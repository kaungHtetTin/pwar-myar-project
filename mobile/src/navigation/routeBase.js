const CONFIGURED_ROUTE_BASE = String(import.meta.env.VITE_ROUTE_BASE || '').replace(/^\/+|\/+$/g, '');
export const ROUTE_BASE = CONFIGURED_ROUTE_BASE ? `/${CONFIGURED_ROUTE_BASE}` : '';

export function routePathFromLocation(pathname, routeBase = ROUTE_BASE) {
  const value = String(pathname || '/');
  if (!routeBase) return value.startsWith('/') ? value : `/${value}`;
  if (value === routeBase) return '/';
  return value.startsWith(`${routeBase}/`) ? value.slice(routeBase.length) || '/' : value;
}

export function routeLocation(path, routeBase = ROUTE_BASE) {
  const value = String(path || '/');
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return routeBase ? `${routeBase}${normalized === '/' ? '' : normalized}` : normalized;
}
