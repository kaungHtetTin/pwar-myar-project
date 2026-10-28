import React, { useEffect, useRef, useState } from "react";
import { request } from "../api";
import { TablePagination } from "../components/common";

export function ShopOrdersTable({ path, refresh, columns, tableLabel, render, onSaved, backgroundRefresh = false }) {
  const [pagination, setPagination] = useState({ path, page: 1, size: 25 });
  const [retry, setRetry] = useState(0);
  const [liveRevision, setLiveRevision] = useState(0);
  const [state, setState] = useState({ rows: [], total: 0, loading: true, error: "" });
  const page = pagination.path === path ? pagination.page : 1;
  const size = pagination.size;
  const generation = useRef(0);
  const lastQuery = useRef(null);
  useEffect(() => {
    const version = ++generation.current;
    let active = true;
    const query = `${path}:${page}:${size}`;
    const keepRows = (backgroundRefresh || liveRevision > 0) && lastQuery.current === query;
    lastQuery.current = query;
    setState((current) => ({ ...current, rows: keepRows ? current.rows : [], loading: !keepRows || !current.rows.length, error: "" }));
    request(`${path}${path.includes("?") ? "&" : "?"}offset=${(page - 1) * size}&limit=${size}`)
      .then((result) => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(result.total / size));
        if (page > lastPage) {
          setPagination({ path, page: lastPage, size });
          return;
        }
        setState({ rows: result.items, total: result.total, loading: false, error: "" });
      })
      .catch((error) => {
        if (active) setState((current) => ({ ...current, loading: false, error: error.message }));
      });
    return () => { active = false; generation.current = version + 1; };
  }, [path, page, size, refresh, retry, backgroundRefresh, liveRevision]);
  useEffect(() => {
    let timer;
    const changed = () => { clearTimeout(timer); timer = setTimeout(() => setLiveRevision(value => value + 1), 80); };
    window.addEventListener('mkpos:shop-order-changed', changed);
    return () => { clearTimeout(timer); window.removeEventListener('mkpos:shop-order-changed', changed); };
  }, []);

  const version = generation.current;
  useEffect(() => {
    const updated = event => {
      const order = event.detail, filters = new URLSearchParams(path.split('?')[1] || '');
      const request_count = (order.customer_requests || []).filter(row => row.status === 'pending' || (row.type === 'return' && row.status === 'approved')).length;
      const matches = (!filters.get('status') || filters.get('status') === order.status) && (!filters.get('payment_status') || filters.get('payment_status') === order.payment_status) && (filters.get('requests') !== '1' || request_count > 0);
      setState(current => { if (!current.rows.some(row => row.id === order.id)) return current; return { ...current, rows: matches ? current.rows.map(row => row.id === order.id ? { ...row, ...order, request_count } : row) : current.rows.filter(row => row.id !== order.id), total: current.total - (matches ? 0 : 1) }; });
    };
    window.addEventListener('mkpos:shop-order-updated', updated); return () => window.removeEventListener('mkpos:shop-order-updated', updated);
  }, [path]);
  function updateRow(id, saved) {
    if (version !== generation.current || saved.id !== id) return;
    setState((current) => ({ ...current, rows: current.rows.map((row) => row.id === id ? { ...row, ...saved } : row) }));
    onSaved?.(saved);
  }

  return <div className="shop-table-card">
    <div className="table-wrap sheet-table shop-table-scroll" aria-busy={state.loading}>
      <table className="shop-data-table" aria-label={tableLabel}>
        <colgroup>{columns.map((column) => <col key={column.label} style={{ width: column.width }} />)}</colgroup>
        <thead><tr>{columns.map((column) => <th key={column.label} scope="col" className={column.className}>{column.label}</th>)}</tr></thead>
        <tbody>{state.rows.map((row) => render(row, { onSaved: (saved) => updateRow(row.id, saved) }))}</tbody>
      </table>
      {state.loading ? <p className="shop-list-end" role="status">Loading…</p>
        : state.error ? <div className="shop-list-end" role="alert">{state.error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
          : !state.rows.length && <p className="shop-list-end">No records found.</p>}
    </div>
    <div className="shop-orders-pagination">
      <label className="shop-page-size">Rows per page
        <select aria-label="Rows per page" value={size} disabled={state.loading} onChange={(event) => setPagination({ path, page: 1, size: Number(event.target.value) })}>
          {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <TablePagination page={page} pageSize={size} total={state.total} loading={state.loading || Boolean(state.error)} onPageChange={(next) => setPagination({ path, page: next, size })} />
    </div>
  </div>;
}
