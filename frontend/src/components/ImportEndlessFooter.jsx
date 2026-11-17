import React, { useEffect, useRef } from 'react';

export function ImportEndlessFooter({ count, total, loading = false, error = '', onLoad, noun = 'rows' }) {
  const sentinel = useRef(null);
  const callback = useRef(onLoad);
  const hasMore = count < total;
  callback.current = onLoad;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading || error) return undefined;
    const root = node.closest('.mkpos-modal-body');
    let requested = false;
    const load = () => {
      if (requested || node.closest('[hidden]')) return;
      requested = true;
      callback.current?.();
    };
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) load(); }, { root, rootMargin: '120px 0px' });
      observer.observe(node);
      return () => observer.disconnect();
    }
    // Keep automatic loading in browsers without IntersectionObserver too.
    const scroll = () => {
      if (root?.clientHeight > 0 && root.scrollHeight - root.scrollTop - root.clientHeight < 120) load();
    };
    root?.addEventListener('scroll', scroll, { passive: true });
    const frame = requestAnimationFrame(scroll);
    return () => { cancelAnimationFrame(frame); root?.removeEventListener('scroll', scroll); };
  }, [count, total, hasMore, loading, error]);

  return <div className="product-import-endless" ref={sentinel}>
    {loading ? <p role="status">Loading more {noun}…</p> : error ? <><p role="alert">{error}</p><button type="button" onClick={onLoad}>Retry loading {noun}</button></>
      : <p>{count} of {total} {noun}{hasMore ? ' · Scroll for more' : ' · All loaded'}</p>}
  </div>;
}
