import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { formatMoney } from '../lib/formatters';

const WidgetBridge = Capacitor.isNativePlatform() ? registerPlugin('WidgetBridge') : null;

/** Pushes the current net balance to the Android home-screen widget. */
export default function useWidgetSync({ netWorth, currency, label, numberFormat = 'intl', enabled = true }) {
  useEffect(() => {
    if (!WidgetBridge || !enabled) return;
    const balance = formatMoney(netWorth ?? 0, currency || 'USD', numberFormat);
    WidgetBridge.setBalance({ label: label || 'Net balance', balance }).catch(() => {});
  }, [netWorth, currency, label, numberFormat, enabled]);
}
