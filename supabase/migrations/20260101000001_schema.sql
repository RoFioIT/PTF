-- ============================================================
-- PTF Portfolio Tracker — Schema Migration 001
-- ============================================================

-- Custom ENUM types
CREATE TYPE portfolio_type AS ENUM ('PEA', 'CTO');
CREATE TYPE accounting_method AS ENUM ('PRU', 'FIFO');
CREATE TYPE asset_type AS ENUM ('stock', 'etf', 'crypto', 'bond', 'other');
CREATE TYPE identifier_type AS ENUM ('ISIN', 'TICKER', 'GOOGLE_SYMBOL', 'OTHER');
CREATE TYPE transaction_type AS ENUM ('BUY', 'SELL');
CREATE TYPE cash_movement_type AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT');

-- ============================================================
-- PORTFOLIOS
-- Each user can have multiple portfolios (PEA, CTO, etc.)
-- ============================================================
CREATE TABLE portfolios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  type              portfolio_type NOT NULL,
  base_currency     text NOT NULL DEFAULT 'EUR',
  accounting_method accounting_method NOT NULL DEFAULT 'PRU',
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ASSETS
-- Global asset registry — shared across all users.
-- Users reference assets via transactions; assets are not user-owned.
-- ============================================================
CREATE TABLE assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  asset_type  asset_type NOT NULL DEFAULT 'stock',
  currency    text NOT NULL DEFAULT 'EUR',
  sector      text,
  country     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ASSET IDENTIFIERS
-- Multiple identifier types per asset (ISIN, Ticker, Google Symbol…)
-- Uniqueness enforced per (type, value) to avoid duplicate lookups.
-- ============================================================
CREATE TABLE asset_identifiers (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id  uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type      identifier_type NOT NULL,
  value     text NOT NULL,
  UNIQUE (type, value)
);

-- ============================================================
-- ASSET PRICES (price cache / historical store)
-- One row per (asset, date, currency). Source tracks which provider
-- supplied the data, enabling future deduplication and trust scoring.
-- ============================================================
CREATE TABLE asset_prices (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id  uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  price     numeric(20, 8) NOT NULL CHECK (price >= 0),
  currency  text NOT NULL DEFAULT 'EUR',
  date      date NOT NULL,
  source    text,
  UNIQUE (asset_id, date, currency)
);

-- ============================================================
-- TRANSACTIONS
-- Core ledger of BUY / SELL events per portfolio.
-- `price` is the per-unit execution price (not including fees).
-- `fees` covers brokerage commissions, taxes, etc.
-- ============================================================
CREATE TABLE transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  asset_id     uuid NOT NULL REFERENCES assets(id),
  type         transaction_type NOT NULL,
  quantity     numeric(20, 8) NOT NULL CHECK (quantity > 0),
  price        numeric(20, 8) NOT NULL CHECK (price >= 0),
  fees         numeric(20, 8) NOT NULL DEFAULT 0 CHECK (fees >= 0),
  currency     text NOT NULL DEFAULT 'EUR',
  date         date NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DIVIDENDS
-- Cash dividends received for a given asset within a portfolio.
-- `tax` records withholding tax deducted at source.
-- ============================================================
CREATE TABLE dividends (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  asset_id     uuid NOT NULL REFERENCES assets(id),
  amount       numeric(20, 8) NOT NULL CHECK (amount > 0),
  tax          numeric(20, 8) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  currency     text NOT NULL DEFAULT 'EUR',
  date         date NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CASH MOVEMENTS
-- Deposits, withdrawals, and transfers into/out of a portfolio.
-- Used for TWR cash-flow adjustments and available-cash tracking.
-- ============================================================
CREATE TABLE cash_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  type         cash_movement_type NOT NULL,
  amount       numeric(20, 8) NOT NULL CHECK (amount > 0),
  currency     text NOT NULL DEFAULT 'EUR',
  date         date NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES — optimized for the most common query patterns
-- ============================================================

-- Most queries filter by portfolio + date range
CREATE INDEX idx_transactions_portfolio_date ON transactions (portfolio_id, date);
CREATE INDEX idx_transactions_asset ON transactions (asset_id);

-- Price lookups by asset + date range (historical charts, valuation)
CREATE INDEX idx_asset_prices_asset_date ON asset_prices (asset_id, date);

-- Identifier lookups by type or value (market-data resolution)
CREATE INDEX idx_asset_identifiers_asset ON asset_identifiers (asset_id);
CREATE INDEX idx_asset_identifiers_type_value ON asset_identifiers (type, value);

CREATE INDEX idx_dividends_portfolio_date ON dividends (portfolio_id, date);
CREATE INDEX idx_cash_movements_portfolio_date ON cash_movements (portfolio_id, date);

-- ============================================================
-- UPDATED_AT TRIGGER for portfolios
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
