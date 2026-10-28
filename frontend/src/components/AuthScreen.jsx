import { AuthLocaleToggle } from './AuthLocaleToggle';
import { BrandImage } from '../platformBranding';
import { PasswordResetForm } from './PasswordResetForm';
import React, { useState } from 'react';
import { RetainedViews } from './RetainedViews';
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Store,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { request } from '../api';
import { BRAND_LOGO } from '../assets';

function AuthIntro({ page }) {
  const signup = page === 'signup';
  return (
    <section className="auth-split-intro">
      <div className="auth-split-brand">
        <span><BrandImage src={BRAND_LOGO} alt="" /></span>
        <div><strong>PwarMyar</strong><small>Business workspace</small></div>
      </div>
      <div className="auth-split-copy">
        <span className="auth-split-kicker"><ShieldCheck size={14} /> {signup ? 'Your business, your workspace' : 'Secure business access'}</span>
        <h1>{signup ? 'Start running your business with clarity.' : 'Everything your business needs, ready when you are.'}</h1>
        <p>{signup ? 'Create an isolated workspace for sales, inventory, purchasing, customers, and reporting.' : 'Sign in to manage daily sales, inventory, customers, purchases, and business reports.'}</p>
      </div>
      <div className="auth-split-points">
        <div><Check size={15} /><span><strong>Private business data</strong><small>Every account has an isolated workspace</small></span></div>
        <div><Check size={15} /><span><strong>Built for daily operations</strong><small>Fast POS tools in one compact console</small></span></div>
      </div>
      <small className="auth-split-copyright">PwarMyar Business Management Platform</small>
    </section>
  );
}

function PasswordInput({ value, onChange, visible, onToggle, autoComplete, placeholder = 'At least 8 characters', confirmation = false }) {
  return (
    <span className="auth-split-input auth-split-password">
      <LockKeyhole size={16} />
      <input required minLength={8} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} placeholder={placeholder} />
      {!confirmation && <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={onToggle}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
    </span>
  );
}

function LoginPage({ onAuthenticated, onNavigate }) {
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onAuthenticated(session);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-split-page">
      <div className="auth-split-shell">
        <AuthIntro page="login" />
        <form className="auth-split-form" onSubmit={submit} aria-labelledby="login-title">
          <AuthLocaleToggle />
          <div className="auth-split-heading">
            <span><LogIn size={19} /></span>
            <div><h2 id="login-title">Welcome back</h2><p>Sign in to open your business workspace.</p></div>
          </div>
          <div className="auth-form">
            <label>
              Email address
              <span className="auth-split-input"><Mail size={16} /><input autoFocus required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="owner@example.com" /></span>
            </label>
            <label>
              Password
              <PasswordInput value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="current-password" />
            </label>
            <div className="auth-split-options">
              <label className="auth-split-remember"><input type="checkbox" checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} /><span>Keep me signed in on this device</span></label>
              <a className="auth-split-forgot" href="/forgot-password" onClick={event => { event.preventDefault(); onNavigate('forgot-password'); }}>Forgot password?</a>
            </div>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit auth-split-submit" type="submit" disabled={busy}><LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in to PwarMyar'}</button>
          </div>
          <div className="auth-split-switch"><span>New to PwarMyar?</span><a href="/signup" onClick={(event) => { event.preventDefault(); onNavigate('signup'); }}>Create business account</a></div>
          <p className="auth-split-help"><ShieldCheck size={14} /> Secure authentication for this deployment.</p>
        </form>
      </div>
    </main>
  );
}

function SignupPage({ onAuthenticated, onNavigate }) {
  const [form, setForm] = useState({ business_name: '', owner_name: '', email: '', password: '', password_confirmation: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onAuthenticated(session);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-split-page">
      <div className="auth-split-shell auth-signup-shell">
        <AuthIntro page="signup" />
        <form className="auth-split-form auth-signup-form" onSubmit={submit} aria-labelledby="signup-title">
          <AuthLocaleToggle />
          <div className="auth-split-heading">
            <span><Building2 size={19} /></span>
            <div><h2 id="signup-title">Create your business</h2><p>Set up your owner account and private PwarMyar workspace.</p></div>
          </div>
          <div className="auth-form auth-signup-fields">
            <div className="auth-split-grid">
              <label>Business name<span className="auth-split-input"><Store size={16} /><input autoFocus required value={form.business_name} onChange={(event) => update('business_name', event.target.value)} placeholder="Example Store" /></span></label>
              <label>Owner name<span className="auth-split-input"><UserRound size={16} /><input required autoComplete="name" value={form.owner_name} onChange={(event) => update('owner_name', event.target.value)} placeholder="Your full name" /></span></label>
            </div>
            <label>Email address<span className="auth-split-input"><Mail size={16} /><input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="owner@example.com" /></span></label>
            <div className="auth-split-grid">
              <label>Password<PasswordInput value={form.password} onChange={(event) => update('password', event.target.value)} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" /></label>
              <label>Confirm password<PasswordInput value={form.password_confirmation} onChange={(event) => update('password_confirmation', event.target.value)} visible={showPassword} autoComplete="new-password" placeholder="Repeat your password" confirmation /></label>
            </div>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit auth-split-submit" type="submit" disabled={busy}><UserPlus size={16} /> {busy ? 'Creating workspace…' : 'Create business account'}</button>
          </div>
          <div className="auth-split-switch"><span>Already have an account?</span><a href="/login" onClick={(event) => { event.preventDefault(); onNavigate('login'); }}>Sign in instead</a></div>
        </form>
      </div>
    </main>
  );
}

export function AuthScreen({ page = 'login', onAuthenticated, onNavigate = () => {} }) {
  return <RetainedViews activeKey={page}>{page === 'forgot-password' ? <main className="auth-split-page"><div className="auth-split-shell"><AuthIntro page="login" /><section className="auth-split-form"><AuthLocaleToggle /><PasswordResetForm onBack={() => onNavigate('login')} /></section></div></main> : page === 'signup'
    ? <SignupPage onAuthenticated={onAuthenticated} onNavigate={onNavigate} />
    : <LoginPage onAuthenticated={onAuthenticated} onNavigate={onNavigate} />}</RetainedViews>;
}
