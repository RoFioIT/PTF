-- ============================================================
-- PTF Portfolio Tracker — Migration 008
-- Real estate properties + mortgages + amortization schedule
-- ============================================================

-- Custom ENUM types
CREATE TYPE property_type    AS ENUM ('home', 'investment');
CREATE TYPE property_country AS ENUM ('france', 'italy');

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE properties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  type           property_type NOT NULL,
  country        property_country NOT NULL,
  address        text,
  current_value  numeric(20,2) NOT NULL DEFAULT 0,
  purchase_price numeric(20,2),
  purchase_date  date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_user    ON properties(user_id);
CREATE INDEX idx_properties_country ON properties(country);
CREATE INDEX idx_properties_type    ON properties(type);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MORTGAGES (header info only — schedule is in mortgage_payments)
-- ============================================================
CREATE TABLE mortgages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  bank_name      text NOT NULL,
  start_date     date NOT NULL,
  initial_amount numeric(20,2) NOT NULL CHECK (initial_amount > 0),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mortgages_property ON mortgages(property_id);

CREATE TRIGGER mortgages_updated_at
  BEFORE UPDATE ON mortgages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MORTGAGE_PAYMENTS
-- One row per line of the bank's amortization plan (imported)
-- ============================================================
CREATE TABLE mortgage_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mortgage_id       uuid NOT NULL REFERENCES mortgages(id) ON DELETE CASCADE,
  month_number      integer NOT NULL CHECK (month_number > 0),
  payment_date      date NOT NULL,
  total_payment     numeric(20,2) NOT NULL,
  principal         numeric(20,2) NOT NULL,
  interest          numeric(20,2) NOT NULL,
  insurance         numeric(20,2) NOT NULL DEFAULT 0,
  remaining_balance numeric(20,2) NOT NULL,
  UNIQUE (mortgage_id, month_number)
);

CREATE INDEX idx_mortgage_payments_mid ON mortgage_payments(mortgage_id);
CREATE INDEX idx_mortgage_payments_dt  ON mortgage_payments(mortgage_id, payment_date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties: users manage their own"
  ON properties FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE mortgages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mortgages: users manage via property"
  ON mortgages FOR ALL TO authenticated
  USING (
    property_id IN (SELECT id FROM properties WHERE user_id = auth.uid())
  )
  WITH CHECK (
    property_id IN (SELECT id FROM properties WHERE user_id = auth.uid())
  );

ALTER TABLE mortgage_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mortgage_payments: users manage via mortgage"
  ON mortgage_payments FOR ALL TO authenticated
  USING (
    mortgage_id IN (
      SELECT m.id FROM mortgages m
      JOIN properties p ON p.id = m.property_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    mortgage_id IN (
      SELECT m.id FROM mortgages m
      JOIN properties p ON p.id = m.property_id
      WHERE p.user_id = auth.uid()
    )
  );
