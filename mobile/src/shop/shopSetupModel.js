export const SHOP_SETUP_PATHS = ['details', 'payments', 'products', 'sales-ai', 'review', 'complete'].map(step => `/shop/setup/${step}`);
export const SHOP_SETUP_STEPS = ['Shop details', 'Payments', 'Products', 'Sales AI', 'Review'];
export const SHOP_SETUP_DESCRIPTIONS = [
  'Give your online shop a name, a look and a customer link.',
  'Customers pay you directly. Verify payments before approving orders.',
  'Publish products with valid prices. Changes save immediately.',
  'Let your sales representative help customers in shop chat.',
  'Review your setup and choose when to open your shop.',
];
const keys = ['slug', 'display_name', 'phone', 'address', 'currency', 'description', 'price_type', 'pickup_instructions', 'pickup_address', 'pickup_hours', 'opening_hours', 'announcement', 'closed_until', 'delivery_zones', 'payment_methods', 'storefront_enabled', 'accepting_orders', 'marketplace_enabled'];
export const stepFields = step => step === 1 ? ['display_name', 'slug', 'phone', 'address', 'price_type'] : step === 2 ? ['payment_methods'] : ['storefront_enabled', 'accepting_orders', 'marketplace_enabled'];
// The shared API retains desktop's version-2 stage IDs. Mobile skips removed stages.
const serverSteps = [1, 4, 5, 6, 7];
export function mobileShopSetupStep(serverStep) {
  const index = serverSteps.findIndex(value => value >= Number(serverStep || 1));
  return index < 0 ? serverSteps.length : index + 1;
}
export function nextShopSetupProgress(step) {
  return { status: step === serverSteps.length ? 'complete' : 'pending', step: serverSteps[Math.min(serverSteps.length - 1, step)], version: 2 };
}
export function shopSetupPayload(saved, draft, step) {
  const merged = { ...saved, ...Object.fromEntries(stepFields(step).map(key => [key, draft[key]])) };
  if (step === 1) merged.price_type = 'Retail';
  if (step === 2) merged.payment_methods = (merged.payment_methods || []).map(method =>
    method.type !== 'cash' && !saved.payment_methods?.some(row => row.id === method.id)
      ? { ...method, name: method.bank?.trim() || 'Bank transfer' }
      : method);
  return Object.fromEntries(keys.filter(key => merged[key] !== undefined).map(key => [key, merged[key]]));
}
