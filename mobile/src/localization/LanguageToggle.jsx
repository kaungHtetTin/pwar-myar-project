import React from 'react';
import { Button } from '../components/Controls';

export function LanguageToggle({ language, onChange }) {
  const myanmar = language === 'my';
  return <Button variant="plain" className="language-toggle" role="switch" aria-label="English / မြန်မာ" aria-checked={myanmar} onClick={() => onChange(myanmar ? 'en' : 'my')}>
    <span lang="en" className={!myanmar ? 'is-selected' : undefined}>EN</span>
    <span lang="my" className={myanmar ? 'is-selected' : undefined}>မြန်မာ</span>
  </Button>;
}
