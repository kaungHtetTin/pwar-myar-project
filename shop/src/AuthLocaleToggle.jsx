import React from 'react';

export function AuthLocaleToggle({ language, onChange }) {
  const myanmar = language === 'my';
  return <div className="auth-locale-row shop-auth-locale" data-no-localize>
    <button className="auth-compact-locale" type="button" role="switch" aria-label="English / မြန်မာ" aria-checked={myanmar} onClick={() => onChange(myanmar ? 'en' : 'my')}>
      <span lang="en" className={!myanmar ? 'is-selected' : undefined}>EN</span>
      <span lang="my" className={myanmar ? 'is-selected' : undefined}>မြန်မာ</span>
    </button>
  </div>;
}
