-- ============================================================
-- Share grants: add DIVIDEND type (shares received as dividends)
-- ============================================================
ALTER TABLE share_grants DROP CONSTRAINT IF EXISTS share_grants_share_type_check;
ALTER TABLE share_grants
  ADD CONSTRAINT share_grants_share_type_check
  CHECK (share_type IN ('AFSS', 'DFSS', 'DIVIDEND'));
