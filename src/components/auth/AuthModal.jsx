import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';

export default function AuthModal({ isOpen, onClose }) {
  const { signIn, signUp, resetPassword, authError, setAuthError } = useAuth();
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

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
