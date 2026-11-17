import { observeViewVisibility } from './viewVisibility.js';

// Relative-time labels share a local clock; it never makes network requests.
const labels = new Set();
let timer, stopVisibility;
const visible = entry => !document.hidden && entry.visible();
function update() {
  if (![...labels].some(visible)) { clearTimeout(timer); timer = undefined; return; }
  if (timer === undefined) timer = setTimeout(tick, 30000);
}
function tick() {
  timer = undefined;
  for (const entry of labels) if (visible(entry)) entry.receive(Date.now());
  update();
}
export function subscribeDisplayClock(receive, isVisible = () => true) {
  if (!labels.size) stopVisibility = observeViewVisibility(() => { clearTimeout(timer); timer = undefined; tick(); });
  const entry = { receive, visible: isVisible };
  labels.add(entry); update();
  return () => {
    labels.delete(entry); update();
    if (!labels.size) stopVisibility?.();
  };
}
