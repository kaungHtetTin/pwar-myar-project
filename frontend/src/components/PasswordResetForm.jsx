import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, Send, ShieldCheck } from 'lucide-react';
import { request } from '../api';
import './password-reset.css';

export function PasswordResetForm({ onBack }) {
  const id = useId(), sending = useRef(false);
  const [form, setForm] = useState({ email: '', code: '', password: '', password_confirmation: '' });
  const [visible, setVisible] = useState({});
  const [sent, setSent] = useState(false), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [errors, setErrors] = useState({}), [notice, setNotice] = useState(''), [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function send(reset = false) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(''); setErrors({}); setNotice('');
    try {
      const result = await request(`/auth/${reset ? 'reset-password' : 'forgot-password'}`, { method: 'POST', body: JSON.stringify(reset ? form : { email: form.email }) });
      if (reset) { setDone(true); setForm({ email: '', code: '', password: '', password_confirmation: '' }); }
      else { setSent(true); setCooldown(result.resend_after || 60); field('code', ''); setNotice(result.message); }
    } catch (e) { setError(e.message); setErrors(e.payload?.errors || {}); }
    finally { sending.current = false; setBusy(false); }
  }
  function input(key, label, props = {}) {
    const password = key.startsWith('password');
    const Icon = key === 'email' ? Mail : password ? LockKeyhole : KeyRound;
    return <label htmlFor={`${id}-${key}`}>{label}<span className={`auth-split-input${password ? ' auth-split-password' : ''}`}><Icon size={16} aria-hidden="true" /><input id={`${id}-${key}`} name={key} aria-label={label} value={form[key]} onChange={event => field(key, event.target.value)} required aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-${key}-error` : undefined} {...props} type={password && visible[key] ? 'text' : props.type} />{password && <button type="button" aria-label={`${visible[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setVisible(current => ({ ...current, [key]: !current[key] }))}>{visible[key] ? <EyeOff size={16} /> : <Eye size={16} />}</button>}</span>{errors[key] && <small className="auth-reset-field-error" id={`${id}-${key}-error`} role="alert">{errors[key][0]}</small>}</label>;
  }
  if (done) return <section className="password-reset-form"><div className="auth-split-heading"><span><Check size={19} aria-hidden="true" /></span><div><h2>Password reset</h2><p role="status">Your password has been changed. Sign in with your new password.</p></div></div><button type="button" className="auth-submit auth-split-submit" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to sign in</button></section>;
  return <form className="password-reset-form" onSubmit={event => { event.preventDefault(); send(sent); }}>
    <div className="auth-split-heading"><span><LockKeyhole size={19} aria-hidden="true" /></span><div><h2>Forgot password?</h2><p>{sent ? 'Enter your email code and choose a new password.' : 'Receive a reset code at your account email address.'}</p></div></div>
    <fieldset className="auth-form password-reset-fields" disabled={busy}>
      {input('email', 'Email address', { type: 'email', autoComplete: 'email', placeholder: 'owner@example.com', maxLength: 255, readOnly: sent })}
      {sent && <>{input('code', 'Email verification code', { type: 'text', inputMode: 'numeric', autoComplete: 'one-time-code', placeholder: '6-digit code', pattern: '[0-9]{6}', minLength: 6, maxLength: 6 })}{input('password', 'New password', { type: 'password', autoComplete: 'new-password', placeholder: 'At least 8 characters', minLength: 8, maxLength: 128 })}{input('password_confirmation', 'Confirm new password', { type: 'password', autoComplete: 'new-password', placeholder: 'Repeat your password', minLength: 8, maxLength: 128 })}</>}
      {error && <div className="auth-error" role="alert">{error}</div>}{notice && <p className="auth-reset-notice" role="status">{notice}</p>}
      <button className="auth-submit auth-split-submit" type="submit" disabled={busy}>{sent ? <LockKeyhole size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{busy ? 'Please wait...' : sent ? 'Reset password' : 'Send reset code'}</button>
      {sent && <div className="auth-reset-links"><button type="button" disabled={busy || cooldown > 0} onClick={() => send(false)}>{cooldown ? `Resend code in ${cooldown}s` : 'Resend code'}</button><button type="button" onClick={() => { setSent(false); setError(''); setErrors({}); setNotice(''); setForm(current => ({ ...current, code: '', password: '', password_confirmation: '' })); }}>Use a different email</button></div>}
      <div className="auth-split-switch"><button type="button" onClick={onBack}><ArrowLeft size={14} aria-hidden="true" />Back to sign in</button></div>
    </fieldset>
    <p className="auth-split-help"><ShieldCheck size={14} aria-hidden="true" />{sent ? 'Your code expires in 10 minutes. Never share it.' : 'Secure recovery for your business account.'}</p>
  </form>;
}
