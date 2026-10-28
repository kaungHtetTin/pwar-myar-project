import { officeDateTime } from './dateTime';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Save, Star, Trash2 } from 'lucide-react';
import { api } from './api';
import { OfficeModal } from './OfficeModal';

export function ProductReviewRating({ rating }) {
  return <span className="office-review-rating" aria-label={`${rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} aria-hidden="true" fill={i < rating ? 'currentColor' : 'none'} />)}<strong>{rating}/5</strong></span>;
}

export function ReviewLookup({ kind, label, value, onChange, businessId, productId, disabled = false, required = false, apiBase = '/office/product-reviews' }) {
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(null), [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ items: [], has_more: false, error: '', loading: true });
  const params = new URLSearchParams({ kind, q: search.trim(), ...(value ? { selected_id: value } : {}), ...(businessId ? { business_id: businessId } : {}), ...(productId ? { product_id: productId } : {}) });
  const path = `${apiBase}/options?${params}`;
  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setResult(current => ({ ...current, loading: true, error: '' }));
      api(path).then(data => { if (!cancelled) setResult({ ...data, error: '', loading: false }); }).catch(e => { if (!cancelled) setResult({ items: [], error: e.message, loading: false }); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [path, disabled, retry]);
  const chosen = String(selected?.id) === String(value) ? selected : String(result.selected?.id) === String(value) ? result.selected : null;
  const items = chosen && !result.items.some(item => String(item.id) === String(chosen.id)) ? [chosen, ...result.items] : result.items;
  return <div className="office-review-lookup">
    <label>Search {label.toLowerCase()}<input type="search" maxLength={200} value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} placeholder={`Find ${label.toLowerCase()}`} /></label>
    <label>{label}<select required={required} disabled={disabled} value={value} onChange={event => { setSelected(items.find(item => String(item.id) === event.target.value) || null); onChange(event.target.value); }}><option value="">{disabled ? 'Choose the previous field first' : result.loading ? 'Loading options...' : `Choose ${label.toLowerCase()}`}</option>{items.map(item => <option key={item.id} value={item.id}>{item.label}{item.detail ? ` (${item.detail})` : ''}</option>)}</select></label>
    {!disabled && result.error && <p className="feedback error" role="alert">{result.error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry options</button></p>}
    {!disabled && !result.loading && !result.error && !items.length && <small>No matches. Try another search.</small>}
    {result.has_more && <small>Refine your search to find more matches.</small>}
  </div>;
}

function ReviewMutation({ title, description, onClose, onSaved, action, danger = false, request, children }) {
  const id = useId(), saving = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { const result = await request(); onSaved(result); }
    catch (e) { setError(e.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title={title} description={description} onClose={onClose} busy={busy} className="office-product-review-modal" footer={<><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" form={id} disabled={busy} className={danger ? 'office-button-danger' : 'office-button-primary'}>{danger ? <Trash2 size={15} /> : <Save size={15} />}{busy ? 'Saving...' : action}</button></>}>
    <form id={id} onSubmit={submit} className="office-review-form"><fieldset disabled={busy}>{children}{error && <p className="feedback error" role="alert">{error}</p>}</fieldset></form>
  </OfficeModal>;
}

function ReviewIdentity({ review, reviewType = 'product' }) {
  return <dl className="office-review-identity"><dt>Shop</dt><dd>{review.shop_name}</dd>{reviewType === 'product' && <><dt>Product</dt><dd>{review.product_name}</dd></>}<dt>Customer</dt><dd>{review.customer_name}<small>{review.customer_email}</small></dd></dl>;
}

export function ProductReviewEditor({ review, onClose, onSaved, reviewType = 'product' }) {
  const shop = reviewType === 'shop', apiBase = `/office/${reviewType}-reviews`;
  const [form, setForm] = useState(() => ({ business_id: '', product_id: '', customer_id: '', rating: review?.rating || '', comment: review?.comment || '', reply: review?.reply || '' }));
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function request() {
    const body = { rating: Number(form.rating), comment: form.comment.trim() || null, reply: form.reply.trim() || null, ...(review ? { version: review.version } : { business_id: Number(form.business_id), ...(!shop ? { product_id: Number(form.product_id) } : {}), customer_id: Number(form.customer_id) }) };
    return api(`${apiBase}${review ? `/${review.id}` : ''}`, { method: review ? 'PUT' : 'POST', body: JSON.stringify(body) });
  }
  return <ReviewMutation title={`${review ? 'Edit' : 'New'} ${reviewType} review`} description={review ? `Update the rating, customer comment, or seller reply. The ${shop ? 'shop and customer' : 'shop, product and customer'} stay fixed.` : 'Create a review for a customer with a completed purchase. Saved reviews appear on the storefront immediately.'} action="Save review" request={request} onClose={onClose} onSaved={onSaved}>
    {review ? <ReviewIdentity review={review} reviewType={reviewType} /> : <>
      <ReviewLookup apiBase={apiBase} kind="shops" label="Shop" required value={form.business_id} onChange={value => setForm(current => ({ ...current, business_id: value, product_id: '', customer_id: '' }))} />
      {!shop && <ReviewLookup apiBase={apiBase} key={`products-${form.business_id}`} kind="products" label="Product" required disabled={!form.business_id} businessId={form.business_id} value={form.product_id} onChange={value => setForm(current => ({ ...current, product_id: value, customer_id: '' }))} />}
      <ReviewLookup apiBase={apiBase} key={`customers-${form.business_id}-${form.product_id}`} kind="customers" label="Customer" required disabled={shop ? !form.business_id : !form.product_id} businessId={form.business_id} productId={shop ? undefined : form.product_id} value={form.customer_id} onChange={value => field('customer_id', value)} />
      <p className="office-review-help">Only active customers with a completed purchase {shop ? 'from the selected shop' : 'of the selected product'} are listed. A customer can have one review per {reviewType}.</p>
    </>}
    <label>Rating<select required value={form.rating} onChange={event => field('rating', event.target.value)}><option value="">Choose rating</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}</select></label>
    <label>Customer comment<textarea maxLength={2000} rows={3} value={form.comment} onChange={event => field('comment', event.target.value)} /></label>
    <label>Seller reply<textarea maxLength={2000} rows={3} value={form.reply} onChange={event => field('reply', event.target.value)} /><small>Optional. This appears as the shop response.</small></label>
  </ReviewMutation>;
}

export function ProductReviewDetails({ review, onClose, reviewType = 'product' }) {
  return <OfficeModal title={`${reviewType === 'shop' ? 'Shop' : 'Product'} review details`} description={`Review #${review.id}`} onClose={onClose} className="office-product-review-modal" footer={<button type="button" onClick={onClose}>Close</button>}>
    <ReviewIdentity review={review} reviewType={reviewType} />
    <section className="office-review-comment"><h3>Customer review</h3><ProductReviewRating rating={review.rating} /><p>{review.comment || 'Rating only. No written comment.'}</p></section>
    <section className="office-review-comment"><h3>Seller reply</h3><p>{review.reply || 'No reply yet.'}</p>{review.replied_at && <small>Replied {officeDateTime(review.replied_at)}</small>}</section>
    <p className="office-review-help">Created {officeDateTime(review.created_at)} / Updated {officeDateTime(review.updated_at)}</p>
  </OfficeModal>;
}

export function DeleteProductReview({ review, onClose, onSaved, reviewType = 'product' }) {
  return <ReviewMutation title={`Delete ${reviewType} review?`} description={`This removes the review and its seller reply from the storefront. ${reviewType === 'shop' ? 'Shop' : 'Product'} rating totals update automatically.`} action="Delete review" danger onClose={onClose} onSaved={onSaved} request={() => api(`/office/${reviewType}-reviews/${review.id}`, { method: 'DELETE', body: JSON.stringify({ version: review.version }) })}>
    <ReviewIdentity review={review} reviewType={reviewType} /><ProductReviewRating rating={review.rating} /><p className="office-review-delete-comment">{review.comment || 'Rating only. No written comment.'}</p>
  </ReviewMutation>;
}
