import React, { useEffect, useRef, useState } from 'react';
import { consumePendingDataRefresh } from '../dataEvents';
import { RetainedFrame } from './RetainedViews';

export function KeepAliveModules({ active, modules, renderModule, onStale }) {
  const [visited, setVisited] = useState(() => new Set(active ? [active] : []));
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;

  useEffect(() => {
    if (!active) return;
    setVisited((current) => {
      if (current.has(active)) return current;
      const next = new Set(current);
      next.add(active);
      return next;
    });
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (consumePendingDataRefresh(active)) {
      onStaleRef.current?.(active);
    }
  }, [active]);

  return modules.map((module) => {
    const mounted = module.id === active || visited.has(module.id);
    if (!mounted) return null;
    return (
      <div
        key={module.id}
        className="module-view"
        hidden={module.id !== active}
        aria-hidden={module.id !== active}
        data-module={module.id}
      >
        <RetainedFrame active={module.id === active}>{renderModule(module.id)}</RetainedFrame>
      </div>
    );
  });
}
