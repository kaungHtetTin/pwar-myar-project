import React, { useLayoutEffect, useRef } from 'react';

export function ChatMessageInput({ value, onResize, ...props }) {
  const input = useRef(null);
  const onResizeRef = useRef(onResize); onResizeRef.current = onResize;
  useLayoutEffect(() => {
    const node = input.current;
    const resize = () => {
      node.style.setProperty('--shop-chat-input-height', '0px');
      const style = getComputedStyle(node);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const height = Math.min(parseFloat(style.maxHeight), Math.max(parseFloat(style.minHeight), node.scrollHeight + border));
      node.style.setProperty('--shop-chat-input-height', `${height}px`);
      onResizeRef.current?.();
    };
    resize();
    if (typeof ResizeObserver === 'undefined') return;
    let width = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth !== width) { width = node.clientWidth; resize(); }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);
  return <textarea {...props} ref={input} value={value} rows={1} />;
}
