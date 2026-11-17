let businessTimezone = 'Asia/Yangon';
let storageTimezone = 'Asia/Yangon';

export function configureTimezone(session) {
  if (session?.business?.timezone) businessTimezone = session.business.timezone;
  if (session?.storage_timezone) storageTimezone = session.storage_timezone;
}
export function getBusinessTimezone() { return businessTimezone; }
export function businessDay(now = new Date(), timezone = businessTimezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function calendarRange(preset, now = new Date(), timezone = businessTimezone) {
  const end = businessDay(now, timezone);
  const start = new Date(`${end}T00:00:00Z`);
  if (preset === 'today') return { start: end, end };
  if (preset === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  else if (preset === 'month') start.setUTCDate(1);
  else if (preset === 'year') start.setUTCMonth(0, 1);
  else return { start: '', end: '' };
  return { start: start.toISOString().slice(0, 10), end };
}
// POS APIs retain SQL wall time for receipt/export compatibility.
export function storedDate(value, timezone = storageTimezone) {
  if (!value) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return new Date(value);
  const wall = Date.parse(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(wall)) return new Date(NaN);
  let instant = wall;
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) + new Date(instant).getUTCMilliseconds();
    const next = instant + wall - rendered;
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

export function storedTimestamp(value) {
  if (!value) return '';
  const date = storedDate(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: businessTimezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
