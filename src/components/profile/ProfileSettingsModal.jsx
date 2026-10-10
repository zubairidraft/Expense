import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';

function ProfileFormInner({ profile, updateProfile, user, signOut, onClose, onOpenOnboarding }) {
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [currency, setCurrency] = useState(profile.defaultCurrency || 'USD');
  const [numberFormat, setNumberFormat] = useState(profile.numberFormat || 'intl');
  const [locale, setLocale] = useState(profile.locale || 'en-US');
  const [dateFormat, setDateFormat] = useState(profile.dateFormat || 'YYYY-MM-DD');
  const [theme, setTheme] = useState(profile.theme || 'dark');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const res = await updateProfile({
      fullName,
      defaultCurrency: currency,
      numberFormat,
      locale,
      dateFormat,
      theme,
    });

    setSaving(false);
    if (!res?.error) {
      setMessage('Profile preferences saved!');
      setTimeout(() => {
        setMessage('');
        onClose();
      }, 1000);
    } else {
      setMessage(`Notice: Saved locally (${res.error.message})`);
    }
  };

  return (
    <form onSubmit={handleSave} className="profile-form">
      {message && (
        <div className="auth-alert success">
          <span>✓</span> {message}
        </div>
      )}

      <div className="profile-user-summary">
        <div className="profile-avatar-circle">
          {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="profile-user-info">
          <span className="profile-email-badge">{user?.email || 'Guest Mode'}</span>
          <span className="profile-user-id">
            {user ? `ID: ${user.id.slice(0, 8)}...` : 'Local Session'}
          </span>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="pref-name">Full Name</label>
        <input
          id="pref-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Alex Morgan"
          className="input-field"
        />
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label htmlFor="pref-currency">Default Currency</label>
          <select
            id="pref-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input-field"
          >
            {Object.entries(CURRENCY_REGISTRY).map(([code, cur]) => (
              <option key={code} value={code}>
                {code} ({cur.symbol})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pref-num-format">Number Formatting</label>
          <select
            id="pref-num-format"
            value={numberFormat}
            onChange={(e) => setNumberFormat(e.target.value)}
            className="input-field"
          >
            <option value="intl">International (1,250,000)</option>
            <option value="lakh">South Asian (12,50,000)</option>
          </select>
        </div>
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label htmlFor="pref-locale">Locale</label>
          <select
            id="pref-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="input-field"
          >
            <option value="en-US">English (United States)</option>
            <option value="en-GB">English (United Kingdom)</option>
            <option value="en-PK">English (Pakistan)</option>
            <option value="ar-AE">Arabic (UAE)</option>
            <option value="ur-PK">Urdu (Pakistan)</option>
            <option value="en-IN">English (India)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pref-date-format">Date Format</label>
          <select
            id="pref-date-format"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="input-field"
          >
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="pref-theme">Theme Mode</label>
        <select
          id="pref-theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="input-field"
        >
          <option value="dark">Dark Aura (Glassmorphism)</option>
          <option value="light">Light Mode</option>
          <option value="system">System Default</option>
        </select>
      </div>

      <div className="modal-actions-bar">
        <button
          type="button"
          onClick={() => {
            onClose();
            if (onOpenOnboarding) onOpenOnboarding();
          }}
          className="btn-secondary"
          title="Re-run Initial Accounts & Balances Onboarding Wizard"
        >
          ✨ Run Setup Wizard
        </button>
        {user && (
          <button
            type="button"
            onClick={() => {
              signOut();
              onClose();
            }}
            className="btn-danger-outline"
          >
            Sign Out
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="submit-btn primary-glow ml-auto"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </form>
  );
}

export default function ProfileSettingsModal({ isOpen, onClose, onOpenOnboarding }) {
  const { profile, updateProfile, user, signOut } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">User Profile & Preferences</h2>
            <p className="modal-subtitle">
              Configure your regional format, base currency, and personal details
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <ProfileFormInner
          key={profile.defaultCurrency + (profile.fullName || '') + profile.numberFormat}
          profile={profile}
          updateProfile={updateProfile}
          user={user}
          signOut={signOut}
          onClose={onClose}
          onOpenOnboarding={onOpenOnboarding}
        />
      </div>
    </div>
  );
}
