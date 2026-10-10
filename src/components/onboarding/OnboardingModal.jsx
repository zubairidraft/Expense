import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAccounts } from '../../context/AccountContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';

const DEFAULT_STARTER_ACCOUNTS = [
  {
    tempId: 'init-1',
    name: 'Main Bank Account',
    type: 'bank',
    nature: 'asset',
    currency: 'USD',
    openingBalance: '0.00',
    icon: '🏦',
    color: '#6366f1',
  },
  {
    tempId: 'init-2',
    name: 'Physical Cash / Wallet',
    type: 'cash',
    nature: 'asset',
    currency: 'USD',
    openingBalance: '0.00',
    icon: '💵',
    color: '#10b981',
  },
];

const PRESET_TEMPLATES = [
  { label: '+ Bank Account', type: 'bank', nature: 'asset', icon: '🏦', name: 'Bank Checking', color: '#6366f1' },
  { label: '+ Cash / Wallet', type: 'cash', nature: 'asset', icon: '💵', name: 'Cash in Hand', color: '#10b981' },
  { label: '+ Digital Wallet', type: 'wallet', nature: 'asset', icon: '📱', name: 'Digital Wallet', color: '#06b6d4' },
  { label: '+ Savings Vault', type: 'savings', nature: 'asset', icon: '🪙', name: 'Emergency Savings', color: '#f59e0b' },
  { label: '+ Credit Card', type: 'card', nature: 'liability', icon: '💳', name: 'Credit Card', color: '#ef4444' },
  { label: '+ Loan / Debt Owed', type: 'loan', nature: 'liability', icon: '🤝', name: 'Personal Loan', color: '#8b5cf6' },
];

export default function OnboardingModal({ isOpen, isMandatory = false, onClose }) {
  const { user, profile, updateProfile, markOnboardingComplete } = useAuth();
  const { currentWorkspace, updateWorkspace } = useWorkspace();
  const { accounts: existingAccounts = [], createMultipleAccounts } = useAccounts();

  // Wizard Step: 1 (Profile & Currency), 2 (Accounts & Balances), 3 (Review & Finish)
  const [step, setStep] = useState(1);

  // Step 1 State: Identity & Defaults
  const [fullName, setFullName] = useState(profile.fullName || user?.user_metadata?.full_name || 'My Financial Ledger');
  const [currency, setCurrency] = useState(profile.defaultCurrency || 'USD');
  const [numberFormat, setNumberFormat] = useState(profile.numberFormat || 'intl');
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || 'Personal Space');

  // Step 2 State: Accounts & Initial Balances
  const [accountsList, setAccountsList] = useState(() => {
    return DEFAULT_STARTER_ACCOUNTS.map((acc) => ({
      ...acc,
      currency: profile.defaultCurrency || 'USD',
    }));
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen || isMandatory) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMandatory, onClose]);

  // Synchronize currency changes in Step 1 to accounts that match old currency
  const handleCurrencyChange = (newCur) => {
    setCurrency(newCur);
    setAccountsList((prev) =>
      prev.map((acc) => ({
        ...acc,
        currency: acc.currency === currency ? newCur : acc.currency,
      }))
    );
  };

  // Add Account preset
  const handleAddPreset = (preset) => {
    const newAcc = {
      tempId: `acc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: preset.name,
      type: preset.type,
      nature: preset.nature,
      currency: currency,
      openingBalance: '0.00',
      icon: preset.icon,
      color: preset.color,
    };
    setAccountsList((prev) => [...prev, newAcc]);
  };

  // Update specific account in list
  const handleUpdateAccount = (tempId, field, value) => {
    setAccountsList((prev) =>
      prev.map((acc) => {
        if (acc.tempId !== tempId) return acc;
        const updated = { ...acc, [field]: value };
        // If type changed to card or loan, default to liability
        if (field === 'type') {
          if (['card', 'loan', 'bnpl'].includes(value)) {
            updated.nature = 'liability';
          } else {
            updated.nature = 'asset';
          }
        }
        return updated;
      })
    );
  };

  // Delete account from list
  const handleDeleteAccount = (tempId) => {
    if (accountsList.length <= 1) {
      alert('You need at least one account to start tracking your finances.');
      return;
    }
    setAccountsList((prev) => prev.filter((acc) => acc.tempId !== tempId));
  };

  // Live calculations for initial net worth
  const { totalAssets, totalLiabilities, startingNetWorth } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;

    accountsList.forEach((acc) => {
      const bal = parseFloat(acc.openingBalance) || 0;
      if (acc.nature === 'liability') {
        liabilities += bal;
      } else {
        assets += bal;
      }
    });

    return {
      totalAssets: assets,
      totalLiabilities: liabilities,
      startingNetWorth: assets - liabilities,
    };
  }, [accountsList]);

  // Complete onboarding action
  const handleFinishOnboarding = async () => {
    setSaving(true);
    setErrorMsg('');

    try {
      // 1. Update user profile preferences
      const profileRes = await updateProfile({
        fullName: fullName.trim(),
        defaultCurrency: currency,
        numberFormat,
      });
      if (profileRes?.error) {
        throw new Error(profileRes.error.message || 'Could not save your profile');
      }

      // 2. Update workspace base currency and name if needed
      if (currentWorkspace?.id && currentWorkspace.id !== 'guest-space') {
        await updateWorkspace(currentWorkspace.id, {
          name: workspaceName.trim() || `${fullName}'s Space`,
          base_currency: currency,
        });
      }

      // 3. Insert all configured accounts
      const accountsPayload = accountsList.map((acc) => ({
        name: acc.name.trim() || 'Account',
        type: acc.type,
        nature: acc.nature,
        currency: acc.currency || currency,
        openingBalance: acc.openingBalance || '0.00',
        icon: acc.icon || '🏦',
        color: acc.color || '#6366f1',
      }));

      // Re-running the wizard must never duplicate accounts that already exist
      const existingNames = new Set(
        existingAccounts.map((a) => `${(a.name || '').trim().toLowerCase()}|${a.currency}`)
      );
      const newAccounts = accountsPayload.filter(
        (a) => !existingNames.has(`${a.name.trim().toLowerCase()}|${a.currency}`)
      );

      if (newAccounts.length > 0) {
        const res = await createMultipleAccounts(newAccounts);
        if (res?.error) {
          throw new Error(res.error.message || 'Failed to create accounts');
        }
      }

      // 4. Mark onboarding complete in profile & Supabase
      try {
        localStorage.setItem('expense_pro_onboarding_completed', 'true');
        localStorage.setItem('expense_pro_onboarding_dismissed', 'true');
      } catch {}

      await markOnboardingComplete();

      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('[OnboardingModal] Setup error:', err);
      setErrorMsg(err.message || 'Could not complete setup. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 9999,
        background: 'rgba(5, 7, 13, 0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={() => {
        if (!isMandatory && onClose) onClose();
      }}
    >
      <div
        className="modal-content glass-card"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, var(--md-surface-container))',
          border: '1px solid rgba(var(--md-primary-rgb), 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(var(--md-primary-rgb), 0.15)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Onboarding Header */}
        <div
          style={{
            padding: '1.5rem 1.75rem',
            borderBottom: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.08))',
            background: 'linear-gradient(180deg, rgba(var(--md-primary-rgb), 0.08) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'var(--accent-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                }}
              >
                ✨
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  Welcome to Expense Tracker Pro
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Set up your accounts, starting balances, and preferences to begin tracking.
                </p>
              </div>
            </div>

            {onClose && (
              <button
                className="btn-secondary"
                onClick={onClose}
                style={{ padding: '0.35rem 0.65rem', borderRadius: '8px' }}
                title="Close"
              >
                ✕
              </button>
            )}
          </div>

          {/* Stepper Indicator */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
            {[
              { num: 1, label: 'Identity & Currency' },
              { num: 2, label: 'Accounts & Balances' },
              { num: 3, label: 'Review & Launch' },
            ].map((s) => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <div
                  key={s.num}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    background: isActive
                      ? 'rgba(var(--md-primary-rgb), 0.15)'
                      : isDone
                      ? 'rgba(var(--md-success-rgb), 0.12)'
                      : 'rgba(var(--md-on-surface-rgb), 0.03)',
                    border: `1px solid ${
                      isActive
                        ? 'rgba(var(--md-primary-rgb), 0.4)'
                        : isDone
                        ? 'rgba(var(--md-success-rgb), 0.3)'
                        : 'rgba(var(--md-on-surface-rgb), 0.06)'
                    }`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: isDone ? 'var(--md-success)' : isActive ? 'var(--md-primary)' : 'rgba(var(--md-on-surface-rgb), 0.1)',
                      color: 'var(--md-on-primary)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isDone ? '✓' : s.num}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: isActive ? '700' : '500',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body Scrollable Area */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(var(--md-error-rgb), 0.1)',
                border: '1px solid rgba(var(--md-error-rgb), 0.3)',
                color: 'var(--md-error)',
                fontSize: '0.88rem',
                marginBottom: '1.25rem',
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* ================= STEP 1: IDENTITY & CURRENCY ================= */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="onboard-name">
                  Your Full Name or Business Identity
                </label>
                <input
                  id="onboard-name"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Alex Morgan or TechVanguard LLC"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="onboard-currency">
                    Primary Base Currency
                  </label>
                  <select
                    id="onboard-currency"
                    className="select-field"
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                  >
                    {Object.entries(CURRENCY_REGISTRY).map(([code, cur]) => (
                      <option key={code} value={code}>
                        {code} ({cur.symbol}) — {cur.name}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    All financial reports & net worth calculate in this currency.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="onboard-number-format">
                    Number Grouping System
                  </label>
                  <select
                    id="onboard-number-format"
                    className="select-field"
                    value={numberFormat}
                    onChange={(e) => setNumberFormat(e.target.value)}
                  >
                    <option value="intl">International Standard (1,250,000.00)</option>
                    <option value="lakh">South Asian Lakh / Crore (12,50,000.00)</option>
                  </select>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    Used across all balances, cards, and reports.
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="onboard-workspace">
                  Primary Workspace Name
                </label>
                <input
                  id="onboard-workspace"
                  type="text"
                  className="input-field"
                  placeholder="Personal Ledger"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ================= STEP 2: ACCOUNTS & INITIAL BALANCES ================= */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Add Your Accounts & Starting Balances
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  Add where your money is kept (Bank accounts, cash in wallet, credit cards). These establish your starting net worth.
                </p>
              </div>

              {/* Quick Template Preset Chips */}
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Quick Add Preset Accounts:
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  {PRESET_TEMPLATES.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', borderRadius: '20px' }}
                      onClick={() => handleAddPreset(p)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Net Worth & Liquidity Summary Banner */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(var(--md-primary-rgb), 0.1) 0%, rgba(var(--md-success-rgb), 0.08) 100%)',
                  border: '1px solid rgba(var(--md-primary-rgb), 0.25)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>
                    Starting Net Worth
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: startingNetWorth >= 0 ? 'var(--md-success)' : 'var(--md-error)' }}>
                    {startingNetWorth >= 0 ? '+' : ''}
                    {startingNetWorth.toLocaleString()} {currency}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--md-success)', fontWeight: '600' }}>Total Assets</span>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem', color: 'var(--md-success)' }}>
                      +{totalAssets.toLocaleString()} {currency}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--md-error)', fontWeight: '600' }}>Debts / Cards</span>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem', color: 'var(--md-error)' }}>
                      -{totalLiabilities.toLocaleString()} {currency}
                    </p>
                  </div>
                </div>
              </div>

              {/* List of Accounts being configured */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {accountsList.map((acc, index) => (
                  <div
                    key={acc.tempId}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      background: 'rgba(var(--md-on-surface-rgb), 0.03)',
                      border: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.08))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <span style={{ fontSize: '1.25rem' }}>{acc.icon}</span>
                        <input
                          type="text"
                          className="input-field"
                          style={{ fontWeight: '600', fontSize: '0.95rem', padding: '0.4rem 0.65rem' }}
                          value={acc.name}
                          onChange={(e) => handleUpdateAccount(acc.tempId, 'name', e.target.value)}
                          placeholder="Account Name"
                          required
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(acc.tempId)}
                        className="tx-delete-btn"
                        style={{ padding: '0.35rem 0.5rem', opacity: 0.7 }}
                        title="Delete account"
                      >
                        🗑️
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                      {/* Account Type */}
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Type</label>
                        <select
                          className="select-field"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          value={acc.type}
                          onChange={(e) => handleUpdateAccount(acc.tempId, 'type', e.target.value)}
                        >
                          <option value="bank">🏦 Bank Checking</option>
                          <option value="cash">💵 Cash / Wallet</option>
                          <option value="savings">🪙 Savings Vault</option>
                          <option value="wallet">📱 Digital Wallet</option>
                          <option value="card">💳 Credit Card</option>
                          <option value="investment">📈 Investment</option>
                          <option value="loan">🤝 Loan Owed</option>
                        </select>
                      </div>

                      {/* Nature */}
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nature</label>
                        <select
                          className="select-field"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          value={acc.nature}
                          onChange={(e) => handleUpdateAccount(acc.tempId, 'nature', e.target.value)}
                        >
                          <option value="asset">🟢 Asset (Money You Own)</option>
                          <option value="liability">🔴 Liability (Debt You Owe)</option>
                        </select>
                      </div>

                      {/* Currency */}
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Currency</label>
                        <select
                          className="select-field"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          value={acc.currency}
                          onChange={(e) => handleUpdateAccount(acc.tempId, 'currency', e.target.value)}
                        >
                          {Object.keys(CURRENCY_REGISTRY).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Initial Opening Balance */}
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '700' }}>
                          Starting Balance
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', fontWeight: '700' }}
                          value={acc.openingBalance}
                          onChange={(e) => handleUpdateAccount(acc.tempId, 'openingBalance', e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= STEP 3: REVIEW & LAUNCH ================= */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🎉</span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  Ready to Launch Your Financial Workspace!
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0.35rem auto 0 auto', maxWidth: '480px' }}>
                  We'll initialize your workspace, book your starting account balances, and configure your multi-currency ledger.
                </p>
              </div>

              {/* Review summary cards */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  background: 'rgba(var(--md-on-surface-rgb), 0.04)',
                  border: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.08))', paddingBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>User & Workspace</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontWeight: '700' }}>
                      {fullName} · {workspaceName}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Base Currency</span>
                    <p style={{ margin: '0.2rem 0 0 0', fontWeight: '700' }}>
                      {currency} ({numberFormat === 'lakh' ? 'Lakh/Crore' : 'International'})
                    </p>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
                    Configured Accounts ({accountsList.length}):
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {accountsList.map((acc, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          background: 'rgba(var(--md-on-surface-rgb), 0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{acc.icon}</span>
                          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{acc.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                            ({acc.nature})
                          </span>
                        </div>
                        <span
                          style={{
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            color: acc.nature === 'liability' ? 'var(--md-error)' : 'var(--md-success)',
                          }}
                        >
                          {acc.nature === 'liability' ? '-' : '+'}
                          {parseFloat(acc.openingBalance || 0).toLocaleString()} {acc.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.08))',
                  }}
                >
                  <span style={{ fontWeight: '700', fontSize: '1rem' }}>Starting Net Balance:</span>
                  <span
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      color: startingNetWorth >= 0 ? 'var(--md-success)' : 'var(--md-error)',
                    }}
                  >
                    {startingNetWorth >= 0 ? '+' : ''}
                    {startingNetWorth.toLocaleString()} {currency}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderTop: '1px solid var(--border-subtle, rgba(var(--md-on-surface-rgb), 0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep(step - 1)}
              disabled={saving}
              style={{ padding: '0.55rem 1.1rem' }}
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              className="submit-btn primary-glow"
              onClick={() => {
                if (step === 1 && !fullName.trim()) {
                  alert('Please enter your name.');
                  return;
                }
                setStep(step + 1);
              }}
              style={{ padding: '0.55rem 1.35rem', marginLeft: 'auto' }}
            >
              Continue to {step === 1 ? 'Accounts Setup' : 'Review'} →
            </button>
          ) : (
            <button
              type="button"
              className="submit-btn primary-glow"
              disabled={saving}
              onClick={handleFinishOnboarding}
              style={{
                padding: '0.65rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, var(--md-success) 0%, var(--md-primary) 100%)',
                marginLeft: 'auto',
              }}
            >
              {saving ? 'Setting Up Your Ledger...' : '🚀 Finish & Open Dashboard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
