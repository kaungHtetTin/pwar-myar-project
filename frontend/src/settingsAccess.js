export const STAFF_SETTINGS_TAB_IDS = Object.freeze(['account', 'receipt', 'printer', 'barcode', 'about']);

export function settingsTabsForRole(tabs, role) {
  if (role === 'owner') return tabs;
  return tabs.filter(({ id }) => STAFF_SETTINGS_TAB_IDS.includes(id));
}
