export function resolveActiveModule(enabledIds, rememberedId) {
  if (rememberedId && enabledIds.includes(rememberedId)) return rememberedId;
  if (enabledIds.includes('sell')) return 'sell';
  return enabledIds[0] || 'sell';
}

export function resolveActivePage(enabledIds, rememberedId) {
  return resolveActiveModule(enabledIds, rememberedId);
}

export function resolveDashboardModule(enabledIds, preferredId) {
  if (preferredId !== 'sell' && enabledIds.includes(preferredId)) return preferredId;
  return enabledIds.find((id) => id !== 'sell') || null;
}

export function resolveEnabledModules(allIds, configuredIds, permissionIds) {
  const configured = configuredIds.length ? configuredIds : allIds;
  return allIds.filter((id) => id === 'settings' || (permissionIds.includes(id) && (id === 'access' || configured.includes(id))));
}
