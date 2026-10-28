import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, History, Check, X, CreditCard } from "lucide-react";
import { request, requestDownload } from "../api";
import { RowActions } from "../components/RowActions";
import { Field, Modal } from "../components/common";
import { nextStates, orderActions } from "./shopOrderActions";
import { emitDataChange } from "../dataEvents";

const money = (order) => `${Number(order.total).toLocaleString()} ${order.currency}`;

export function ShopOrderRowActions({ order, can, busy, onSaved, onView, timezone }) {
  const [action, setAction] = useState(null);
  return <>
    <RowActions label={order.reference} disabled={busy}>
      <button type="button" onClick={onView}><Eye size={15} /> View order</button>
      {orderActions(order, can).map((item) => <button key={item.key} type="button" className={item.danger ? "danger-button" : ""}
        disabled={busy || item.disabled} aria-haspopup="dialog" onClick={() => setAction(item)}>
        {item.key === "history" ? <History size={15} /> : item.danger ? <X size={15} /> : ["confirm", "refund"].includes(item.key) ? <CreditCard size={15} /> : <Check size={15} />}
        {item.title}
      </button>)}
    </RowActions>
    {action && createPortal(<OrderActionModal key={`${order.id}-${action.key}`} id={order.id} action={action} can={can} onSaved={onSaved}
      timezone={timezone} onClose={() => setAction(null)} />, document.body)}
  </>;
}

function PaymentProof({ id, proofs }) {
  const [selection, setSelection] = useState(proofs.at(-1)?.id);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ loading: false, url: "", error: "" });
  useEffect(() => {
    let active = true, url;
    if (!selection) return;
    setState({ loading: true, url: "", error: "" });
    requestDownload(`/shop-admin/orders/${id}/proofs/${selection}`, { accept: "image/*", timeoutMs: 15000 })
      .then((result) => {
        if (active) { url = URL.createObjectURL(result.blob); setState({ loading: false, url, error: "" }); }
      })
      .catch((error) => { if (active) setState({ loading: false, url: "", error: error.name === "AbortError" ? "Screenshot loading timed out. Retry or check the receiving account directly." : error.message }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id, selection, retry]);
  if (!proofs.length) return null;
  return <div className="shop-proof-review">
    <h3>Payment screenshot</h3>
    <div className="shop-actions">{proofs.map((proof) => <button key={proof.id} type="button" aria-pressed={selection === proof.id} onClick={() => setSelection(proof.id)}>Proof #{proof.id}: {proof.status}</button>)}</div>
    {state.loading && <p role="status">Loading payment screenshot…</p>}
    {state.error && <p role="alert">{state.error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry screenshot</button></p>}
    {state.url && <div className="shop-proof-preview"><img className="shop-proof-image" src={state.url} alt="Customer payment proof" /><a href={state.url} target="_blank" rel="noreferrer">Open full screenshot</a></div>}
  </div>;
}

function OrderActionModal({ id, action, can, onSaved, timezone, onClose }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [returned, setReturned] = useState(false);
  const [verified, setVerified] = useState(false);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const working = useRef(false);
  const loadVersion = useRef(0);
  useEffect(() => {
    let active = true;
    const version = ++loadVersion.current;
    setOrder(null); setError("");
    request(`/shop-admin/orders/${id}`).then((result) => { if (active && version === loadVersion.current) setOrder(result); })
      .catch((error) => { if (active && version === loadVersion.current) setError(error.message); });
    return () => { active = false; };
  }, [id, retry]);
  useEffect(() => {
    let active = true;
    const changed = event => {
      if (!event.detail?.orderIds?.includes(Number(id))) return;
      const version = ++loadVersion.current;
      request(`/shop-admin/orders/${id}`).then(result => { if (active && version === loadVersion.current) setOrder(result); }).catch(() => {});
    };
    window.addEventListener('mkpos:shop-order-changed', changed);
    return () => { active = false; window.removeEventListener('mkpos:shop-order-changed', changed); };
  }, [id]);
  const history = action.key === "history";
  const payment = ["confirm", "refund"].includes(action.key);
  const needsReason = ["cancelled", "return_pending", "reject"].includes(action.key);
  const needsReturn = action.key === "cancelled" && order?.status === "return_pending";
  const available = order && orderActions(order, can).some((item) => item.key === action.key && !item.disabled);
  const disabled = saving || !available || (needsReason && !reason.trim()) || (needsReturn && !returned) || (payment && !verified);
  async function submit(event) {
    event.preventDefault();
    if (disabled || working.current) return;
    working.current = true; setSaving(true); setError("");
    let path, body;
    if (["confirm", "refund", "reject"].includes(action.key)) {
      path = `/shop-admin/orders/${id}/payments/${action.key}`;
      body = action.key === "reject" ? { reason } : { amount: Number(order.total), reference, verified, review_note: note };
    } else if (action.key === "reopen") {
      path = `/shop-admin/orders/${id}/reopen`;
    } else {
      path = `/shop-admin/orders/${id}/transition`;
      body = { status: action.key, reason: needsReason ? reason : "", return_confirmed: returned };
    }
    try {
      const saved = await request(path, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
      onSaved?.(saved);
      onClose();
      emitDataChange(["products", "sales", "reports"], "shop");
    } catch (error) { setError(error.message); }
    finally { working.current = false; setSaving(false); }
  }
  return <Modal open title={action.title} subtitle={order?.reference || ""} size={payment || action.key === "reject" ? "medium" : "small"}
    className="shop-order-action-modal" busy={saving} onClose={onClose} footer={<>
      <button type="button" disabled={saving} onClick={onClose}>Close</button>
      {!history && <button type="submit" form={`shop-table-action-${id}`} className={action.danger ? "danger-button" : "primary"} disabled={disabled}>{saving ? "Saving…" : action.title}</button>}
    </>}>
    {error && <p role="alert">{error} {!order && <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>}</p>}
    {!order && !error && <p role="status">Loading order…</p>}
    {order && <form id={`shop-table-action-${id}`} onSubmit={submit}>
      <p><strong>{order.customer_name}</strong> · {money(order)}</p>
      {!available && <p role="alert">This action is no longer available for the current order status. Close this form and refresh the orders table.</p>}
      {history ? <ol className="shop-history-list">
        {!order.events.length && <li>No order history yet.</li>}
        {order.events.map((event) => <li key={event.id}><strong>{event.event.replaceAll("_", " ")}</strong>
          <time dateTime={`${event.created_at.replace(" ", "T")}Z`}>{new Date(`${event.created_at.replace(" ", "T")}Z`).toLocaleString(undefined, { timeZone: timezone })}</time>
          {event.reason && <p>{event.reason}</p>}
        </li>)}
      </ol> : <>
        {Object.values(nextStates).some((states) => states.includes(action.key)) && <p>Order status: {order.status.replaceAll("_", " ")} → {action.key.replaceAll("_", " ")}</p>}
        {action.key === "completed" && <p>Completing this order records its POS sale and consumes the reserved stock.</p>}
        {action.key === "cancelled" && <p>Cancellation releases the reserved stock.{order.payment_status === "paid" && " A manual refund will be required."}</p>}
        {action.key === "reopen" && <p>Available stock will be checked and reserved again before this order is reopened for payment review.</p>}
        {(payment || action.key === "reject") && <>
          <p>{order.payment_method.name}: {order.payment_method.instructions}</p>
          {order.payment_method.type === "transfer" && <p>{[order.payment_method.bank, order.payment_method.account_name, order.payment_method.account_no].filter(Boolean).join(" · ")}</p>}
          {action.key !== "refund" && <PaymentProof id={id} proofs={order.payments.filter((item) => item.type === "proof")} />}
        </>}
        {payment && <>
          <p>{action.key === "refund" ? "Verify the full refund was sent to the customer before recording it." : "Check the full amount against your cash receipt or receiving account. A customer screenshot alone does not confirm receipt."}</p>
          {action.key === "confirm" && ["cancelled", "expired"].includes(order.status) && <p>The order stays closed. Recording payment creates a refund obligation and does not restore its stock.</p>}
          <div className="shop-payment-review-fields">
            <Field label="Payment / refund reference (optional)"><input value={reference} maxLength={255} disabled={saving} onChange={(event) => setReference(event.target.value)} /></Field>
            <Field label="Internal review note"><textarea rows={2} value={note} maxLength={2000} disabled={saving} onChange={(event) => setNote(event.target.value)} /></Field>
          </div>
          <label className="shop-checkbox"><input type="checkbox" checked={verified} disabled={saving} onChange={(event) => setVerified(event.target.checked)} />{action.key === "refund" ? "I checked that the full refund was sent to the customer." : "I checked that the full payment was received by this shop."}</label>
        </>}
        {needsReason && <Field label={action.key === "reject" ? "Customer-visible rejection reason" : "Reason (required for cancellation or failed delivery)"}>
          <textarea required rows={3} maxLength={2000} disabled={saving} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>}
        {needsReturn && <label className="shop-checkbox"><input type="checkbox" checked={returned} disabled={saving} onChange={(event) => setReturned(event.target.checked)} />Goods physically returned</label>}
      </>}
    </form>}
  </Modal>;
}
