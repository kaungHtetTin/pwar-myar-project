const feeds = new Set();
function authRealm(key) { return key.includes('/office/') || key.startsWith('office:') ? 'office' : key.includes('customer:') || key.startsWith('chat:/chat:') ? 'customer' : 'business'; }
function authEpoch(realm) { try { return localStorage.getItem(`mkpos.auth-generation:${realm}`) || ''; } catch { return ''; } }
export function invalidateBackgroundSession(realm) {
  for (const feed of feeds) if (feed.realm === realm) feed.stop();
  try { localStorage.setItem(`mkpos.auth-generation:${realm}`, `${Date.now()}:${Math.random()}`); } catch { /* In-memory cleanup still applies. */ }
}

// Same-origin, account-scoped coordination. No credentials or persistent response cache.
export function shareBackgroundFeed(key, start, receive) {
  if (!key || !globalThis.BroadcastChannel || !globalThis.navigator?.locks?.request) return start(receive);
  let channel;
  try { channel = new BroadcastChannel(`mkpos.feed.v1:${key}`); } catch { return start(receive); }
  let active = true, leader = false, acquiring = false, unavailable = false, release, stopFeed, snapshot;
  const realm = authRealm(key), epoch = authEpoch(realm);
  const peer = globalThis.crypto?.randomUUID?.() || `${Date.now()}:${Math.random()}`;
  let sequence = 0, version = '', lastVersion = '';
  const post = data => { try { channel.postMessage(data); } catch { /* Independent polling remains available. */ } };
  const emit = (...args) => {
    if (!active || !leader || authEpoch(realm) !== epoch) return;
    snapshot = args; version = `${peer}:${++sequence}`;
    receive(...args);
    post({ type: 'snapshot', args, version });
  };
  const elect = () => {
    if (!active || unavailable || leader || acquiring || document.hidden || navigator.onLine === false) return;
    acquiring = true;
    navigator.locks.request(`mkpos.feed.v1:${key}`, { ifAvailable: true }, async lock => {
      if (!lock || !active || document.hidden) return;
      leader = true;
      try {
        await new Promise(done => { release = done; stopFeed = start(emit); });
      } finally {
        leader = false; release = undefined; stopFeed?.(); stopFeed = undefined; snapshot = undefined;
        post({ type: 'vacant' });
      }
    }).catch(() => {
      // Browser denied locks: retain normal polling rather than losing updates.
      unavailable = true;
      if (active && !stopFeed) stopFeed = start(receive);
    }).finally(() => { acquiring = false; });
  };
  channel.onmessage = ({ data }) => {
    if (!active || !data || authEpoch(realm) !== epoch) return;
    if (data.type === 'snapshot' && !leader && (!data.target || data.target === peer) && data.version !== lastVersion && Array.isArray(data.args)) { lastVersion = data.version; receive(...data.args); }
    if (data.type === 'hello' && leader && snapshot) post({ type: 'snapshot', args: snapshot, version, target: data.peer });
    if (data.type === 'vacant') elect();
    if (data.type === 'refresh' && leader) document.dispatchEvent(new Event('visibilitychange'));
  };
  const visibility = () => { if (document.hidden) release?.(); else { elect(); post({ type: 'hello', peer }); } };
  const refresh = () => { if (!leader) post({ type: 'refresh' }); };
  const refreshEvents = ['mkpos:shop-chat-read', 'mkpos:customer-chat-read'];
  for (const event of refreshEvents) window.addEventListener(event, refresh);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('online', elect);
  const timer = setInterval(elect, 2000);
  post({ type: 'hello', peer }); elect();
  const entry = { realm, stop };
  feeds.add(entry);
  const storage = event => { if (event.key === `mkpos.auth-generation:${realm}` && authEpoch(realm) !== epoch) stop(); };
  window.addEventListener('storage', storage);
  function stop() {
    active = false; feeds.delete(entry); window.removeEventListener('storage', storage); clearInterval(timer); release?.(); stopFeed?.(); stopFeed = undefined;
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('online', elect);
    for (const event of refreshEvents) window.removeEventListener(event, refresh);
    channel.close(); snapshot = undefined;
  }
  return stop;
}

export function debounceRefresh(callback, delay = 150) {
  let timer;
  const run = () => { clearTimeout(timer); timer = setTimeout(() => { timer = undefined; callback(); }, delay); };
  run.cancel = () => clearTimeout(timer);
  return run;
}

// Only expiry metadata crosses tabs. Identity is supplied by an authenticated response.
export function createCooldownChannel(onCooldown) {
  let scope = '', channel;
  const expiries = new Map();
  return {
    identity(value) {
      if (scope === value) return;
      channel?.close(); channel = undefined; expiries.clear(); scope = value || '';
      if (!scope || !globalThis.BroadcastChannel) return;
      try {
        channel = new BroadcastChannel(`mkpos.cooldown.v1:${scope}`);
        channel.onmessage = ({ data }) => {
          if (data?.type === 'hello') {
            for (const [key, until] of expiries) if (until > Date.now()) channel.postMessage({ key, until });
            return;
          }
          if (typeof data?.key === 'string' && Number.isFinite(data.until) && data.until > Date.now() && data.until <= Date.now() + 86400000) { expiries.set(data.key, data.until); onCooldown(data.key, data.until); }
        };
        channel.postMessage({ type: 'hello' });
      } catch { /* Local cooldowns still work without cross-tab support. */ }
    },
    send(key, until) { expiries.set(key, until); try { channel?.postMessage({ key, until }); } catch { /* Keep the local expiry. */ } },
  };
}
