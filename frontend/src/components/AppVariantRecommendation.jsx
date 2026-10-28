import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Smartphone } from 'lucide-react';
import { Modal } from './common';
import { useLanguage } from './LanguageProvider';
import { mobileAppUrl } from './appVariantUrl';
import './app-variant-recommendation.css';

const QUERY = '(max-width: 767px)';
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
  const smallScreen = useSyncExternalStore(subscribe, () => window.matchMedia?.(QUERY).matches || false, () => false);
  const [dismissed, setDismissed] = useState(dismissedPreviously);
  const root = useRef(null);
  const { language } = useLanguage();
  const my = language === 'my';
  const title = my ? 'မိုဘိုင်းပုံစံကို အသုံးပြုမလား။' : 'Use PwarMyar Mobile?';
  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* Dismiss for this mount when storage is unavailable. */ }
  }
  const native = import.meta.env.MODE === 'desktop' || window.mkposDesktop || window.Capacitor?.isNativePlatform?.();
  const open = smallScreen && !dismissed && !native;
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function keepFocus(event) {
      const dialog = root.current?.querySelector('[role="dialog"]');
      if (dialog && !dialog.contains(event.target)) dialog.querySelector('button')?.focus({ preventScroll: true });
    }
    document.addEventListener('focusin', keepFocus);
    return () => { document.removeEventListener('focusin', keepFocus); document.body.style.overflow = previousOverflow; };
  }, [open]);
  return <div ref={root}><Modal open={open} title={title} onClose={dismiss} size="small" className="app-variant-recommendation" footer={<>
    <button type="button" onClick={dismiss}>{my ? 'ဤပုံစံကို ဆက်သုံးမည်' : 'Stay here'}</button>
    <button type="button" className="primary" onClick={() => { dismiss(); onSwitch(mobileAppUrl()); }}>{my ? 'မိုဘိုင်းပုံစံ ဖွင့်မည်' : 'Open mobile app'}</button>
  </>}>
    <div className="app-variant-copy"><Smartphone size={32} aria-hidden="true" /><p>{my ? 'ဤမျက်နှာပြင်ငယ်အတွက် မိုဘိုင်းပုံစံသည် ထိတွေ့အသုံးပြုရန် ပိုမိုအဆင်ပြေပါသည်။' : 'The mobile app has a touch-friendly layout that fits this small screen.'}</p></div>
  </Modal></div>;
}
