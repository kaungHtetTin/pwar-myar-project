import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Monitor } from 'lucide-react';
import { MobileSheet } from './MobilePrimitives';
import { Button } from './Controls';
import { useLocale } from '../localization/LocaleContext';
import { webAppUrl } from './appVariantUrl';

const QUERY = '(min-width: 1200px)';
const DISMISSED_KEY = 'mkpos.variant-recommendation.dismissed';
function subscribe(listener) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener('change', listener);
  return () => media?.removeEventListener('change', listener);
}
function dismissedPreviously() {
  try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

export function AppVariantRecommendation({ onSwitch = url => window.location.assign(url) }) {
  const largeScreen = useSyncExternalStore(subscribe, () => window.matchMedia?.(QUERY).matches || false, () => false);
  const [dismissed, setDismissed] = useState(dismissedPreviously);
  const root = useRef(null);
  const { language } = useLocale();
  const my = language === 'my';
  const native = window.Capacitor?.isNativePlatform?.() || window.mkposDesktop;
  const open = largeScreen && !dismissed && !native;
  const title = my ? 'မျက်နှာပြင်ကြီးပုံစံကို အသုံးပြုမလား။' : 'Use PwarMyar for large screens?';
  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* Keep dismissal in memory when storage is unavailable. */ }
  }
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const dialog = root.current?.querySelector('[role="dialog"]');
    const buttons = () => [...dialog.querySelectorAll('button:not(:disabled)')];
    function keepFocus(event) {
      if (!dialog.contains(event.target)) buttons()[0]?.focus({ preventScroll: true });
    }
    buttons()[0]?.focus({ preventScroll: true });
    function trapFocus(event) {
      if (event.key !== 'Tab') return;
      const controls = buttons();
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    dialog.addEventListener('keydown', trapFocus);
    document.addEventListener('focusin', keepFocus);
    return () => { dialog.removeEventListener('keydown', trapFocus); document.removeEventListener('focusin', keepFocus); if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, [open]);
  return <div ref={root} className="app-variant-recommendation"><MobileSheet open={open} title={title} onClose={dismiss} footer={<>
    <Button variant="secondary" onClick={dismiss}>{my ? 'ဤပုံစံကို ဆက်သုံးမည်' : 'Stay here'}</Button>
    <Button variant="primary" onClick={() => { dismiss(); onSwitch(webAppUrl()); }}>{my ? 'မျက်နှာပြင်ကြီးပုံစံ ဖွင့်မည်' : 'Open web app'}</Button>
  </>}><div className="app-variant-copy"><Monitor size={32} aria-hidden="true" /><p>{my ? 'မျက်နှာပြင်ကြီးပုံစံဖြင့် ဇယားများနှင့် လုပ်ဆောင်ချက်များကို ပိုမိုကျယ်ဝန်းစွာ အသုံးပြုနိုင်ပါသည်။' : 'The web app gives you more room for tables and tools on this large screen.'}</p></div></MobileSheet></div>;
}
