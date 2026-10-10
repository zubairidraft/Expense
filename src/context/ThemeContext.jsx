import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
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

  const updateAppearance = useCallback(
    (patch) => {
      setAppearance((prev) => {
        const next = { ...prev, ...patch };
        saveAppearance(next, scope);
        return next;
      });
    },
    [scope]
  );

  const resetAppearance = useCallback(() => {
    const next = { ...DEFAULT_APPEARANCE };
    saveAppearance(next, scope);
    setAppearance(next);
  }, [scope]);

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
