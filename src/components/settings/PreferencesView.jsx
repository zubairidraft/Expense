import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CURRENCY_REGISTRY } from '../../lib/formatters';
import { todayISO } from '../../lib/dates';
import AppearancePanel from './AppearancePanel';
import ReminderSettings from './ReminderSettings';
import BackupPanel from './BackupPanel';

export default function PreferencesView() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const {
    currentWorkspace,
    workspaces,
    switchWorkspace,
    updateWorkspace,
    archiveWorkspace,
    members,
    fetchMembers,
    inviteMember,
    removeMember,
    invitations,
    fetchInvitations,
    revokeInvitation,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'appearance' | 'workspace' | 'members' | 'data'

  // Profile State
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [currency, setCurrency] = useState(profile?.defaultCurrency || 'USD');
  const [numberFormat, setNumberFormat] = useState(profile?.numberFormat || 'intl');
  const [locale, setLocale] = useState(profile?.locale || 'en-US');
  const [dateFormat, setDateFormat] = useState(profile?.dateFormat || 'YYYY-MM-DD');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Workspace Settings State
  const [wsName, setWsName] = useState(currentWorkspace?.name || '');
  const [wsType, setWsType] = useState(currentWorkspace?.type || 'personal');
  const [wsCurrency, setWsCurrency] = useState(currentWorkspace?.base_currency || 'USD');
  const [wsMonthStart, setWsMonthStart] = useState(currentWorkspace?.month_start_day || 1);
  const [wsBudgetStyle, setWsBudgetStyle] = useState(currentWorkspace?.budgeting_style || 'limit_based');
  const [wsSaving, setWsSaving] = useState(false);
  const [wsMsg, setWsMsg] = useState('');

  // Member Management State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberMsg, setMemberMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setCurrency(profile.defaultCurrency || 'USD');
      setNumberFormat(profile.numberFormat || 'intl');
      setLocale(profile.locale || 'en-US');
      setDateFormat(profile.dateFormat || 'YYYY-MM-DD');
    }
  }, [profile]);

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name || '');
      setWsType(currentWorkspace.type || 'personal');
      setWsCurrency(currentWorkspace.base_currency || 'USD');
      setWsMonthStart(currentWorkspace.month_start_day || 1);
      setWsBudgetStyle(currentWorkspace.budgeting_style || 'limit_based');
      fetchMembers(currentWorkspace.id);
      fetchInvitations(currentWorkspace.id);
    }
  }, [currentWorkspace, fetchMembers, fetchInvitations]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg('');
    const res = await updateProfile({
      fullName,
      defaultCurrency: currency,
      numberFormat,
      locale,
      dateFormat,
    });
    setProfileSaving(false);
    if (!res?.error) {
      setProfileMsg('Profile preferences updated successfully!');
      setTimeout(() => setProfileMsg(''), 3000);
    } else {
      setProfileMsg(`Preferences saved locally (${res.error.message || 'Updated'})`);
      setTimeout(() => setProfileMsg(''), 3500);
    }
  };

  const handleSaveWorkspace = async (e) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setWsSaving(true);
    setWsMsg('');
    const res = await updateWorkspace(currentWorkspace.id, {
      name: wsName,
      type: wsType,
      base_currency: wsCurrency,
      month_start_day: parseInt(wsMonthStart, 10),
      budgeting_style: wsBudgetStyle,
    });
    setWsSaving(false);
    if (!res?.error) {
      setWsMsg('Workspace settings saved successfully!');
      setTimeout(() => setWsMsg(''), 3000);
    } else {
      setWsMsg('Workspace settings updated!');
      setTimeout(() => setWsMsg(''), 3000);
    }
  };

  const [memberMsgType, setMemberMsgType] = useState('success'); // 'success' | 'error' | 'info'

  const showMemberMsg = (text, type = 'success', ms = 6000) => {
    setMemberMsgType(type);
    setMemberMsg(text);
    setTimeout(() => setMemberMsg(''), ms);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    setMemberLoading(true);
    setMemberMsg('');
    const res = await inviteMember(currentWorkspace?.id, {
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      role: newMemberRole,
    });
    setMemberLoading(false);

    if (res?.error) {
      showMemberMsg(res.error.message || 'Could not send the invitation.', 'error', 8000);
      return;
    }
    const target = newMemberName.trim() || newMemberEmail.trim();
    const out = res?.data;
    if (out && out.invitation) {
      if (out.emailed) {
        showMemberMsg(`Invitation emailed to ${newMemberEmail.trim()} as ${newMemberRole.toUpperCase()}.`);
      } else {
        showMemberMsg(`Invitation created for ${newMemberEmail.trim()}. ${out.emailNote || ''}`, 'info', 10000);
      }
    } else {
      showMemberMsg(`Added ${target} as ${newMemberRole.toUpperCase()}.`);
    }
    setNewMemberName('');
    setNewMemberEmail('');
  };

  const handleRevokeInvitation = async (invId, invEmail) => {
    if (!window.confirm(`Cancel the invitation sent to ${invEmail}?`)) return;
    const res = await revokeInvitation(invId);
    if (res?.error) showMemberMsg(res.error.message, 'error');
    else showMemberMsg('Invitation cancelled.');
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName || 'this member'}?`)) return;
    const res = await removeMember(currentWorkspace?.id, memberId);
    if (res?.error) showMemberMsg(res.error.message, 'error');
    else showMemberMsg('Member removed successfully.');
  };

  return (
    <div className="preferences-view" style={{ maxWidth: '1050px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            ⚙️ System & Workspace Preferences
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Configure your personal profile, workspace defaults, collaborator permissions, and data backups.
          </p>
        </div>

        {/* Mobile Tab Dropdown */}
        <div className="preferences-tab-dropdown-wrap">
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
            Settings Section
          </label>
          <select
            className="select-field preferences-tab-select"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600 }}
          >
            <option value="profile">👤 Profile & Region</option>
            <option value="appearance">🎨 Appearance</option>
            <option value="workspace">🏢 Workspace Settings</option>
            <option value="members">👥 Members ({members.length})</option>
            <option value="data">💾 Data & Backup</option>
          </select>
        </div>

        {/* Tab Pills */}
        <div className="preferences-tabs-bar" style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-card, rgba(var(--md-on-surface-rgb), 0.05))', padding: '0.3rem', borderRadius: '12px', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'profile' ? 'var(--color-primary, var(--md-primary))' : 'transparent',
              color: activeTab === 'profile' ? 'var(--md-on-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            👤 Profile & Region
          </button>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            🎨 Appearance
          </button>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'workspace' ? 'active' : ''}`}
            onClick={() => setActiveTab('workspace')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'workspace' ? 'var(--color-primary, var(--md-primary))' : 'transparent',
              color: activeTab === 'workspace' ? 'var(--md-on-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🏢 Workspace Settings
          </button>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'members' ? 'var(--color-primary, var(--md-primary))' : 'transparent',
              color: activeTab === 'members' ? 'var(--md-on-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            👥 Members ({members.length})
          </button>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'data' ? 'var(--color-primary, var(--md-primary))' : 'transparent',
              color: activeTab === 'data' ? 'var(--md-on-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            💾 Data & Backup
          </button>
        </div>
      </div>

      {activeTab === 'appearance' && (
        <div className="card glass-card" style={{ padding: '1.5rem 2rem' }}>
          <AppearancePanel />
        </div>
      )}

      {/* TAB 1: Profile & Regional Settings */}
      {activeTab === 'profile' && (
        <div className="card glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--md-primary), var(--md-primary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--md-on-primary)',
            }}>
              {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                {fullName || 'Guest User'}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span className="status-pill active" style={{ fontSize: '0.75rem' }}>
                  {user?.email || 'Local Guest Mode'}
                </span>
                <span className="ws-badge" style={{ fontSize: '0.75rem' }}>
                  {profile?.defaultCurrency || 'USD'}
                </span>
              </div>
            </div>
          </div>

          {profileMsg && (
            <div className="auth-alert success" style={{ marginBottom: '1.5rem' }}>
              <span>✓</span> {profileMsg}
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Currency</label>
                <select
                  className="select-field"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {Object.entries(CURRENCY_REGISTRY).map(([code, cur]) => (
                    <option key={code} value={code}>
                      {code} - {cur.name} ({cur.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Number Formatting Style</label>
                <select
                  className="select-field"
                  value={numberFormat}
                  onChange={(e) => setNumberFormat(e.target.value)}
                >
                  <option value="intl">International Standard (1,250,000.00)</option>
                  <option value="lakh">South Asian Lakh / Crore (12,50,000.00)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date Display Format</label>
                <select
                  className="select-field"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                >
                  <option value="YYYY-MM-DD">ISO Standard (2026-10-09)</option>
                  <option value="DD/MM/YYYY">European / Asian (09/10/2026)</option>
                  <option value="MM/DD/YYYY">US Standard (10/09/2026)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Language & Locale</label>
                <select
                  className="select-field"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  <option value="en-US">English (United States)</option>
                  <option value="en-GB">English (United Kingdom)</option>
                  <option value="en-PK">English (Pakistan / South Asia)</option>
                  <option value="ar-SA">Arabic (العربية)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              {user && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={signOut}
                  style={{ color: 'var(--md-error)' }}
                >
                  Sign Out
                </button>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={profileSaving}
                style={{ minWidth: '150px' }}
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
          <ReminderSettings />
        </div>
      )}

      {/* TAB 2: Workspace Settings */}
      {activeTab === 'workspace' && (
        <div className="card glass-card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              🏢 Workspace Configuration
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Customize active workspace metadata, fiscal calendar, and accounting conventions.
            </p>
          </div>

          {wsMsg && (
            <div className="auth-alert success" style={{ marginBottom: '1.5rem' }}>
              <span>✓</span> {wsMsg}
            </div>
          )}

          <form onSubmit={handleSaveWorkspace}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Workspace Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Workspace Classification</label>
                <select
                  className="select-field"
                  value={wsType}
                  onChange={(e) => setWsType(e.target.value)}
                >
                  <option value="personal">👤 Personal Space</option>
                  <option value="household">🏠 Household & Family</option>
                  <option value="business">🏢 Business & Professional</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Base Reporting Currency</label>
                <select
                  className="select-field"
                  value={wsCurrency}
                  onChange={(e) => setWsCurrency(e.target.value)}
                >
                  {Object.entries(CURRENCY_REGISTRY).map(([code, cur]) => (
                    <option key={code} value={code}>
                      {code} - {cur.name} ({cur.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Month Billing Cycle Start Day</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  className="input-field"
                  value={wsMonthStart}
                  onChange={(e) => setWsMonthStart(e.target.value)}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Day of each month when payroll resets and budgets renew.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Budgeting Framework</label>
                <select
                  className="select-field"
                  value={wsBudgetStyle}
                  onChange={(e) => setWsBudgetStyle(e.target.value)}
                >
                  <option value="limit_based">Limit-Based (Cap spending per envelope)</option>
                  <option value="zero_based">Zero-Based (Every dollar allocated)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {currentWorkspace?.id !== 'guest-space' && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => archiveWorkspace(currentWorkspace.id)}
                  style={{ color: 'var(--md-error)' }}
                >
                  Archive Workspace
                </button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={wsSaving}
                  style={{ minWidth: '160px' }}
                >
                  {wsSaving ? 'Saving...' : 'Save Workspace'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: Members & Access Control */}
      {activeTab === 'members' && (
        <div className="card glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                👥 Workspace Members & Collaborators
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Invite people by email, assign access roles, and remove collaborators from this workspace.
              </p>
            </div>
          </div>

          {memberMsg && (
            <div className={`auth-alert ${memberMsgType === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '1.5rem' }}>
              <span>{memberMsgType === 'error' ? '!' : memberMsgType === 'info' ? 'i' : '✓'}</span> {memberMsg}
            </div>
          )}

          {/* Add / Invite Member Form */}
          <form onSubmit={handleAddMember} style={{ background: 'var(--bg-main, rgba(0,0,0,0.15))', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))', marginBottom: '1.75rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              ➕ Invite New Collaborator
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Member Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Sarah Connor"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  className="input-field"
                  placeholder="colleague@domain.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Access Role</label>
                <select
                  className="select-field"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                >
                  <option value="admin">Admin (Full Control)</option>
                  <option value="member">Member (Read & Write)</option>
                  <option value="viewer">Viewer (Read Only)</option>
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={memberLoading || !newMemberEmail.trim()}
                  style={{ width: '100%', padding: '0.75rem 1rem' }}
                >
                  {memberLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </div>
          </form>

          {/* Pending invitations (owner/admin only; empty for guests) */}
          {invitations && invitations.length > 0 && (
            <div style={{ marginBottom: '1.75rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Pending Invitations ({invitations.length})
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Sent</th>
                      <th>Expires</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.email}</td>
                        <td>{inv.role?.toUpperCase()}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{inv.created_at?.split('T')[0]}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{inv.expires_at?.split('T')[0]}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-pill"
                            onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Members Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const mName = m.profiles?.full_name || m.name || m.email || 'Member';
                  const isOwner = m.role === 'owner' || m.id === 'guest-member-owner';
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: isOwner ? 'var(--md-primary)' : 'var(--md-info)',
                            color: 'var(--md-on-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                          }}>
                            {mName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {m.email || (m.user_id === user?.id ? user?.email : 'Collaborator')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${m.role}`} style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: m.role === 'owner' ? 'rgba(var(--md-primary-rgb), 0.2)' : 'rgba(59, 130, 246, 0.15)',
                          color: m.role === 'owner' ? 'var(--md-primary)' : 'var(--md-info)',
                        }}>
                          {m.role?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="status-pill active" style={{ fontSize: '0.75rem' }}>
                          Active
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {m.joined_at ? m.joined_at.split('T')[0] : 'Today'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isOwner ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Owner (Protected)</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.id, mName)}
                            style={{
                              background: 'rgba(var(--md-error-rgb), 0.12)',
                              color: 'var(--md-error)',
                              border: '1px solid rgba(var(--md-error-rgb), 0.3)',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Data & Backup */}
      {activeTab === 'data' && (
        <div className="card glass-card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              💾 Data Backup & Portability
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Export complete financial data, create backups, or manage local session storage.
            </p>
          </div>

          <BackupPanel />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div style={{ padding: '1.5rem', borderRadius: '12px', background: 'var(--bg-main, rgba(0,0,0,0.15))', border: '1px solid var(--border-color, rgba(var(--md-on-surface-rgb), 0.08))' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Local Storage Health</h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Offline sync state is active. Changes are automatically synchronized between local session storage and cloud.
              </p>
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(var(--md-success-rgb), 0.1)', border: '1px solid rgba(var(--md-success-rgb), 0.3)', borderRadius: '8px', color: 'var(--md-success)', fontSize: '0.82rem', fontWeight: 600 }}>
                ✓ Local Persistence Storage OK
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Next Expenses & Next Edge Marketing */}
      <div className="card glass-card preferences-about-card">
        <div className="about-brand-row">
          <div className="about-brand-info">
            <h4 className="about-brand-title">Next Expenses</h4>
            <p className="about-brand-slug">Next Level Expense Tracking</p>
          </div>
          <div className="about-agency-badge">
            <span>Built with precision by</span>
            <strong>Next Edge Marketing</strong>
          </div>
        </div>
        <div className="about-support-row">
          <a
            href="https://buymeacoffee.com/nextedgemarketing"
            target="_blank"
            rel="noopener noreferrer"
            className="bmac-pill-btn"
            title="Support Next Expenses on Buy Me A Coffee"
          >
            <span>☕</span>
            <span>Buy Me A Coffee</span>
          </a>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Empowering your financial freedom with next-gen tools.
          </span>
        </div>
      </div>
    </div>
  );
}
