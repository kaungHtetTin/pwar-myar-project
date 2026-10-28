import { createPollPolicy, createSocketRecovery } from './backgroundPolicy';
import { io } from 'socket.io-client';

export function connectShopChat(config, channel, authorize, onChange, onStatus = () => {}, onPresence = () => {}, isVisible = () => true, onActivity = () => {}, onTyping = () => {}) {
  if (!config?.realtime_enabled) { onPresence(null); onStatus('Refreshing messages'); return () => {}; }
  let active = true;
  const authPoll = createPollPolicy(), heartbeatPoll = createPollPolicy({ intervalMs: 30000 });
  const socket = io(`${config.scheme}://${config.host}:${config.port}`, {
    path: config.path || '/socket.io', transports: ['websocket'], reconnectionDelayMax: 10000,
    auth: (callback) => {
      if (!active || !authPoll.ready()) { callback({ token: '' }); return; }
      authorize({ channel_name: channel }).then((data) => { authPoll.success(); if (active) callback({ token: data.token }); })
        .catch(error => { authPoll.failure(error); if (active) { onStatus('Refreshing messages'); callback({ token: '' }); } });
    },
  });
  const recovery = createSocketRecovery(socket, () => active);
  let wasVisible = false, lastHeartbeat = 0, lastTyping = 0, typingUntil = 0;
  const typingTimers = new Map();
  const clearTyping = () => { for (const timer of typingTimers.values()) clearTimeout(timer); typingTimers.clear(); onTyping(null); };
  const typing = (value) => {
    if (!socket.connected) return;
    if (!value) { typingUntil = 0; socket.emit('chat.typing', false); return; }
    if (document.hidden || !isVisible() || Date.now() - lastTyping < 1000) return;
    typingUntil = Date.now() + 3000; lastTyping = Date.now(); socket.emit('chat.typing', true);
  };
  const activity = () => {
    if (document.hidden && isVisible() && Date.now() < typingUntil) return;
    const visible = !document.hidden && isVisible();
    if (!visible) { if (!isVisible()) typing(false); clearTyping(); }
    if (socket.connected) socket.emit('chat.activity', visible);
    if (heartbeatPoll.ready({ allowHidden: true }) && ((visible && Date.now() - lastHeartbeat >= 30000) || (!visible && wasVisible))) {
      lastHeartbeat = Date.now();
      Promise.resolve().then(() => onActivity()).then(() => heartbeatPoll.success()).catch(error => { heartbeatPoll.failure(error); });
    }
    wasVisible = visible;
  };
  document.addEventListener('visibilitychange', activity);
  const activityTimer = setInterval(activity, 2000);
  socket.on('connect', () => { activity(); onStatus('Live'); onChange(); });
  socket.on('chat.presence', onPresence);
  socket.on('chat.changed', onChange);
  socket.on('chat.typing', data => {
    if (!data || !['owner', 'customer'].includes(data.sender) || typeof data.typing !== 'boolean' || data.thread !== channel.split('.').at(-1)) return;
    clearTimeout(typingTimers.get(data.sender)); onTyping(data);
    if (data.typing) typingTimers.set(data.sender, setTimeout(() => onTyping({ ...data, typing: false }), 6000));
  });
  socket.on('connect_error', () => { clearTyping(); onPresence(null); onStatus('Refreshing messages'); });
  socket.on('disconnect', (reason) => {
    clearTyping(); onPresence(null); onStatus('Reconnecting...');
    if (active && reason === 'io server disconnect') recovery.retry();
  });
  const stop = () => { typing(false); clearTyping(); if (wasVisible) Promise.resolve().then(() => onActivity()).catch(() => {}); active = false; recovery.stop(); clearInterval(activityTimer); document.removeEventListener('visibilitychange', activity); socket.removeAllListeners(); socket.disconnect(); };
  stop.typing = typing;
  return stop;
}
