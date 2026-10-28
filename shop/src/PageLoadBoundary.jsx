import React, { useCallback, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { PageLoadingContext, PageReadyContext } from './pageLoading';
import { LoadingSkeleton } from './LoadingSkeleton';

/** Keep one initial skeleton mounted while child loading stages hand off to each other. */
export function PageLoadBoundary({ variant, waiting = false, children }) {
  const pending = useRef(new Set());
  const revealed = useRef(false);
  const [ready, setReady] = useState(false);
  const [revision, update] = useReducer(value => value + 1, 0);
  const register = useCallback(id => {
    if (revealed.current) return;
    pending.current.add(id);
    update();
    return () => { pending.current.delete(id); update(); };
  }, []);
  useLayoutEffect(() => {
    if (!revealed.current && !waiting && pending.current.size === 0) {
      revealed.current = true;
      setReady(true);
    }
  }, [waiting, revision]);
  return <>
    {!ready && <div data-page-loading><LoadingSkeleton variant={variant} page /></div>}
    <div data-page-load-content hidden={!ready} inert={!ready ? '' : undefined}>
      <PageLoadingContext.Provider value={register}><PageReadyContext.Provider value={ready}>{children}</PageReadyContext.Provider></PageLoadingContext.Provider>
    </div>
  </>;
}
