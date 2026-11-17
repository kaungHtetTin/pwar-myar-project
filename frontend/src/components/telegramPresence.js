export function telegramPresence(thread, now = Date.now()) {
  const value = thread?.telegram_last_message_at;
  if (!value) return 'Telegram';
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  if (!Number.isFinite(date.getTime())) return 'Telegram';
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < 60) return 'Telegram · Last message just now';
  const [unit, divisor] = seconds < 3600 ? ['minute',60] : seconds < 86400 ? ['hour',3600] : ['day',86400];
  return `Telegram · Last message ${new Intl.RelativeTimeFormat('en', {numeric:'always'}).format(-Math.floor(seconds/divisor),unit)}`;
}

