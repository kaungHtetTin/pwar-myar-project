const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function apiRequestUrl(serverUrl, requestPath) {
  const path = String(requestPath || '');
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Desktop API paths must start with one slash.');
  return `${String(serverUrl).replace(/\/$/, '')}/api${path}`;
}

function safeHeaders(input = {}) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(input || {})) {
    const normalized = name.toLowerCase();
    if (['cookie', 'host', 'origin', 'referer', 'content-length', 'x-xsrf-token'].includes(normalized)) continue;
    if (value !== undefined && value !== null) headers.set(name, String(value));
  }
  headers.set('Accept', 'application/json');
  return headers;
}

function requestBody(payload) {
  if (!payload) return undefined;
  if (payload.kind === 'text') return String(payload.value ?? '');
  if (payload.kind !== 'form-data') throw new Error('Unsupported desktop request body.');

  const form = new FormData();
  for (const entry of payload.entries || []) {
    if (entry.kind === 'file') {
      const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes || []);
      form.append(entry.name, new Blob([bytes], { type: entry.type || 'application/octet-stream' }), entry.filename || 'upload');
    } else {
      form.append(entry.name, String(entry.value ?? ''));
    }
  }
  return form;
}

function createDesktopApiClient({ serverUrl, fetchImpl, getCookies }) {
  if (typeof fetchImpl !== 'function' || typeof getCookies !== 'function') {
    throw new Error('Desktop API client requires fetch and cookie access.');
  }
  const normalizedServer = String(serverUrl).replace(/\/$/, '');
  const trustedOrigin = new URL(normalizedServer).origin;

  function trustedHeaders(headers = {}) {
    return {
      ...headers,
      Origin: trustedOrigin,
      Referer: `${normalizedServer}/`,
    };
  }

  async function csrfToken({ refresh = false } = {}) {
    let cookies = refresh ? [] : await getCookies({ url: `${normalizedServer}/` });
    let token = cookies.find((item) => item.name === 'XSRF-TOKEN')?.value;
    if (!token) {
      const response = await fetchImpl(`${normalizedServer}/sanctum/csrf-cookie`, {
        method: 'GET',
        headers: trustedHeaders({ Accept: 'application/json' }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Unable to start a secure desktop session.');
      cookies = await getCookies({ url: `${normalizedServer}/` });
      token = cookies.find((item) => item.name === 'XSRF-TOKEN')?.value;
    }
    if (!token) throw new Error('The server did not provide a CSRF cookie.');
    return decodeURIComponent(token);
  }

  async function send(payload, allowCsrfRetry = true) {
    const method = String(payload?.method || 'GET').toUpperCase();
    const headers = safeHeaders(payload?.headers);
    const usesTokenAuth = headers.get('X-MKPOS-Auth')?.toLowerCase() === 'token';
    headers.set('Origin', trustedOrigin);
    headers.set('Referer', `${normalizedServer}/`);
    if (UNSAFE_METHODS.has(method) && !usesTokenAuth) headers.set('X-XSRF-TOKEN', await csrfToken());
    if (payload?.body?.kind === 'form-data') headers.delete('Content-Type');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(payload?.timeoutMs) || 15000));
    let response;
    try {
      response = await fetchImpl(apiRequestUrl(normalizedServer, payload?.path), {
        method,
        headers,
        body: ['GET', 'HEAD'].includes(method) ? undefined : requestBody(payload?.body),
        credentials: 'include',
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Request timed out. Check that PwarMyar is running and try again.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 419 && allowCsrfRetry && UNSAFE_METHODS.has(method) && !usesTokenAuth) {
      await csrfToken({ refresh: true });
      return send(payload, false);
    }
    const responseHeaders = Object.fromEntries(response.headers.entries());
    if (payload?.responseType === 'base64') {
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: Buffer.from(await response.arrayBuffer()).toString('base64'),
      };
    }
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: await response.text(),
    };
  }

  return Object.freeze({ request: send });
}

module.exports = { apiRequestUrl, createDesktopApiClient, requestBody, safeHeaders };
