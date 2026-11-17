// Shop APIs expose UTC timestamps; accept both SQL strings and explicit ISO offsets.
export function shopDate(value) {
  if (!value) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function chatTimestamp(value, timezone = 'Asia/Yangon', full = false) {
  const date = shopDate(value);
  if (!date) return '';
  const options = full ? { dateStyle: 'medium', timeStyle: 'short' } : { hour: '2-digit', minute: '2-digit' };
  return date.toLocaleString([], { ...options, timeZone: timezone });
}
