import { useEffect, useState } from 'react';
import { request } from './api';

export const DEFAULT_PLATFORM_CONTACTS = {
  phone_numbers: ['09688683805', '09682537158', '09792104209'],
  viber_numbers: ['09682537158', '09688683805', '09792104209'],
  telegram_url: 'https://t.me/moekaungdev',
  email: '',
  community_label: '',
  community_url: '',
};

export function viberHref(phone) {
  const digits = String(phone).replace(/[^+0-9]/g, '');
  const number = digits.startsWith('0') ? `+95${digits.slice(1)}` : digits;
  return `viber://chat?number=${encodeURIComponent(number)}`;
}

export function usePlatformContacts() {
  const [contacts, setContacts] = useState(DEFAULT_PLATFORM_CONTACTS);
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => request('/contact-settings')).then(data => {
      if (current && data) setContacts({ ...DEFAULT_PLATFORM_CONTACTS, ...data });
    }).catch(() => {});
    return () => { current = false; };
  }, []);
  return contacts;
}
