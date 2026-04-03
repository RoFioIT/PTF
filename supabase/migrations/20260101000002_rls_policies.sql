-- ============================================================
-- PTF Portfolio Tracker — RLS Policies Migration 002
-- ============================================================
-- Security model:
--   · portfolios, transactions, dividends, cash_movements
--     are USER-PRIVATE → strict user_id / portfolio ownership check
--   · assets, asset_identifiers, asset_prices
--     are SHARED READ-ONLY for authenticated users
--     (writes are performed by a trusted service role / admin only)
-- ============================================================

-- ── PORTFOLIOS ──────────────────────────────────────────────
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolios: users can SELECT their own"
  ON portfolios FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "portfolios: users can INSERT their own"
  ON portfolios FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "portfolios: users can UPDATE their own"
  ON portfolios FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "portfolios: users can DELETE their own"
  ON portfolios FOR DELETE
  USING (user_id = auth.uid());

-- ── TRANSACTIONS ─────────────────────────────────────────────
-- Ownership is inferred through the parent portfolio.
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: users can SELECT via portfolio"
  ON transactions FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "transactions: users can INSERT via portfolio"
  ON transactions FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "transactions: users can UPDATE via portfolio"
  ON transactions FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "transactions: users can DELETE via portfolio"
  ON transactions FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ── DIVIDENDS ────────────────────────────────────────────────
ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dividends: users can SELECT via portfolio"
  ON dividends FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "dividends: users can INSERT via portfolio"
  ON dividends FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "dividends: users can UPDATE via portfolio"
  ON dividends FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "dividends: users can DELETE via portfolio"
  ON dividends FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ── CASH MOVEMENTS ───────────────────────────────────────────
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_movements: users can SELECT via portfolio"
  ON cash_movements FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cash_movements: users can INSERT via portfolio"
  ON cash_movements FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cash_movements: users can UPDATE via portfolio"
  ON cash_movements FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cash_movements: users can DELETE via portfolio"
  ON cash_movements FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ── ASSETS (shared, read-only for users) ─────────────────────
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets: authenticated users can SELECT"
  ON assets FOR SELECT
  TO authenticated
  USING (true);

-- Inserts/updates/deletes performed by service role only (no user policy needed)

-- ── ASSET IDENTIFIERS (shared, read-only for users) ──────────
ALTER TABLE asset_identifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_identifiers: authenticated users can SELECT"
  ON asset_identifiers FOR SELECT
  TO authenticated
  USING (true);

-- ── ASSET PRICES (shared, read-only for users) ───────────────
ALTER TABLE asset_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_prices: authenticated users can SELECT"
  ON asset_prices FOR SELECT
  TO authenticated
  USING (true);
