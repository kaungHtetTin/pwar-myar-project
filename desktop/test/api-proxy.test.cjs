const assert = require('node:assert/strict');
const test = require('node:test');
const { apiRequestUrl, createDesktopApiClient, requestBody, safeHeaders } = require('../api-proxy.cjs');

test('keeps desktop API requests on the configured server API', () => {
  assert.equal(
    apiRequestUrl('https://example.test/backend/public/', '/auth/me'),
    'https://example.test/backend/public/api/auth/me',
  );
  assert.throws(() => apiRequestUrl('https://example.test', 'https://evil.test'), /start with one slash/);
  assert.throws(() => apiRequestUrl('https://example.test', '//evil.test'), /start with one slash/);
});

test('drops renderer-controlled transport and CSRF headers', () => {
  const headers = safeHeaders({
    Cookie: 'stolen=true',
    Origin: 'https://evil.test',
    'X-XSRF-TOKEN': 'fake',
    'Content-Type': 'application/json',
  });
  assert.equal(headers.has('Cookie'), false);
  assert.equal(headers.has('Origin'), false);
  assert.equal(headers.has('X-XSRF-TOKEN'), false);
  assert.equal(headers.get('Content-Type'), 'application/json');
});

test('reconstructs multipart values and files in the main process', async () => {
  const form = requestBody({
    kind: 'form-data',
    entries: [
      { kind: 'text', name: 'plan_id', value: '3' },
      { kind: 'file', name: 'proof', filename: 'proof.png', type: 'image/png', bytes: new Uint8Array([1, 2, 3]) },
    ],
  });
  assert.equal(form.get('plan_id'), '3');
  assert.equal(form.get('proof').name, 'proof.png');
  assert.equal(form.get('proof').type, 'image/png');
  assert.deepEqual([...new Uint8Array(await form.get('proof').arrayBuffer())], [1, 2, 3]);
});

test('uses the Electron cookie jar for CSRF-protected API requests', async () => {
  let csrfReady = false;
  const calls = [];
  const client = createDesktopApiClient({
    serverUrl: 'https://example.test/backend/public',
    getCookies: async () => csrfReady ? [{ name: 'XSRF-TOKEN', value: 'secure%20token' }] : [],
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/sanctum/csrf-cookie')) {
        csrfReady = true;
        return new Response(null, { status: 204 });
      }
      return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const response = await client.request({
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { kind: 'text', value: '{"email":"owner@example.com"}' },
  });

  assert.equal(response.ok, true);
  assert.equal(calls[0].url, 'https://example.test/backend/public/sanctum/csrf-cookie');
  assert.equal(calls[1].url, 'https://example.test/backend/public/api/auth/login');
  assert.equal(calls[1].options.headers.get('X-XSRF-TOKEN'), 'secure token');
  assert.equal(calls[1].options.headers.get('Origin'), 'https://example.test');
  assert.equal(calls[1].options.headers.get('Referer'), 'https://example.test/backend/public/');
});

test('portable token requests do not depend on a desktop session or CSRF cookie', async () => {
  const calls = [];
  const client = createDesktopApiClient({
    serverUrl: 'https://example.test/backend/public',
    getCookies: async () => {
      throw new Error('Token auth must not read the session cookie jar.');
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response('{"access_token":"desktop-token"}', {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const response = await client.request({
    path: '/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MKPOS-Auth': 'token',
      'X-MKPOS-Client': 'desktop',
    },
    body: { kind: 'text', value: '{"email":"owner@example.com"}' },
  });

  assert.equal(response.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.test/backend/public/api/auth/register');
  assert.equal(calls[0].options.headers.get('X-MKPOS-Auth'), 'token');
  assert.equal(calls[0].options.headers.get('X-MKPOS-Client'), 'desktop');
  assert.equal(calls[0].options.headers.has('X-XSRF-TOKEN'), false);
});
