import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import './office-table.css';

export function OfficeActionHeader() {
  return <th className="office-action-column" aria-label="Actions" />;
}

export function OfficeActionCell({ children }) {
  return <td className="office-action-column">{children}</td>;
}

/** Non-interactive placeholders keep the standard table layout while records load. */
export function OfficeTableLoadingRows({ columns = 5, rows = 5, actionColumn = true }) {
  return Array.from({ length: rows }, (_, row) => <tr key={row} className="office-table-skeleton-row" aria-hidden="true">
    {Array.from({ length: columns }, (_, column) => {
      const action = actionColumn && column === columns - 1;
      return action ? <OfficeActionCell key={column}><span className="office-table-skeleton office-table-skeleton-action" /></OfficeActionCell> : <td key={column}><span className="office-table-skeleton" style={{ width: `${[72, 48, 62, 55][(row + column) % 4]}%` }} /></td>;
    })}
  </tr>);
}

export function OfficeTableLoadingStatus({ label = 'Updating records...' }) {
  return <span className="office-table-loading-status" role="status">{label}</span>;
}

export function OfficeTableLoading({ columns = ['Name', 'Details', 'Status'], label = 'Loading records...', actionColumn = true }) {
  return <div className="office-table-loading">
    <OfficeTableLoadingStatus label={label} />
    <div className="office-table-scroll" aria-busy="true"><table className="office-data-table" aria-hidden="true"><thead><tr>{columns.map((column, index) => <th key={index}>{column}</th>)}{actionColumn && <OfficeActionHeader />}</tr></thead><tbody><OfficeTableLoadingRows columns={columns.length + (actionColumn ? 1 : 0)} actionColumn={actionColumn} /></tbody></table></div>
  </div>;
}

/** The Businesses footer is the shared layout for every paginated Office table. */
export function OfficeTablePagination({ label, total, page, perPage, lastPage, onPageChange, onPerPageChange, overallTotal, disabled = false }) {
  const first = total ? (page - 1) * perPage + 1 : 0;
  const last = Math.min(page * perPage, total);
  const records = label.toLowerCase().endsWith('s') ? label.toLowerCase() : `${label.toLowerCase()}s`;
  return <nav className="office-table-pagination" aria-label={`${label} pagination`}>
    <span className="office-table-pagination-summary" role="status">
      {total ? `${first}–${last}` : '0'} of {total} {overallTotal == null ? records : `matching ${records}`}
      {overallTotal != null && <> <span aria-hidden="true">·</span> {overallTotal} total</>}
    </span>
    <div className="office-table-pagination-controls">
      <label>Rows per page<select value={perPage} disabled={disabled} onChange={event => onPerPageChange(Number(event.target.value))}>{[10, 25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label>
      <div className="office-table-pagination-pages">
        <button type="button" aria-label="First" title="First page" disabled={disabled || page <= 1} onClick={() => onPageChange(1)}><ChevronsLeft size={16} /></button>
        <button type="button" aria-label="Previous" title="Previous page" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} /></button>
        <span aria-live="polite">Page {page} of {lastPage}</span>
        <button type="button" aria-label="Next" title="Next page" disabled={disabled || page >= lastPage} onClick={() => onPageChange(page + 1)}><ChevronRight size={16} /></button>
        <button type="button" aria-label="Last" title="Last page" disabled={disabled || page >= lastPage} onClick={() => onPageChange(lastPage)}><ChevronsRight size={16} /></button>
      </div>
    </div>
  </nav>;
}
