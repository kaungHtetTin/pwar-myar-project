import React from 'react';

export function SkeletonBlock({ className = '' }) {
  return <span className={`skeleton-block ${className}`} aria-hidden="true" />;
}

// Keep these rows inside the real table so its existing column widths apply.
export function TableSkeletonRows({ columns, rows = 6, identityColumn = -1, className = '' }) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} className={`table-skeleton-row ${className}`} aria-hidden="true">
      {Array.from({ length: columns }, (_, column) => (
        <td key={column}>
          <span className="skeleton-cell-content">
            {column === identityColumn && <SkeletonBlock className="skeleton-avatar" />}
            <SkeletonBlock className="skeleton-line" />
          </span>
        </td>
      ))}
    </tr>
  ));
}

export function TableLoadingState({ children = 'Loading records…', refreshing = false }) {
  return <div className={refreshing ? 'loading-refresh-status' : 'visually-hidden'} role="status" aria-live="polite">
    {refreshing ? 'Refreshing records…' : children}
  </div>;
}

export function PageSkeleton({ children = 'Loading page…', variant = 'form', count = 6 }) {
  return <div className={`page-loading-skeleton loading-skeleton loading-skeleton--${variant}`} role="status" aria-live="polite" aria-busy="true">
    <span className="visually-hidden">{children}</span>
    <div className="loading-skeleton-content" aria-hidden="true">
      {variant === 'report' ? <>
        <div className="skeleton-metrics">{Array.from({ length: 6 }, (_, i) => <div className="skeleton-metric" key={i}><SkeletonBlock /><SkeletonBlock /></div>)}</div>
        <div className="skeleton-chart"><SkeletonBlock className="skeleton-title" /><div>{[45, 72, 55, 88, 65, 95, 76].map((height, i) => <SkeletonBlock key={i} className={`skeleton-chart-bar skeleton-chart-bar--${height}`} />)}</div></div>
      </> : Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-item">
          {variant === 'cards' && <SkeletonBlock className="skeleton-image" />}
          {variant === 'list' && <SkeletonBlock className="skeleton-avatar" />}
          <div><SkeletonBlock className="skeleton-label" /><SkeletonBlock className={variant === 'form' ? 'skeleton-control' : 'skeleton-description'} /></div>
        </div>
      ))}
    </div>
  </div>;
}

export function LoadingState(props) {
  return <PageSkeleton {...props} />;
}
