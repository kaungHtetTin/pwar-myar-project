import { AuthLocaleToggle } from './AuthLocaleToggle';
import { InputGroup, Button, Checkbox, IconButton, Input } from '../components/Controls';
import { PasswordResetForm } from './PasswordResetForm';
import React, { useId, useRef, useState } from 'react';
import { AUTH_MESSAGES } from './authLocale';
import { RetainedViews } from '../navigation/RetainedViews';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { REMAINING_PAGE_PATTERNS } from '../localization/remainingPagesLocale';
import { Eye, EyeOff, LockKeyhole, Mail, Store, UserRound } from 'lucide-react';
import { AuthBrandHero, AuthPageHeader } from './AuthReferenceParts';
import { apiRequest } from '../api/client';

function fieldErrorsFrom(error) {
  return Object.fromEntries(
    Object.entries(error?.payload?.errors || {}).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ]),
  );
}

export function AuthScreen(props) { return <ModuleLocalizationBoundary messages={AUTH_MESSAGES} patterns={REMAINING_PAGE_PATTERNS}><AuthScreenContent {...props} /></ModuleLocalizationBoundary>; }

function TextField({ id, label, icon: Icon, error, ...inputProps }) {
  const errorId = `${id}-error`;
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label === 'Email address' ? 'Email' : label}</label>
      <InputGroup as="span" className={`auth-input${error ? ' auth-input--error' : ''}`}>
        <Icon size={19} aria-hidden="true" />
        <Input id={id} aria-label={label} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...inputProps} />
      </InputGroup>
      {error && <span className="field-error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}

function PasswordField({ id, label, error, value, onChange, autoComplete, placeholder, visible, onToggle }) {
  const errorId = `${id}-error`;
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}</label>
      <InputGroup as="span" className={`auth-input auth-input--password${error ? ' auth-input--error' : ''}`}>
        <LockKeyhole size={19} aria-hidden="true" />
        <Input
          id={id}
          required
          minLength={8}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <IconButton variant="ghost" type="button" className="password-toggle" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} onClick={onToggle}>
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </IconButton>
      </InputGroup>
      {error && <span className="field-error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}

function LoginForm({ onAuthenticated, onNavigate }) {
  const formId = useId();
  const submitting = useRef(false);
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setErrors({});
    setGeneralError('');

    try {
      const session = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onAuthenticated(session);
    } catch (error) {
      const nextErrors = fieldErrorsFrom(error);
      setErrors(nextErrors);
      if (!Object.keys(nextErrors).length) setGeneralError(error.message || 'Unable to sign in. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <TextField
        id={`${formId}-email`}
        label="Email address"
        icon={Mail}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="owner@example.com"
        required
        autoFocus
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
        error={errors.email}
      />
      <PasswordField
        id={`${formId}-password`}
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
        value={form.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })}
        visible={showPassword}
        onToggle={() => setShowPassword((current) => !current)}
        error={errors.password}
      />
      <div className="auth-reference-options"><label className="remember-control">
        <Checkbox type="checkbox" aria-label="Keep me signed in on this device" checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} />
        <span>Remember me</span>
      </label><a className="auth-forgot-link" href="/forgot-password" onClick={event => { event.preventDefault(); onNavigate('forgot-password'); }}>Forgot password?</a></div>
      {generalError && <div className="form-error" role="alert">{generalError}</div>}
      <Button variant="primary" className="primary-button" type="submit" disabled={busy}>
        <span>{busy ? 'Signing in...' : 'Login'}</span>
        {busy && <span className="button-spinner" aria-hidden="true" />}
      </Button>
      <div className="auth-reference-divider"><span>or</span></div>
      <p className="auth-switch">Don't have an account? <a href="/signup" onClick={(event) => { event.preventDefault(); onNavigate('signup'); }}>Create account</a></p>
    </form>
  );
}

function SignupForm({ onAuthenticated, onNavigate }) {
  const formId = useId();
  const submitting = useRef(false);
  const [form, setForm] = useState({ business_name: '', owner_name: '', email: '', password: '', password_confirmation: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setGeneralError('');
    setErrors({});

    if (form.password !== form.password_confirmation) {
      setErrors({ password_confirmation: 'The passwords do not match.' });
      return;
    }

    submitting.current = true;
    setBusy(true);
    try {
      const session = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onAuthenticated(session);
    } catch (error) {
      const nextErrors = fieldErrorsFrom(error);
      setErrors(nextErrors);
      if (!Object.keys(nextErrors).length) setGeneralError(error.message || 'Unable to create your account. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <TextField id={`${formId}-business`} label="Business name" icon={Store} placeholder="Example Store" required autoFocus value={form.business_name} onChange={(event) => update('business_name', event.target.value)} error={errors.business_name} />
      <TextField id={`${formId}-owner`} label="Owner name" icon={UserRound} autoComplete="name" placeholder="Your full name" required value={form.owner_name} onChange={(event) => update('owner_name', event.target.value)} error={errors.owner_name} />
      <TextField id={`${formId}-email`} label="Email address" icon={Mail} type="email" inputMode="email" autoComplete="email" placeholder="owner@example.com" required value={form.email} onChange={(event) => update('email', event.target.value)} error={errors.email} />
      <PasswordField id={`${formId}-password`} label="Password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => update('password', event.target.value)} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} error={errors.password} />
      <p className="auth-password-help">Must be at least 8 characters</p>
      <PasswordField id={`${formId}-confirmation`} label="Confirm password" autoComplete="new-password" placeholder="Enter it again" value={form.password_confirmation} onChange={(event) => update('password_confirmation', event.target.value)} visible={showConfirmation} onToggle={() => setShowConfirmation((current) => !current)} error={errors.password_confirmation} />
      {generalError && <div className="form-error" role="alert">{generalError}</div>}
      <Button variant="primary" className="primary-button" type="submit" disabled={busy}>
        <span>{busy ? 'Creating account...' : 'Create account'}</span>
        {busy && <span className="button-spinner" aria-hidden="true" />}
      </Button>
      <div className="auth-reference-divider"><span>or</span></div>
      <p className="auth-switch">Already have an account? <a href="/login" onClick={(event) => { event.preventDefault(); onNavigate('login'); }}>Login</a></p>
    </form>
  );
}

function AuthScreenContent({ page = 'login', onAuthenticated, onNavigate, onBack }) {
  const signup = page === 'signup';
  const reset = page === 'forgot-password';
  return <main className={`auth-reference-page${signup ? ' auth-reference-signup' : ''}`}>
    <AuthPageHeader title={reset ? 'Reset password' : signup ? 'Create account' : 'Login'} onBack={signup || reset ? () => onNavigate('login', { back: true }) : onBack} actions={<AuthLocaleToggle />} />
    <div className="auth-reference-layout"><AuthBrandHero />
      <section className="auth-reference-panel" aria-label={reset ? 'Reset password' : signup ? 'Create account' : 'Login'}>
        {!signup && !reset && <div className="auth-reference-welcome"><h2>Welcome back</h2><p>Sign in to manage your shop</p></div>}
        <RetainedViews activeKey={page}>{reset ? <PasswordResetForm onBack={() => onNavigate('login', { back: true })} /> : signup
          ? <SignupForm onAuthenticated={onAuthenticated} onNavigate={onNavigate} />
          : <LoginForm onAuthenticated={onAuthenticated} onNavigate={onNavigate} />}</RetainedViews>
      </section>
    </div>
  </main>;
}
