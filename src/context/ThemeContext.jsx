import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  DEFAULT_APPEARANCE,
  THEME_PRESETS,
  FONT_OPTIONS,
  loadAppearance,
  saveAppearance,
  applyAppearance,
} from '../lib/theme';

const ThemeContext = createContext(null);

// Apply stored appearance immediately (before first paint of React tree) to avoid a colour flash
applyAppearance(loadAppearance('guest'));

export function ThemeProvider({ children }) {
  const { user, profile, updateProfile } = useAuth();
  const scope = user?.id || 'guest';

  const [appearance, setAppearance] = useState(() => loadAppearance(scope));

  // Switching user -> load that user's appearance
  useEffect(() => {
    setAppearance(loadAppearance(scope));
  }, [scope]);

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  // Sync colours/fonts with the account so every device looks the same
  const pushTimer = useRef(null);
  const pushToAccount = useCallback(
    (next) => {
      if (!user?.id) return;
      clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        supabase.from('profiles').update({ appearance: next }).eq('id', user.id).then(({ error }) => {
          if (error) console.warn('[Theme] appearance sync failed:', error.message);
        });
      }, 800);
    },
    [user?.id]
  );

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('appearance')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (data?.appearance && typeof data.appearance === 'object') {
          const merged = { ...DEFAULT_APPEARANCE, ...data.appearance };
          saveAppearance(merged, user.id);
          setAppearance(merged);
        } else {
          // First time on this account: upload what this device already has
          pushToAccount(loadAppearance(user.id));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, pushToAccount]);

  const updateAppearance = useCallback(
    (patch) => {
      setAppearance((prev) => {
        const next = { ...prev, ...patch };
        saveAppearance(next, scope);
        pushToAccount(next);
        return next;
      });
    },
    [scope, pushToAccount]
  );

  const resetAppearance = useCallback(() => {
    const next = { ...DEFAULT_APPEARANCE };
    saveAppearance(next, scope);
    pushToAccount(next);
    setAppearance(next);
  }, [scope, pushToAccount]);

  // Light / dark / system mode lives on the profile (synced to the server for signed-in users)
  const mode = profile?.theme || 'dark';
  const setMode = useCallback((m) => updateProfile({ theme: m }), [updateProfile]);

  const value = useMemo(
    () => ({
      appearance,
      updateAppearance,
      resetAppearance,
      mode,
      setMode,
      presets: THEME_PRESETS,
      fonts: FONT_OPTIONS,
    }),
    [appearance, updateAppearance, resetAppearance, mode, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
