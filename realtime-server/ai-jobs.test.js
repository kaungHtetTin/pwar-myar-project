import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createChatServer } from './server.js';
import { createAiJobDispatcher } from './ai-jobs.js';

const secret = 'ai-node-test-secret-at-least-32-characters';
const sign = (purpose, timestamp, body) => createHmac('sha256', secret).update(`${purpose}\n${timestamp}\n${body}`).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  for (let tries = 0; tries < 200; tries++) {
    if (predicate()) return;
    await pause(10);
  }
  assert.fail('Expected queue callback did not arrive.');
}

async function fixture(t, onCallback = () => ({ retry_after: null }), options = {}) {
  const calls = [];
  const backend = createServer(async (req, res) => {
    const parts = [];
    for await (const chunk of req) parts.push(chunk);
    const body = Buffer.concat(parts).toString('utf8');
    calls.push({ body, headers: req.headers });
    const response = await onCallback(calls.length, JSON.parse(body));
    if (response !== undefined && !res.destroyed) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    }
  });
  backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
  const service = createChatServer({ secret, origins: ['https://shop.example.test'], aiJobs: {
    secret, callbackUrl: `http://127.0.0.1:${backend.address().port}/integrations/ai-jobs/process`, ...options,
  } });
  service.http.listen(0, '127.0.0.1'); await once(service.http, 'listening');
  t.after(async () => {
    await new Promise(resolve => service.io.close(resolve));
    backend.closeAllConnections();
    await new Promise(resolve => backend.close(resolve));
  });
  async function wake(data = { queue: 'sales-ai', request_id: randomUUID() }, { purpose = 'wake', timestamp = String(Math.floor(Date.now() / 1000)), signed = true, raw } = {}) {
    const body = raw ?? JSON.stringify(data);
    return fetch(`http://127.0.0.1:${service.http.address().port}/ai-jobs`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-AI-Timestamp': timestamp,
      'X-AI-Signature': signed ? sign(purpose, timestamp, body) : '0'.repeat(64),
    }, body });
  }
  return { calls, wake };
}

test('signed wake acknowledges promptly and callback drains jobs with a separate purpose signature', async t => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { calls, wake } = await fixture(t, async count => count === 1 ? pending : { retry_after: null });
  const response = await wake();
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true });
  await until(() => calls.length === 1);
  const first = calls[0];
  assert.equal(first.headers['x-ai-signature'], sign('process', first.headers['x-ai-timestamp'], first.body));
  assert.deepEqual(Object.keys(JSON.parse(first.body)).sort(), ['queue', 'request_id']);
  finish({ retry_after: 0 });
  await until(() => calls.length === 2);
});

test('unsigned, expired, reflected, replayed and arbitrary queue/URL requests cannot start work', async t => {
  const { calls, wake } = await fixture(t);
  assert.equal((await wake(undefined, { signed: false })).status, 401);
  assert.equal((await wake(undefined, { purpose: 'process' })).status, 401);
  assert.equal((await wake(undefined, { timestamp: String(Math.floor(Date.now() / 1000) - 90) })).status, 401);
  assert.equal((await wake({ queue: 'default', request_id: randomUUID() })).status, 422);
  assert.equal((await wake({ queue: 'sales-ai', request_id: randomUUID(), callback_url: 'https://attacker.test' })).status, 422);
  assert.equal((await wake(undefined, { raw: 'x'.repeat(1025) })).status, 413);
  assert.equal(calls.length, 0);
  const data = { queue: 'customer-service', request_id: randomUUID() };
  assert.equal((await wake(data)).status, 202);
  assert.equal((await wake(data)).status, 409);
  await until(() => calls.length === 1);
  assert.equal(JSON.parse(calls[0].body).queue, 'customer-service');
});

test('bursts coalesce while a queue is active and never start concurrent callbacks for it', async t => {
  let active = 0, maxActive = 0;
  const { calls, wake } = await fixture(t, async () => {
    maxActive = Math.max(maxActive, ++active);
    await pause(80);
    active--;
    return { retry_after: null };
  });
  await wake();
  await until(() => calls.length === 1);
  const results = await Promise.all(Array.from({ length: 10 }, () => wake()));
  assert.ok(results.every(result => result.status === 202));
  await until(() => calls.length === 2 && active === 0);
  assert.equal(maxActive, 1);
  assert.equal(calls.length, 2);
});

test('ambiguous callback timeout is left to cron instead of automatic replay', async t => {
  const { calls, wake } = await fixture(t, () => undefined, { requestTimeoutMs: 40 });
  await wake();
  await until(() => calls.length === 1);
  await pause(100);
  assert.equal(calls.length, 1);
});

test('callback configuration rejects insecure remote targets and credential-bearing URLs', () => {
  for (const callbackUrl of ['http://remote.example.test/process', 'https://user:pass@example.test/process', 'https://example.test/process?token=secret']) {
    assert.throws(() => createAiJobDispatcher({ secret, callbackUrl }));
  }
});


test('Wyne Wyne reply queue uses the same signed callback allowlist', async t => {
  const {calls,wake}=await fixture(t);
  assert.equal((await wake({queue:'wyne-wyne',request_id:randomUUID()})).status,202);
  await until(()=>calls.length===1);
  assert.equal(JSON.parse(calls[0].body).queue,'wyne-wyne');
});
