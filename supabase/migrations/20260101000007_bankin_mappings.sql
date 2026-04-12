-- ============================================================
-- Bankin' mapping rules — server-side storage for bookmarklet sync
-- Mirrors the localStorage format but persisted in the DB so the
-- bookmarklet can POST directly without needing browser localStorage.
-- NULL account_id = "skip this account"
-- ============================================================

CREATE TABLE bankin_mappings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mapping_key text NOT NULL,
  account_id  uuid REFERENCES cash_accounts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mapping_key)
);

ALTER TABLE bankin_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bankin_mappings_owner" ON bankin_mappings
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_bankin_mappings_user ON bankin_mappings(user_id);

CREATE TRIGGER set_bankin_mappings_updated_at
  BEFORE UPDATE ON bankin_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
