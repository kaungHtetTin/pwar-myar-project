let timezone = 'Asia/Yangon';

export function setOfficeTimezone(value) {
  if (value) timezone = value;
}

export function officeDate(value) {
  if (!value) return '—';
  return parseOfficeDate(value).toLocaleDateString(undefined, { timeZone: timezone });
}

export function officeDateTime(value, options = {}) {
  if (!value) return '—';
  return parseOfficeDate(value).toLocaleString(undefined, { timeZone: timezone, ...options });
}

export function officeDay(value) {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parseOfficeDate(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function officeDateInput(value) {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(parseOfficeDate(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function paymentMatchesDates(item, query) {
  if (!query.from && !query.to) return true;
  const day = officeDay(item.created_at);
  return (!query.from || day >= query.from) && (!query.to || day <= query.to);
}

export function parseOfficeDate(value, sourceTimezone = timezone) {
  if (!value) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return new Date(value);
  const wall = Date.parse(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(wall)) return new Date(NaN);
  let instant = wall;
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: sourceTimezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) + new Date(instant).getUTCMilliseconds();
    const next = instant + wall - rendered;
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}
