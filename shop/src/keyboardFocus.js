export const usesTouchKeyboard = () => Boolean(window.matchMedia?.('(hover: none) and (pointer: coarse)').matches);

export function canRestoreFocus(element) {
  return !usesTouchKeyboard() || !element.matches('input, textarea, select, [contenteditable="true"]');
}

export function focusPanel(panel, desktopSelector) {
  const target = panel?.querySelector(usesTouchKeyboard() ? 'button:not(:disabled)' : desktopSelector);
  target?.focus({ preventScroll: true });
}
