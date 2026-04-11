/**
 * PTF — Bankin' Scraper Bookmarklet (Phase 1: CSV Export)
 *
 * Run this on app.bankin.com to scrape all account balances and
 * download a CSV ready for review and PTF import.
 *
 * Parsing algorithm mirrors src/lib/import/parseBankinText.ts
 * Mapping keys match src/lib/import/bankinMapping.ts (mappingKey())
 */
(function () {
  'use strict';

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
    var state = 'SEEK_ACCOUNT'; // or 'SEEK_AMOUNT'

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
        if (!isAmount) {
          pendingName = line;
          state = 'SEEK_AMOUNT';
        }
        continue;
      }

      // state === SEEK_AMOUNT
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

  // ── CSV builder ──────────────────────────────────────────────────

  function toCSV(items, quarter) {
    var rows = ['quarter,section,account,balance,currency,mapping_key'];
    items.forEach(function (it) {
      var row = [
        quarter,
        '"' + it.section.replace(/"/g, '""') + '"',
        '"' + it.account.replace(/"/g, '""') + '"',
        it.balance,
        it.currency,
        '"' + it.mappingKey.replace(/"/g, '""') + '"',
      ];
      rows.push(row.join(','));
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

  function showToast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
      'background:#10b981', 'color:#fff', 'font:600 14px/1.4 system-ui,sans-serif',
      'padding:10px 18px', 'border-radius:8px', 'box-shadow:0 4px 16px rgba(0,0,0,.3)',
      'pointer-events:none', 'transition:opacity .4s',
    ].join(';');
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; }, 2600);
    setTimeout(function () { t.parentNode && t.parentNode.removeChild(t); }, 3000);
  }

  // ── Dialog ───────────────────────────────────────────────────────

  function removeExisting() {
    var old = document.getElementById('ptf-bookmarklet-dialog');
    if (old) old.parentNode.removeChild(old);
  }

  function showDialog(items) {
    removeExisting();

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'ptf-bookmarklet-dialog';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483646',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,.5)', 'font-family:system-ui,sans-serif',
    ].join(';');

    // Card
    var card = document.createElement('div');
    card.style.cssText = [
      'background:#12121a', 'border:1px solid #1e1e2e', 'border-radius:12px',
      'padding:24px', 'width:320px', 'box-shadow:0 8px 32px rgba(0,0,0,.5)',
      'color:#e8e8f0',
    ].join(';');

    // Title
    var title = document.createElement('div');
    title.textContent = 'PTF — Export Bankin\u2019 data';
    title.style.cssText = 'font-size:15px;font-weight:700;margin-bottom:4px;';
    card.appendChild(title);

    // Subtitle
    var sub = document.createElement('div');
    sub.textContent = items.length + ' account' + (items.length !== 1 ? 's' : '') + ' found';
    sub.style.cssText = 'font-size:12px;color:#6b7280;margin-bottom:16px;';
    card.appendChild(sub);

    // Quarter label
    var lbl = document.createElement('label');
    lbl.textContent = 'Quarter';
    lbl.style.cssText = 'display:block;font-size:12px;color:#9ca3af;margin-bottom:6px;';
    card.appendChild(lbl);

    // Quarter input
    var input = document.createElement('input');
    input.type = 'text';
    input.value = currentQuarter();
    input.placeholder = 'e.g. 2026-Q2';
    input.style.cssText = [
      'width:100%', 'box-sizing:border-box', 'background:#0a0a0f',
      'border:1px solid #1e1e2e', 'border-radius:6px', 'padding:8px 12px',
      'color:#fff', 'font-size:14px', 'outline:none', 'margin-bottom:6px',
    ].join(';');
    card.appendChild(input);

    // Validation hint
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#ef4444;margin-bottom:14px;min-height:16px;';
    card.appendChild(hint);

    input.addEventListener('input', function () {
      hint.textContent = isValidQuarter(input.value) ? '' : 'Format must be YYYY-Q1 to YYYY-Q4';
    });

    // Buttons row
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';

    var btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    btnCancel.style.cssText = [
      'flex:1', 'padding:8px', 'border-radius:6px', 'border:1px solid #1e1e2e',
      'background:transparent', 'color:#9ca3af', 'font-size:13px', 'cursor:pointer',
    ].join(';');
    btnCancel.onclick = removeExisting;

    var btnDownload = document.createElement('button');
    btnDownload.textContent = '\u2193 Download CSV';
    btnDownload.style.cssText = [
      'flex:2', 'padding:8px', 'border-radius:6px', 'border:none',
      'background:#6366f1', 'color:#fff', 'font-size:13px',
      'font-weight:600', 'cursor:pointer',
    ].join(';');
    btnDownload.onclick = function () {
      var q = input.value.trim();
      if (!isValidQuarter(q)) {
        hint.textContent = 'Format must be YYYY-Q1 to YYYY-Q4';
        return;
      }
      downloadCSV(toCSV(items, q), q);
      removeExisting();
      showToast('\u2713 ' + items.length + ' accounts \u2014 bankin_' + q + '.csv');
    };

    row.appendChild(btnCancel);
    row.appendChild(btnDownload);
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
    alert('PTF Bookmarklet: no account data found.\nMake sure you are on the Bankin\u2019 accounts page with balances visible.');
    return;
  }
  showDialog(items);

})();
