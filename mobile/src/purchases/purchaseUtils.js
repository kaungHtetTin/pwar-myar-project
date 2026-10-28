import { baseUnitName, formatQuantity, hasPurchaseUnit, normalizeNumber, productPriceRows } from '../products/productUtils';

export function blankPurchaseForm() {
  return {
    reference_no: '',
    purchase_date: dateInput(new Date()),
    expected_delivery: '',
    supplier_id: null,
    supplier_name: '',
    payment_method: 'Cash',
    paid_amount: null,
    note: '',
    product_id: '',
    unit_name: '',
    quantity: 1,
    foc_quantity: 0,
    unit_cost: 0,
    items: [],
  };
}

export function blankPurchaseFilters() {
  return { preset: 'all', q: '', supplier: '', payment_status: 'all', date_from: '', date_to: '' };
}

export function purchasePageFromPath(pathname) {
  if (pathname === '/purchases/new') return { kind: 'new', purchaseId: null };
  const edit = pathname.match(/^\/purchases\/(\d+)\/edit$/);
  if (edit) return { kind: 'edit', purchaseId: Number(edit[1]) };
  const detail = pathname.match(/^\/purchases\/(\d+)$/);
  if (detail) return { kind: 'detail', purchaseId: Number(detail[1]) };
  return { kind: 'list', purchaseId: null };
}

export function purchaseHistoryPath(filters, limit, offset) {
  const params = new URLSearchParams({ status: 'completed', with_total: 'true', limit: String(limit), offset: String(offset) });
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.supplier.trim()) params.set('supplier', filters.supplier.trim());
  if (filters.payment_status && filters.payment_status !== 'all') params.set('payment_status', filters.payment_status);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  return `/purchases?${params}`;
}

function dateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function presetDateFromTo(preset, now = new Date()) {
  const start = new Date(now);
  const end = dateInput(now);
  if (preset === 'today') return { date_from: end, date_to: end };
  if (preset === 'week') {
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return { date_from: dateInput(start), date_to: end };
  }
  if (preset === 'month') {
    start.setDate(1);
    return { date_from: dateInput(start), date_to: end };
  }
  if (preset === 'year') {
    start.setMonth(0, 1);
    return { date_from: dateInput(start), date_to: end };
  }
  return { date_from: '', date_to: '' };
}

export function dateRangeError(from, to) {
  return from && to && from > to ? 'From date cannot be later than To date.' : '';
}

export function purchaseUnitOptions(product) {
  const options = [{ name: baseUnitName(product), factor: 1 }];
  if (hasPurchaseUnit(product)) options.push({ name: String(product.purchase_unit).trim(), factor: Number(product.purchase_conversion_factor) });
  return options;
}

export function purchaseUnitFor(product, unitName) {
  const requested = String(unitName || '').trim().toLowerCase();
  return purchaseUnitOptions(product).find(({ name }) => name.toLowerCase() === requested) || purchaseUnitOptions(product)[0];
}

export function buildPurchaseLine(product, unitName, quantity, focQuantity, unitCost) {
  const unit = purchaseUnitFor(product, unitName);
  const paid = normalizeNumber(quantity, 0);
  const foc = normalizeNumber(focQuantity, 0);
  const cost = normalizeNumber(unitCost, 0);
  const received = (paid + foc) * unit.factor;
  return {
    product_id: product.id,
    product_name: product.name,
    current_stock: `${formatQuantity(product.stock)} ${baseUnitName(product)}`,
    unit_name: unit.name,
    conversion_factor: unit.factor,
    quantity: paid,
    foc_quantity: foc,
    unit_cost: cost,
    effective_unit_cost: received > 0 ? (paid * cost) / received : 0,
    line_total: paid * cost,
    product,
  };
}

export function recalculatePurchaseLine(item, patch = {}) {
  const next = { ...item, ...patch };
  const quantity = normalizeNumber(next.quantity, 0);
  const foc = normalizeNumber(next.foc_quantity, 0);
  const unitCost = normalizeNumber(next.unit_cost, 0);
  const received = (quantity + foc) * Number(next.conversion_factor || 1);
  return {
    ...next,
    base_quantity: quantity * Number(next.conversion_factor || 1),
    base_foc_quantity: foc * Number(next.conversion_factor || 1),
    line_total: quantity * unitCost,
    effective_unit_cost: received > 0 ? (quantity * unitCost) / received : 0,
  };
}

export function purchaseTotals(items) {
  return (items || []).reduce((totals, item) => {
    const factor = Number(item.conversion_factor || 1);
    totals.paid += Number(item.quantity || 0) * factor;
    totals.foc += Number(item.foc_quantity || 0) * factor;
    totals.total += Number(item.line_total || 0);
    return totals;
  }, { paid: 0, foc: 0, total: 0 });
}

export function purchasePaymentAmounts(form) {
  const total = purchaseTotals(form?.items || []).total;
  const paid = form?.paid_amount === null || form?.paid_amount === ''
    ? 0
    : normalizeNumber(form.paid_amount, 0);
  return { total, paid, credit: Math.max(0, total - paid) };
}

export function itemCostWarnings(item) {
  const cost = Number(item.effective_unit_cost || 0);
  return productPriceRows(item.product)
    .filter((price) => price.is_manual !== false && Number(price.price || 0) > 0 && Number(price.price) < cost)
    .map((price) => ({ name: price.name, price: Number(price.price), cost }));
}

export function purchasePayload(form) {
  return {
    reference_no: String(form.reference_no || '').trim() || null,
    purchase_date: form.purchase_date || null,
    expected_delivery: form.expected_delivery || null,
    supplier_id: form.supplier_id || null,
    supplier_name: String(form.supplier_name || '').trim(),
    payment_method: String(form.payment_method || 'Cash'),
    paid_amount: Math.round(purchasePaymentAmounts(form).paid),
    note: String(form.note || '').trim(),
    items: form.items.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      product_id: item.product_id,
      unit_name: item.unit_name,
      quantity: normalizeNumber(item.quantity, 0),
      foc_quantity: normalizeNumber(item.foc_quantity, 0),
      unit_cost: normalizeNumber(item.unit_cost, 0),
    })),
  };
}
