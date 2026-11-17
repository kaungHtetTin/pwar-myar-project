import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api/client';

const DEFAULT_CONTACTS = {
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
  const [contacts, setContacts] = useState(DEFAULT_CONTACTS);
  const reload = useCallback(async (signal) => {
    const data = await apiRequest('/contact-settings', signal ? { signal } : undefined);
    if (!signal?.aborted && data) setContacts({ ...DEFAULT_CONTACTS, ...data });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    reload(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [reload]);
  return contacts;
}
