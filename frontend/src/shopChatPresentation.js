import { businessDay, getBusinessTimezone } from './timezone';
export function chatInitials(name = '') {
  return name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase() || '?';
}

export function chatDate(value) {
  if (!value) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function chatTime(value, now = new Date()) {
  const date = chatDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const timezone = getBusinessTimezone();
  const today = new Date(`${businessDay(now, timezone)}T00:00:00Z`);
  const day = new Date(`${businessDay(date, timezone)}T00:00:00Z`);
  const days = Math.round((today - day) / 86400000);
  if (days === 0) return date.toLocaleTimeString([], { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString([], days > 1 && days < 7 ? { timeZone: timezone, weekday: 'short' } : { timeZone: timezone, month: 'short', day: 'numeric', ...(businessDay(date).slice(0, 4) !== businessDay(now).slice(0, 4) ? { year: 'numeric' } : {}) });
}

export function lastSeenLabel(value, now = Date.now()) {
  const date = chatDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < 60) return 'Last seen just now';
  const [unit, divisor] = seconds < 3600 ? ['minute', 60] : seconds < 86400 ? ['hour', 3600] : seconds < 604800 ? ['day', 86400] : seconds < 2592000 ? ['week', 604800] : seconds < 31536000 ? ['month', 2592000] : ['year', 31536000];
  return `Last seen ${new Intl.RelativeTimeFormat('en', { numeric: 'always' }).format(-Math.floor(seconds / divisor), unit)}`;
}

