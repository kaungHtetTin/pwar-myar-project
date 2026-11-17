import { observeViewVisibility } from '../../../shared/network/viewVisibility.js';
import { createPollPolicy, createSocketRecovery } from '../backgroundPolicy';
import { io } from 'socket.io-client';
import { apiRequest } from '../api/client';

export function connectMobileShopChat(config, channel, callbacks) {
  if (!config?.realtime_enabled || !channel) { callbacks.status?.('Refreshing messages'); return { close() {}, typing() {} }; }
  let closed = false, lastTyping = 0, lastActivity;
  const authPoll = createPollPolicy();
  const socket = io(`${config.scheme}://${config.host}:${config.port}`, {
    path: config.path || '/socket.io', transports: ['websocket'], reconnection: false,
    auth: done => {
      if (closed || !authPoll.ready()) { done({ token: '' }); return; }
      return apiRequest('/shop-admin/chat/auth', { method: 'POST', body: JSON.stringify({ channel_name: channel }) }).then(data => { authPoll.success(); if (!closed) done({ token: data.token }); }).catch(error => { authPoll.failure(error); if (!closed) done({ token: '' }); });
    },
  });
  const recovery = createSocketRecovery(socket, () => !closed);
  const activity = () => {
    const visible = !document.hidden && callbacks.visible();
    if (socket.connected && lastActivity !== visible) { lastActivity = visible; socket.emit('chat.activity', visible); }
  };
  socket.on('connect', () => { lastActivity = undefined; activity(); callbacks.status?.('Live'); if (callbacks.visible() || callbacks.listenWhileHidden) callbacks.change(); });
  socket.on('chat.changed', () => { if (callbacks.visible() || callbacks.listenWhileHidden) callbacks.change(); });
  socket.on('chat.presence', data => callbacks.presence?.(data));
  socket.on('chat.typing', data => { if (data?.thread === channel.split('.').at(-1) && data.sender === 'customer' && typeof data.typing === 'boolean') callbacks.typing?.(data.typing); });
  socket.on('connect_error', () => callbacks.status?.('Refreshing messages'));
  socket.on('disconnect', reason => { callbacks.status?.('Reconnecting…'); callbacks.typing?.(false); if (!closed && reason === 'io server disconnect') recovery.retry(); });
  const stopVisibility = observeViewVisibility(activity);
  return {
    typing(value) { if (!socket.connected || !callbacks.visible()) return; if (value && Date.now() - lastTyping < 1000) return; lastTyping = Date.now(); socket.emit('chat.typing', value); },
    close() { closed = true; recovery.stop(); if (socket.connected) { socket.emit('chat.typing', false); socket.emit('chat.activity', false); } stopVisibility(); socket.removeAllListeners(); socket.disconnect(); },
  };
}
