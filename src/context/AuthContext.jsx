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
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

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

      if (data) {
        setProfile({
          id: data.id,
          fullName: data.full_name || userMetadata.full_name || 'User',
          avatarUrl: data.avatar_url || '',
          defaultCurrency: data.default_currency || 'USD',
          locale: data.locale || 'en-US',
          numberFormat: data.number_format || 'intl',
          dateFormat: data.date_format || 'YYYY-MM-DD',
          theme: data.theme || 'dark',
        });
      } else {
        // Fallback to metadata if DB table or trigger is still being populated
        setProfile({
          id: userId,
          fullName: userMetadata.full_name || userMetadata.name || 'User',
          avatarUrl: userMetadata.avatar_url || '',
          defaultCurrency: userMetadata.default_currency || 'USD',
          locale: userMetadata.locale || 'en-US',
          numberFormat: userMetadata.number_format || 'intl',
          dateFormat: userMetadata.date_format || 'YYYY-MM-DD',
          theme: userMetadata.theme || 'dark',
        });
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
        setProfile(DEFAULT_PROFILE);
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
        setProfile(DEFAULT_PROFILE);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  // Synchronize document direction for RTL locales (Arabic & Urdu)
  useEffect(() => {
    const isRtl = profile.locale === 'ar-AE' || profile.locale === 'ur-PK';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = profile.locale || 'en-US';
  }, [profile.locale]);

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

  const signOut = async () => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(DEFAULT_PROFILE);
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
    if (!user) return { error: new Error('User not authenticated') };
    setAuthError(null);
    try {
      const dbPayload = {};
      if (updates.fullName !== undefined) dbPayload.full_name = updates.fullName;
      if (updates.avatarUrl !== undefined) dbPayload.avatar_url = updates.avatarUrl;
      if (updates.defaultCurrency !== undefined) dbPayload.default_currency = updates.defaultCurrency;
      if (updates.locale !== undefined) dbPayload.locale = updates.locale;
      if (updates.numberFormat !== undefined) dbPayload.number_format = updates.numberFormat;
      if (updates.dateFormat !== undefined) dbPayload.date_format = updates.dateFormat;
      if (updates.theme !== undefined) dbPayload.theme = updates.theme;

      // Update in Supabase profiles table
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...dbPayload });

      if (error) throw error;

      // Update local state
      setProfile((prev) => ({
        ...prev,
        ...updates,
      }));

      return { error: null };
    } catch (err) {
      console.error('[AuthContext] Update profile error:', err);
      // Still update local state for responsive UI if network/table is in-migration
      setProfile((prev) => ({ ...prev, ...updates }));
      return { error: err };
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
        signOut,
        resetPassword,
        updateProfile,
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
