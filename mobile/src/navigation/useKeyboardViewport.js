import { useEffect } from 'react';

// Safari resizes/pans the visual viewport without resizing 100dvh.
export function useKeyboardViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport || !window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) return undefined;
    const root = document.documentElement;
    let baseline = Math.max(window.innerHeight, viewport.height);
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const editing = document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]), textarea, [contenteditable="true"]');
        const wasOpen = root.hasAttribute('data-mobile-keyboard-open');
        if (!editing && !wasOpen) baseline = Math.max(window.innerHeight, viewport.height);
        // Retain the frame through blur while tapping Send, until dismissal resizes it.
        const open = (editing || wasOpen) && Math.abs(viewport.scale - 1) < .05 && baseline - viewport.height > 140;
        root.toggleAttribute('data-mobile-keyboard-open', Boolean(open));
        if (open) {
          root.style.setProperty('--mobile-keyboard-height', `${viewport.height}px`);
          root.style.setProperty('--mobile-keyboard-top', `${viewport.offsetTop || 0}px`);
        } else {
          root.style.removeProperty('--mobile-keyboard-height');
          root.style.removeProperty('--mobile-keyboard-top');
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
      root.removeAttribute('data-mobile-keyboard-open');
      root.style.removeProperty('--mobile-keyboard-height');
      root.style.removeProperty('--mobile-keyboard-top');
    };
  }, []);
}
