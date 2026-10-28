export function weeklyProgress(usage) {
  if (!usage || !Number.isFinite(usage.limit) || usage.limit <= 0 || !Number.isFinite(usage.remaining)) return null;
  const remaining = Math.max(0, Math.min(usage.limit, usage.remaining));
  const percent = Math.round(remaining / usage.limit * 1000) / 10;
  const blend = percent >= 50 ? (percent - 50) * 2 : percent * 2;
  const from = percent >= 50 ? 'success' : 'warning';
  const to = percent >= 50 ? 'warning' : 'danger';
  return { remaining, percent, color: `color-mix(in srgb, var(--theme-${from}) ${blend}%, var(--theme-${to}))` };
}

export function weeklyReset(usage, language = 'en') {
  if (typeof usage?.resets_at !== 'string') return null;
  const date = new Date(usage.resets_at);
  if (!Number.isFinite(date.getTime())) return null;
  const options = { timeZone: 'Asia/Yangon' };
  const locale = language === 'my' ? 'my-MM' : 'en-US';
  return {
    date: new Intl.DateTimeFormat(locale, { ...options, weekday: 'short', month: 'short', day: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat(locale, { ...options, hour: 'numeric', minute: '2-digit', hour12: true }).format(date),
    full: new Intl.DateTimeFormat(locale, { ...options, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(date),
  };
}

