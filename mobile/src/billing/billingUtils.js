export function billingPageFromPath(pathname) {
  const match = pathname.match(/^\/billing\/request\/(\d+)$/);
  return match ? { kind: 'request', planId: Number(match[1]) } : { kind: 'overview', planId: null };
}

export function dateLabel(value) {
  if (!value) return 'No end date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysRemaining(value, now = Date.now()) {
  const end = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(end) ? null : Math.max(0, Math.ceil((end - now) / 86400000));
}

export function billingRequestMessage(reference, note) {
  return [reference.trim() && `Transfer reference: ${reference.trim()}`, note.trim()].filter(Boolean).join('\n');
}

export function billingPendingMessage(message = '') {
  const match = message.match(/^Transfer reference: ([^\n]+)(?:\n([\s\S]*))?$/);
  return match ? { reference: match[1], note: match[2] || '' } : { reference: '', note: message };
}
