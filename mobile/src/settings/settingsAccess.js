export const STAFF_SETTINGS_SECTION_IDS = Object.freeze(['account', 'receipt', 'printer', 'barcode', 'about']);

export function settingsSectionsForRole(sections, role) {
  if (role === 'owner') return sections;
  return sections.filter(([id]) => STAFF_SETTINGS_SECTION_IDS.includes(id));
}
