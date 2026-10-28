const paths = {
  'server-health': 'system/server-health',
  overview: 'overview', businesses: 'businesses', 'platform-users': 'platform-users',
  'shop-reviews': 'shop-reviews', 'product-reviews': 'product-reviews', 'shop-reports': 'shop-reports', 'error-reports': 'error-reports',
  plans: 'plans', 'payment-methods': 'payment-methods', requests: 'payments', admins: 'admins',
  'activity-log': 'activity-log', 'bank-books': 'bank-books', 'ai-usage': 'ai/usage-report',
  'agent-skills': 'ai/skills', 'agent-assignments': 'ai/agent-assignments',
  'ai-requests': 'ai/balance-book', branding: 'branding', founders: 'founders',
  'sales-ai-topups': 'ai/sales-topups',
  'financial-book': 'financial-book', financial: 'financial-report', settings: 'settings',
  tutorials: 'tutorials', 'marketplace-categories': 'marketplace-categories', 'marketplace-products': 'marketplace-products',
};
const restricted = new Set(['agent-skills', 'agent-assignments', 'admins', 'branding', 'ai-usage', 'ai-requests', 'server-health']);
const settingsTabs = new Set(['account', 'contacts', 'downloads', 'ai-provider', 'ai-assistant', 'ai-pricing', 'telegram-support', 'theme']);
const overview = () => ({ tab: 'overview', businessId: null });
const scope = admin => String(admin.id);
const prefix = admin => `mkpos.office.navigation:${window.location.pathname.replace(/\/+$/, '') || '/'}:${scope(admin)}:`;

export function normalizeOfficePage(page, admin) {
  if (!page || (page.tab !== 'business-detail' && !Object.hasOwn(paths, page.tab))) return overview();
  if (restricted.has(page.tab) && admin.role !== 'super_admin') return overview();
  if (page.tab === 'business-detail') {
    const id = Number(page.businessId);
    return Number.isSafeInteger(id) && id > 0 ? { tab: 'business-detail', businessId: id } : overview();
  }
  const result = { tab: page.tab, businessId: null };
  if (page.tab === 'settings') {
    result.settingsTab = settingsTabs.has(page.settingsTab) && (!['ai-provider', 'ai-assistant', 'ai-pricing', 'telegram-support', 'theme'].includes(page.settingsTab) || admin.role === 'super_admin') ? page.settingsTab : 'account';
  }
  return result;
}

export function officePageHash(page) {
  if (page.tab === 'business-detail') return `#/businesses/${page.businessId}`;
  if (page.tab === 'settings') return `#/settings/${page.settingsTab || 'account'}`;
  return `#/${paths[page.tab] || 'overview'}`;
}

export function officePageFromHash(hash, admin) {
  let path;
  try { path = decodeURIComponent(hash.replace(/^#\/?/, '')).replace(/\/$/, ''); }
  catch { return overview(); }
  const business = /^businesses\/([1-9]\d*)$/.exec(path);
  if (business) return normalizeOfficePage({ tab: 'business-detail', businessId: business[1] }, admin);
  if (path.startsWith('settings/')) return normalizeOfficePage({ tab: 'settings', settingsTab: path.slice(9) }, admin);
  const tab = Object.keys(paths).find(key => paths[key] === path);
  return normalizeOfficePage({ tab }, admin);
}

function markerFor(admin) {
  const marker = window.history.state?.mkposOffice;
  return marker?.scope === scope(admin) && typeof marker.key === 'string' && /^[a-z0-9-]{8,64}$/i.test(marker.key)
    && Number.isInteger(marker.index) && marker.index >= 0 ? marker : null;
}

export function readOfficeNavigation(admin) {
  const page = officePageFromHash(window.location.hash, admin), marker = markerFor(admin);
  if (marker) {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(prefix(admin) + marker.key));
      if (saved?.version === 1 && Array.isArray(saved.entries) && marker.index < saved.entries.length) {
        const entries = saved.entries.map(item => normalizeOfficePage(item, admin));
        if (officePageHash(entries[marker.index]) === officePageHash(page)) return { key: marker.key, entries, index: marker.index };
      }
    } catch { /* A URL remains sufficient when storage is unavailable or invalid. */ }
  }
  const key = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return { key, entries: [page], index: 0 };
}

export function writeOfficeNavigation(state, admin, mode = 'replace') {
  const entries = state.entries.map(page => normalizeOfficePage(page, admin));
  try { window.sessionStorage.setItem(prefix(admin) + state.key, JSON.stringify({ version: 1, entries })); }
  catch { /* Private browsing/storage limits must not break navigation. */ }
  const url = `${window.location.pathname}${window.location.search}${officePageHash(entries[state.index])}`;
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({ ...window.history.state,
    mkposOffice: { key: state.key, index: state.index, scope: scope(admin) } }, '', url);
}

export function restoreOfficeNavigation(current, admin) {
  const marker = markerFor(admin), page = officePageFromHash(window.location.hash, admin);
  if (marker?.key === current.key && marker.index < current.entries.length
    && officePageHash(normalizeOfficePage(current.entries[marker.index], admin)) === officePageHash(page)) {
    return marker.index === current.index ? current : { ...current, index: marker.index };
  }
  return readOfficeNavigation(admin);
}

export function clearOfficeNavigation(admin) {
  try {
    const keys = Object.keys(window.sessionStorage).filter(key => key.startsWith(prefix(admin)));
    keys.forEach(key => window.sessionStorage.removeItem(key));
  } catch { /* Logout still works without storage access. */ }
  const remaining = { ...window.history.state };
  delete remaining.mkposOffice;
  delete remaining.mkposPageNavigation;
  window.history.replaceState(remaining, '', `${window.location.pathname}${window.location.search}`);
}
