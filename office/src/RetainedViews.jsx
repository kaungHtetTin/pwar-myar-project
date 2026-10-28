import React, { useLayoutEffect, useRef, useState } from 'react';
import { RetainedActivityContext, useRetainedActivity } from './retainedActivity';

function RetainedFrame({ active, children }) {
  const visible = useRetainedActivity() && active;
  const root = useRef(null), positions = useRef(new Map()), windowPosition = useRef([0, 0]), focus = useRef(null);
  useLayoutEffect(() => {
    if (!visible) return;
    const node = root.current;
    const restore = () => {
      for (const [element, [left, top]] of positions.current) if (element.isConnected) element.scrollTo?.(left, top);
      window.scrollTo(...windowPosition.current);
      if (focus.current?.isConnected) focus.current.focus({ preventScroll: true });
    };
    restore();
    const frame = requestAnimationFrame(restore);
    const remember = (event) => {
      if (node.hidden) return;
      if (event.target === document || event.target === window) windowPosition.current = [window.scrollX, window.scrollY];
      else if (node.contains(event.target) || event.target.contains?.(node)) positions.current.set(event.target, [event.target.scrollLeft, event.target.scrollTop]);
    };
    window.addEventListener('scroll', remember, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', remember, true); };
  }, [visible]);
  return <RetainedActivityContext.Provider value={visible}><div ref={root} hidden={!visible} aria-hidden={!visible} data-retained-view onFocusCapture={(event) => { focus.current = event.target; }}>{children}</div></RetainedActivityContext.Provider>;
}

export function RetainedViews({ activeKey, children }) {
  const [frames, setFrames] = useState(() => new Map([[activeKey, children]]));
  if (frames.get(activeKey) !== children) {
    const next = new Map(frames); next.set(activeKey, children); setFrames(next);
  }
  const keys = frames.has(activeKey) ? [...frames.keys()] : [...frames.keys(), activeKey];
  return keys.map((key) => <RetainedFrame key={key} active={key === activeKey}>{key === activeKey ? children : frames.get(key)}</RetainedFrame>);
}
