import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const queues = new Set(['sales-ai', 'customer-service', 'wyne-wyne']);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const signature = (purpose, timestamp, body, secret) => createHmac('sha256', secret).update(`${purpose}\n${timestamp}\n${body}`).digest('hex');

export function createAiJobDispatcher({ secret, callbackUrl, requestTimeoutMs = 370000 }) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('AI_JOBS_SECRET must contain at least 32 characters.');
  const target = new URL(callbackUrl);
  if ((target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)))
    || target.username || target.password || target.hash || target.search) throw new Error('AI_JOBS_CALLBACK_URL must be a fixed HTTPS endpoint (HTTP is allowed only on loopback).');
  const states = new Map([...queues].map(queue => [queue, { running: false, requested: false, timer: null, controller: null }]));
  const received = new Map();
  let closed = false;

  function schedule(queue, seconds = 0) {
    if (closed) return;
    const state = states.get(queue);
    clearTimeout(state.timer);
    state.timer = setTimeout(() => { state.timer = null; void processQueue(queue); }, seconds * 1000);
    state.timer.unref();
  }

  async function processQueue(queue) {
    const state = states.get(queue);
    if (closed || state.running) return;
    state.running = true;
    state.requested = false;
    state.controller = new AbortController();
    const timeout = setTimeout(() => state.controller?.abort(), requestTimeoutMs);
    timeout.unref();
    let next = null;
    try {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ queue, request_id: randomUUID() });
      const response = await fetch(target, {
        method: 'POST', redirect: 'error', signal: state.controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-AI-Timestamp': timestamp, 'X-AI-Signature': signature('process', timestamp, body, secret) },
        body,
      });
      if (!response.ok) {
        // Never print response bodies, headers, URLs, prompts or provider errors.
        console.warn('AI queue callback unavailable; cron will recover', { queue, status: response.status });
        await response.body?.cancel();
      } else {
        // The callback is controlled by the server administrator, never wake data.
        const reader = response.body.getReader();
        let bytes = 0, parts = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 1024) { await reader.cancel(); throw new Error('Invalid callback response.'); }
          parts.push(Buffer.from(value));
        }
        const data = JSON.parse(Buffer.concat(parts).toString('utf8'));
        if (data.retry_after === null) next = null;
        else if (Number.isInteger(data.retry_after) && data.retry_after >= 0 && data.retry_after <= 600) next = data.retry_after;
        else throw new Error('Invalid callback response.');
      }
    } catch {
      if (!closed) console.warn('AI queue callback interrupted; cron will recover', { queue });
      // An ambiguous request is never automatically replayed. Durable queue/run
      // claims remain authoritative; cron handles interrupted work normally.
    } finally {
      clearTimeout(timeout);
      state.controller = null;
      state.running = false;
      if (!closed && (state.requested || next !== null)) schedule(queue, state.requested ? 0 : next);
    }
  }

  return {
    async handle(req, res) {
      const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
      const timestamp = req.headers['x-ai-timestamp'];
      const given = req.headers['x-ai-signature'];
      if (closed || typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 60
        || typeof given !== 'string' || !/^[a-f0-9]{64}$/.test(given)) return reply(401, { message: 'Unauthorized.' });
      let size = 0, chunks = [];
      try {
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1024) return reply(413, { message: 'Request too large.' });
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks).toString('utf8');
        if (!timingSafeEqual(Buffer.from(signature('wake', timestamp, body, secret), 'hex'), Buffer.from(given, 'hex'))) return reply(401, { message: 'Unauthorized.' });
        const data = JSON.parse(body);
        if (!data || Array.isArray(data) || Object.keys(data).length !== 2 || !queues.has(data.queue)
          || typeof data.request_id !== 'string' || !uuid.test(data.request_id)) return reply(422, { message: 'Invalid request.' });
        const now = Date.now();
        for (const [key, expires] of received) if (expires <= now) received.delete(key);
        if (received.has(data.request_id)) return reply(409, { message: 'Request already received.' });
        if (received.size >= 10000) return reply(503, { message: 'Busy; cron will recover.' });
        received.set(data.request_id, now + 180000);
        const state = states.get(data.queue);
        state.requested = true;
        if (!state.running) schedule(data.queue);
        // Acknowledge before starting the slow Laravel/provider request.
        return reply(202, { accepted: true });
      } catch { return reply(400, { message: 'Invalid request.' }); }
    },
    close() {
      closed = true;
      for (const state of states.values()) { clearTimeout(state.timer); state.controller?.abort(); }
      received.clear();
    },
  };
}
