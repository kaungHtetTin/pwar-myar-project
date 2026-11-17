import React from 'react';
import { LanguageToggle } from '../localization/LanguageToggle';
import { useLocale } from '../localization/LocaleContext';

export function AuthLocaleToggle() {
  const { language, setLanguage } = useLocale();
  return <div className="auth-header-locale" data-no-localize>
    <LanguageToggle language={language} onChange={setLanguage} />
  </div>;
}
