-- ============================================================
-- PTF Seed — Portfolio import
-- User: admin@ptf.local (ec090416-28b7-4647-9994-19dba860eef0)
-- ============================================================

DO $$
DECLARE
  v_user_id   uuid := 'ec090416-28b7-4647-9994-19dba860eef0';
  v_pea_id    uuid := gen_random_uuid();
  v_cto_id    uuid := gen_random_uuid();

  -- Asset IDs
  v_lvmh      uuid := gen_random_uuid();
  v_panx      uuid := gen_random_uuid();
  v_peadyn    uuid := gen_random_uuid();
  v_tte       uuid := gen_random_uuid();
  v_asml      uuid := gen_random_uuid();
  v_amzn      uuid := gen_random_uuid();
  v_mse       uuid := gen_random_uuid();
  v_cap       uuid := gen_random_uuid();
  v_cspx      uuid := gen_random_uuid();
  v_sgo       uuid := gen_random_uuid();
  v_race      uuid := gen_random_uuid();

BEGIN

-- ── Portfolios ────────────────────────────────────────────────
INSERT INTO portfolios (id, user_id, name, type, base_currency, accounting_method)
VALUES
  (v_pea_id, v_user_id, 'PEA', 'PEA', 'EUR', 'PRU'),
  (v_cto_id, v_user_id, 'CTO', 'CTO', 'EUR', 'PRU');

-- ── Assets ───────────────────────────────────────────────────
INSERT INTO assets (id, name, asset_type, currency) VALUES
  (v_lvmh,   'LVMH Moet Hennessy Louis Vuitton SE',         'stock', 'EUR'),
  (v_panx,   'Amundi PEA US Tech Screened UCITS ETF Acc',   'etf',   'EUR'),
  (v_peadyn, 'PEA Dynamic',                                 'etf',   'EUR'),
  (v_tte,    'TotalEnergies SE',                            'stock', 'EUR'),
  (v_asml,   'ASML Holding NV',                             'stock', 'EUR'),
  (v_amzn,   'Amazon.com Inc',                              'stock', 'USD'),
  (v_mse,    'Amundi EURO STOXX 50 II UCITS ETF Acc',       'etf',   'EUR'),
  (v_cap,    'Capgemini SE',                                'stock', 'EUR'),
  (v_cspx,   'iShares Core S&P 500 UCITS ETF USD (Acc)',    'etf',   'USD'),
  (v_sgo,    'Compagnie de Saint-Gobain SA',                'stock', 'EUR'),
  (v_race,   'Ferrari NV',                                  'stock', 'EUR');

-- ── Asset identifiers ────────────────────────────────────────
INSERT INTO asset_identifiers (asset_id, type, value) VALUES
  -- LVMH
  (v_lvmh,   'ISIN',         'FR0000121014'),
  (v_lvmh,   'GOOGLE_SYMBOL','EPA:MC'),
  (v_lvmh,   'TICKER',       'MC'),
  -- Amundi PEA US Tech
  (v_panx,   'ISIN',         'FR0013412269'),
  (v_panx,   'GOOGLE_SYMBOL','EPA:PANX'),
  (v_panx,   'TICKER',       'PANX'),
  -- PEA Dynamic (no Google symbol)
  (v_peadyn, 'ISIN',         'FR001400AEJ2'),
  -- TotalEnergies
  (v_tte,    'ISIN',         'FR0000120271'),
  (v_tte,    'GOOGLE_SYMBOL','EPA:TTE'),
  (v_tte,    'TICKER',       'TTE'),
  -- ASML
  (v_asml,   'ISIN',         'NL0010273215'),
  (v_asml,   'GOOGLE_SYMBOL','AMS:ASML'),
  (v_asml,   'TICKER',       'ASML'),
  -- Amazon
  (v_amzn,   'ISIN',         'US0231351067'),
  (v_amzn,   'GOOGLE_SYMBOL','NASDAQ:AMZN'),
  (v_amzn,   'TICKER',       'AMZN'),
  -- Amundi Euro Stoxx 50
  (v_mse,    'ISIN',         'FR0007054358'),
  (v_mse,    'GOOGLE_SYMBOL','EPA:MSE'),
  (v_mse,    'TICKER',       'MSE'),
  -- Capgemini
  (v_cap,    'ISIN',         'FR0000125338'),
  (v_cap,    'GOOGLE_SYMBOL','EPA:CAP'),
  (v_cap,    'TICKER',       'CAP'),
  -- iShares Core S&P 500
  (v_cspx,   'ISIN',         'IE00B5BMR087'),
  (v_cspx,   'GOOGLE_SYMBOL','LON:CSPX'),
  (v_cspx,   'TICKER',       'CSPX'),
  -- Saint-Gobain
  (v_sgo,    'ISIN',         'FR0000125007'),
  (v_sgo,    'GOOGLE_SYMBOL','EPA:SGO'),
  (v_sgo,    'TICKER',       'SGO'),
  -- Ferrari
  (v_race,   'ISIN',         'NL0011585146'),
  (v_race,   'GOOGLE_SYMBOL','BIT:RACE'),
  (v_race,   'TICKER',       'RACE');

-- ── Transactions (BUY) ───────────────────────────────────────
-- PRU = average cost per share as entered; fees = 0 (not provided)
INSERT INTO transactions (portfolio_id, asset_id, type, quantity, price, fees, currency, date) VALUES
  -- PEA
  (v_pea_id, v_lvmh,   'BUY', 1,      864.86, 0, 'EUR', '2024-02-29'),
  (v_pea_id, v_panx,   'BUY', 40,     51.03,  0, 'EUR', '2024-04-15'),
  (v_pea_id, v_peadyn, 'BUY', 19.048, 105.00, 0, 'EUR', '2024-01-01'),
  (v_pea_id, v_tte,    'BUY', 35,     56.03,  0, 'EUR', '2025-12-31'),
  -- ASML has no portfolio label in source → assigned to CTO
  (v_cto_id, v_asml,   'BUY', 2,      1021.28,0, 'EUR', '2025-01-08'),
  -- CTO
  (v_cto_id, v_amzn,   'BUY', 20,     137.28, 0, 'USD', '2024-01-01'),
  (v_cto_id, v_mse,    'BUY', 40,     28.20,  0, 'EUR', '2024-01-01'),
  (v_cto_id, v_cap,    'BUY', 10,     83.41,  0, 'EUR', '2024-01-01'),
  (v_cto_id, v_cspx,   'BUY', 4,      502.28, 0, 'USD', '2024-05-06'),
  (v_cto_id, v_sgo,    'BUY', 25,     48.26,  0, 'EUR', '2024-01-01'),
  (v_cto_id, v_race,   'BUY', 2,      440.07, 0, 'EUR', '2024-10-14');

END $$;
