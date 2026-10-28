window.storefrontCalls = [];
export async function api(path, options) { window.storefrontCalls.push({ path, ...options }); return { ok: true }; }
