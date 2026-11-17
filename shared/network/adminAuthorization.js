let promptHandler = null;

// Credentials are used for one request only, never cached or persisted.
export function registerAdminAuthorization(handler) {
  promptHandler = handler;
  return () => { if (promptHandler === handler) promptHandler = null; };
}

function authorizedOptions(options, credentials) {
  const body = options.body;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const copy = new FormData();
    for (const [key, value] of body.entries()) copy.append(key, value);
    for (const [key, value] of Object.entries(credentials)) copy.set(key, value);
    return { ...options, body: copy };
  }
  return { ...options, body: JSON.stringify({ ...(body ? JSON.parse(body) : {}), ...credentials }) };
}

export async function withAdminAuthorization(path, options, perform) {
  let current = options;
  for (let attempt = 0; ; attempt += 1) {
    try { return await perform(path, current); }
    catch (error) {
      if (error.status !== 403 || error.code !== 'admin_pin_required' || !promptHandler || options.adminPinPrompt === false || attempt >= 3 || options.signal?.aborted) throw error;
      const credentials = await promptHandler({ message: error.message, allowOwnerRecovery: Boolean(error.payload?.allow_owner_recovery), signal: options.signal });
      if (!credentials || options.signal?.aborted) {
        const cancelled = new Error('Authorization cancelled. Your changes have not been saved.');
        cancelled.status = 403;
        cancelled.code = 'admin_pin_cancelled';
        throw cancelled;
      }
      current = authorizedOptions(options, credentials);
    }
  }
}
