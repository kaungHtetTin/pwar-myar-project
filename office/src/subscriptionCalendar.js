export function shiftMonth(month, change) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + change, 1)).toISOString().slice(0, 7);
}

export function calendarDays(month) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const start = 1 - (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, number - 1, start + index));
    const day = date.toISOString().slice(0, 10);
    return { day, number: date.getUTCDate(), inMonth: day.startsWith(month) };
  });
}

export function calendarLabel(day, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
}

export function expiryUrgency(day, today, total) {
  if (!total) return '';
  const remaining = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return remaining < 0 ? 'is-past' : remaining <= 3 ? 'is-danger' : remaining <= 7 ? 'is-warning' : '';
}
