export const DATA_CHANGED_EVENT = 'mkpos:mobile-data-changed';

const dependents = {
  'shop-admin': ['shop', 'products', 'sales', 'customers', 'reports', 'settings'],
  reports: ['reports'],
  products: ['products', 'sell', 'purchases', 'reports'],
  categories: ['products', 'sell'],
  sales: ['sales', 'transactions', 'customers', 'products', 'sell', 'reports'],
  purchases: ['purchases', 'suppliers', 'products', 'sell', 'transactions', 'reports'],
  customers: ['customers', 'sell'],
  suppliers: ['suppliers', 'purchases'],
  'customer-payments': ['customers', 'transactions', 'reports'],
  'supplier-payments': ['suppliers', 'purchases', 'transactions', 'reports'],
  expenses: ['expenses', 'transactions', 'reports'],
  roles: ['access'],
  staff: ['access'],
  settings: ['settings', 'sell'],
  'price-types': ['settings', 'products', 'sell'],
  subscription: ['billing'],
  data: ['*'],
};

export function publishResourceChanges(resources) {
  const modules = [...new Set(resources.flatMap(resource => dependents[resource] || []))];
  if (modules.length) window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { modules } }));
}

export function publishDataChange(path, method) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
  if (path.startsWith('/shop-admin/chat/')) return;
  if (/\/(print|receipt-preview|test-print)(\?|$)/.test(path)) return;
  if (path.split('?')[0] === '/settings/timezone') {
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { modules: ['*'] } }));
    return;
  }
  const resource = path.split('/')[1];
  const modules = /\/(customers|suppliers)\/\d+\/payments/.test(path)
    ? dependents[`${resource.slice(0, -1)}-payments`] : dependents[resource];
  if (modules) window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { modules } }));
}

export function isReadOnlyRoute(path) {
  if (!path) return false;
  if (path.startsWith('/shop')) return !/\/(action|review|location|edit|new|storefront|fulfillment|cover|logo)(\/|$)/.test(path);
  if (path.startsWith('/sell')) return path === '/sell';
  if (path.startsWith('/settings')) return ['/settings', '/settings/prices'].includes(path);
  return !/(\/(new|edit|stock|import|password|request|restore|reset)(\/|$))/.test(path);
}
