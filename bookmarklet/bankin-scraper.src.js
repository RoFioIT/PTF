/**
 * PTF — Bankin' Scraper Bookmarklet (Phase 2: Direct Sync)
 *
 * Run this on app.bankin.com to scrape account balances and:
 *   • Sync them directly to your PTF app (primary)
 *   • Or download a CSV for manual review
 *
 * First use: click "Configure" and paste your PTF sync config
 * (copy it from PTF → Cash Accounts → Mapping → "Copy sync config")
 *
 * Config is stored in localStorage on app.bankin.com.
 * Tokens auto-refresh when expired.
 */
(function () {
  'use strict';

  var CONFIG_KEY = 'ptf_bookmarklet_config';

  // ── Parser (mirrors parseBankinText.ts) ─────────────────────────

  var AMOUNT_RE = /^\s*[\d\s\u202f]+(?:,\d{1,2})?\s*[€E]\s*>?\s*$/;

  function isSectionHeader(line) {
    var trimmed = line.trim();
    if (trimmed.length <= 2) return false;
    if (/\d/.test(trimmed)) return false;
    var letters = trimmed.replace(/[\s'\-.]/g, '');
    if (letters.length === 0) return false;
    return letters === letters.toUpperCase() && /[A-Z]/.test(letters);
  }

  function parseAmount(line) {
    var s = line.replace(/[€E>]/g, '');
    s = s.replace(/[\s\u202f\u00a0]/g, '');
    s = s.replace(',', '.');
    return parseFloat(s);
  }

  function scrape() {
    var raw = document.body.innerText;
    var lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length >= 2; });
    var items = [];
    var currentSection = '';
    var pendingName = '';
    var state = 'SEEK_ACCOUNT';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var isAmount = AMOUNT_RE.test(line);
      var isHeader = isSectionHeader(line);

      if (isHeader) {
        currentSection = line.trim();
        state = 'SEEK_ACCOUNT';
        pendingName = '';
        continue;
      }

      if (state === 'SEEK_ACCOUNT') {
        if (!isAmount) { pendingName = line; state = 'SEEK_AMOUNT'; }
        continue;
      }

      if (isAmount) {
        var amount = parseAmount(line);
        if (!isNaN(amount) && pendingName.length > 0) {
          items.push({
            section: currentSection,
            account: pendingName,
            balance: amount,
            currency: 'EUR',
            mappingKey: currentSection.toUpperCase().trim() + '::' + pendingName.toLowerCase().trim(),
          });
        }
        pendingName = '';
        state = 'SEEK_ACCOUNT';
      } else {
        pendingName = line;
      }
    }
    return items;
  }

  // ── Quarter helpers ──────────────────────────────────────────────

  function currentQuarter() {
    var now = new Date();
    var q = Math.ceil((now.getMonth() + 1) / 3);
    return now.getFullYear() + '-Q' + q;
  }

  function isValidQuarter(s) {
    return /^\d{4}-Q[1-4]$/.test(s.trim());
  }

  // ── Config storage ───────────────────────────────────────────────

  function loadConfig() {
    try {
      var raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveConfig(cfg) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  // ── Token refresh ────────────────────────────────────────────────

  function refreshToken(cfg, callback) {
    var url = cfg.ptfUrl.replace(/\/$/, '');
    // Derive Supabase URL from PTF URL via the anon key (we stored it in config)
    // Call Supabase token refresh directly using stored anonKey
    var supabaseUrl = cfg.supabaseUrl || '';
    if (!supabaseUrl) {
      callback(null, 'No Supabase URL in config — re-copy sync config from PTF');
      return;
    }
    fetch(supabaseUrl + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.anonKey,
      },
      body: JSON.stringify({ refresh_token: cfg.refreshToken }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.access_token) {
          cfg.accessToken = data.access_token;
          if (data.refresh_token) cfg.refreshToken = data.refresh_token;
          saveConfig(cfg);
          callback(cfg, null);
        } else {
          callback(null, 'Token refresh failed — re-copy sync config from PTF');
        }
      })
      .catch(function (e) { callback(null, e.message); });
  }

  // ── Sync to PTF ──────────────────────────────────────────────────

  function syncToPTF(cfg, items, quarter, onResult) {
    var url = cfg.ptfUrl.replace(/\/$/, '') + '/api/cash-accounts/bookmarklet';
    var payload = {
      quarter: quarter,
      accounts: items.map(function (it) {
        return { mappingKey: it.mappingKey, balance: it.balance, currency: it.currency };
      }),
    };

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.accessToken,
      },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (data) { return { status: r.status, data: data }; });
      })
      .then(function (res) {
        if (res.status === 401) {
          // Try token refresh once
          refreshToken(cfg, function (newCfg, err) {
            if (err) { onResult(null, err); return; }
            syncToPTF(newCfg, items, quarter, onResult);
          });
          return;
        }
        if (!res.data.ok) {
          onResult(null, res.data.error || 'Sync failed');
          return;
        }
        onResult(res.data, null);
      })
      .catch(function (e) { onResult(null, e.message); });
  }

  // ── CSV download (fallback) ──────────────────────────────────────

  function toCSV(items, quarter) {
    var rows = ['quarter,section,account,balance,currency,mapping_key'];
    items.forEach(function (it) {
      rows.push([
        quarter,
        '"' + it.section.replace(/"/g, '""') + '"',
        '"' + it.account.replace(/"/g, '""') + '"',
        it.balance,
        it.currency,
        '"' + it.mappingKey.replace(/"/g, '""') + '"',
      ].join(','));
    });
    return rows.join('\n');
  }

  function downloadCSV(csv, quarter) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bankin_' + quarter + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Toast ────────────────────────────────────────────────────────

  function showToast(msg, isError) {
    var t = document.createElement('div');
    t.innerHTML = msg;
    t.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
      'background:' + (isError ? '#ef4444' : '#10b981'),
      'color:#fff', 'font:600 13px/1.5 system-ui,sans-serif',
      'padding:10px 18px', 'border-radius:8px', 'box-shadow:0 4px 16px rgba(0,0,0,.3)',
      'pointer-events:none', 'transition:opacity .4s', 'max-width:340px',
    ].join(';');
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; }, 3500);
    setTimeout(function () { t.parentNode && t.parentNode.removeChild(t); }, 4000);
  }

  // ── Styles ───────────────────────────────────────────────────────

  var S = {
    overlay: 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font-family:system-ui,sans-serif',
    card: 'background:#12121a;border:1px solid #1e1e2e;border-radius:14px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.6);color:#e8e8f0',
    title: 'font-size:15px;font-weight:700;margin-bottom:4px',
    sub: 'font-size:12px;color:#6b7280;margin-bottom:18px',
    label: 'display:block;font-size:12px;color:#9ca3af;margin-bottom:6px',
    input: 'width:100%;box-sizing:border-box;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:6px;padding:8px 12px;color:#fff;font-size:14px;outline:none;margin-bottom:6px',
    hint: 'font-size:11px;color:#ef4444;margin-bottom:14px;min-height:16px',
    row: 'display:flex;gap:8px;margin-top:4px',
    btnCancel: 'flex:1;padding:8px;border-radius:6px;border:1px solid #1e1e2e;background:transparent;color:#9ca3af;font-size:13px;cursor:pointer',
    btnPrimary: 'flex:2;padding:8px;border-radius:6px;border:none;background:#6366f1;color:#fff;font-size:13px;font-weight:600;cursor:pointer',
    btnSecondary: 'flex:1;padding:8px;border-radius:6px;border:1px solid #374151;background:transparent;color:#9ca3af;font-size:13px;cursor:pointer',
    btnLink: 'background:none;border:none;color:#6366f1;font-size:12px;cursor:pointer;padding:0;text-decoration:underline',
    textarea: 'width:100%;box-sizing:border-box;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:6px;padding:8px 12px;color:#fff;font-size:12px;font-family:monospace;outline:none;resize:vertical;min-height:80px',
    status: 'font-size:12px;min-height:18px;margin-top:8px;text-align:center',
  };

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ── Dialog helpers ───────────────────────────────────────────────

  function removeExisting() {
    var old = document.getElementById('ptf-bookmarklet');
    if (old) old.parentNode.removeChild(old);
  }

  // ── Config setup dialog (first time) ────────────────────────────

  function showConfigDialog(onSaved) {
    removeExisting();

    var overlay = el('div', S.overlay); overlay.id = 'ptf-bookmarklet';
    var card = el('div', S.card);

    card.appendChild(el('div', S.title, 'PTF — First-time setup'));
    card.appendChild(el('div', S.sub, 'In the PTF app, go to Cash Accounts → Mapping → "Copy sync config", then paste it below.'));

    var lbl = el('label', S.label, 'Sync config JSON');
    card.appendChild(lbl);

    var ta = el('textarea', S.textarea);
    ta.placeholder = '{"ptfUrl":"https://...","anonKey":"...","accessToken":"...","refreshToken":"..."}';
    card.appendChild(ta);

    var hint = el('div', S.hint);
    card.appendChild(hint);

    var row = el('div', S.row);
    var btnCancel = el('button', S.btnCancel, 'Cancel');
    btnCancel.onclick = removeExisting;

    var btnSave = el('button', S.btnPrimary, 'Save & continue');
    btnSave.onclick = function () {
      hint.textContent = '';
      var raw = ta.value.trim();
      if (!raw) { hint.textContent = 'Paste your sync config JSON'; return; }
      try {
        var cfg = JSON.parse(raw);
        if (!cfg.ptfUrl || !cfg.accessToken || !cfg.refreshToken || !cfg.anonKey) {
          throw new Error('Missing required fields');
        }
        // Derive Supabase URL from anonKey issuer — store a default
        // We'll infer it on token refresh; for now store as-is
        cfg.supabaseUrl = cfg.supabaseUrl || 'https://enpdtuunxsqxyjjhizga.supabase.co';
        saveConfig(cfg);
        removeExisting();
        onSaved(cfg);
      } catch (e) {
        hint.textContent = 'Invalid JSON — ' + e.message;
      }
    };

    row.appendChild(btnCancel);
    row.appendChild(btnSave);
    card.appendChild(row);

    overlay.appendChild(card);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) removeExisting(); });
    document.body.appendChild(overlay);
    ta.focus();
  }

  // ── Main dialog ──────────────────────────────────────────────────

  function showMainDialog(items, cfg) {
    removeExisting();

    var overlay = el('div', S.overlay); overlay.id = 'ptf-bookmarklet';
    var card = el('div', S.card);

    // Title + reconfigure link
    var titleRow = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px');
    titleRow.appendChild(el('div', S.title, 'PTF — Export Bankin\u2019 data'));
    var btnCfg = el('button', S.btnLink, 'Reconfigure');
    btnCfg.onclick = function () { showConfigDialog(function (newCfg) { showMainDialog(items, newCfg); }); };
    titleRow.appendChild(btnCfg);
    card.appendChild(titleRow);

    card.appendChild(el('div', S.sub, items.length + ' account' + (items.length !== 1 ? 's' : '') + ' found \u2014 ' + (cfg ? cfg.ptfUrl.replace(/https?:\/\//, '') : 'no PTF configured')));

    // Quarter input
    card.appendChild(el('label', S.label, 'Quarter'));
    var input = el('input', S.input);
    input.type = 'text';
    input.value = currentQuarter();
    input.placeholder = 'e.g. 2026-Q2';
    card.appendChild(input);

    var hint = el('div', S.hint);
    card.appendChild(hint);

    input.addEventListener('input', function () {
      hint.textContent = isValidQuarter(input.value) ? '' : 'Format must be YYYY-Q1 to YYYY-Q4';
    });

    // Status line
    var status = el('div', S.status);
    card.appendChild(status);

    // Buttons
    var row = el('div', S.row);

    var btnCancel = el('button', S.btnCancel, 'Cancel');
    btnCancel.onclick = removeExisting;

    var btnCSV = el('button', S.btnSecondary, '\u2193 CSV');
    btnCSV.title = 'Download CSV for manual review';
    btnCSV.onclick = function () {
      var q = input.value.trim();
      if (!isValidQuarter(q)) { hint.textContent = 'Format must be YYYY-Q1 to YYYY-Q4'; return; }
      downloadCSV(toCSV(items, q), q);
      removeExisting();
      showToast('\u2713 ' + items.length + ' accounts \u2014 bankin_' + q + '.csv downloaded');
    };

    var btnSync = el('button', S.btnPrimary, '\u2191 Sync to PTF');
    btnSync.title = 'Push balances directly into your PTF account';
    btnSync.onclick = function () {
      var q = input.value.trim();
      if (!isValidQuarter(q)) { hint.textContent = 'Format must be YYYY-Q1 to YYYY-Q4'; return; }
      if (!cfg) { showConfigDialog(function (newCfg) { showMainDialog(items, newCfg); }); return; }

      btnSync.disabled = true;
      btnCSV.disabled = true;
      btnSync.textContent = 'Syncing\u2026';
      status.style.color = '#9ca3af';
      status.textContent = 'Connecting to PTF\u2026';

      syncToPTF(cfg, items, q, function (result, err) {
        btnSync.disabled = false;
        btnCSV.disabled = false;
        btnSync.textContent = '\u2191 Sync to PTF';
        if (err) {
          status.style.color = '#ef4444';
          status.textContent = '\u26a0 ' + err;
          return;
        }
        var unmappedNote = result.unmapped && result.unmapped.length > 0
          ? ' \u2014 ' + result.unmapped.length + ' unmapped'
          : '';
        removeExisting();
        showToast(
          '\u2713 ' + result.imported + ' imported, ' + result.skipped + ' skipped' + unmappedNote + ' \u2014 ' + q,
          false
        );
        if (result.unmapped && result.unmapped.length > 0) {
          console.warn('[PTF] Unmapped Bankin\u2019 accounts (add them in PTF \u2192 Mapping):', result.unmapped);
        }
      });
    };

    row.appendChild(btnCancel);
    row.appendChild(btnCSV);
    row.appendChild(btnSync);
    card.appendChild(row);

    overlay.appendChild(card);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) removeExisting(); });
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  }

  // ── Entry point ──────────────────────────────────────────────────

  var items = scrape();
  if (items.length === 0) {
    alert('PTF Bookmarklet: no account data found.\nMake sure you are on the Bankin\u2019 accounts page with all balances visible.');
    return;
  }

  var cfg = loadConfig();
  if (!cfg) {
    showConfigDialog(function (newCfg) { showMainDialog(items, newCfg); });
  } else {
    showMainDialog(items, cfg);
  }

})();
