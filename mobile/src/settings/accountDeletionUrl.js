import { routeLocation } from '../navigation/routeBase';

export function accountDeletionUrl() {
  if (import.meta.env.DEV) return new URL(routeLocation('/account-deletion'), window.location.origin).href;
  const api = new URL(import.meta.env.VITE_API_URL || '/api', window.location.origin);
  return new URL(`${api.pathname.replace(/\/api\/?$/, '')}/mobile/account-deletion`, api.origin).href;
}
