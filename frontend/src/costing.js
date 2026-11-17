export function sellingPrices(product) {
  const rows = Array.isArray(product?.prices) && product.prices.length
    ? product.prices
    : [{ name: 'Retail', price: product?.price || 0 }];
  return rows
    .map((row) => ({
      name: String(row.name || '').trim(),
      price: Number(row.price || 0),
      isManual: row.is_manual !== false && Number(row.is_manual) !== 0,
    }))
    .filter((row) => row.name && Number.isFinite(row.price) && row.price > 0);
}

export function priceMargin(price, cost) {
  const sellingPrice = Number(price || 0);
  const buyingCost = Number(cost || 0);
  const amount = sellingPrice - buyingCost;
  const percent = buyingCost > 0 ? (amount / buyingCost) * 100 : 0;
  return {
    amount,
    percent,
    belowCost: buyingCost > 0 && sellingPrice > 0 && sellingPrice < buyingCost,
  };
}

export function belowCostPrices(product, cost = product?.cost) {
  return sellingPrices(product)
    .map((row) => ({ ...row, ...priceMargin(row.price, cost) }))
    .filter((row) => row.belowCost);
}

export function purchaseCostWarnings(items, products) {
  const productsById = new Map((products || []).map((product) => [Number(product.id), product]));
  return (items || []).flatMap((item) => {
    const product = productsById.get(Number(item.product_id)) || item.product;
    if (!product) return [];
    return belowCostPrices(product, item.unit_cost).filter((price) => price.isManual).map((price) => ({
      productId: product.id,
      productName: product.name,
      cost: Number(item.unit_cost || 0),
      ...price,
    }));
  });
}
