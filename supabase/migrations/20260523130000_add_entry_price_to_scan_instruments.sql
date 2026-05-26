ALTER TABLE scan_instruments
  ADD COLUMN entry_price_low  numeric(12,4),
  ADD COLUMN entry_price_high numeric(12,4);
