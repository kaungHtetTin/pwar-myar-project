export const DEFAULT_PRICE_TYPES = ['Retail', 'Wholesale', 'Credit'];

export function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function money(value, currency = 'Ks') {
  return `${Math.round(Number(value || 0)).toLocaleString()} ${currency}`;
}

export function formatQuantity(value) {
  return Number(value || 0).toFixed(3).replace(/\.?0+$/, '');
}

export function baseUnitName(product) {
  return String(product?.base_unit || 'Unit').trim() || 'Unit';
}

export function hasPurchaseUnit(product) {
  const factor = Number(product?.purchase_conversion_factor || 1);
  return Boolean(String(product?.purchase_unit || '').trim()) && Number.isFinite(factor) && factor > 1;
}

export function stockWithUnit(product) {
  return `${formatQuantity(product?.stock)} ${baseUnitName(product)}`;
}

export function stockStatus(product) {
  const stock = Number(product?.stock || 0);
  const threshold = Number(product?.low_stock_threshold || 0);
  if (stock <= 0) return 'out_of_stock';
  if (threshold > 0 && stock <= threshold) return 'low_stock';
  return 'in_stock';
}

export function stockStatusLabel(status) {
  if (status === 'out_of_stock') return 'Out of stock';
  if (status === 'low_stock') return 'Low stock';
  return 'In stock';
}

export function priceMargin(price, cost) {
  const sellingPrice = Number(price || 0);
  const buyingCost = Number(cost || 0);
  const amount = sellingPrice - buyingCost;
  return {
    amount,
    percent: buyingCost > 0 ? (amount / buyingCost) * 100 : 0,
    belowCost: buyingCost > 0 && sellingPrice > 0 && sellingPrice < buyingCost,
  };
}

export function productPriceRows(product) {
  const prices = Array.isArray(product?.prices) && product.prices.length
    ? product.prices
    : [{ name: 'Retail', price: product?.price || 0, is_manual: true }];
  const order = { retail: 0, wholesale: 1, credit: 2 };
  return [...prices]
    .filter((price) => String(price.name || '').trim() && Number(price.price || 0) > 0)
    .sort((a, b) => {
      const aOrder = order[String(a.name || '').trim().toLowerCase()] ?? 99;
      const bOrder = order[String(b.name || '').trim().toLowerCase()] ?? 99;
      return aOrder - bOrder || String(a.name || '').localeCompare(String(b.name || ''));
    });
}

export function belowCostPrices(product) {
  return productPriceRows(product)
    .map((row) => ({ ...row, ...priceMargin(row.price, product?.cost) }))
    .filter((row) => row.belowCost);
}

export function cleanPriceTypes(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  const result = [];
  source.forEach((item) => {
    const name = String(item || '').trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
  });
  return result.length ? result : [...DEFAULT_PRICE_TYPES];
}

export function priceRuleMap(payload) {
  return Object.fromEntries((payload?.rules || []).map((rule) => [
    String(rule.name || '').toLowerCase(),
    {
      ...rule,
      pricing_mode: rule.pricing_mode === 'automatic' ? 'automatic' : 'manual',
      markup_percent: Number(rule.markup_percent || 0),
      rounding: Math.max(Number(rule.rounding || 1), 1),
      minimum_profit: Math.max(Number(rule.minimum_profit || 0), 0),
    },
  ]));
}

export function automaticSellingPrice(cost, rule) {
  const buyingCost = Math.max(Number(cost || 0), 0);
  if (!buyingCost || rule?.pricing_mode !== 'automatic') return 0;
  const markupPrice = buyingCost * (1 + Number(rule.markup_percent || 0) / 100);
  const minimumPrice = buyingCost + Number(rule.minimum_profit || 0);
  const rounding = Math.max(Number(rule.rounding || 1), 1);
  return Math.ceil(Math.max(markupPrice, minimumPrice) / rounding) * rounding;
}

export function productPriceFormRows(priceTypes, product = null, rules = {}) {
  const existing = product?.prices || [];
  return cleanPriceTypes(priceTypes).map((name, index) => {
    const row = existing.find((price) => String(price.name || '').toLowerCase() === name.toLowerCase());
    const rule = rules[name.toLowerCase()];
    return {
      id: `mobile-price-${product?.id || 'new'}-${index}-${name}`,
      name,
      price: row?.price ?? (name === 'Retail' ? product?.price : 0) ?? 0,
      is_manual: row ? row.is_manual !== false && Number(row.is_manual) !== 0 : rule?.pricing_mode !== 'automatic',
    };
  });
}

export function blankProductForm(priceTypes = DEFAULT_PRICE_TYPES, rules = {}) {
  return {
    name: '', sku: '', barcode: '', category: '', marketplace_category_id: '', base_unit: 'Unit', purchase_unit: '',
    purchase_conversion_factor: 1, cost: 0, stock: 0, low_stock_threshold: 0,
    photo_url: '', photo_file: null, remove_photo: false,
    prices: productPriceFormRows(priceTypes, null, rules),
  };
}

export function parseProductCsv(text) {
  const normalized = String(text || '').replace(/\r\n?/g, '\n').replace(/\ufeff/g, '');
  if (!normalized.trim()) return [];
  const splitRow = (line) => {
    const values = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = !quoted;
      else if (character === ',' && !quoted) {
        values.push(value);
        value = '';
      } else value += character;
    }
    values.push(value);
    return values;
  };
  const lines = normalized.split('\n');
  const headers = splitRow(lines[0]).map((item) => item.trim().toLowerCase());
  return lines.slice(1).filter((line) => line.trim()).map((line) => {
    const values = splitRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '').trim()]));
  });
}

export function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function productPrice(product, priceType) {
  const prices = product?.prices || [];
  const matched = prices.find((price) => price.name === priceType)
    || prices.find((price) => price.name === 'Retail');
  return Number(matched?.price ?? product?.price ?? 0);
}
