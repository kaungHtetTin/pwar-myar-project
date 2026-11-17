import { IconButton } from '../components/Controls';
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { BRAND_LOGO } from '../assets';
import { BrandImage } from '../platformBranding';

export function AuthPageHeader({ title, onBack, actions }) {
  return <header className="auth-reference-topbar">{onBack && <IconButton variant="ghost" type="button" aria-label={title === 'Login' ? 'Back to create account' : 'Back to login'} onClick={onBack}><ChevronLeft size={27} /></IconButton>}<h1>{title}</h1>{actions}</header>;
}

export function AuthStorefront() {
  return <svg className="auth-storefront" viewBox="0 0 320 220" aria-hidden="true" focusable="false">
    <defs><linearGradient id="auth-shop-wall" x2="1" y2="1"><stop stopColor="var(--theme-primary-soft)" /><stop offset="1" stopColor="var(--theme-primary-soft)" /></linearGradient><linearGradient id="auth-shop-roof" x2="1" y2="1"><stop stopColor="var(--theme-primary)" /><stop offset="1" stopColor="var(--theme-primary)" /></linearGradient></defs>
    <ellipse cx="164" cy="205" rx="140" ry="6" fill="var(--theme-text-muted)" />
    <path d="M230 201C248 163 248 120 282 118C291 140 276 167 254 195C274 175 285 163 303 165C308 184 279 210 246 209Z" fill="var(--theme-text-muted)" />
    <path d="M244 202L279 128M248 202L296 175" fill="none" stroke="var(--theme-primary-text)" strokeWidth="3" />
    <path d="M48 70H243V204H48Z" fill="url(#auth-shop-wall)" />
    <rect x="75" y="117" width="46" height="87" rx="6" fill="var(--theme-primary-text)" /><circle cx="112" cy="163" r="3" fill="var(--theme-primary-text)" />
    <rect x="150" y="117" width="66" height="47" rx="6" fill="var(--theme-primary-text)" />
    <path d="M55 15Q57 8 66 8H224Q234 8 237 17L268 69H24Z" fill="url(#auth-shop-roof)" />
    <path d="M79 18H106L94 69H59ZM133 18H160L166 69H126ZM188 18H214L236 69H201Z" fill="var(--theme-on-primary)" />
    <path d="M24 69H59V78A17.5 17.5 0 0 1 24 78ZM94 69H126V78A16 16 0 0 1 94 78ZM166 69H201V78A17.5 17.5 0 0 1 166 78ZM236 69H268V78A16 16 0 0 1 236 78Z" fill="var(--theme-primary-text)" />
    <path d="M59 69H94V78A17.5 17.5 0 0 1 59 78ZM126 69H166V78A20 18 0 0 1 126 78ZM201 69H236V78A17.5 17.5 0 0 1 201 78Z" fill="var(--theme-primary-text)" />
  </svg>;
}

export function AuthBrandHero() {
  return <div className="auth-reference-hero"><BrandImage className="auth-storefront auth-brand-image" src={BRAND_LOGO} alt="PwarMyar" /><strong data-no-localize>PwarMyar</strong><p>Simple POS for Everyday Business</p></div>;
}

export function AuthSessionLoading() {
  return <main className="auth-reference-page auth-session-page"><AuthPageHeader title="PwarMyar" /><section className="auth-session-content" role="status" aria-live="polite"><BrandImage className="auth-storefront auth-brand-image" src={BRAND_LOGO} alt="PwarMyar" /><span className="auth-loading-spinner" aria-hidden="true" /><p>Checking your session...</p></section></main>;
}
