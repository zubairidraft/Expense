import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  canUseNativeReminders,
  ensureReminderPermission,
  isLocalReminderEnabled,
  setLocalReminderEnabled,
} from '../../lib/localReminders';

/**
 * Reminder preferences: Android phone notifications (this device) and
 * email reminders (account-wide, needs the reminders migration).
 */
export default function ReminderSettings() {
  const { user } = useAuth();
  const [phoneOn, setPhoneOn] = useState(isLocalReminderEnabled());
  const [emailOn, setEmailOn] = useState(true);
  const [emailSupported, setEmailSupported] = useState(true);
  const [msg, setMsg] = useState('');
  const native = canUseNativeReminders();

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('email_reminders').eq('id', user.id).maybeSingle();
      if (!alive) return;
      if (error) {
        setEmailSupported(false);
        return;
      }
      if (data && typeof data.email_reminders === 'boolean') setEmailOn(data.email_reminders);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const togglePhone = async (on) => {
    setMsg('');
    if (on) {
      const ok = await ensureReminderPermission();
      if (!ok) {
        setMsg('Please enable notification permissions in your phone settings.');
        return;
      }
    }
    setLocalReminderEnabled(on);
    setPhoneOn(on);
  };

  const toggleEmail = async (on) => {
    setMsg('');
    setEmailOn(on);
    const { error } = await supabase.from('profiles').update({ email_reminders: on }).eq('id', user.id);
    if (error) {
      setEmailOn(!on);
      setMsg('Could not save email reminder preference. Database migration pending.');
    }
  };

  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderTop: '1px solid rgba(148,163,184,0.2)' };

  return (
    <div className="card glass-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <h3 style={{ margin: 0 }}>🔔 Reminders</h3>
      <p style={{ opacity: 0.75, fontSize: '0.88rem', margin: '0.35rem 0 0.75rem' }}>
        Timely alerts for due bills, budget limits (80%), and loan settlement dates.
      </p>

      <label style={row}>
        <span>
          <strong>Phone notifications</strong>
          <br />
          <small style={{ opacity: 0.7 }}>
            {native ? 'Daily reminder at 9:00 AM on this device.' : 'Supported on the Android app.'}
          </small>
        </span>
        <input type="checkbox" checked={phoneOn && native} disabled={!native} onChange={(e) => togglePhone(e.target.checked)} />
      </label>

      <label style={row}>
        <span>
          <strong>Email reminders</strong>
          <br />
          <small style={{ opacity: 0.7 }}>
            {user ? `Daily morning email summary to ${user.email}.` : 'Available once signed in.'}
          </small>
        </span>
        <input
          type="checkbox"
          checked={emailOn && emailSupported}
          disabled={!user || !emailSupported}
          onChange={(e) => toggleEmail(e.target.checked)}
        />
      </label>

      {!emailSupported && (
        <p style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: 0 }}>
          Email reminders are not configured yet (database migration pending).
        </p>
      )}
      {msg && <p role="alert" style={{ fontSize: '0.82rem', color: '#d97706', marginBottom: 0 }}>{msg}</p>}
    </div>
  );
}
