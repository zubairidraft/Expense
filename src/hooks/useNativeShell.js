import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Android shell integration:
 *  - hardware back button: closes the top-most open layer, then goes back to
 *    Overview, and only then exits the app
 *  - app shortcut deep link (com.expensetracking.app://quick-add)
 *
 * layers: array of { open: boolean, close: () => void } in priority order (top first)
 */
export default function useNativeShell({ layers, canGoHome, goHome, onQuickAdd }) {
  const latest = useRef({ layers, canGoHome, goHome, onQuickAdd });
  latest.current = { layers, canGoHome, goHome, onQuickAdd };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let backHandle;
    let urlHandle;
    let cancelled = false;

    (async () => {
      const { App } = await import('@capacitor/app');

      const handleUrl = (url) => {
        if (url && url.startsWith('com.expensetracking.app://quick-add')) {
          latest.current.onQuickAdd?.();
        }
      };

      backHandle = await App.addListener('backButton', () => {
        const { layers: ls, canGoHome: cg, goHome: gh } = latest.current;
        const top = (ls || []).find((l) => l.open);
        if (top) {
          top.close();
          return;
        }
        if (cg) {
          gh();
          return;
        }
        App.exitApp();
      });

      urlHandle = await App.addListener('appUrlOpen', ({ url }) => handleUrl(url));

      try {
        const launch = await App.getLaunchUrl();
        handleUrl(launch?.url);
      } catch {
        /* no launch url */
      }

      if (cancelled) {
        backHandle.remove();
        urlHandle.remove();
      }
    })();

    return () => {
      cancelled = true;
      backHandle?.remove();
      urlHandle?.remove();
    };
  }, []);
}
