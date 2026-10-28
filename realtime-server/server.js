import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Server } from 'socket.io';
import { createAiJobDispatcher } from './ai-jobs.js';

const validChannel = (channel) => typeof channel === 'string' && /^private-shop\.chat\.(business\.[1-9]\d*|thread\.[a-f0-9-]{36}|customer\.[1-9]\d*)$/.test(channel);
const customerChatChannel = channel => typeof channel === 'string' && /^private-shop\.chat\.customer\.[1-9]\d*$/.test(channel);
const orderChannel = (channel) => typeof channel === 'string' && /^private-shop\.orders\.business\.[1-9]\d*$/.test(channel);
const subscriptionChannel = channel => typeof channel === 'string' && /^private-shop\.subscription\.business\.[1-9]\d*$/.test(channel);
const activityChannel = channel => typeof channel === 'string' && (channel === 'private-office.activity' || /^private-shop\.activity\.business\.[1-9]\d*$/.test(channel));
const customerOrderChannel = channel => typeof channel === 'string' && /^private-shop\.orders\.(customer\.[1-9]\d*|tracking\.O-[A-Z0-9]{16})$/.test(channel);
const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('hex');
const resourceChannel = channel => channel === 'public-platform.branding' || (typeof channel === 'string' && /^private-business\.resources\.[1-9]\d*$/.test(channel));
const resourceNames = new Set(['products', 'priceTypes', 'settings', 'sales', 'purchases', 'expenses', 'customers', 'suppliers', 'customerPayments', 'supplierPayments', 'reports', 'assistant', 'branding']);
function matches(value, signature, secret) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(sign(value, secret), 'hex'), Buffer.from(signature, 'hex'));
}

export function createChatServer({ secret, origins, path = '/socket.io', aiJobs = null }) {
  if (!secret || secret.length < 32) throw new Error('CHAT_SECRET must contain at least 32 characters.');
  if (!origins?.length || origins.includes('*')) throw new Error('Set CHAT_ALLOWED_ORIGINS to your web app origins.');
  const allowedOrigin = (origin) => !origin || origins.includes(origin);
  const aiDispatcher = aiJobs ? createAiJobDispatcher(aiJobs) : null;
  let io;
  const participants = new Map();
  function presence(businessId) {
    const sockets = participants.get(businessId) || new Set();
    const customers = new Set();
    let owner = false;
    for (const socket of sockets) {
      if (!socket.data.active) continue;
      if (socket.data.role === 'owner') owner = true;
      else customers.add(socket.data.channel.split('.').at(-1));
    }
    return { owner_active: owner, customers: [...customers] };
  }
  function publishPresence(businessId) {
    const status = presence(businessId);
    io.to(`private-shop.chat.business.${businessId}`).emit('chat.presence', status);
    const threads = new Set([...participants.get(businessId) || []].map((socket) => socket.data.channel).filter((channel) => channel.includes('.thread.')));
    for (const channel of threads) io.to(channel).emit('chat.presence', { owner_active: status.owner_active, customer_active: status.customers.includes(channel.split('.').at(-1)) });
  }
  function publishTyping(socket) {
    const channel = socket.data.channel;
    if (!channel.includes('.thread.')) return;
    const typing = [...participants.get(socket.data.businessId) || []].some(peer => peer.data.channel === channel && peer.data.role === socket.data.role && peer.data.typing);
    io.to(channel).emit('chat.typing', { thread: channel.split('.').at(-1), sender: socket.data.role, typing });
  }
  const http = createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
    };
    const pathname = req.url?.split('?')[0];
    if (pathname === '/health' || pathname === '/api/health') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return reply(405, { message: 'Method not allowed.' });
      }
      return reply(200, { ok: true, service: 'mkpos-chat-realtime', status: 'healthy' });
    }
    if (req.method === 'POST' && req.url === '/ai-jobs') {
      if (!aiDispatcher) return reply(503, { message: 'AI dispatch is disabled.' });
      return aiDispatcher.handle(req, res);
    }
    if (req.method !== 'POST' || req.url !== '/events') return reply(404, { message: 'Not found.' });
    const timestamp = req.headers['x-chat-timestamp'];
    if (typeof timestamp !== 'string' || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 30) return reply(401, { message: 'Unauthorized.' });
    let size = 0, chunks = [];
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 10000) return reply(413, { message: 'Request too large.' });
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      if (!matches(`${timestamp}.${body}`, req.headers['x-chat-signature'], secret)) return reply(401, { message: 'Unauthorized.' });
      const event = JSON.parse(body);
      if (event.event === 'resources.changed') {
        if (!Array.isArray(event.channels) || event.channels.length !== 1 || !resourceChannel(event.channels[0])
          || !Array.isArray(event.data?.resources) || !event.data.resources.length || event.data.resources.length > resourceNames.size
          || !event.data.resources.every(name => resourceNames.has(name) && ((event.channels[0] === 'public-platform.branding') === (name === 'branding')))) return reply(422, { message: 'Invalid event.' });
        io.to(event.channels[0]).emit('resources.changed', { resources: [...new Set(event.data.resources)] });
        return reply(200, { ok: true });
      }
      if (event.event === 'activity.changed') {
        if (!Array.isArray(event.channels) || event.channels.length !== 1 || !activityChannel(event.channels[0])
          || !Number.isSafeInteger(event.data?.event_id) || event.data.event_id < 1) return reply(422, { message: 'Invalid event.' });
        io.to(event.channels).emit('activity.changed', { event_id: event.data.event_id });
        return reply(200, { ok: true });
      }
      if (event.event === 'subscription.approved') {
        if (!Array.isArray(event.channels) || event.channels.length !== 1 || !subscriptionChannel(event.channels[0])
          || !Number.isSafeInteger(event.data?.event_id) || event.data.event_id < 1) return reply(422, { message: 'Invalid event.' });
        io.to(event.channels).emit('subscription.approved', { event_id: event.data.event_id });
        return reply(200, { ok: true });
      }
      if (event.event === 'order.updated') {
        if (!Array.isArray(event.channels) || event.channels.length < 1 || event.channels.length > 2 || !event.channels.every(customerOrderChannel)
          || !Number.isSafeInteger(event.data?.event_id) || event.data.event_id < 1 || !/^O-[A-Z0-9]{16}$/.test(event.data?.reference)
          || event.channels.some(channel => channel.includes('.tracking.') && channel !== `private-shop.orders.tracking.${event.data.reference}`)) return reply(422, { message: 'Invalid event.' });
        io.to(event.channels).emit('order.updated', { event_id: event.data.event_id, reference: event.data.reference });
        return reply(200, { ok: true });
      }
      if (event.event === 'order.changed') {
        if (!Array.isArray(event.channels) || event.channels.length !== 1 || !orderChannel(event.channels[0])
          || !Number.isSafeInteger(event.data?.order_id) || event.data.order_id < 1
          || !Number.isSafeInteger(event.data?.event_id) || event.data.event_id < 1) return reply(422, { message: 'Invalid event.' });
        io.to(event.channels).emit('order.changed', { order_id: event.data.order_id, event_id: event.data.event_id });
        return reply(200, { ok: true });
      }
      if (event.event === 'order.submitted') {
        if (!Array.isArray(event.channels) || event.channels.length !== 1 || !orderChannel(event.channels[0])
          || !Number.isSafeInteger(event.data?.order_id) || event.data.order_id < 1) return reply(422, { message: 'Invalid event.' });
        io.to(event.channels).emit('order.submitted', { order_id: event.data.order_id });
        return reply(200, { ok: true });
      }
      if (!Array.isArray(event.channels) || ![2, 3].includes(event.channels.length) || !event.channels.every(validChannel)
        || event.channels.filter(channel => channel.includes('.business.')).length !== 1
        || event.channels.filter(channel => channel === `private-shop.chat.thread.${event.data?.thread}`).length !== 1
        || event.channels.filter(customerChatChannel).length !== event.channels.length - 2
        || event.event !== 'chat.changed' || !Number.isSafeInteger(event.data?.message_id) || event.data.message_id < 1
        || !validChannel(`private-shop.chat.thread.${event.data?.thread}`)) return reply(422, { message: 'Invalid event.' });
      // Send identifiers only. Message content is fetched from the authenticated PwarMyar API.
      io.to(event.channels).emit('chat.changed', { thread: event.data.thread, message_id: event.data.message_id });
      return reply(200, { ok: true });
    } catch { return reply(400, { message: 'Invalid request.' }); }
  });
  http.requestTimeout = 10000;
  http.on('close', () => aiDispatcher?.close());
  io = new Server(http, {
    path, serveClient: false, maxHttpBufferSize: 10000, transports: ['websocket'],
    cors: { origin: origins }, allowRequest: (req, callback) => callback(null, allowedOrigin(req.headers.origin)),
  });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length > 2000) throw new Error();
      const [payload, signature, extra] = token.split('.');
      if (extra || !matches(payload, signature, secret)) throw new Error();
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (resourceChannel(data.channel)) {
        if (!Number.isSafeInteger(data.exp) || data.exp <= Date.now() / 1000 || data.exp > Date.now() / 1000 + 310) throw new Error();
        if (data.channel === 'public-platform.branding') {
          if (data.role !== 'public') throw new Error();
        } else if (data.role !== 'business' || !Number.isSafeInteger(data.user_id) || data.user_id < 1
          || !Number.isSafeInteger(data.business_id) || data.business_id < 1 || data.channel !== `private-business.resources.${data.business_id}`) throw new Error();
        socket.data.channel = data.channel; socket.data.expires = data.exp; return next();
      }
      if (customerChatChannel(data.channel)) {
        if (data.role !== 'customer' || !Number.isSafeInteger(data.customer_id) || data.customer_id < 1
          || data.channel !== `private-shop.chat.customer.${data.customer_id}`
          || !Number.isSafeInteger(data.exp) || data.exp <= Date.now() / 1000 || data.exp > Date.now() / 1000 + 310) throw new Error();
        socket.data.channel = data.channel; socket.data.expires = data.exp; return next();
      }
      if (activityChannel(data.channel)) {
        if (!Number.isSafeInteger(data.exp) || data.exp <= Date.now() / 1000 || data.exp > Date.now() / 1000 + 310) throw new Error();
        if (data.channel === 'private-office.activity') {
          if (data.role !== 'office' || !Number.isSafeInteger(data.admin_id) || data.admin_id < 1) throw new Error();
        } else if (data.role !== 'owner' || !Number.isSafeInteger(data.business_id) || data.business_id < 1 || data.channel !== `private-shop.activity.business.${data.business_id}`) throw new Error();
        socket.data.channel = data.channel; socket.data.expires = data.exp; return next();
      }
      if (customerOrderChannel(data.channel)) {
        if (data.role !== 'customer' || !Number.isSafeInteger(data.exp) || data.exp <= Date.now() / 1000 || data.exp > Date.now() / 1000 + 310) throw new Error();
        if (data.channel.includes('.customer.')) {
          if (!Number.isSafeInteger(data.customer_id) || data.customer_id < 1 || data.channel !== `private-shop.orders.customer.${data.customer_id}`) throw new Error();
        } else if (!Number.isSafeInteger(data.business_id) || data.business_id < 1) throw new Error();
        socket.data.channel = data.channel; socket.data.expires = data.exp;
        return next();
      }
      if ((!validChannel(data.channel) && !orderChannel(data.channel) && !subscriptionChannel(data.channel)) || !Number.isSafeInteger(data.exp) || data.exp <= Date.now() / 1000 || data.exp > Date.now() / 1000 + 310) throw new Error();
      if (!['owner', 'customer'].includes(data.role) || !Number.isSafeInteger(data.business_id) || data.business_id < 1
        || (data.channel.includes('.business.') && (data.role !== 'owner' || data.channel !== `private-shop.${subscriptionChannel(data.channel) ? 'subscription' : orderChannel(data.channel) ? 'orders' : 'chat'}.business.${data.business_id}`))) throw new Error();
      socket.data.channel = data.channel; socket.data.expires = data.exp;
      socket.data.role = data.role; socket.data.businessId = data.business_id; socket.data.active = false;
      next();
    } catch { next(new Error('Sign in through PwarMyar to use chat.')); }
  });
  io.on('connection', (socket) => {
    socket.join(socket.data.channel);
    if (resourceChannel(socket.data.channel) || orderChannel(socket.data.channel) || customerOrderChannel(socket.data.channel) || customerChatChannel(socket.data.channel) || subscriptionChannel(socket.data.channel) || activityChannel(socket.data.channel)) {
      const expiry = setTimeout(() => socket.disconnect(true), Math.max(1, socket.data.expires * 1000 - Date.now()));
      expiry.unref();
      socket.on('disconnect', () => clearTimeout(expiry));
      return;
    }
    const businessId = socket.data.businessId;
    if (!participants.has(businessId)) participants.set(businessId, new Set());
    participants.get(businessId).add(socket);
    publishPresence(businessId);
    let typingTimer, lastTyping = 0;
    const stopTyping = () => { clearTimeout(typingTimer); if (socket.data.typing) { socket.data.typing = false; publishTyping(socket); } };
    socket.on('chat.typing', (typing) => {
      if (typeof typing !== 'boolean' || !socket.data.channel.includes('.thread.')) return;
      if (!typing) return stopTyping();
      if (!socket.data.active || Date.now() - lastTyping < 500) return;
      lastTyping = Date.now(); socket.data.typing = true; publishTyping(socket);
      clearTimeout(typingTimer); typingTimer = setTimeout(stopTyping, 5000); typingTimer.unref();
    });
    // A client can change only its own activity, never another participant's identity.
    socket.on('chat.activity', (active) => {
      if (active === false) stopTyping();
      if (typeof active !== 'boolean' || socket.data.active === active) return;
      socket.data.active = active;
      publishPresence(businessId);
    });
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(1, socket.data.expires * 1000 - Date.now()));
    expiry.unref();
    socket.on('disconnect', () => {
      stopTyping();
      clearTimeout(expiry);
      participants.get(businessId)?.delete(socket);
      publishPresence(businessId);
      if (!participants.get(businessId)?.size) participants.delete(businessId);
    });
    // Customers and owners submit messages to Laravel, never directly to Socket.IO.
  });
  return { http, io };
}
