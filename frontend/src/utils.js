export function money(value, currency = 'Ks') {
  return `${Math.round(Number(value || 0)).toLocaleString()} ${currency}`;
}

export function actionLabel(isBusy, busyText, label) {
  return isBusy ? busyText : label;
}

export function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatDateInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatQuantity(value) {
  return Number(value || 0).toFixed(3).replace(/\.?0+$/, '');
}
