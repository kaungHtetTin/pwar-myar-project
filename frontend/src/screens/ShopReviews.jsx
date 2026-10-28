import React, { useEffect, useRef, useState } from 'react';
import { Filter, MessageSquare, Search, Star } from 'lucide-react';
import { request } from '../api';
import { Field, FilterDrawer, Modal, TablePagination } from '../components/common';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { RowActions } from '../components/RowActions';
import { dateRangeError } from '../dateRanges';

const defaultFilters = { type: '', rating: '', reply_status: '', content: '', date_from: '', date_to: '', sort: 'newest' };

export function ShopReviews({ canReply = false, timezone = 'Asia/Rangoon' }) {
  const [filters, setFilters] = useState(defaultFilters), [search, setSearch] = useState(''), [q, setQ] = useState('');
  const [filterOpen, setFilterOpen] = useState(false), [draft, setDraft] = useState(defaultFilters);
  const [page, setPage] = useState(1), [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [review, setReview] = useState(null), [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false), [replyError, setReplyError] = useState('');
  const [version, setVersion] = useState(0);
  const guard = useRef(false);
  const filterCount = [filters.type, filters.rating, filters.reply_status, filters.content, filters.date_from || filters.date_to, filters.sort !== 'newest'].filter(Boolean).length;
  const rangeError = dateRangeError(draft.date_from, draft.date_to);
  useEffect(() => {
    const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    request(`/shop-admin/reviews?${new URLSearchParams({ type: filters.type, q, offset: (page - 1) * 20, limit: 20, ...filters })}`)
      .then(rows => { if (active) { const lastPage = Math.max(1, Math.ceil(rows.total / 20)); if (page > lastPage) setPage(lastPage); else setData(rows); } }).catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, q, page, version]);
  async function save(event) {
    event.preventDefault(); if (guard.current) return;
    guard.current = true; setSaving(true); setReplyError('');
    try {
      const result = await request(`/shop-admin/reviews/${review.id}/reply`, { method: 'PUT', body: JSON.stringify({ reply }) });
      const remains = !filters.reply_status || (filters.reply_status === 'replied' ? Boolean(result.reply) : !result.reply);
      setData(current => ({ ...current, total: current.total - (remains ? 0 : 1), items: remains
        ? current.items.map(row => row.id === review.id ? { ...row, ...result } : row)
        : current.items.filter(row => row.id !== review.id) }));
      if (!remains && page > Math.max(1, Math.ceil((data.total - 1) / 20))) setPage(value => value - 1);
      // Refill a filtered page when a reply changes membership so pagination skips no rows.
      if (!remains) setVersion(value => value + 1);
      setReview(null);
    } catch (e) { setReplyError(e.message); }
    finally { guard.current = false; setSaving(false); }
  }
  return <section className="shop-reviews-admin">
    <h2>Ratings and reviews</h2>
    <AppBarSearch className="shop-product-search"><form onSubmit={e => { e.preventDefault(); setQ(search.trim()); setPage(1); }}>
      <label><Search size={16} /><input disabled={saving} value={search} onChange={e => setSearch(e.target.value)} placeholder="Customer, product or review" aria-label="Search reviews" /></label>
    </form></AppBarSearch>
    <AppBarActions><button type="button" className="filter-drawer-trigger" disabled={saving} aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => { setDraft(filters); setFilterOpen(true); }}>
      <Filter size={16} /> Filters{filterCount > 0 && <span className="filter-count">{filterCount}</span>}
    </button></AppBarActions>
    {error && <p role="alert">{error}<button type="button" onClick={() => setVersion(v => v + 1)}>Try again</button></p>}
    <div className="shop-table-card">
      <div className="table-wrap sheet-table shop-table-scroll">
        <table className="shop-reviews-table" aria-label="Ratings and reviews" aria-busy={loading}>
          <colgroup><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '10%' }} /><col style={{ width: '27%' }} /><col style={{ width: '27%' }} />{canReply && <col className="table-action-column" />}</colgroup>
          <thead><tr><th scope="col">Customer</th><th scope="col">Review for</th><th scope="col">Rating</th><th scope="col">Review</th><th scope="col">Your reply</th>{canReply && <th scope="col" className="table-actions-cell">Actions</th>}</tr></thead>
          <tbody>{data.items.map(row => <tr key={row.id}>
            <td><strong>{row.customer_name}</strong>{row.created_at && <small className="shop-cell-meta">{new Date(`${row.created_at.replace(' ', 'T')}Z`).toLocaleString(undefined, { timeZone: timezone })}</small>}</td>
            <td>{row.target_id ? <><strong>{row.product_name || 'Product'}</strong><small className="shop-cell-meta">Product review</small></> : 'Shop review'}</td>
            <td><span className="shop-review-rating"><Star size={15} aria-hidden="true" /> {row.rating} / 5</span></td>
            <td className="shop-review-text">{row.comment || <span className="shop-review-empty">Rating only</span>}</td>
            <td className="shop-review-text">{row.reply || <span className="shop-review-empty">No reply yet</span>}</td>
            {canReply && <td className="table-actions-cell"><RowActions label={`${row.customer_name} - ${row.target_id ? row.product_name || 'Product' : 'Shop review'}`} disabled={saving}>
              <button type="button" onClick={() => { setReview(row); setReply(row.reply || ''); setReplyError(''); }}><MessageSquare size={15} />{row.reply ? 'Edit reply' : 'Reply'}</button>
            </RowActions></td>}
          </tr>)}</tbody>
        </table>
        {loading && <p className="shop-list-end" role="status">Loading reviews...</p>}
        {!loading && !error && !data.total && <p className="shop-list-end">{filterCount || q ? 'No reviews match your filters.' : 'No reviews yet.'}</p>}
      </div>
      <TablePagination page={page} pageSize={20} total={data.total} loading={loading || saving || search.trim() !== q} onPageChange={setPage} />
    </div>
    <FilterDrawer open={filterOpen} title="Review filters" busy={saving} onClose={() => setFilterOpen(false)}>
      <div className="drawer-filter-form">
        <Field label="Review type"><select value={draft.type} onChange={e => setDraft(value => ({ ...value, type: e.target.value }))}><option value="">All reviews</option><option value="shop">Shop reviews</option><option value="product">Product reviews</option></select></Field>
        <Field label="Star rating"><select value={draft.rating} onChange={e => setDraft(value => ({ ...value, rating: e.target.value }))}><option value="">All ratings</option>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} {rating === 1 ? 'star' : 'stars'}</option>)}</select></Field>
        <Field label="Reply status"><select value={draft.reply_status} onChange={e => setDraft(value => ({ ...value, reply_status: e.target.value }))}><option value="">All replies</option><option value="unreplied">Awaiting reply</option><option value="replied">Replied</option></select></Field>
        <Field label="Review content"><select value={draft.content} onChange={e => setDraft(value => ({ ...value, content: e.target.value }))}><option value="">All reviews</option><option value="written">Written reviews</option><option value="rating_only">Rating only</option></select></Field>
        <Field label="From date"><input type="date" value={draft.date_from} max={draft.date_to || undefined} onChange={e => setDraft(value => ({ ...value, date_from: e.target.value }))} /></Field>
        <Field label="To date"><input type="date" value={draft.date_to} min={draft.date_from || undefined} onChange={e => setDraft(value => ({ ...value, date_to: e.target.value }))} /></Field>
        <small>Review dates use shop time: {timezone}.</small>
        {rangeError && <p role="alert">{rangeError}</p>}
        <Field label="Sort reviews"><select value={draft.sort} onChange={e => setDraft(value => ({ ...value, sort: e.target.value }))}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="rating_high">Highest rating first</option><option value="rating_low">Lowest rating first</option></select></Field>
        <div className="drawer-filter-actions">
          <button type="button" onClick={() => { setFilters(defaultFilters); setDraft(defaultFilters); setSearch(''); setQ(''); setPage(1); setFilterOpen(false); }}>Clear</button>
          <button type="button" className="primary" disabled={Boolean(rangeError)} onClick={() => { if (Object.keys(defaultFilters).some(key => draft[key] !== filters[key])) { setFilters(draft); setPage(1); } setFilterOpen(false); }}>Apply Filter</button>
        </div>
      </div>
    </FilterDrawer>
    <Modal open={Boolean(review)} title="Reply to review" size="medium" busy={saving} onClose={() => { if (!saving) setReview(null); }} footer={<>
      <button type="button" disabled={saving} onClick={() => setReview(null)}>Cancel</button><button type="submit" form="shop-review-reply-form" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save reply'}</button>
    </>}>
      {review && <form id="shop-review-reply-form" onSubmit={save}><p><strong>{review.customer_name}</strong> - {review.rating} / 5</p><p className="shop-review-original">{review.comment}</p>
        {replyError && <p role="alert">{replyError}</p>}
        <label>Your public reply<textarea disabled={saving} rows={5} maxLength={2000} value={reply} onChange={e => setReply(e.target.value)} /></label>
        <small>Leave blank to remove your reply.</small>
      </form>}
    </Modal>
  </section>;
}
