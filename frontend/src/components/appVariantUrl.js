export function mobileAppUrl() {
  const base = import.meta.env.VITE_MOBILE_APP_URL || (import.meta.env.DEV ? 'http://127.0.0.1:5176' : 'https://mobilepos.pwarmyar.com');
  const auth = window.location.pathname.match(/^\/(login|signup|forgot-password)\/?$/)?.[1];
  return `${base.replace(/\/$/, '')}/${auth || ''}`;
}
