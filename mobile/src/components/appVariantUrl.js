export function webAppUrl() {
  const base = import.meta.env.VITE_WEB_APP_URL || (import.meta.env.DEV ? 'http://127.0.0.1:5174' : 'https://pos.pwarmyar.com');
  const auth = window.location.pathname.match(/^\/(login|signup|forgot-password)\/?$/)?.[1];
  return `${base.replace(/\/$/, '')}/${auth || ''}`;
}
