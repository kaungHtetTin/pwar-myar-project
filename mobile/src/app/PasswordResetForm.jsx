import { Button, Input } from '../components/Controls';
import React, { useEffect, useId, useRef, useState } from 'react';
import { apiRequest } from '../api/client';

export function PasswordResetForm({ onBack }) {
  const id = useId(), sending = useRef(false);
  const [form, setForm] = useState({ email: '', code: '', password: '', password_confirmation: '' });
  const [sent, setSent] = useState(false), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [errors, setErrors] = useState({}), [notice, setNotice] = useState(''), [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function send(reset = false) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(''); setErrors({}); setNotice('');
    try {
      const result = await apiRequest(`/auth/${reset ? 'reset-password' : 'forgot-password'}`, { method: 'POST', body: JSON.stringify(reset ? form : { email: form.email }) });
      if (reset) { setDone(true); setForm({ email: '', code: '', password: '', password_confirmation: '' }); }
      else { setSent(true); setCooldown(result.resend_after || 60); field('code', ''); setNotice(result.message); }
    } catch (e) { setError(e.message); setErrors(e.payload?.errors || {}); }
    finally { sending.current = false; setBusy(false); }
  }
  function input(key, label, props = {}) {
    return <label className="password-reset-field" htmlFor={`${id}-${key}`}>{label}<Input id={`${id}-${key}`} name={key} aria-label={label} value={form[key]} onChange={event => field(key, event.target.value)} required aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-${key}-error` : undefined} {...props} />{errors[key] && <small id={`${id}-${key}-error`} role="alert">{errors[key][0]}</small>}</label>;
  }
  if (done) return <section className="password-reset-form"><h2>Password reset</h2><p role="status">Your password has been changed. Sign in with your new password.</p><Button variant="primary" type="button" className="primary-button primary" onClick={onBack}>Back to sign in</Button></section>;
  return <form className="password-reset-form" onSubmit={event => { event.preventDefault(); send(sent); }}>
    <h2>Forgot password?</h2><p>{sent ? 'Enter the 6-digit code from your email and choose a new password. The code expires in 10 minutes.' : 'Enter your account email address to receive a password reset code.'}</p>
    <fieldset disabled={busy}>
      {input('email', 'Email address', { type: 'email', autoComplete: 'email', maxLength: 255, readOnly: sent })}
      {sent && <>{input('code', 'Email verification code', { type: 'text', inputMode: 'numeric', autoComplete: 'one-time-code', pattern: '[0-9]{6}', minLength: 6, maxLength: 6 })}{input('password', 'New password', { type: 'password', autoComplete: 'new-password', minLength: 8, maxLength: 128 })}{input('password_confirmation', 'Confirm new password', { type: 'password', autoComplete: 'new-password', minLength: 8, maxLength: 128 })}</>}
      {error && <p className="password-reset-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <Button variant="primary" className="primary-button primary" type="submit" disabled={busy}>{busy ? 'Please wait...' : sent ? 'Reset password' : 'Send reset code'}</Button>
      {sent && <><Button variant="plain" type="button" disabled={busy || cooldown > 0} onClick={() => send(false)}>{cooldown ? `Resend code in ${cooldown}s` : 'Resend code'}</Button><Button variant="plain" type="button" onClick={() => { setSent(false); setError(''); setErrors({}); setNotice(''); setForm(current => ({ ...current, code: '', password: '', password_confirmation: '' })); }}>Use a different email</Button></>}
      <Button variant="plain" type="button" onClick={onBack}>Back to sign in</Button>
    </fieldset>
  </form>;
}
