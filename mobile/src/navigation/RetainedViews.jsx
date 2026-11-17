import React, { useContext, useLayoutEffect, useRef, useState } from 'react';
import { PageActivityContext } from './pageRefresh';

function RetainedFrame({ active, children }) {
  const parentActive = useContext(PageActivityContext);
  active = parentActive && active;
  const root = useRef(null), positions = useRef(new Map()), windowPosition = useRef([0, 0]), focus = useRef(null);
  useLayoutEffect(() => {
    if (!active) return;
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
      else if (node.contains(event.target)) positions.current.set(event.target, [event.target.scrollLeft, event.target.scrollTop]);
    };
    window.addEventListener('scroll', remember, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', remember, true); };
  }, [active]);
  return <div ref={root} hidden={!active} aria-hidden={!active} data-retained-view onFocusCapture={(event) => { focus.current = event.target; }}><PageActivityContext.Provider value={active}>{children}</PageActivityContext.Provider></div>;
}

export function RetainedViews({ activeKey, children }) {
  const [frames, setFrames] = useState(() => new Map([[activeKey, children]]));
  useLayoutEffect(() => {
    setFrames((current) => { if (current.get(activeKey) === children) return current; const next = new Map(current); next.set(activeKey, children); return next; });
  }, [activeKey, children]);
  const keys = frames.has(activeKey) ? [...frames.keys()] : [...frames.keys(), activeKey];
  return keys.map((key) => <RetainedFrame key={key} active={key === activeKey}>{key === activeKey ? children : frames.get(key)}</RetainedFrame>);
}
