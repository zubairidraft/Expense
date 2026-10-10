import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  convertCurrency,
  STATIC_FALLBACK_RATES,
  getEstimatedRate,
} from '@universal-expense/core';

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const [rates, setRates] = useState(STATIC_FALLBACK_RATES);
  const [dbRates, setDbRates] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('effective_date', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setDbRates(data);
        const mapped = { ...STATIC_FALLBACK_RATES };
        const seen = new Set();
        // Rows are newest-first: keep only the latest rate per currency
        for (const row of data) {
          if (row.base_currency === 'USD' && !seen.has(row.quote_currency)) {
            mapped[row.quote_currency] = parseFloat(row.rate);
            seen.add(row.quote_currency);
          }
        }
        setRates(mapped);
      }
    } catch (err) {
      console.warn('Using static fallback exchange rates:', err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const convert = (amount, from, to) => {
    if (!amount || parseFloat(amount) === 0) return '0.00';
    const rate = getEstimatedRate(from, to, rates);
    return convertCurrency(amount, from, to, rate, 2);
  };

  const updateRate = async (base, quote, rate) => {
    const numRate = parseFloat(rate);
    if (!user) {
      setRates((prev) => ({ ...prev, [quote]: numRate }));
      return;
    }

    const { error } = await supabase.rpc('upsert_exchange_rate', {
      p_base: base,
      p_quote: quote,
      p_rate: numRate,
      p_source: 'manual',
    });

    if (error) throw error;
    await fetchRates();
  };

  const value = {
    rates,
    dbRates,
    loading,
    convert,
    updateRate,
    refreshRates: fetchRates,
    getEstimatedRate: (from, to) => getEstimatedRate(from, to, rates),
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
