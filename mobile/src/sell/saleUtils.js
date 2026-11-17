import { baseUnitName, normalizeNumber } from '../products/productUtils';

export const DEFAULT_PAYMENT_METHODS = ['Cash', 'Banking Pay', 'KPay', 'Wave Pay'];

export const EMPTY_SALE_DRAFT = {
  cart: [],
  priceType: 'Retail',
  discount: 0,
  paidAmount: '',
  paymentMethod: 'Cash',
  customer: null,
};

export function cleanPaymentMethods(settings = {}) {
  const methods = String(settings.payment_methods || '').split(',').map((item) => item.trim()).filter(Boolean);
  return (methods.length ? methods : DEFAULT_PAYMENT_METHODS).filter((method) => method.toLowerCase() !== 'credit');
}

export function salePageFromPath(pathname) {
  if (pathname === '/sell/offline-sales') return 'offline-sales';
  if (pathname === '/sell/cart') return 'cart';
  if (pathname === '/sell/checkout') return 'checkout';
  if (pathname === '/sell/customer/new') return 'new-customer';
  return 'products';
}

export function saleDraftFrom(value) {
  if (!value || typeof value !== 'object') return { ...EMPTY_SALE_DRAFT };
  const cart = Array.isArray(value.cart) ? value.cart.filter((item) => item?.product_id && Number(item.unit_price) >= 0) : [];
  const firstType = cart[0]?.price_type;
  return {
    cart,
    priceType: typeof value.priceType === 'string' && value.priceType.trim() ? value.priceType : (typeof firstType === 'string' && cart.every(item => item.price_type === firstType) ? firstType : 'Retail'),
    discount: value.discount ?? 0,
    paidAmount: value.paidAmount ?? '',
    paymentMethod: typeof value.paymentMethod === 'string' && value.paymentMethod ? value.paymentMethod : 'Cash',
    customer: value.customer?.id ? value.customer : null,
  };
}

export function cartUnits(cart = []) {
  return cart.reduce((total, item) => total + Math.max(0, normalizeNumber(item.quantity)) + Math.max(0, normalizeNumber(item.foc_quantity)), 0);
}

export function cartItemFromProduct(product, priceType = 'Retail') {
  return {
    product_id: product.id,
    product_name: product.name,
    photo_url: product.photo_url || '',
    price_type: priceType,
    unit_price: saleProductPrice(product, priceType),
    prices: saleProductPrices(product),
    unit_cost: Number(product.cost || 0),
    base_unit: baseUnitName(product),
    purchase_unit: product.purchase_unit || '',
    purchase_conversion_factor: Number(product.purchase_conversion_factor || 1),
    quantity: 1,
    foc_quantity: 0,
    stock: Number(product.stock || 0),
  };
}

export function saleProductPrices(product) {
  const prices = (product.prices || []).map(row => ({ name: row.name, price: Number(row.price) }));
  if (!prices.some(row => String(row.name).toLowerCase() === 'retail') && product.price != null) prices.push({ name: 'Retail', price: Number(product.price) });
  return prices;
}

export function saleProductPrice(product, priceType) {
  const row = saleProductPrices(product).find(row => String(row.name).toLowerCase() === String(priceType).toLowerCase());
  return Number.isFinite(row?.price) && row.price > 0 ? row.price : 0;
}

// Validate every line before changing any prices; merge legacy mixed-price rows.
export function repriceSaleCart(cart, priceType, products) {
  const missing = cart.filter(item => !saleProductPrice(products.get(Number(item.product_id)) || item, priceType));
  if (missing.length) return { missing: [...new Set(missing.map(item => item.product_name))] };
  const rows = new Map();
  for (const item of cart) {
    const product = products.get(Number(item.product_id)) || item;
    const previous = rows.get(Number(item.product_id));
    rows.set(Number(item.product_id), { ...item, price_type: priceType, unit_price: saleProductPrice(product, priceType), prices: saleProductPrices(product), quantity: previous ? normalizeNumber(previous.quantity) + normalizeNumber(item.quantity) : item.quantity, foc_quantity: previous ? normalizeNumber(previous.foc_quantity) + normalizeNumber(item.foc_quantity) : item.foc_quantity });
  }
  return { cart: [...rows.values()] };
}

export function saleTotals(cart, discount, paidAmount) {
  const subtotal = Math.round(cart.reduce((sum, item) => sum + normalizeNumber(item.quantity) * Number(item.unit_price || 0), 0));
  const discountAmount = Math.min(Math.max(0, Math.round(normalizeNumber(discount))), subtotal);
  const total = Math.max(0, subtotal - discountAmount);
  const tendered = Math.max(0, Math.round(normalizeNumber(paidAmount)));
  const paid = Math.min(tendered, total);
  return { subtotal, discount: discountAmount, total, paid, unpaid: Math.max(total - paid, 0), change: Math.max(tendered - total, 0) };
}

export function salePayload({ cart, discount, paidAmount, paymentMethod, customerId }) {
  const totals = saleTotals(cart, discount, paidAmount);
  const focOnly = cart.length > 0
    && cart.every((item) => normalizeNumber(item.quantity) === 0)
    && cart.some((item) => normalizeNumber(item.foc_quantity) > 0);
  return {
    items: cart.map((item) => ({
      product_id: item.product_id,
      price_type: item.price_type,
      quantity: normalizeNumber(item.quantity),
      foc_quantity: Math.max(0, normalizeNumber(item.foc_quantity)),
      unit_price: Math.round(Number(item.unit_price || 0)),
    })),
    discount: totals.discount,
    payment_type: totals.unpaid > 0 ? 'credit' : 'cash',
    payment_method: focOnly ? 'FOC' : (totals.unpaid > 0 && totals.paid === 0 ? 'Credit' : paymentMethod),
    paid_amount: totals.paid,
    customer_id: focOnly ? null : (customerId ? Number(customerId) : null),
  };
}
