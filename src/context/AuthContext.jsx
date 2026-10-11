import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const DEFAULT_PROFILE = {
  fullName: 'Guest User',
  avatarUrl: '',
  defaultCurrency: 'USD',
  locale: 'en-US',
  numberFormat: 'intl',
  dateFormat: 'YYYY-MM-DD',
  theme: 'dark',
  onboardingCompleted: true,
};

const getStoredProfile = () => {
  try {
    const raw = localStorage.getItem('expense_pro_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch (e) {
    console.warn('[AuthContext] Failed to parse stored profile:', e);
  }
  return DEFAULT_PROFILE;
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(getStoredProfile);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Apply theme to DOM and listen for system theme changes
  useEffect(() => {
    const currentTheme = profile.theme || 'dark';

    const applyTheme = (themeMode) => {
      let resolved = themeMode;
      if (themeMode === 'system') {
        resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      }

      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(resolved);

      if (document.body) {
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(resolved);
      }
    };

    applyTheme(currentTheme);

    if (currentTheme === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [profile.theme]);

  // Synchronize document direction for RTL locales (Arabic & Urdu)
  useEffect(() => {
    const isRtl = profile.locale === 'ar-AE' || profile.locale === 'ur-PK';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = profile.locale || 'en-US';
  }, [profile.locale]);

  // Fetch or fallback profile from Supabase
  const loadProfile = useCallback(async (userId, userMetadata = {}) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[AuthContext] Error fetching profile:', error.message);
      }

      const stored = getStoredProfile();

      if (data) {
        const loadedProfile = {
          id: data.id,
          fullName: data.full_name || userMetadata.full_name || stored.fullName || 'User',
          avatarUrl: data.avatar_url || '',
          defaultCurrency: data.default_currency || stored.defaultCurrency || 'USD',
          locale: data.locale || stored.locale || 'en-US',
          numberFormat: data.number_format || stored.numberFormat || 'intl',
          dateFormat: data.date_format || stored.dateFormat || 'YYYY-MM-DD',
          theme: data.theme || stored.theme || 'dark',
          onboardingCompleted: data.onboarding_completed ?? stored.onboardingCompleted ?? true,
        };
        setProfile(loadedProfile);
        try {
          localStorage.setItem('expense_pro_profile', JSON.stringify(loadedProfile));
        } catch {}
      } else {
        const fallbackProfile = {
          id: userId,
          fullName: userMetadata.full_name || userMetadata.name || stored.fullName || 'User',
          avatarUrl: userMetadata.avatar_url || '',
          defaultCurrency: userMetadata.default_currency || stored.defaultCurrency || 'USD',
          locale: userMetadata.locale || stored.locale || 'en-US',
          numberFormat: userMetadata.number_format || stored.numberFormat || 'intl',
          dateFormat: userMetadata.date_format || stored.dateFormat || 'YYYY-MM-DD',
          theme: userMetadata.theme || stored.theme || 'dark',
          onboardingCompleted: userMetadata.onboarding_completed ?? stored.onboardingCompleted ?? true,
        };
        setProfile(fallbackProfile);
        try {
          localStorage.setItem('expense_pro_profile', JSON.stringify(fallbackProfile));
        } catch {}
      }
    } catch (err) {
      console.error('[AuthContext] Exception while loading profile:', err);
    }
  }, []);

  useEffect(() => {
    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id, session.user.user_metadata);
      } else {
        setProfile(getStoredProfile());
      }
      setLoading(false);
    });

    // 2. Listen to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await loadProfile(newSession.user.id, newSession.user.user_metadata);
      } else {
        setProfile(getStoredProfile());
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = async ({ email, password, fullName, defaultCurrency = 'USD' }) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            default_currency: defaultCurrency,
          },
        },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      setAuthError(err.message);
      return { data: null, error: err };
    }
  };

  const signIn = async ({ email, password }) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      setAuthError(err.message);
      return { data: null, error: err };
    }
  };

  // Google sign-in / sign-up (same call: Supabase creates the account on first use)
  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      // Keep a pending workspace-invite token through the Google round trip
      const inviteToken = new URLSearchParams(window.location.search).get('invite');
      const redirectTo = window.location.origin + (inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : '');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      setAuthError(err.message);
      return { data: null, error: err };
    }
  };

  const signOut = async () => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(DEFAULT_PROFILE);
      try {
        localStorage.removeItem('expense_pro_profile');
      } catch {}
      return { error: null };
    } catch (err) {
      setAuthError(err.message);
      return { error: err };
    }
  };

  const resetPassword = async (email) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      setAuthError(err.message);
      return { data: null, error: err };
    }
  };

  const updateProfile = async (updates) => {
    setAuthError(null);
    const updated = { ...profile, ...updates };
    setProfile(updated);

    // Save to localStorage immediately
    try {
      localStorage.setItem('expense_pro_profile', JSON.stringify(updated));
      if (updates.theme) {
        localStorage.setItem('expense_pro_theme', updates.theme);
      }
    } catch (e) {
      console.warn('[AuthContext] Failed to persist profile to localStorage:', e);
    }

    if (!user) return { data: updated, error: null };

    // Remote sync for authenticated users
    try {
      const dbPayload = {};
      if (updates.fullName !== undefined) dbPayload.full_name = updates.fullName;
      if (updates.avatarUrl !== undefined) dbPayload.avatar_url = updates.avatarUrl;
      if (updates.defaultCurrency !== undefined) dbPayload.default_currency = updates.defaultCurrency;
      if (updates.locale !== undefined) dbPayload.locale = updates.locale;
      if (updates.numberFormat !== undefined) dbPayload.number_format = updates.numberFormat;
      if (updates.dateFormat !== undefined) dbPayload.date_format = updates.dateFormat;
      if (updates.theme !== undefined) dbPayload.theme = updates.theme;
      if (updates.onboardingCompleted !== undefined) dbPayload.onboarding_completed = updates.onboardingCompleted;

      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...dbPayload });

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.warn('[AuthContext] Remote profile update warning:', err.message);
      return { error: err };
    }
  };

  const toggleTheme = () => {
    const nextTheme = profile.theme === 'light' ? 'dark' : 'light';
    updateProfile({ theme: nextTheme });
  };

  const markOnboardingComplete = async () => {
    try {
      localStorage.setItem('expense_pro_onboarding_completed', 'true');
      localStorage.setItem('expense_pro_onboarding_dismissed', 'true');
    } catch {}

    if (user) {
      try {
        await supabase.rpc('complete_user_onboarding', { p_user_id: user.id });
      } catch (err) {
        console.warn('[AuthContext] complete_user_onboarding RPC notice:', err);
      }
      return updateProfile({ onboardingCompleted: true });
    } else {
      return updateProfile({ onboardingCompleted: true });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        authError,
        setAuthError,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updateProfile,
        toggleTheme,
        markOnboardingComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
