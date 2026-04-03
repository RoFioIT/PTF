-- ============================================================
-- PTF Portfolio Tracker — Migration 004
-- ADM Shares: employee share scheme portfolio type
-- ============================================================

-- Add ADM to portfolio_type ENUM
ALTER TYPE portfolio_type ADD VALUE 'ADM';

-- ============================================================
-- SHARE GRANTS
-- Tracks unvested / vested / lapsed employee share awards.
-- Each grant belongs to a portfolio and references an asset.
-- vesting_pct is null until the vesting event occurs.
-- ============================================================
CREATE TABLE share_grants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id     uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  asset_id         uuid NOT NULL REFERENCES assets(id),
  share_type       text NOT NULL CHECK (share_type IN ('AFSS', 'DFSS')),
  grant_date       date NOT NULL,
  vesting_date     date NOT NULL,
  granted_quantity numeric(20, 8) NOT NULL CHECK (granted_quantity > 0),
  vesting_pct      numeric(5, 2) CHECK (vesting_pct >= 0 AND vesting_pct <= 100),
  status           text NOT NULL DEFAULT 'unvested'
                     CHECK (status IN ('unvested', 'vested', 'lapsed')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_grants_portfolio ON share_grants (portfolio_id);

-- RLS: users access grants only via their own portfolios
ALTER TABLE share_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_grants_user ON share_grants
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- SEED: ADM stock asset
-- ============================================================
DO $$
DECLARE adm_asset_id uuid;
BEGIN
  INSERT INTO assets (name, asset_type, currency, country)
  VALUES ('ADM Shares', 'stock', 'GBP', 'GB')
  RETURNING id INTO adm_asset_id;

  INSERT INTO asset_identifiers (asset_id, type, value)
  VALUES (adm_asset_id, 'ISIN', 'GB00B02J6398');
END $$;
