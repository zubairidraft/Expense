-- =============================================================================
-- Seed: 01_currencies.sql
-- Purpose: ISO 4217 currency registry with minor units and symbols
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.currencies (
  code VARCHAR(3) PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  minor_units SMALLINT NOT NULL CHECK (minor_units >= 0 AND minor_units <= 4),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO public.currencies (code, name, symbol, minor_units, active) VALUES
  ('PKR', 'Pakistani Rupee', 'Rs', 2, true),
  ('AED', 'UAE Dirham', 'AED', 2, true),
  ('USD', 'US Dollar', '$', 2, true),
  ('EUR', 'Euro', '€', 2, true),
  ('GBP', 'British Pound', '£', 2, true),
  ('SAR', 'Saudi Riyal', 'SR', 2, true),
  ('INR', 'Indian Rupee', '₹', 2, true),
  ('JPY', 'Japanese Yen', '¥', 0, true),
  ('KWD', 'Kuwaiti Dinar', 'KD', 3, true),
  ('BHD', 'Bahraini Dinar', 'BD', 3, true),
  ('OMR', 'Omani Rial', 'RO', 3, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  symbol = EXCLUDED.symbol,
  minor_units = EXCLUDED.minor_units,
  active = EXCLUDED.active;
