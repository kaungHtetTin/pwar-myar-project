import React from 'react';
import { useLanguage } from './LanguageProvider';
import '../../../shared/theme/auth-locale.css';

export function AuthLocaleToggle() {
  const { language, setLanguage } = useLanguage();
  const myanmar = language === 'my';
  return <div className="auth-locale-row" data-no-localize>
    <button className="auth-compact-locale" type="button" role="switch" aria-label="English / မြန်မာ" aria-checked={myanmar} onClick={() => setLanguage(myanmar ? 'en' : 'my')}>
      <span lang="en" className={!myanmar ? 'is-selected' : undefined}>EN</span>
      <span lang="my" className={myanmar ? 'is-selected' : undefined}>မြန်မာ</span>
    </button>
  </div>;
}
