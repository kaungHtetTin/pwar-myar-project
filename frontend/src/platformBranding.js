import { io } from 'socket.io-client';
import { startResourceRealtime } from '../../shared/network/resourceRealtime.js';
import { applyPlatformTheme } from './themeRuntime';
import React, { useEffect, useState } from 'react';

let branding = {};
let cacheKey = null;
const eventName = 'mkpos:platform-branding';
const defaultFavicons = new Map();
const defaultTouchIcons = new Map();
const validColor = value => /^#[0-9a-f]{6}$/i.test(value || '');

export function applyBranding(value) {
  if (value?.theme_version && branding.theme_version > value.theme_version) return;
  branding = value || {};
  if (cacheKey) { try { window.localStorage.setItem(cacheKey, JSON.stringify(branding)); } catch { /* Storage may be unavailable. */ } }
  applyPlatformTheme(branding);
  if (validColor(branding.primary_color) && window.mkposDesktop?.applyTheme) {
    try {
      Promise.resolve(window.mkposDesktop.applyTheme({ mode: document.documentElement.dataset.theme, background: document.documentElement.style.getPropertyValue('--theme-background') })).catch(() => {});
    } catch { /* Keep the web theme if an older desktop bridge cannot apply native chrome. */ }
  }
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) { favicon = document.createElement('link'); favicon.rel = 'icon'; document.head.appendChild(favicon); }
  if (!defaultFavicons.has(favicon)) defaultFavicons.set(favicon, { href: favicon.getAttribute('href'), type: favicon.getAttribute('type') });
  if (branding.favicon_url) { favicon.href = branding.favicon_url; favicon.removeAttribute('type'); }
  else { const original = defaultFavicons.get(favicon); if (original.href) favicon.href = original.href; else favicon.removeAttribute('href'); if (original.type) favicon.type = original.type; }
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && validColor(branding.primary_color)) themeMeta.content = branding.primary_color;
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(link => {
    if (!defaultTouchIcons.has(link)) defaultTouchIcons.set(link, link.href);
    link.href = branding.icon_url || defaultTouchIcons.get(link);
  });
  window.dispatchEvent(new CustomEvent(eventName, { detail: branding }));
}

export function BrandImage({ asset = 'logo', src, onError, ...props }) {
  const [value, setValue] = useState(() => branding[`${asset}_url`]);
  const [failedUrl, setFailedUrl] = useState(null);
  useEffect(() => {
    const update = () => setValue(branding[`${asset}_url`]);
    update(); window.addEventListener(eventName, update);
    return () => window.removeEventListener(eventName, update);
  }, [asset]);
  return React.createElement('img', { ...props, src: value && value !== failedUrl ? value : src, onError: event => { if (value && value !== failedUrl) setFailedUrl(value); onError?.(event); } });
}

export function startBranding(apiBase) {
  cacheKey = `mkpos.platform-branding:${apiBase}`;
  try { const cached = JSON.parse(window.localStorage.getItem(cacheKey)); if (cached) applyBranding(cached); } catch { /* Use packaged defaults when no valid cache exists. */ }
  if (!validColor(branding.primary_color)) applyBranding({ primary_color: '#0e684e', theme_mode: 'light' });
  let fetching = false;
  const refresh = async () => {
    if (fetching) return;
    fetching = true;
    try {
      if (window.mkposDesktop?.apiRequest) {
        const response = await window.mkposDesktop.apiRequest({ path:'/branding', method:'GET', headers:{Accept:'application/json'}, timeoutMs:10000 });
        if (response.ok) applyBranding(JSON.parse(response.body));
      } else {
        const response = await fetch(`${apiBase.replace(/\/$/, '')}/branding`, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (response.ok) applyBranding(await response.json());
      }
    } catch { /* Keep the last saved theme while offline. */ } finally { fetching = false; }
  };
  refresh();
  const visibleRefresh = () => { if (document.visibilityState !== 'hidden') void refresh(); };
  const stopRealtime = startResourceRealtime({ io, publicRoom: true, base: '/branding/realtime', fallback: ['branding'], receive: refresh,
    request: async path => {
      if (window.mkposDesktop?.apiRequest) {
        const response = await window.mkposDesktop.apiRequest({ path, method: 'GET', headers: { Accept: 'application/json' }, timeoutMs: 10000 });
        if (!response.ok) throw new Error('Branding connection unavailable.');
        return JSON.parse(response.body);
      }
      const response = await fetch(`${apiBase.replace(/\/$/, '')}${path}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Branding connection unavailable.');
      return response.json();
    },
  });
  window.addEventListener('focus', visibleRefresh);
  document.addEventListener('visibilitychange', visibleRefresh);
  window.addEventListener('online', refresh);
  window.addEventListener('mkpos:refresh-branding', refresh);
  return () => { stopRealtime(); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh); window.removeEventListener('online', refresh); window.removeEventListener('mkpos:refresh-branding', refresh); };
}
