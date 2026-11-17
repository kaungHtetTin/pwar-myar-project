// Retained pages expose visibility through `hidden`; no activity polling is needed.
export function observeViewVisibility(update) {
  document.addEventListener('visibilitychange', update);
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(update) : null;
  if (document.documentElement) observer?.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update); };
}
