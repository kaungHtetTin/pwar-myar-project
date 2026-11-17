// UI entry values stay separate from the canonical stock-unit API values.
export function updateProductUnitEntry(form, patch) {
  const next = { ...form, ...patch };
  const factor = Number(next.purchase_conversion_factor);
  const available = Boolean(String(next.purchase_unit || '').trim()) && Number.isFinite(factor) && factor > 1;
  for (const field of ['stock', 'cost']) {
    const mode = `_${field}_purchase`;
    const entry = `_${field}_entry`;
    if (!available || (Object.hasOwn(patch, mode) && patch[mode] !== form[mode])) {
      next[mode] = available && Boolean(patch[mode]);
      next[entry] = next[mode]
        ? Number(form[field] || 0) * (field === 'stock' ? 1 / factor : factor)
        : (patch[entry] ?? form[field]);
      if (Object.hasOwn(patch, entry)) next[field] = patch[entry];
      // Changing display units must never change a saved quantity or cost.
      continue;
    }
    if (Object.hasOwn(patch, entry) || (next[mode] && Object.hasOwn(patch, 'purchase_conversion_factor'))) {
      const raw = next[entry] ?? form[field];
      const value = Number(raw) * (next[mode] ? (field === 'stock' ? factor : 1 / factor) : 1);
      next[field] = raw === '' ? '' : Math.round(value * (field === 'stock' ? 1000 : 1)) / (field === 'stock' ? 1000 : 1);
    }
  }
  return next;
}
