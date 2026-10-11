import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';

export default function AuthModal({ isOpen, onClose }) {
  const { signIn, signUp, signInWithGoogle, resetPassword, authError, setAuthError } = useAuth();
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setSuccessMsg('');
    setAuthError(null);
    const { error } = await signInWithGoogle();
    // On success the browser is redirected to Google; only reset on failure
    if (error) setGoogleLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setAuthError(null);

    try {
      if (tab === 'signin') {
        const { error } = await signIn({ email, password });
        if (!error) {
          onClose();
        }
      } else if (tab === 'signup') {
        const { error } = await signUp({
          email,
          password,
          fullName,
          defaultCurrency: currency,
        });
        if (!error) {
          setSuccessMsg('Account created successfully! Check your email if verification is required, or sign in.');
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } else if (tab === 'forgot') {
        const { error } = await resetPassword(email);
        if (!error) {
          setSuccessMsg('Password reset instructions sent to your email.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">
              {tab === 'signin' && 'Welcome Back'}
              {tab === 'signup' && 'Create Account'}
              {tab === 'forgot' && 'Reset Password'}
            </h2>
            <p className="modal-subtitle">
              {tab === 'signin' && 'Sign in to access your synchronized expenses'}
              {tab === 'signup' && 'Set up your multi-currency expense ledger'}
              {tab === 'forgot' && 'Enter your email to receive a recovery link'}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Tab switchers */}
        <div className="auth-tabs">
          <button
            className={`auth-tab-btn ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setTab('signin');
              setSuccessMsg('');
              setAuthError(null);
            }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab-btn ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setTab('signup');
              setSuccessMsg('');
              setAuthError(null);
            }}
          >
            Sign Up
          </button>
          <button
            className={`auth-tab-btn ${tab === 'forgot' ? 'active' : ''}`}
            onClick={() => {
              setTab('forgot');
              setSuccessMsg('');
              setAuthError(null);
            }}
          >
            Forgot?
          </button>
        </div>

        {authError && (
          <div className="auth-alert error">
            <span>⚠️</span> {authError}
          </div>
        )}

        {successMsg && (
          <div className="auth-alert success">
            <span>✓</span> {successMsg}
          </div>
        )}

        {tab !== 'forgot' && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="submit-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                width: '100%',
                background: 'var(--md-surface-container-high, #fff)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color, rgba(128,128,128,0.35))',
                marginBottom: '0.9rem',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0 0 0.9rem 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border-color, rgba(128,128,128,0.3))' }} />
              or use email
              <span style={{ flex: 1, height: 1, background: 'var(--border-color, rgba(128,128,128,0.3))' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'signup' && (
            <div className="form-group">
              <label htmlFor="reg-name">Full Name</label>
              <input
                id="reg-name"
                type="text"
                required
                placeholder="e.g. Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              required
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          {tab !== 'forgot' && (
            <div className="form-group">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
              />
            </div>
          )}

          {tab === 'signup' && (
            <div className="form-group">
              <label htmlFor="reg-currency">Default Base Currency</label>
              <select
                id="reg-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input-field"
              >
                {Object.entries(CURRENCY_REGISTRY).map(([code, cur]) => (
                  <option key={code} value={code}>
                    {code} ({cur.symbol}) - {cur.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="submit-btn primary-glow"
          >
            {loading ? (
              <span className="spinner-inline">Processing...</span>
            ) : tab === 'signin' ? (
              'Sign In'
            ) : tab === 'signup' ? (
              'Create My Ledger'
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
