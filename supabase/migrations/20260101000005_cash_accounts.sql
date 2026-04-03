-- ============================================================
-- Cash Accounts — Quarterly Balance Tracker
-- Completely separate from the portfolio/asset engine.
-- ============================================================

-- Accounts registry
CREATE TABLE cash_accounts (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner       text         NOT NULL,
  category    text         NOT NULL,
  name        text         NOT NULL,
  currency    text         NOT NULL DEFAULT 'EUR',
  is_active   boolean      NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

-- Quarterly balance snapshots (one per account per quarter)
CREATE TABLE cash_account_snapshots (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid          NOT NULL REFERENCES cash_accounts(id) ON DELETE CASCADE,
  quarter     text          NOT NULL,   -- format: 'YYYY-QN'  e.g. '2025-Q4'
  balance     numeric(20,2) NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (account_id, quarter)
);

-- Indexes
CREATE INDEX idx_cash_accounts_user     ON cash_accounts(user_id);
CREATE INDEX idx_cash_accounts_owner    ON cash_accounts(owner);
CREATE INDEX idx_cash_snapshots_account ON cash_account_snapshots(account_id);
CREATE INDEX idx_cash_snapshots_quarter ON cash_account_snapshots(quarter);

-- Auto-update updated_at
CREATE TRIGGER set_cash_accounts_updated_at
  BEFORE UPDATE ON cash_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE cash_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_account_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_accounts_owner" ON cash_accounts
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cash_account_snapshots_owner" ON cash_account_snapshots
  FOR ALL TO authenticated
  USING (
    account_id IN (SELECT id FROM cash_accounts WHERE user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT id FROM cash_accounts WHERE user_id = auth.uid())
  );

-- ============================================================
-- SEED SCRIPT — run separately in Supabase SQL editor
-- Replace 268dbb82-ef5d-4a89-b0f7-9de1081d86e8 with your actual auth.users id.
-- ============================================================
--
-- INSERT INTO cash_accounts (user_id, owner, category, name) VALUES
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Studio',  'Cash',                      'CCF Studio'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Silvia',  'Cash Risparmio',            'Livret A Silvia'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Silvia',  'Investimenti - Assurance',  'Assurance Silvia'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Silvia',  'Cash',                      'CCF Silvia'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Silvia',  'Cash',                      'LDDS Silvia'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Silvia',  'Cash',                      'CCF equilibre Silvia'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Silvia',  'Cash',                      'CCF Comune'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash Risparmio',            'Livret A Roberto'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash Risparmio',            'Livret A Chiara'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash Risparmio',            'Livret A Laura'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Investimenti - Assurance',  'Assurance Roberto'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash Risparmio',            'LDDS Roberto'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash Risparmio',            'CAT special CCF'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash',                      'Livret Bourso+ Roberto'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash',                      'BoursoBank Roberto'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash',                      'BoursoBank Comune'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Investimenti - Borsa',      'BoursoBank Titres'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Investimenti - Borsa',      'BoursoBank PEA'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Investimenti - Assurance',  'BoursoBank Per'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Investimenti - Assurance',  'BoursoBank Assurance Vie'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash',                      'BoursoBank Silvia'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash Risparmio',            'CCF Equilibre Chiara'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash',                      'Conto Chiara'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Cash',                      'Conto Laura'),
--   ('268dbb82-ef5d-4a89-b0f7-9de1081d86e8', 'Roberto', 'Investimenti - Borsa',      'FICP Investimmo (HSBC)');
