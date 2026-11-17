import { useShopRefresh } from './pageRefresh';
import { LoadingSkeleton } from './LoadingSkeleton';
import React, { useEffect, useRef, useState } from 'react';
import { Star, MessageSquare, ShieldCheck, CornerDownRight, Pencil, Trash2 } from 'lucide-react';
import { SectionTitle, IconButton } from './ShoppingComponents';
import { request } from './api';
import { useCustomer } from './CustomerAccount';
import { useText } from './i18n';

export function RatingSummary({ rating, slug, productId = 0 }) {
  const text = useText();
  const [updated, setUpdated] = useState(null);
  useEffect(() => { setUpdated(null); }, [rating]);
  useEffect(() => {
    const changed = event => { if (event.detail.slug === slug && event.detail.productId === productId) setUpdated(event.detail.summary); };
    window.addEventListener('mkpos.shop.review-saved', changed);
    return () => window.removeEventListener('mkpos.shop.review-saved', changed);
  }, [slug, productId]);
  const current = updated || rating;
  return <span className={`rating-summary ${current?.count ? 'has-ratings' : 'no-ratings'}`}><Star size={16} aria-hidden="true" fill={current?.count ? 'currentColor' : 'none'} />{current?.count ? `${Number(current.average).toFixed(1)} / 5 (${current.count})` : text('No ratings yet')}</span>;
}

export function Reviews({ slug, productId = 0 }) {
  const text = useText();
  const { customer, loading: accountLoading } = useCustomer();
  const path = `/stores/${encodeURIComponent(slug)}${productId ? `/products/${productId}` : ''}/reviews`;
  const [data, setData] = useState({ items: [], summary: null, has_more: false });
  const [mine, setMine] = useState(null), [eligible, setEligible] = useState(false);
  const [form, setForm] = useState({ rating: 0, comment: '' });
  const [editing, setEditing] = useState(false), [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const guard = useRef(false), generation = useRef(0);
  useShopRefresh(() => setVersion(value => value + 1), !editing && !busy && !confirmDelete);
  useEffect(() => {
    const token = ++generation.current;
    setLoading(true); setError(''); setMine(null); setEligible(false); setEditing(false);
    const publicReviews = request(`${path}?limit=12`);
    const ownReview = customer ? request(`${path}/mine`, { customerAuth: true }) : Promise.resolve(null);
    Promise.all([publicReviews, ownReview]).then(([rows, own]) => {
      if (token !== generation.current) return;
      setData(rows); setMine(own?.review || null); setEligible(Boolean(own?.can_review));
    }).catch(e => { if (token === generation.current) setError(e.message); })
      .finally(() => { if (token === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [path, customer?.id, version]);

  async function more() {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError('');
    const token = generation.current;
    try {
      const rows = await request(`${path}?limit=12&offset=${data.items.length}`);
      if (token === generation.current) setData(current => ({ ...rows, items: [...current.items, ...rows.items] }));
    } catch (e) { if (token === generation.current) setError(e.message); }
    finally { guard.current = false; setBusy(false); }
  }
  function edit() {
    setForm({ rating: mine?.rating || 0, comment: mine?.comment || '' });
    setEditing(true); setNotice(''); setError('');
  }
  async function mutate(remove = false) {
    if (guard.current) return;
    if (!remove && !form.rating) { setError(text('Choose a rating from 1 to 5 stars.')); return; }
    guard.current = true; setBusy(true); setError('');
    try {
      const result = await request(`${path}/mine`, { customerAuth: true, method: remove ? 'DELETE' : 'PUT',
        ...(remove ? {} : { body: JSON.stringify(form) }) });
      window.dispatchEvent(new CustomEvent('mkpos.shop.review-saved', { detail: { slug, productId, summary: result.summary } }));
      setData(current => ({ ...current, summary: result.summary, items: remove
        ? current.items.filter(row => row.id !== mine?.id)
        : mine ? current.items.map(row => row.id === result.review.id ? result.review : row)
          : [result.review, ...current.items] }));
      setMine(remove ? null : result.review);
      setEditing(false); setConfirmDelete(false);
      setNotice(text(remove ? 'Review deleted.' : 'Review saved.'));
    } catch (e) { setError(e.message); }
    finally { guard.current = false; setBusy(false); }
  }
  const date = value => new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString();
  const destination = `/store/${encodeURIComponent(slug)}${productId ? `/products/${productId}` : ''}`;
  const visibleReviews = mine && !data.items.some(review => review.id === mine.id) ? [mine, ...data.items] : data.items;
  return <section className="reviews" aria-label={text(productId ? 'Product reviews' : 'Shop reviews')}>
    <div className="reviews-heading"><SectionTitle icon={MessageSquare} title={text(productId ? 'Product reviews' : 'Shop reviews')} /><div className="review-rating-overview"><RatingSummary rating={data.summary} slug={slug} productId={productId} /></div></div>
    {error && <p className="error" role="alert">{error}{loading === false && !data.summary && <button type="button" onClick={() => setVersion(v => v + 1)}>{text('Try again')}</button>}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading || accountLoading ? <LoadingSkeleton variant="reviews" message="Loading reviews..." /> : <>
      {!customer ? <a className="button" href={`#/account/login?next=${encodeURIComponent(destination)}`}>{text('Sign in to write a review')}</a>
        : !editing && !mine && <div className="review-own-actions">
          {eligible && <button type="button" onClick={edit}>{text('Write a review')}</button>}
          {!eligible && <p>{text('Complete a purchase before reviewing this shop or product.')}</p>}
        </div>}
      {editing && <form className="review-form" onSubmit={e => { e.preventDefault(); mutate(); }}><fieldset disabled={busy}>
        <legend>{text(mine ? 'Edit your review' : 'Write a review')}</legend>
        <div className="review-stars" role="radiogroup" aria-label={text('Your rating')}>
          {[1, 2, 3, 4, 5].map(value => <label key={value} className={value <= form.rating ? 'chosen' : ''}>
            <input type="radio" name={`rating-${productId}`} value={value} checked={form.rating === value} onChange={() => setForm(f => ({ ...f, rating: value }))} aria-label={text('{count} stars', { count: value })} />
            <Star size={28} aria-hidden="true" />
          </label>)}
        </div>
        <label>{text('Your review (optional)')}<textarea maxLength={2000} rows={4} value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} /></label>
        <small>{form.comment.length} / 2000</small>
        <div className="review-own-actions"><button type="button" onClick={() => { setEditing(false); setError(''); }}>{text('Cancel')}</button><button className="primary" disabled={busy}>{text(busy ? 'Saving...' : 'Save review')}</button></div>
      </fieldset></form>}
      {confirmDelete && <div className="review-delete" role="alertdialog" aria-label={text('Delete your review')}>
        <p>{text('Delete your rating and review?')}</p><div className="review-own-actions"><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>{text('Cancel')}</button><button type="button" disabled={busy} onClick={() => mutate(true)}>{text(busy ? 'Deleting...' : 'Delete review')}</button></div>
      </div>}
      {!visibleReviews.length && !error && <p>{text('No reviews yet. Be the first to share your experience.')}</p>}
      <div className="review-list">{visibleReviews.map(review => <article className="review-card" key={review.id}>
        <header><span className="review-avatar" aria-hidden="true">{review.customer_name?.trim().slice(0, 1) || <MessageSquare size={17} />}</span><div className="review-author"><strong>{review.customer_name}</strong><span className="review-verified"><ShieldCheck size={12} aria-hidden="true" />{text('Verified purchase')}</span><time>{date(review.created_at)}</time></div>{customer && mine?.id === review.id && !editing && !confirmDelete && <div className="review-row-actions">{eligible && <IconButton label="Edit your review" icon={Pencil} disabled={busy} onClick={edit} />}<IconButton label="Delete your review" icon={Trash2} disabled={busy} onClick={() => { setConfirmDelete(true); setError(''); }} /></div>}</header>
        <div className="review-display-stars" aria-label={text('{count} stars', { count: review.rating })}>{[1, 2, 3, 4, 5].map(n => <Star key={n} size={16} aria-hidden="true" fill={n <= review.rating ? 'currentColor' : 'none'} />)}</div>
        {review.comment && <p>{review.comment}</p>}
        {review.reply && <div className="review-reply"><div><CornerDownRight size={15} aria-hidden="true" /><strong>{text('Shop reply')}</strong></div><p>{review.reply}</p></div>}
      </article>)}</div>
      {data.has_more && <button type="button" disabled={busy} onClick={more}>{text(busy ? 'Loading reviews...' : 'Load more reviews')}</button>}
    </>}
  </section>;
}
