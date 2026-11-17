import React, { useEffect, useRef, useState } from 'react';
import { useText } from './i18n';

export function SalesTable({ label, children, editable = false }) {
  const t = useText(), viewport = useRef(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const node = viewport.current;
    const measure = () => setOverflow(node.scrollWidth > node.clientWidth + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (node.firstElementChild) observer?.observe(node.firstElementChild);
    return () => observer?.disconnect();
  }, []);
  return <div className="sales-table-group">
    {overflow && <small className="sales-table-hint">{t('Scroll sideways to see all columns.')}</small>}
    <div ref={viewport} className={`sales-action-table${editable ? ' sales-action-table-editable' : ''}`} role="region" aria-label={`${label} — ${t('scrollable table')}`} tabIndex={overflow ? 0 : undefined}>
      {children}
    </div>
  </div>;
}
