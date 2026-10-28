import { createContext, useContext } from 'react';

export const LocaleContext = createContext({
  language: 'en',
  setLanguage: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}
