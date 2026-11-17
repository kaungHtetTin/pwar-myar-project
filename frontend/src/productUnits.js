import { formatQuantity } from './utils';

export function baseUnitName(product) {
  return String(product?.base_unit || 'Unit').trim() || 'Unit';
}

export function purchaseUnitFactor(product) {
  const factor = Number(product?.purchase_conversion_factor || 1);
  return Number.isFinite(factor) && factor > 1 ? factor : 1;
}

export function hasPurchaseUnit(product) {
  return Boolean(String(product?.purchase_unit || '').trim()) && purchaseUnitFactor(product) > 1;
}

export function purchaseUnitOptions(product) {
  const options = [{ name: baseUnitName(product), factor: 1 }];
  if (hasPurchaseUnit(product)) {
    options.push({ name: String(product.purchase_unit).trim(), factor: purchaseUnitFactor(product) });
  }
  return options;
}

export function purchaseUnitFor(product, unitName) {
  const requested = String(unitName || '').trim().toLocaleLowerCase();
  return purchaseUnitOptions(product).find((unit) => unit.name.toLocaleLowerCase() === requested)
    || purchaseUnitOptions(product)[0];
}

export function stockWithUnit(product) {
  return `${formatQuantity(product?.stock)} ${baseUnitName(product)}`;
}
