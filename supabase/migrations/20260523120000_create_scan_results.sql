-- scan_sessions: one record per /ptf-ai-chk scan run
CREATE TABLE scan_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at    date NOT NULL DEFAULT CURRENT_DATE,
  sector_focus  text NOT NULL,
  market_regime text,
  vix_level     numeric(5,2),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- scan_instruments: one row per ticker per session
CREATE TABLE scan_instruments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  ticker            text NOT NULL,
  name              text NOT NULL,
  instrument_type   text NOT NULL CHECK (instrument_type IN ('stock', 'etf')),
  market            text,
  sector_or_theme   text,
  price             numeric(12,4),
  price_currency    text DEFAULT 'EUR',
  pe_forward        numeric(8,2),
  perf_3m           numeric(8,2),
  analyst_consensus text,
  score             integer,
  signal            text NOT NULL CHECK (signal IN ('BUY', 'WATCH', 'AVOID')),
  pea_eligible      boolean,
  ter               numeric(6,4),
  aum_eur_m         numeric(12,2),
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_sessions_user ON scan_sessions(user_id);
CREATE INDEX idx_scan_sessions_date ON scan_sessions(scanned_at DESC);
CREATE INDEX idx_scan_instruments_session ON scan_instruments(session_id);
CREATE INDEX idx_scan_instruments_ticker ON scan_instruments(ticker);

ALTER TABLE scan_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_sessions_owner" ON scan_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "scan_instruments_via_session" ON scan_instruments
  FOR ALL TO authenticated
  USING (session_id IN (SELECT id FROM scan_sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM scan_sessions WHERE user_id = auth.uid()));
