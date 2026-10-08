-- =============================================================================
-- Migration: 20261008000014_multi_currency_exchange_rates.sql
-- Purpose: Phase 16 - Multi-Currency Services, Historical Rates & Conversion
-- =============================================================================

BEGIN;

-- 1. Exchange Rates Table
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency VARCHAR(3) NOT NULL REFERENCES public.currencies(code) ON UPDATE CASCADE,
  quote_currency VARCHAR(3) NOT NULL REFERENCES public.currencies(code) ON UPDATE CASCADE,
  rate NUMERIC(20,10) NOT NULL CHECK (rate > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'open_er_api' CHECK (source IN ('manual', 'open_er_api', 'ecb', 'fixer', 'fallback')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_exchange_rates_pair_date UNIQUE(base_currency, quote_currency, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON public.exchange_rates(base_currency, quote_currency, effective_date DESC);

-- 2. RLS Policies
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_rates' AND policyname = 'Exchange rates viewable by authenticated') THEN
    CREATE POLICY "Exchange rates viewable by authenticated" ON public.exchange_rates
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_rates' AND policyname = 'Exchange rates manageable by authenticated') THEN
    CREATE POLICY "Exchange rates manageable by authenticated" ON public.exchange_rates
      FOR ALL TO authenticated
      USING (true);
  END IF;
END;
$$;

-- 3. Stored Procedure: Upsert exchange rate & its inverse atomically
CREATE OR REPLACE FUNCTION public.upsert_exchange_rate(
  p_base TEXT,
  p_quote TEXT,
  p_rate NUMERIC,
  p_date DATE DEFAULT CURRENT_DATE,
  p_source TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv_rate NUMERIC;
BEGIN
  IF p_rate <= 0 THEN
    RAISE EXCEPTION 'Exchange rate must be greater than zero';
  END IF;

  -- 1. Upsert forward rate
  INSERT INTO public.exchange_rates (base_currency, quote_currency, rate, effective_date, source)
  VALUES (p_base, p_quote, p_rate, p_date, p_source)
  ON CONFLICT (base_currency, quote_currency, effective_date)
  DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, created_at = clock_timestamp();

  -- 2. Calculate and upsert inverse rate
  v_inv_rate := ROUND(1.0 / p_rate, 10);
  INSERT INTO public.exchange_rates (base_currency, quote_currency, rate, effective_date, source)
  VALUES (p_quote, p_base, v_inv_rate, p_date, p_source)
  ON CONFLICT (base_currency, quote_currency, effective_date)
  DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, created_at = clock_timestamp();

  RETURN jsonb_build_object(
    'base', p_base,
    'quote', p_quote,
    'rate', p_rate,
    'inverse_rate', v_inv_rate,
    'date', p_date,
    'source', p_source
  );
END;
$$;

-- 4. Seed Standard Fallback FX Rates
INSERT INTO public.exchange_rates (base_currency, quote_currency, rate, effective_date, source)
VALUES
  ('USD', 'PKR', 278.5000000000, CURRENT_DATE, 'fallback'),
  ('PKR', 'USD', 0.0035906643, CURRENT_DATE, 'fallback'),
  ('USD', 'AED', 3.6725000000, CURRENT_DATE, 'fallback'),
  ('AED', 'USD', 0.2722940776, CURRENT_DATE, 'fallback'),
  ('USD', 'EUR', 0.9250000000, CURRENT_DATE, 'fallback'),
  ('EUR', 'USD', 1.0810810811, CURRENT_DATE, 'fallback'),
  ('USD', 'GBP', 0.7850000000, CURRENT_DATE, 'fallback'),
  ('GBP', 'USD', 1.2738853503, CURRENT_DATE, 'fallback'),
  ('USD', 'SAR', 3.7500000000, CURRENT_DATE, 'fallback'),
  ('SAR', 'USD', 0.2666666667, CURRENT_DATE, 'fallback'),
  ('USD', 'INR', 83.9000000000, CURRENT_DATE, 'fallback'),
  ('INR', 'USD', 0.0119189511, CURRENT_DATE, 'fallback')
ON CONFLICT (base_currency, quote_currency, effective_date) DO NOTHING;

COMMIT;
