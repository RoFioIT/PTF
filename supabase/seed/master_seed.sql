-- ============================================================
-- PTF Master Seed — Portfolios, Assets, Transactions,
--                   Dividends, Cash Movements, Share Grants
-- User UUID: b32a689f-bf4e-48ad-8ada-999e98060684
-- Run AFTER all 6 migrations. Run BEFORE cash_accounts_seed.sql.
-- ============================================================

DO $$
DECLARE
  v_uid uuid := 'b32a689f-bf4e-48ad-8ada-999e98060684';

  -- Portfolio IDs
  v_pea_id uuid := gen_random_uuid();
  v_cto_id uuid := gen_random_uuid();
  v_adm_id uuid := gen_random_uuid();

  -- Asset IDs
  v_adm    uuid;   -- looked up from migration 004
  v_lvmh   uuid := gen_random_uuid();
  v_panx   uuid := gen_random_uuid();
  v_peadyn uuid := gen_random_uuid();
  v_tte    uuid := gen_random_uuid();
  v_asml   uuid := gen_random_uuid();
  v_amzn   uuid := gen_random_uuid();
  v_mse    uuid := gen_random_uuid();
  v_cap    uuid := gen_random_uuid();
  v_cspx   uuid := gen_random_uuid();
  v_sgo    uuid := gen_random_uuid();
  v_race   uuid := gen_random_uuid();

BEGIN

  -- ── Portfolios ──────────────────────────────────────────────
  INSERT INTO portfolios (id, user_id, name, type, base_currency, accounting_method) VALUES
    (v_pea_id, v_uid, 'PEA', 'PEA', 'EUR', 'PRU'),
    (v_cto_id, v_uid, 'CT0', 'CTO', 'EUR', 'PRU'),
    (v_adm_id, v_uid, 'ADM', 'ADM', 'EUR', 'PRU');

  -- ── Assets ─────────────────────────────────────────────────
  INSERT INTO assets (id, name, asset_type, currency, country) VALUES
    (v_lvmh,   'LVMH Moet Hennessy Louis Vuitton SE',       'stock', 'EUR', 'FR'),
    (v_panx,   'Amundi PEA US Tech Screened UCITS ETF Acc', 'etf',   'EUR', 'FR'),
    (v_peadyn, 'PEA Dynamic',                               'other', 'EUR', 'FR'),
    (v_tte,    'TotalEnergies SE',                          'stock', 'EUR', 'FR'),
    (v_asml,   'ASML Holding NV',                           'stock', 'EUR', 'NL'),
    (v_amzn,   'Amazon.com Inc',                            'stock', 'USD', 'US'),
    (v_mse,    'Amundi EURO STOXX 50 II UCITS ETF Acc',     'etf',   'EUR', 'FR'),
    (v_cap,    'Capgemini SE',                              'stock', 'EUR', 'FR'),
    (v_cspx,   'iShares Core S&P 500 UCITS ETF USD (Acc)',  'etf',   'USD', 'IE'),
    (v_sgo,    'Compagnie de Saint Gobain SA',              'stock', 'EUR', 'FR'),
    (v_race,   'Ferrari NV',                                'stock', 'EUR', 'NL');

  -- ── Asset identifiers ───────────────────────────────────────
  INSERT INTO asset_identifiers (asset_id, type, value) VALUES
    (v_lvmh,   'ISIN',          'FR0000121014'),
    (v_lvmh,   'GOOGLE_SYMBOL', 'EPA:MC'),
    (v_panx,   'ISIN',          'FR0013412269'),
    (v_panx,   'GOOGLE_SYMBOL', 'EPA:PANX'),
    (v_peadyn, 'ISIN',          'FR001400AEJ2'),
    (v_peadyn, 'BOURSORAMA',    '0P0001PRAT'),
    (v_tte,    'ISIN',          'FR0000120271'),
    (v_tte,    'GOOGLE_SYMBOL', 'EPA:TTE'),
    (v_asml,   'ISIN',          'NL0010273215'),
    (v_asml,   'GOOGLE_SYMBOL', 'AMS:ASML'),
    (v_amzn,   'ISIN',          'US0231351067'),
    (v_amzn,   'GOOGLE_SYMBOL', 'NASDAQ:AMZN'),
    (v_mse,    'ISIN',          'FR0007054358'),
    (v_mse,    'GOOGLE_SYMBOL', 'EPA:MSE'),
    (v_cap,    'ISIN',          'FR0000125338'),
    (v_cap,    'GOOGLE_SYMBOL', 'EPA:CAP'),
    (v_cspx,   'ISIN',          'IE00B5BMR087'),
    (v_cspx,   'GOOGLE_SYMBOL', 'LON:CSPX'),
    (v_sgo,    'ISIN',          'FR0000125007'),
    (v_sgo,    'GOOGLE_SYMBOL', 'EPA:SGO'),
    (v_race,   'ISIN',          'NL0011585146'),
    (v_race,   'GOOGLE_SYMBOL', 'BIT:RACE');

  -- ── ADM asset (created by migration 004) ────────────────────
  SELECT id INTO v_adm FROM assets WHERE name = 'ADM Shares' LIMIT 1;
  INSERT INTO asset_identifiers (asset_id, type, value)
    VALUES (v_adm, 'GOOGLE_SYMBOL', 'LON:ADM') ON CONFLICT DO NOTHING;

  -- ── Transactions ────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, asset_id, type, quantity, price, fees, currency, date) VALUES
    -- PEA
    (v_pea_id, v_peadyn, 'BUY', 19.048, 105.00,   0, 'EUR', '2024-01-01'),
    (v_pea_id, v_lvmh,   'BUY', 1,      864.86,   0, 'EUR', '2024-02-29'),
    (v_pea_id, v_panx,   'BUY', 40,     51.03,    0, 'EUR', '2024-04-15'),
    (v_pea_id, v_asml,   'BUY', 2,      1021.28,  0, 'EUR', '2025-01-08'),
    (v_pea_id, v_tte,    'BUY', 35,     56.03,    0, 'EUR', '2025-12-31'),
    -- CTO
    (v_cto_id, v_amzn,   'BUY', 20,     137.28,   0, 'EUR', '2024-01-01'),
    (v_cto_id, v_sgo,    'BUY', 25,     48.26,    0, 'EUR', '2024-01-01'),
    (v_cto_id, v_cap,    'BUY', 10,     83.41,    0, 'EUR', '2024-01-01'),
    (v_cto_id, v_mse,    'BUY', 40,     28.20,    0, 'EUR', '2024-01-01'),
    (v_cto_id, v_cspx,   'BUY', 4,      502.28,   0, 'EUR', '2024-05-06'),
    (v_cto_id, v_race,   'BUY', 2,      440.07,   0, 'EUR', '2024-10-14'),
    -- ADM (vested grants)
    (v_adm_id, v_adm,    'BUY', 250,    0,        0, 'GBP', '2026-04-02'),  -- DFSS 100% vesting
    (v_adm_id, v_adm,    'BUY', 195,    0,        0, 'GBP', '2026-04-02');  -- DFSS 78% vesting

  -- ── Dividends ───────────────────────────────────────────────
  INSERT INTO dividends (portfolio_id, asset_id, amount, tax, currency, date, notes) VALUES
    -- LVMH (PEA)
    (v_pea_id, v_lvmh,   7.50,  0,      'EUR', '2024-04-23', 'Imported from Yahoo Finance — 1 share × €7.5/share'),
    (v_pea_id, v_lvmh,   5.50,  0,      'EUR', '2024-12-02', 'Imported from Yahoo Finance — 1 share × €5.5/share'),
    (v_pea_id, v_lvmh,   7.50,  0,      'EUR', '2025-04-24', 'Imported from Yahoo Finance — 1 share × €7.5/share'),
    (v_pea_id, v_lvmh,   5.50,  0,      'EUR', '2025-12-02', 'Imported from Yahoo Finance — 1 share × €5.5/share'),
    -- ASML (PEA)
    (v_pea_id, v_asml,   3.04,  0,      'EUR', '2025-02-10', 'Imported from Yahoo Finance — 2 shares × €1.52/share'),
    (v_pea_id, v_asml,   3.68,  0,      'EUR', '2025-04-25', 'Imported from Yahoo Finance — 2 shares × €1.84/share'),
    (v_pea_id, v_asml,   3.20,  0,      'EUR', '2025-07-28', 'Imported from Yahoo Finance — 2 shares × €1.6/share'),
    (v_pea_id, v_asml,   3.20,  0,      'EUR', '2025-10-28', 'Imported from Yahoo Finance — 2 shares × €1.6/share'),
    (v_pea_id, v_asml,   3.20,  0,      'EUR', '2026-02-09', 'Imported from Yahoo Finance — 2 shares × €1.6/share'),
    -- TotalEnergies (PEA)
    (v_pea_id, v_tte,    29.75, 0,      'EUR', '2025-12-31', 'Imported from Yahoo Finance — 35 shares × €0.85/share'),
    (v_pea_id, v_tte,    29.75, 0,      'EUR', '2026-03-31', 'Imported from Yahoo Finance — 35 shares × €0.85/share'),
    -- Capgemini (CTO)
    (v_cto_id, v_cap,    34.00, 10.20,  'EUR', '2024-05-29', 'Imported from Yahoo Finance — 10 shares × €3.4/share'),
    (v_cto_id, v_cap,    34.00, 10.20,  'EUR', '2025-05-20', 'Imported from Yahoo Finance — 10 shares × €3.4/share'),
    -- Saint-Gobain (CTO)
    (v_cto_id, v_sgo,    52.50, 15.75,  'EUR', '2024-06-10', 'Imported from Yahoo Finance — 25 shares × €2.1/share'),
    (v_cto_id, v_sgo,    55.00, 16.50,  'EUR', '2025-06-09', 'Imported from Yahoo Finance — 25 shares × €2.2/share'),
    -- Ferrari (CTO)
    (v_cto_id, v_race,   5.972, 1.7916, 'EUR', '2025-04-22', 'Imported from Yahoo Finance — 2 shares × €2.986/share');

  -- ── Cash Movements ──────────────────────────────────────────
  INSERT INTO cash_movements (portfolio_id, type, amount, currency, date, notes) VALUES
    (v_pea_id, 'DEPOSIT', 5100.00, 'EUR', '2024-01-01', 'Open balance'),
    (v_pea_id, 'DEPOSIT', 2000.00, 'EUR', '2025-12-30', null),
    (v_pea_id, 'DEPOSIT', 2000.00, 'EUR', '2026-01-08', null),
    (v_cto_id, 'DEPOSIT', 8694.00, 'EUR', '2024-01-01', null),
    (v_cto_id, 'DEPOSIT',  942.76, 'EUR', '2024-01-01', null),
    (v_cto_id, 'DEPOSIT', 2000.00, 'EUR', '2026-01-07', null);

  -- ── Share Grants (ADM) ──────────────────────────────────────
  INSERT INTO share_grants (portfolio_id, asset_id, share_type, grant_date, vesting_date, granted_quantity, vesting_pct, status) VALUES
    (v_adm_id, v_adm, 'DFSS', '2022-09-22', '2025-09-22',  250, 78,   'vested'),
    (v_adm_id, v_adm, 'DFSS', '2022-09-22', '2025-09-22',  250, 100,  'vested'),
    (v_adm_id, v_adm, 'AFSS', '2023-08-21', '2026-08-21',   77, null, 'unvested'),
    (v_adm_id, v_adm, 'DFSS', '2023-09-28', '2026-09-28', 1000, null, 'unvested'),
    (v_adm_id, v_adm, 'DFSS', '2023-09-28', '2026-09-28', 1000, null, 'unvested'),
    (v_adm_id, v_adm, 'AFSS', '2024-03-11', '2027-03-11',   69, null, 'unvested'),
    (v_adm_id, v_adm, 'AFSS', '2024-08-20', '2027-08-20',   62, null, 'unvested'),
    (v_adm_id, v_adm, 'DFSS', '2024-10-01', '2027-10-01', 1250, null, 'unvested'),
    (v_adm_id, v_adm, 'DFSS', '2024-10-01', '2027-10-01', 1250, null, 'unvested'),
    (v_adm_id, v_adm, 'AFSS', '2025-03-13', '2028-03-13',   59, null, 'unvested'),
    (v_adm_id, v_adm, 'AFSS', '2025-08-21', '2028-08-21',   50, null, 'unvested'),
    (v_adm_id, v_adm, 'DFSS', '2025-09-10', '2028-09-10', 1250, null, 'unvested'),
    (v_adm_id, v_adm, 'DFSS', '2025-09-10', '2028-09-10', 1250, null, 'unvested');

  RAISE NOTICE 'Master seed completed.';
END;
$$;
