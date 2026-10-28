import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LocaleContext } from './LocaleContext';
import { LANGUAGE_STORAGE_KEY, normalizeLanguage } from './navigationLocale';

export function LocaleProvider({ children }) {
  const [language, setLanguageState] = useState(() => normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)));
  const setLanguage = useCallback((nextLanguage) => setLanguageState(normalizeLanguage(nextLanguage)), []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
