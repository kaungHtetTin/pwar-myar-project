export function formatTokens(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 'Unavailable';
  if (amount < 1000) return amount.toLocaleString('en-US');
  const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
  for (const [scale, suffix] of units) {
    if (amount >= scale || Math.round(amount / scale * 100) / 100 >= 1) {
      return `${(amount / scale).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
    }
  }
  return amount.toLocaleString('en-US');
}
