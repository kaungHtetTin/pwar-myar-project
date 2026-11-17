// A database outage affects every API route in this SPA, not just one feed.
// Pause new requests briefly; never replay mutations after an uncertain result.
export function createServiceAvailability() {
  let retryAt = 0;
  return {
    record(error) {
      if (error.status === 503 && error.code === 'database_unavailable') {
        retryAt = Math.max(retryAt, Date.now() + (error.retryAfterMs || 15000));
      }
    },
    guard() {
      const retryAfterMs = retryAt - Date.now();
      if (retryAfterMs > 0) {
        throw Object.assign(new Error('The database is temporarily unavailable. Please try again shortly.'), {
          status: 503, code: 'database_unavailable', retryAfterMs,
        });
      }
    },
    clear() { retryAt = 0; },
  };
}
