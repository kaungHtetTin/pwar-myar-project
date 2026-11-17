export const DEFAULT_PRICE_TYPES = ['Retail', 'Wholesale', 'Credit'];

export function cleanPriceTypes(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const unique = [];
  const seen = new Set();
  source.forEach((item) => {
    const name = String(item || '').trim();
    const key = name.toLocaleLowerCase();
    if (name && !seen.has(key)) {
      unique.push(name);
      seen.add(key);
    }
  });
  return unique.length ? unique : [...DEFAULT_PRICE_TYPES];
}

export function priceRuleMap(payload) {
  const rows = Array.isArray(payload?.rules) ? payload.rules : [];
  return Object.fromEntries(rows.map((rule) => [
    String(rule.name || '').toLocaleLowerCase(),
    {
      name: String(rule.name || ''),
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
  const existingPrices = product?.prices || [];
  return cleanPriceTypes(priceTypes).map((name, index) => {
    const existing = existingPrices.find((price) => (
      String(price.name || '').toLocaleLowerCase() === name.toLocaleLowerCase()
    ));
    const rule = rules[name.toLocaleLowerCase()];
    const isAutomaticByDefault = !product && rule?.pricing_mode === 'automatic';
    return {
      id: `product-price-${product?.id || 'new'}-${index}-${name}`,
      name,
      price: existing?.price ?? (name === 'Retail' ? product?.price : 0) ?? 0,
      is_manual: existing ? existing.is_manual !== false && Number(existing.is_manual) !== 0 : !isAutomaticByDefault,
    };
  });
}
