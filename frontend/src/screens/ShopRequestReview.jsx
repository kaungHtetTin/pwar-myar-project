import React, { useEffect, useState } from 'react';
import { MessageSquare, Image, X } from 'lucide-react';
import { request, requestDownload } from '../api';
import { Field } from '../components/common';

function RequestedChanges({ changes, order }) {
  return <div className="shop-request-changes"><p>Requested changes only. Arrange the change with the customer; item changes may require a replacement checkout. Resolving this request does not edit the original order.</p><dl>{Object.entries(changes).filter(([key]) => key !== 'items').map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl>{changes.items && <div className="table-wrap"><table aria-label="Requested product quantities"><thead><tr><th>Product</th><th>Quantity</th></tr></thead><tbody>{changes.items.map(item => <tr key={item.product_id}><td>{order.items?.find(p => Number(p.product_id) === Number(item.product_id))?.name || `#${item.product_id}`}</td><td>{item.quantity}</td></tr>)}</tbody></table></div>}</div>;
}

function ReviewRow({ order, row, onSaved, canReview, busy }) {
  const [note, setNote] = useState(''), [returned, setReturned] = useState(false), [working, setWorking] = useState(false), [error, setError] = useState(''), [photo, setPhoto] = useState(null), [photoBusy, setPhotoBusy] = useState(false);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  async function review(status) {
    if (working || busy) return;
    if (note.trim().length < 5) { setError('Enter a review note of at least five characters.'); return; }
    if (!window.confirm(`${status === 'approved' ? 'Approve' : status === 'rejected' ? 'Decline' : 'Resolve'} this customer request?`)) return;
    setWorking(true); setError('');
    try { onSaved(await request(`/shop-admin/orders/${order.id}/requests/${row.id}`, { method: 'POST', body: JSON.stringify({ status, staff_note: note, return_confirmed: returned }) })); setNote(''); }
    catch (e) { setError(e.message); } finally { setWorking(false); }
  }
  async function showPhoto() {
    if (photoBusy) return; setPhotoBusy(true); setError('');
    try { const result = await requestDownload(`/shop-admin/orders/${order.id}/requests/${row.id}/photo`, { accept: 'image/*', timeoutMs: 15000 }); setPhoto(URL.createObjectURL(result.blob)); }
    catch (e) { setError(e.message); } finally { setPhotoBusy(false); }
  }
  return <article className="shop-request-review"><div className="shop-request-heading"><strong>{row.type === 'change' ? 'Order change request' : row.type === 'return' ? 'Return/refund request' : 'Cancellation request'}</strong><span className={`status-badge ${row.status === 'pending' ? 'warn' : row.status === 'rejected' ? 'voided' : 'completed'}`}>{row.status}</span></div><p>{row.reason}</p>{row.requested_changes && <RequestedChanges changes={row.requested_changes} order={order} />}{row.staff_note && <p className="shop-flow-notice">Shop response: {row.staff_note}</p>}{row.has_photo && <button type="button" disabled={photoBusy || busy} onClick={showPhoto}><Image size={16} />{photoBusy ? 'Loading photo…' : 'View return photo'}</button>}{photo && <div className="shop-request-photo"><img src={photo} alt="Customer return evidence" /><button type="button" onClick={() => setPhoto(null)}><X size={15} />Close photo</button></div>}{error && <p role="alert" className="error">{error}</p>}
    {row.type === 'return' && row.status === 'approved' && <p className="shop-flow-notice">Confirm the goods have returned, then use the existing PIN-protected Sales void workflow for sale #{order.sale_id}. Record the full refund below after sending it. Resolve this request after the sale is voided and the refund is recorded.</p>}
    {canReview && (row.status === 'pending' || (row.type === 'return' && row.status === 'approved')) && <fieldset disabled={busy || working}><Field label="Review note"><textarea minLength={5} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></Field>{row.type === 'cancellation' && ['dispatched', 'return_pending'].includes(order.status) && <label className="shop-hours-enable"><input type="checkbox" checked={returned} onChange={e => setReturned(e.target.checked)} />Goods have physically returned</label>}<div className="shop-request-actions">{row.status === 'pending' ? <><button type="button" className="primary" onClick={() => review(row.type === 'change' ? 'resolved' : 'approved')}>{row.type === 'change' ? 'Mark resolved' : 'Approve request'}</button><button type="button" className="danger-button" onClick={() => review('rejected')}>Decline request</button></> : <button type="button" className="primary" disabled={!order.sale_voided || order.payment_status !== 'refunded'} onClick={() => review('resolved')}>Resolve request</button>}</div></fieldset>}
  </article>;
}
export function ShopRequestReview({ order, onSaved, canReview, busy }) {
  if (!order.customer_requests?.length) return null;
  return <section className="panel"><h2><MessageSquare size={18} />Customer requests</h2>{order.customer_requests.map(row => <ReviewRow key={row.id} order={order} row={row} onSaved={onSaved} canReview={canReview} busy={busy} />)}</section>;
}
