import { useEffect } from 'react';
import { usesTouchKeyboard } from './keyboardFocus';
import './keyboard-viewport.css';

export function KeyboardViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport || !usesTouchKeyboard()) return undefined;
    const root = document.documentElement;
    let baseline = Math.max(window.innerHeight, viewport.height);
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = document.activeElement;
        const editing = element?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]), textarea, [contenteditable="true"]');
        // Browser toolbars and pinch zoom are not keyboard openings.
        const wasOpen = root.hasAttribute('data-shop-keyboard-open');
        if (!editing && !wasOpen) baseline = Math.max(window.innerHeight, viewport.height);
        // Keep the frame stable between input blur and the keyboard's closing
        // resize, including a tap on Send or an attachment button.
        const open = (editing || wasOpen) && Math.abs(viewport.scale - 1) < .05 && baseline - viewport.height > 140;
        root.toggleAttribute('data-shop-keyboard-open', Boolean(open));
        if (open) {
          root.style.setProperty('--shop-keyboard-height', `${viewport.height}px`);
          root.style.setProperty('--shop-keyboard-top', `${viewport.offsetTop || 0}px`);
        } else {
          root.style.removeProperty('--shop-keyboard-height');
          root.style.removeProperty('--shop-keyboard-top');
        }
      });
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      root.removeAttribute('data-shop-keyboard-open');
      root.style.removeProperty('--shop-keyboard-height');
      root.style.removeProperty('--shop-keyboard-top');
    };
  }, []);
  return null;
}
