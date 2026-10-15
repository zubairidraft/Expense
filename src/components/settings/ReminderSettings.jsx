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
        setMsg('Phone settings mein jaa kar app ki notifications allow karo.');
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
      setMsg('Email reminder setting save nahi hui. Pehle reminders migration run karni hogi.');
    }
  };

  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderTop: '1px solid rgba(148,163,184,0.2)' };

  return (
    <div className="card glass-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <h3 style={{ margin: 0 }}>🔔 Reminders</h3>
      <p style={{ opacity: 0.75, fontSize: '0.88rem', margin: '0.35rem 0 0.75rem' }}>
        Bill due, budget limit (80%) aur udhaar wapsi ka din — yaad dilane ke liye.
      </p>

      <label style={row}>
        <span>
          <strong>Phone notifications</strong>
          <br />
          <small style={{ opacity: 0.7 }}>
            {native ? 'Is device par subah 9 baje reminder.' : 'Sirf Android app mein kaam karta hai.'}
          </small>
        </span>
        <input type="checkbox" checked={phoneOn && native} disabled={!native} onChange={(e) => togglePhone(e.target.checked)} />
      </label>

      <label style={row}>
        <span>
          <strong>Email reminders</strong>
          <br />
          <small style={{ opacity: 0.7 }}>
            {user ? `Roz subah ek email ${user.email} par.` : 'Login karne par available.'}
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
          Email reminders abhi setup nahi hain (database migration baaki hai).
        </p>
      )}
      {msg && <p role="alert" style={{ fontSize: '0.82rem', color: '#d97706', marginBottom: 0 }}>{msg}</p>}
    </div>
  );
}
