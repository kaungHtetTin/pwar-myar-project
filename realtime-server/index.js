import 'dotenv/config';
import { createChatServer } from './server.js';

const host = process.env.CHAT_HOST || '127.0.0.1';
const port = Number(process.env.CHAT_PORT || 8080);
const origins = (process.env.CHAT_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
const aiJobs = process.env.AI_JOBS_CALLBACK_URL || process.env.AI_JOBS_SECRET
  ? { callbackUrl: process.env.AI_JOBS_CALLBACK_URL, secret: process.env.AI_JOBS_SECRET } : null;
const { http, io } = createChatServer({ secret: process.env.CHAT_SECRET, origins, path: process.env.CHAT_SOCKET_PATH || '/socket.io', aiJobs });
http.once('error', async (error) => {
  if (error.code === 'EADDRINUSE') {
    const probeHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '[::1]' : host.includes(':') ? `[${host}]` : host;
    try {
      const response = await fetch(`http://${probeHost}:${port}/health`, { signal: AbortSignal.timeout(2000) });
      const status = await response.json();
      if (response.ok && status.ok === true && status.service === 'mkpos-chat-realtime') {
        console.log(`PwarMyar realtime server is already running on ${host}:${port}. Chat is ready; another instance is not needed.`);
        process.exit(0);
      }
    } catch { /* Another application may own the port. */ }
    console.error(`Port ${port} on ${host} is already used by another application. Update CHAT_PORT and the matching Laravel socket/publish port settings, or stop that application.`);
  } else {
    console.error(`Unable to start PwarMyar realtime server: ${error.message}`);
  }
  process.exit(1);
});
http.listen(port, host, () => console.log(`PwarMyar Socket.IO listening on ${host}:${port}`));
const shutdown = () => io.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
