export const AUTH_PAGES = Object.freeze({
  login: '/login',
  signup: '/signup',
  'forgot-password': '/forgot-password',
});

export function usesPortableRouting(basePath = '/') {
  return basePath === '.' || basePath === './';
}

function normalizeBasePath(basePath = '/') {
  if (!basePath || basePath === './') return '/';
  const normalized = String(basePath).replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}/` : '/';
}

function routeFromPath(pathname, basePath = '/') {
  const base = normalizeBasePath(basePath);
  if (base === '/') return pathname;
  const prefix = base.slice(0, -1);
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) || '/' : pathname;
}

export function appHomePath(basePath = '/') {
  return normalizeBasePath(basePath);
}

export function authPageFromPath(pathname, basePath = '/') {
  return Object.keys(AUTH_PAGES).find(page => AUTH_PAGES[page] === routeFromPath(pathname, basePath)) || 'login';
}

export function isAuthPath(pathname, basePath = '/') {
  return Object.values(AUTH_PAGES).includes(routeFromPath(pathname, basePath));
}

export function authPathFor(page, basePath = '/') {
  const route = AUTH_PAGES[page] || AUTH_PAGES.login;
  const base = normalizeBasePath(basePath);
  return base === '/' ? route : `${base.slice(0, -1)}${route}`;
}

export function routePathFromLocation(location, basePath = '/') {
  const hash = String(location?.hash || '').replace(/^#/, '');
  if (!usesPortableRouting(basePath)) {
    const legacyAuth = Object.entries(AUTH_PAGES).find(([, path]) => path === hash);
    return legacyAuth ? authPathFor(legacyAuth[0], basePath) : location?.pathname || '/';
  }
  return hash.startsWith('/') ? hash : '/';
}

export function appHomeLocation(basePath = '/') {
  return usesPortableRouting(basePath) ? '#/' : appHomePath(basePath);
}

export function authLocationFor(page, basePath = '/') {
  return usesPortableRouting(basePath) ? `#${AUTH_PAGES[page] || AUTH_PAGES.login}` : authPathFor(page, basePath);
}
