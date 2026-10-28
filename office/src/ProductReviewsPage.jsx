import { officeDate } from './dateTime';
import React, { useEffect, useRef, useState } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { api } from './api';
import { OfficePageToolbar } from './OfficePageToolbar';
import {OfficeTableLoadingRows, OfficeActionCell, OfficeActionHeader, OfficeTablePagination} from './OfficeTable';
import { FilterDrawer } from './FilterDrawer';
import { RowActions } from './RowActions';
import { DeleteProductReview, ProductReviewDetails, ProductReviewEditor, ProductReviewRating, ReviewLookup } from './ProductReviewForms';
import './product-reviews.css';

const defaults = { business_id: '', rating: '', reply_status: 'all', content: 'all', from: '', to: '', sort: 'newest' };
function ReviewFilters({ query, onApply, onClear, apiBase }) {
  const [draft, setDraft] = useState(() => ({ ...query }));
  const field = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  return <form className="office-drawer-filter-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}><div className="office-drawer-filter-fields">
    <ReviewLookup apiBase={apiBase} kind="shops" label="Shop" value={draft.business_id} onChange={value => field('business_id', value)} />
    <label>Rating<select value={draft.rating} onChange={event => field('rating', event.target.value)}><option value="">All ratings</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} stars</option>)}</select></label>
    <label>Reply status<select value={draft.reply_status} onChange={event => field('reply_status', event.target.value)}><option value="all">All reviews</option><option value="replied">Replied</option><option value="unreplied">Unreplied</option></select></label>
    <label>Review content<select value={draft.content} onChange={event => field('content', event.target.value)}><option value="all">All content</option><option value="written">Written comments</option><option value="rating_only">Rating only</option></select></label>
    <label>From date<input type="date" value={draft.from} onChange={event => field('from', event.target.value)} /></label><label>To date<input type="date" min={draft.from || undefined} value={draft.to} onChange={event => field('to', event.target.value)} /></label>
    <label>Sort by<select value={draft.sort} onChange={event => field('sort', event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="rating_high">Highest rating</option><option value="rating_low">Lowest rating</option></select></label>
    </div><div className="office-drawer-filter-actions"><button type="button" onClick={onClear}>Clear</button><button type="submit" className="office-button-primary">Apply filters</button></div></form>;
}

export function ProductReviewsPage({ refreshToken = 0, filterOpen = false, onFilterOpen, onFilterClose, reviewType = 'product' }) {
  const shop = reviewType === 'shop', title = shop ? 'Shop' : 'Product', apiBase = `/office/${reviewType}-reviews`;
  const [query, setQuery] = useState({ ...defaults, q: '', page: 1, per_page: 25 }), [search, setSearch] = useState('');
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null), [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    const current = ++sequence.current; let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== ''));
      api(`${apiBase}?${params}`).then(value => { if (!cancelled && current === sequence.current) setData(value); }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, refreshToken, revision, apiBase]);
  function saved() { setNotice(modal.type === 'delete' ? `${title} review deleted.` : `${title} review saved.`); setModal(null); setRevision(value => value + 1); }
  const filterCount = Object.keys(defaults).filter(key => query[key] !== defaults[key]).length;
  return <div className="office-page-stack office-product-reviews">
    <OfficePageToolbar searchLabel={`Search ${reviewType} reviews`} placeholder={`Search shop, ${shop ? '' : 'product, '}customer or comment`} search={search} onSearchChange={setSearch} onSearch={() => setQuery(current => ({ ...current, q: search.trim(), page: 1 }))} onClearSearch={() => { setSearch(''); setQuery(current => ({ ...current, q: '', page: 1 })); }} actionLabel="New review" onCreate={() => { setNotice(''); setModal({ type: 'new' }); }} onFilterOpen={onFilterOpen} filterOpen={filterOpen} filterCount={filterCount} busy={loading} />
    {error && <p className="feedback error" role="alert">{error} <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {notice && <p className="office-success" role="status">{notice}</p>}
    <section className="office-panel office-table-panel" aria-label={`${title} reviews list`}>
      <header className="office-panel-header"><h2>Customer {reviewType} reviews</h2><span>{loading ? '' : `${data?.total || 0} matching reviews`}</span></header>
      <div className="office-table-scroll"><table className="office-data-table office-product-review-table" aria-label={`${title} reviews`}><thead><tr><th>{shop ? 'Shop' : 'Product / shop'}</th><th>Customer</th><th>Rating / comment</th><th>Seller reply</th><th>Created</th><OfficeActionHeader /></tr></thead><tbody>{!data && loading && <OfficeTableLoadingRows columns={6}/>}{data?.items.map(row => <tr key={row.id}>
        <td><div className="office-cell-stack"><strong>{shop ? row.shop_name : row.product_name}</strong><small>{shop ? row.shop_slug : row.shop_name}</small></div></td><td><div className="office-cell-stack"><strong>{row.customer_name}</strong><small>{row.customer_email}</small></div></td>
        <td><ProductReviewRating rating={row.rating} /><p className="office-review-excerpt" title={row.comment || undefined}>{row.comment || 'Rating only'}</p></td>
        <td><span className={`office-status office-status-${row.reply ? 'active' : 'pending'}`}>{row.reply ? 'Replied' : 'Unreplied'}</span>{row.reply && <p className="office-review-excerpt" title={row.reply}>{row.reply}</p>}</td>
        <td>{officeDate(row.created_at)}</td><OfficeActionCell><RowActions label={`${reviewType} review ${row.id}`} disabled={loading}><button type="button" onClick={() => setModal({ type: 'view', review: row })}><Eye size={14} />View review</button><button type="button" onClick={() => setModal({ type: 'edit', review: row })}><Pencil size={14} />Edit review</button><button type="button" className="danger-button" onClick={() => setModal({ type: 'delete', review: row })}><Trash2 size={14} />Delete review</button></RowActions></OfficeActionCell>
      </tr>)}{!loading && !data?.items.length && <tr><td colSpan={6}><p className="office-business-message">No {reviewType} reviews match these filters.</p></td></tr>}</tbody></table></div>
      {data && <OfficeTablePagination label={`${title} review`} total={data.total} page={data.page} perPage={data.per_page} lastPage={data.last_page} disabled={loading} onPageChange={page => setQuery(current => ({ ...current, page }))} onPerPageChange={per_page => setQuery(current => ({ ...current, page: 1, per_page }))} />}
    </section>
    <FilterDrawer open={filterOpen} title={`${title} review filters`} onClose={onFilterClose}>{filterOpen && <ReviewFilters apiBase={apiBase} query={query} onApply={draft => { setQuery(current => ({ ...current, ...Object.fromEntries(Object.keys(defaults).map(key => [key, draft[key]])), page: 1 })); onFilterClose(); }} onClear={() => { setQuery(current => ({ ...current, ...defaults, page: 1 })); onFilterClose(); }} />}</FilterDrawer>
    {['new', 'edit'].includes(modal?.type) && <ProductReviewEditor reviewType={reviewType} key={modal.review?.id || 'new'} review={modal.review} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.type === 'view' && <ProductReviewDetails reviewType={reviewType} review={modal.review} onClose={() => setModal(null)} />}
    {modal?.type === 'delete' && <DeleteProductReview reviewType={reviewType} review={modal.review} onClose={() => setModal(null)} onSaved={saved} />}
  </div>;
}
