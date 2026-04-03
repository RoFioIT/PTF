WITH
    -- ── PEA Assets ─────────────────────────────────────────────
    ins_mc AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('LVMH Moet Hennessy Louis Vuitton SE', 'stock', 'EUR', 'FR')
      RETURNING id),
    ins_mc_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_mc.id, t.tp::identifier_type, t.v FROM ins_mc
      CROSS JOIN (VALUES ('ISIN','FR0000121014'),('GOOGLE_SYMBOL','EPA:MC')) AS t(tp,v)),

    ins_panx AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('Amundi PEA US Tech Screened UCITS ETF Acc', 'etf', 'EUR', 'FR')
      RETURNING id),
    ins_panx_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_panx.id, t.tp::identifier_type, t.v FROM ins_panx
      CROSS JOIN (VALUES ('ISIN','FR0013412269'),('GOOGLE_SYMBOL','EPA:PANX')) AS t(tp,v)),

    ins_dynamic AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('PEA Dynamic', 'other', 'EUR', 'FR')
      RETURNING id),
    ins_dynamic_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_dynamic.id, t.tp::identifier_type, t.v FROM ins_dynamic
      CROSS JOIN (VALUES ('ISIN','FR001400AEJ2'),('BOURSORAMA','0P0001PRAT')) AS t(tp,v)),

    ins_tte AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('TotalEnergies SE', 'stock', 'EUR', 'FR')
      RETURNING id),
    ins_tte_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_tte.id, t.tp::identifier_type, t.v FROM ins_tte
      CROSS JOIN (VALUES ('ISIN','FR0000120271'),('GOOGLE_SYMBOL','EPA:TTE')) AS t(tp,v)),

    ins_asml AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('ASML Holding NV', 'stock', 'EUR', 'NL')
      RETURNING id),
    ins_asml_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_asml.id, t.tp::identifier_type, t.v FROM ins_asml
      CROSS JOIN (VALUES ('ISIN','NL0010273215'),('GOOGLE_SYMBOL','AMS:ASML')) AS t(tp,v)),

    -- ── CTO Assets ─────────────────────────────────────────────
    ins_amzn AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('Amazon.com Inc', 'stock', 'USD', 'US')
      RETURNING id),
    ins_amzn_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_amzn.id, t.tp::identifier_type, t.v FROM ins_amzn
      CROSS JOIN (VALUES ('ISIN','US0231351067'),('GOOGLE_SYMBOL','NASDAQ:AMZN')) AS t(tp,v)),

    ins_mse AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('Amundi EURO STOXX 50 II UCITS ETF Acc', 'etf', 'EUR', 'FR')
      RETURNING id),
    ins_mse_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_mse.id, t.tp::identifier_type, t.v FROM ins_mse
      CROSS JOIN (VALUES ('ISIN','FR0007054358'),('GOOGLE_SYMBOL','EPA:MSE')) AS t(tp,v)),

    ins_cap AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('Capgemini SE', 'stock', 'EUR', 'FR')
      RETURNING id),
    ins_cap_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_cap.id, t.tp::identifier_type, t.v FROM ins_cap
      CROSS JOIN (VALUES ('ISIN','FR0000125338'),('GOOGLE_SYMBOL','EPA:CAP')) AS t(tp,v)),

    ins_cspx AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('iShares Core S&P 500 UCITS ETF USD (Acc)', 'etf', 'USD', 'IE')
      RETURNING id),
    ins_cspx_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_cspx.id, t.tp::identifier_type, t.v FROM ins_cspx
      CROSS JOIN (VALUES ('ISIN','IE00B5BMR087'),('GOOGLE_SYMBOL','LON:CSPX')) AS t(tp,v)),

    ins_sgo AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('Compagnie de Saint Gobain SA', 'stock', 'EUR', 'FR')
      RETURNING id),
    ins_sgo_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_sgo.id, t.tp::identifier_type, t.v FROM ins_sgo
      CROSS JOIN (VALUES ('ISIN','FR0000125007'),('GOOGLE_SYMBOL','EPA:SGO')) AS t(tp,v)),

    ins_race AS (
      INSERT INTO assets (name, asset_type, currency, country)
      VALUES ('Ferrari NV', 'stock', 'EUR', 'NL')
      RETURNING id),
    ins_race_ids AS (
      INSERT INTO asset_identifiers (asset_id, type, value)
      SELECT ins_race.id, t.tp::identifier_type, t.v FROM ins_race
      CROSS JOIN (VALUES ('ISIN','NL0011585146'),('GOOGLE_SYMBOL','BIT:RACE')) AS t(tp,v)),

    -- ── Transactions ───────────────────────────────────────────
    pea AS (SELECT id FROM portfolios WHERE type = 'PEA' LIMIT 1),
    cto AS (SELECT id FROM portfolios WHERE type = 'CTO' LIMIT 1),

    ins_txs AS (
      
INSERT INTO transactions (portfolio_id, asset_id, type, quantity, price, fees, currency, date)
SELECT pea.id, ins_mc.id,      'BUY'::transaction_type, 1,      864.86,  0, 'EUR', '2024-02-29'::date FROM pea, ins_mc      UNION ALL
SELECT pea.id, ins_panx.id,    'BUY'::transaction_type, 40,     51.03,   0, 'EUR', '2024-04-15'::date FROM pea, ins_panx    UNION ALL
SELECT pea.id, ins_dynamic.id, 'BUY'::transaction_type, 19.048, 105.00,  0, 'EUR', '2024-01-01'::date FROM pea, ins_dynamic UNION ALL
SELECT pea.id, ins_tte.id,     'BUY'::transaction_type, 35,     56.03,   0, 'EUR', '2025-12-31'::date FROM pea, ins_tte     UNION ALL
SELECT pea.id, ins_asml.id,    'BUY'::transaction_type, 2,      1021.28, 0, 'EUR', '2025-01-08'::date FROM pea, ins_asml    UNION ALL
SELECT cto.id, ins_amzn.id,    'BUY'::transaction_type, 20,     137.28,  0, 'EUR', '2024-01-01'::date FROM cto, ins_amzn    UNION ALL
SELECT cto.id, ins_mse.id,     'BUY'::transaction_type, 40,     28.20,   0, 'EUR', '2024-01-01'::date FROM cto, ins_mse     UNION ALL
SELECT cto.id, ins_cap.id,     'BUY'::transaction_type, 10,     83.41,   0, 'EUR', '2024-01-01'::date FROM cto, ins_cap     UNION ALL
SELECT cto.id, ins_cspx.id,    'BUY'::transaction_type, 4,      502.28,  0, 'EUR', '2024-05-06'::date FROM cto, ins_cspx    UNION ALL
SELECT cto.id, ins_sgo.id,     'BUY'::transaction_type, 25,     48.26,   0, 'EUR', '2024-01-01'::date FROM cto, ins_sgo     UNION ALL
SELECT cto.id, ins_race.id,    'BUY'::transaction_type, 2,      440.07,  0, 'EUR', '2024-10-14'::date FROM cto, ins_race
    )

SELECT '11 assets · 22 identifiers · 11 transactions imported' AS result;