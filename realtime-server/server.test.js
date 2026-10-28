import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { io as connect } from 'socket.io-client';
import { createChatServer } from './server.js';

const secret = 'test-secret-that-is-at-least-thirty-two-characters';
const channel = 'private-shop.chat.thread.12345678-1234-1234-1234-123456789abc';
const origin = 'http://shop.test';

test('customer inbox rooms receive signed changes across shops without leaking to other accounts', { timeout: 5000 }, async t => {
  const url = await server(t);
  const room = 'private-shop.chat.customer.101';
  const customer = client(t, url, ticket(room, undefined, { role: 'customer', customer_id: 101 }));
  const other = client(t, url, ticket('private-shop.chat.customer.102', undefined, { role: 'customer', customer_id: 102 }));
  await Promise.all([once(customer, 'connect'), once(other, 'connect')]);
  let leaks = 0; other.on('chat.changed', () => leaks++);
  const changed = once(customer, 'chat.changed');
  const data = { thread: channel.split('.').at(-1), message_id: 7, body: 'Private text' };
  assert.equal((await publish(url, JSON.stringify({ channels: [channel, 'private-shop.chat.business.42', room], event: 'chat.changed', data }))).status, 200);
  assert.deepEqual((await changed)[0], { thread: data.thread, message_id: 7 });
  for (const identity of [{ role: 'owner', customer_id: 101 }, { role: 'customer', customer_id: 102 }]) {
    const denied = client(t, url, ticket(room, undefined, identity));
    await once(denied, 'connect_error'); assert.equal(denied.connected, false);
  }
  customer.emit('chat.changed', data);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(leaks, 0);
});
test('public API and legacy health checks support monitoring without credentials or cached responses', { timeout: 5000 }, async t => {
  const url = await server(t);
  for (const path of ['/api/health', '/health', '/api/health?probe=uptime']) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), { ok: true, service: 'mkpos-chat-realtime', status: 'healthy' });
  }
  const head = await fetch(url + '/api/health', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const denied = await fetch(url + '/api/health', { method: 'POST' });
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.get('allow'), 'GET, HEAD');
  assert.equal((await fetch(url + '/api/health-other')).status, 404);
});

test('activity alerts isolate Office and each owner and accept only signed server publications', { timeout: 5000 }, async t => {
  const url = await server(t), room = 'private-shop.activity.business.42', officeRoom = 'private-office.activity';
  const owner = client(t, url, ticket(room)), other = client(t, url, ticket('private-shop.activity.business.43'));
  const office = client(t, url, ticket(officeRoom, undefined, { role: 'office', admin_id: 8 }));
  await Promise.all([once(owner,'connect'),once(other,'connect'),once(office,'connect')]);
  let leaks=0;other.on('activity.changed',()=>leaks++);
  const ownerUpdate=once(owner,'activity.changed');
  assert.equal((await publish(url,JSON.stringify({channels:[room],event:'activity.changed',data:{event_id:11,title:'Private'}}))).status,200);
  assert.deepEqual((await ownerUpdate)[0],{event_id:11});
  const officeUpdate=once(office,'activity.changed');
  assert.equal((await publish(url,JSON.stringify({channels:[officeRoom],event:'activity.changed',data:{event_id:12}}))).status,200);
  assert.deepEqual((await officeUpdate)[0],{event_id:12});
  for(const [room,identity] of [[officeRoom,{role:'owner',business_id:42}],[officeRoom,{role:'office',admin_id:0}],['private-shop.activity.business.42',{role:'owner',business_id:43}],['private-shop.activity.business.42',{role:'customer',business_id:42}]]){
    const denied=client(t,url,ticket(room,undefined,identity));await once(denied,'connect_error');assert.equal(denied.connected,false);
  }
  other.emit('activity.changed',{event_id:13});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(leaks,0);
  assert.equal((await publish(url,JSON.stringify({channels:[officeRoom],event:'activity.changed',data:{event_id:-1}}))).status,422);
});
test('subscription approvals reach only the signed business owner room', { timeout: 5000 }, async t => {
  const url = await server(t), room = 'private-shop.subscription.business.42';
  const owner = client(t, url, ticket(room)), other = client(t, url, ticket('private-shop.subscription.business.43'));
  await Promise.all([once(owner, 'connect'), once(other, 'connect')]);
  let leaks = 0; other.on('subscription.approved', () => leaks++);
  const incoming = once(owner, 'subscription.approved');
  const event = { channels: [room], event: 'subscription.approved', data: { event_id: 12, plan_name: 'Private' } };
  assert.equal((await publish(url, JSON.stringify(event))).status, 200);
  assert.deepEqual((await incoming)[0], { event_id: 12 });
  for (const identity of [{ role: 'customer', business_id: 42 }, { role: 'owner', business_id: 43 }]) {
    const denied = client(t, url, ticket(room, undefined, identity)); await once(denied, 'connect_error'); assert.equal(denied.connected, false);
  }
  assert.equal((await publish(url, JSON.stringify({ ...event, data: { event_id: 0 } }))).status, 422);
  assert.equal((await publish(url, JSON.stringify({ ...event, channels: ['private-shop.orders.business.42'] }))).status, 422);
  owner.emit('subscription.approved', { event_id: 13 });
  await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(leaks, 0);
});
test('order updates are private to the signed customer or private tracking room', { timeout: 5000 }, async t => {
  const url = await server(t), reference = 'O-1234567890ABCDEF';
  const accountRoom = 'private-shop.orders.customer.101', guestRoom = `private-shop.orders.tracking.${reference}`;
  const customer = client(t, url, ticket(accountRoom, undefined, { role: 'customer', customer_id: 101 }));
  const guest = client(t, url, ticket(guestRoom, undefined, { role: 'customer', business_id: 42 }));
  const other = client(t, url, ticket('private-shop.orders.customer.102', undefined, { role: 'customer', customer_id: 102 }));
  const otherOrder = client(t, url, ticket('private-shop.orders.tracking.O-AAAAAAAAAAAAAAAA', undefined, { role: 'customer', business_id: 42 }));
  await Promise.all([once(customer,'connect'),once(guest,'connect'),once(other,'connect'),once(otherOrder,'connect')]);
  let leaks = 0; other.on('order.updated', () => leaks++); otherOrder.on('order.updated', () => leaks++);
  const accountUpdate = once(customer, 'order.updated'), guestUpdate = once(guest, 'order.updated');
  const event = { channels: [accountRoom, guestRoom], event: 'order.updated', data: { event_id: 20, reference, reason: 'Private content' } };
  assert.equal((await publish(url, JSON.stringify(event))).status, 200);
  assert.deepEqual((await accountUpdate)[0], { event_id: 20, reference });
  assert.deepEqual((await guestUpdate)[0], { event_id: 20, reference });
  assert.equal((await publish(url, JSON.stringify({ ...event, data: { event_id: 20, reference: 'O-AAAAAAAAAAAAAAAA' } }))).status, 422);
  for (const identity of [{ role: 'owner', customer_id: 101 }, { role: 'customer', customer_id: 102 }]) {
    const denied = client(t, url, ticket(accountRoom, undefined, identity));
    await once(denied, 'connect_error'); assert.equal(denied.connected, false);
  }
  customer.emit('order.updated', { event_id: 21, reference });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(leaks, 0);
});
test('submitted orders reach only signed owner order rooms with identifiers only', { timeout: 5000 }, async t => {
  const url = await server(t);
  const room = 'private-shop.orders.business.42';
  const owner = client(t, url, ticket(room));
  const other = client(t, url, ticket('private-shop.orders.business.43'));
  const customer = client(t, url, ticket(channel));
  await Promise.all([once(owner, 'connect'), once(other, 'connect'), once(customer, 'connect')]);
  let leaked = 0;
  other.on('order.submitted', () => leaked++);
  customer.on('order.submitted', () => leaked++);
  const incoming = once(owner, 'order.submitted');
  assert.equal((await publish(url, JSON.stringify({ channels: [room], event: 'order.submitted', data: { order_id: 12, customer_name: 'Private' } }))).status, 200);
  assert.deepEqual((await incoming)[0], { order_id: 12 });
  assert.equal((await publish(url, JSON.stringify({ channels: [channel], event: 'order.submitted', data: { order_id: 12 } }))).status, 422);
  assert.equal((await publish(url, JSON.stringify({ channels: [room], event: 'order.submitted', data: { order_id: -1 } }))).status, 422);
  customer.emit('order.submitted', { order_id: 13 });
  for (const identity of [{ role: 'customer', business_id: 42 }, { role: 'owner', business_id: 43 }]) {
    const denied = client(t, url, ticket(room, undefined, identity));
    await once(denied, 'connect_error');
    assert.equal(denied.connected, false);
  }
  assert.equal(leaked, 0);
});
test('typing is scoped to the authenticated thread and stops on inactivity', { timeout: 8000 }, async t => {
  const url = await server(t);
  const customer = client(t, url, ticket(channel));
  const owner = client(t, url, ticket(channel, Math.floor(Date.now() / 1000) + 300, { role: 'owner', business_id: 42 }));
  const other = client(t, url, ticket('private-shop.chat.thread.aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
  await Promise.all([once(customer, 'connect'), once(owner, 'connect'), once(other, 'connect')]);
  let leaked = 0; other.on('chat.typing', () => leaked++);
  customer.emit('chat.activity', true);
  const started = once(owner, 'chat.typing'); customer.emit('chat.typing', true);
  assert.deepEqual((await started)[0], { thread: channel.split('.').at(-1), sender: 'customer', typing: true });
  const stopped = once(owner, 'chat.typing'); customer.emit('chat.activity', false);
  assert.equal((await stopped)[0].typing, false);
  customer.emit('chat.activity', true);
  await new Promise(resolve => setTimeout(resolve, 510));
  const again = once(owner, 'chat.typing'); customer.emit('chat.typing', true); await again;
  const expired = once(owner, 'chat.typing'); assert.equal((await expired)[0].typing, false);
  assert.equal(leaked, 0);
});
const sign = (value) => createHmac('sha256', secret).update(value).digest('hex');
function ticket(room, expires = Math.floor(Date.now() / 1000) + 300, identity = { role: room.includes('.business.') ? 'owner' : 'customer', business_id: room.includes('.business.') ? Number(room.split('.').at(-1)) : 42 }) {
  const payload = Buffer.from(JSON.stringify({ channel: room, exp: expires, ...identity })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
async function server(t) {
  const service = createChatServer({ secret, origins: [origin] });
  service.http.listen(0, '127.0.0.1'); await once(service.http, 'listening');
  t.after(() => new Promise((resolve) => service.io.close(resolve)));
  return `http://127.0.0.1:${service.http.address().port}`;
}
function client(t, url, token, clientOrigin = origin) {
  const socket = connect(url, { transports: ['websocket'], reconnection: false, auth: { token }, extraHeaders: { Origin: clientOrigin } });
  t.after(() => socket.disconnect());
  return socket;
}
async function publish(url, body, timestamp = String(Math.floor(Date.now() / 1000)), signature = sign(`${timestamp}.${body}`)) {
  return fetch(`${url}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Chat-Timestamp': timestamp, 'X-Chat-Signature': signature }, body });
}

function presenceEvent(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('chat.presence', listener); reject(new Error('Presence update missing')); }, 2000);
    const listener = (status) => { if (predicate(status)) { clearTimeout(timer); socket.off('chat.presence', listener); resolve(status); } };
    socket.on('chat.presence', listener);
  });
}

test('presence tracks visible participants across tabs and scopes customer snapshots to their conversation', { timeout: 10000 }, async (t) => {
  const url = await server(t);
  const owner = client(t, url, ticket('private-shop.chat.business.42'));
  const customer = client(t, url, ticket(channel));
  const other = client(t, url, ticket('private-shop.chat.business.43'));
  await Promise.all([once(owner, 'connect'), once(customer, 'connect'), once(other, 'connect')]);
  let otherEvents = 0; other.on('chat.presence', () => otherEvents++);
  const ownerOnline = presenceEvent(customer, (status) => status.owner_active);
  owner.emit('chat.activity', true);
  assert.deepEqual(await ownerOnline, { owner_active: true, customer_active: false });
  const customerOnline = presenceEvent(owner, (status) => status.customers.includes(channel.split('.').at(-1)));
  customer.emit('chat.activity', true);
  assert.equal((await customerOnline).owner_active, true);
  const secondTab = client(t, url, ticket(channel));
  await once(secondTab, 'connect');
  const bothTabs = presenceEvent(secondTab, (status) => status.customer_active);
  secondTab.emit('chat.activity', true); await bothTabs;
  const stillOnline = presenceEvent(owner, (status) => status.customers.length === 1);
  customer.disconnect(); await stillOnline;
  const hidden = presenceEvent(owner, (status) => status.customers.length === 0);
  secondTab.emit('chat.activity', false); await hidden;
  const ownerOffline = presenceEvent(secondTab, (status) => !status.owner_active);
  owner.disconnect();
  assert.deepEqual(await ownerOffline, { owner_active: false, customer_active: false });
  assert.equal(otherEvents, 0);
});

test('presence identities must be signed and customers cannot join a business room', { timeout: 5000 }, async (t) => {
  const url = await server(t);
  for (const identity of [{ role: 'owner', business_id: 43 }, { role: 'customer', business_id: 42 }, { role: 'admin', business_id: 42 }]) {
    const socket = client(t, url, ticket('private-shop.chat.business.42', undefined, identity));
    await once(socket, 'connect_error');
    assert.equal(socket.connected, false);
  }
});

test('signed Laravel events reach only the authorized rooms and expose identifiers only', { timeout: 5000 }, async (t) => {
  const url = await server(t);
  const customer = client(t, url, ticket(channel)), owner = client(t, url, ticket('private-shop.chat.business.42')),
    other = client(t, url, ticket('private-shop.chat.business.43'));
  await Promise.all([once(customer, 'connect'), once(owner, 'connect'), once(other, 'connect')]);
  let otherEvents = 0; other.on('chat.changed', () => otherEvents++);
  const customerEvent = once(customer, 'chat.changed'), ownerEvent = once(owner, 'chat.changed');
  const body = JSON.stringify({ channels: [channel, 'private-shop.chat.business.42'], event: 'chat.changed',
    data: { thread: channel.split('.').at(-1), message_id: 10, body: 'This content must not be broadcast.' } });
  assert.equal((await publish(url, body)).status, 200);
  const [customerData] = await customerEvent, [ownerData] = await ownerEvent;
  assert.deepEqual(customerData, { thread: channel.split('.').at(-1), message_id: 10 });
  assert.deepEqual(customerData, ownerData);
  assert.equal(otherEvents, 0);
  customer.emit('chat.changed', { body: 'Injected' });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(otherEvents, 0);
});

test('missing, tampered, expired, and unsupported room tickets are rejected', { timeout: 5000 }, async (t) => {
  const url = await server(t);
  for (const token of ['', ticket(channel).replace(/.$/, 'z'), ticket(channel, Math.floor(Date.now() / 1000) - 1), ticket('public-room')]) {
    const socket = client(t, url, token);
    const [error] = await once(socket, 'connect_error');
    assert.match(error.message, /Sign in through PwarMyar/);
    assert.equal(socket.connected, false);
  }
  const disallowed = client(t, url, ticket(channel), 'http://untrusted.test');
  await once(disallowed, 'connect_error');
  assert.equal(disallowed.connected, false);
});

test('publishing requires a current signature and a valid chat event', { timeout: 5000 }, async (t) => {
  const url = await server(t);
  assert.equal((await publish(url, '{}', undefined, '0'.repeat(64))).status, 401);
  assert.equal((await publish(url, '{}', String(Math.floor(Date.now() / 1000) - 60))).status, 401);
  assert.equal((await publish(url, JSON.stringify({ channels: ['public'], event: 'custom' }))).status, 422);
  assert.equal((await fetch(`${url}/health`)).status, 200);
});

function startCommand(port) {
  return new Promise((resolve) => execFile(process.execPath, ['index.js'], {
    cwd: new URL('.', import.meta.url), timeout: 5000,
    env: { ...process.env, CHAT_HOST: '127.0.0.1', CHAT_PORT: String(port), CHAT_SECRET: secret, CHAT_ALLOWED_ORIGINS: origin },
  }, (error, stdout, stderr) => resolve({ code: error?.code || 0, stdout, stderr })));
}

test('starting a second instance reports the running PwarMyar service without crashing', { timeout: 10000 }, async (t) => {
  const url = await server(t);
  const result = await startCommand(new URL(url).port);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /already running/);
  assert.equal(result.stderr, '');
  assert.equal((await fetch(`${url}/health`)).status, 200);
});

test('an unrelated occupied port produces a clear error and preserves the other application', { timeout: 10000 }, async (t) => {
  const other = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });
  other.listen(0, '127.0.0.1'); await once(other, 'listening');
  t.after(() => new Promise((resolve) => other.close(resolve)));
  const result = await startCommand(other.address().port);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /already used by another application/);
  assert.doesNotMatch(result.stderr, /Unhandled|node:events/);
  assert.equal((await fetch(`http://127.0.0.1:${other.address().port}/health`)).status, 200);
});

test('order changes reach all authorized staff devices in the same business only', { timeout: 5000 }, async t => {
  const url = await server(t), room = 'private-shop.orders.business.42';
  const first = client(t, url, ticket(room)), second = client(t, url, ticket(room));
  const other = client(t, url, ticket('private-shop.orders.business.43'));
  await Promise.all([once(first, 'connect'), once(second, 'connect'), once(other, 'connect')]);
  let leaked = 0; other.on('order.changed', () => leaked++);
  const a = once(first, 'order.changed'), b = once(second, 'order.changed');
  const event = { channels: [room], event: 'order.changed', data: { event_id: 50, order_id: 12, customer_name: 'Private' } };
  assert.equal((await publish(url, JSON.stringify(event))).status, 200);
  for (const update of [await a, await b]) assert.deepEqual(update[0], { event_id: 50, order_id: 12 });
  assert.equal((await publish(url, JSON.stringify({ ...event, channels: [channel] }))).status, 422);
  assert.equal((await publish(url, JSON.stringify({ ...event, data: { order_id: 12 } }))).status, 422);
  first.emit('order.changed', { event_id: 51, order_id: 12 });
  await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(leaked, 0);
});


test('resource notifications isolate tenants and public branding and reject invalid identities and payloads', { timeout: 5000 }, async t => {
  const url = await server(t), room = 'private-business.resources.42';
  const owner = client(t, url, ticket(room, undefined, {role:'business', business_id:42, user_id:8}));
  const other = client(t, url, ticket('private-business.resources.43', undefined, {role:'business', business_id:43, user_id:9}));
  const guest = client(t, url, ticket('public-platform.branding', undefined, {role:'public'}));
  await Promise.all([once(owner,'connect'),once(other,'connect'),once(guest,'connect')]);
  let leaks=0; other.on('resources.changed',()=>leaks++); guest.on('resources.changed',data=>{if(data.resources.includes('products'))leaks++});
  const received=once(owner,'resources.changed');
  const event={channels:[room],event:'resources.changed',data:{resources:['products','assistant'],body:'Private'}};
  assert.equal((await publish(url,JSON.stringify(event))).status,200);
  assert.deepEqual((await received)[0],{resources:['products','assistant']});
  const branded=once(guest,'resources.changed');
  assert.equal((await publish(url,JSON.stringify({channels:['public-platform.branding'],event:'resources.changed',data:{resources:['branding']}}))).status,200);
  assert.deepEqual((await branded)[0],{resources:['branding']});
  for(const [channel,identity] of [[room,{role:'business',business_id:43,user_id:8}],[room,{role:'public'}],[room,{role:'business',business_id:42,user_id:0}]]) {
    const denied=client(t,url,ticket(channel,undefined,identity)); await once(denied,'connect_error'); assert.equal(denied.connected,false);
  }
  for(const [channels,resources] of [[[room],['branding']],[['public-platform.branding'],['products']],[[room],['invalid']],[[room],[]],[[room,'private-business.resources.43'],['products']]]) {
    assert.equal((await publish(url,JSON.stringify({channels,event:'resources.changed',data:{resources}}))).status,422);
  }
  owner.emit('resources.changed',{resources:['products']});
  await new Promise(resolve=>setTimeout(resolve,30)); assert.equal(leaks,0);
});
