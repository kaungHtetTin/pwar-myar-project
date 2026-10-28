const { io } = require('../realtime-server/node_modules/socket.io-client');
const { parse } = require('../realtime-server/node_modules/dotenv');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { createHmac } = require('node:crypto');

(async () => {
  const env = parse(readFileSync('laravel/.env'));
  const node = parse(readFileSync('realtime-server/.env.production.example'));
  const base = `${env.SHOP_CHAT_SOCKET_SCHEME}://${env.SHOP_CHAT_SOCKET_HOST}:${env.SHOP_CHAT_SOCKET_PORT}`;
  const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) });
  const status = await health.json();
  if (!health.ok || status.status !== 'healthy') throw Error('Socket health check failed.');
  const body = '{}', timestamp = String(Math.floor(Date.now() / 1000));
  // Invalid event verifies authentication without broadcasting or modifying any record.
  const publish = await fetch(`${env.SHOP_CHAT_PUBLISH_SCHEME}://${env.SHOP_CHAT_PUBLISH_HOST}:${env.SHOP_CHAT_PUBLISH_PORT}/events`, {
    method: 'POST', body, signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', 'X-Chat-Timestamp': timestamp,
      'X-Chat-Signature': createHmac('sha256', env.SHOP_CHAT_APP_SECRET).update(`${timestamp}.${body}`).digest('hex') },
  });
  const publishResult = await publish.json();
  const signingVerified = publish.status === 422 && publishResult.message === 'Invalid event.';
  // Use an isolated non-customer test room and immediately disconnect; no events are sent.
  const payload = Buffer.from(JSON.stringify({ channel: 'private-shop.orders.business.2147483647', role: 'owner', business_id: 2147483647, exp: Math.floor(Date.now() / 1000) + 120 })).toString('base64url');
  const token = payload + '.' + createHmac('sha256', env.SHOP_CHAT_APP_SECRET).update(payload).digest('hex');
  const origins = await Promise.all(node.CHAT_ALLOWED_ORIGINS.split(',').map(origin => new Promise(resolve => {
    const socket = io(base, { path: env.SHOP_CHAT_SOCKET_PATH || '/socket.io', transports: ['websocket'], reconnection: false, timeout: 10000, extraHeaders: { Origin: origin }, auth: { token } });
    const finish = (connected, error) => { socket.disconnect(); resolve({ origin, connected, ...(error ? { error } : {}) }); };
    socket.once('connect', () => finish(true));
    socket.once('connect_error', error => finish(false, error.message));
  })));
  const result = { endpoint: base, healthy: true, signingVerified, origins, allOriginsReady: origins.every(origin => origin.connected) };
  mkdirSync('artifacts/production-realtime', { recursive: true });
  writeFileSync('artifacts/production-realtime/configuration-check.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (!signingVerified || !result.allOriginsReady) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
