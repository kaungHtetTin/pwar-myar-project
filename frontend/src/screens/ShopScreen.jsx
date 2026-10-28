import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRetainedActivity } from '../components/retainedActivity';
import { BarChart3, Check, CreditCard, Filter, History, MessageCircle, Package, Phone, Search, ShoppingBag, Store, Tag, Truck, Users, X } from "lucide-react";
import { ShopPaymentMethods } from "./ShopPaymentMethods";
import { ShopDeliveryZones } from "./ShopDeliveryZones";
import { ShopContacts } from "./ShopContacts";
import { ShopChat } from "./ShopChat";
import { ShopSalesAi } from './ShopSalesAi';
import { ShopCustomers } from "./ShopCustomers";
import { ShopCustomerDetail } from "./ShopCustomerDetail";
import { ShopLocationGate } from "./ShopLocationGate";
import { ShopLocationSettings } from "./ShopLocationSettings";
import { ShopLogoSettings } from "./ShopLogoSettings";
import { ShopCoverSettings } from "./ShopCoverSettings";
import { nextStates, transitionActions } from "./shopOrderActions";
import { ShopOrderRowActions } from "./ShopOrderRowActions";
import { ShopOrdersTable } from "./ShopOrdersTable";
import { ShopPublicationRow } from "./ShopPublicationRow";
import { ShopPromotions } from "./ShopPromotions";
import { ShopReport } from "./ShopReport";
import { ShopReviews } from './ShopReviews';
import { ShopOperatingSettings } from './ShopOperatingSettings';
import { ShopRequestReview } from './ShopRequestReview';
import { request, requestDownload } from "../api";
import { Field, FilterDrawer, Modal, TablePagination } from "../components/common";
import { AppBarActions, AppBarSearch } from "../components/WorkspaceHeader";
import { emitDataChange, useDataRefresh } from "../dataEvents";
import { dateRangeError } from "../dateRanges";
import "../styles/shop.css";
import { RetainedViews } from "../components/RetainedViews";
import { usePageNavigation } from "../usePageNavigation";
import { useAiPageLink } from "../ai/useAiPageLink";

const amount = (v, currency) => `${Number(v).toLocaleString()} ${currency}`;
const label = (v) => v.replaceAll("_", " ");
const statusTone = (state) => ["paid", "completed", "refunded"].includes(state)
  ? "completed" : ["cancelled", "expired"].includes(state)
    ? "voided" : ["pending", "proof_submitted", "refund_pending", "return_pending"].includes(state)
      ? "warn" : "shop-status-neutral";
function orderDateRange(preset, timezone) {
  if (["all", "custom"].includes(preset)) return { preset, date_from: "", date_to: "" };
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type) => parts.find((value) => value.type === type).value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(`${today}T00:00:00Z`);
  if (preset === "last7") start.setUTCDate(start.getUTCDate() - 6);
  if (preset === "last30") start.setUTCDate(start.getUTCDate() - 29);
  if (preset === "month") start.setUTCDate(1);
  return { preset, date_from: start.toISOString().slice(0, 10), date_to: today };
}
const defaultProductFilters = { category: "", stock_status: "all", publication_status: "all", price_status: "all", sort: "name_asc" };

function OrderProgress({ order }) {
  const titles = { pending: "Pending", accepted: "Accepted", packing: "Packing", ready_for_pickup: "Ready for pickup", dispatched: "Dispatched", completed: "Completed", return_pending: "Awaiting return", cancelled: "Cancelled", expired: "Expired" };
  const returned = order.status === "return_pending" || order.events.some((event) => event.event === "return_pending");
  let steps = ["pending", "accepted", "packing", order.fulfillment === "pickup" ? "ready_for_pickup" : "dispatched", "completed"];
  if (returned) steps = ["pending", "accepted", "packing", "dispatched", "return_pending", "cancelled"];
  const stopped = ["cancelled", "expired"].includes(order.status);
  if (stopped) {
    const lastReached = steps.reduce((last, step, index) => order.events.some((event) => event.event === step) && step !== order.status ? index : last, 0);
    steps = [...steps.slice(0, lastReached + 1), order.status];
  }
  const current = steps.indexOf(order.status);
  return <section className="panel shop-order-progress" aria-label="Order progress">
    <div className="shop-order-progress-heading"><h2>Order status</h2><span className={`status-badge ${statusTone(order.status)}`}>{titles[order.status] || label(order.status)}</span></div>
    <ol aria-label="Fulfillment progress">{steps.map((step, index) => {
      const done = index < current || (step === "completed" && order.status === "completed");
      const active = index === current;
      const state = active && stopped ? "stopped" : done ? "done" : active ? "current" : "upcoming";
      return <li key={step} data-state={state} aria-current={active ? "step" : undefined}>
        <span className="shop-order-step-marker" aria-hidden="true">{active && stopped ? <X size={15} /> : done ? <Check size={15} /> : index + 1}</span>
        <strong>{titles[step]}</strong>
      </li>;
    })}</ol>
  </section>;
}

const sectionDetails = {
  'sales-ai': { icon: MessageCircle, description: 'Name, instructions and personality' },
  'sales-ai-tools': { icon: Check, description: 'Allowed representative actions' },
  'sales-ai-policies': { icon: Store, description: 'Published terms for customers' },
  'sales-ai-wallet': { icon: BarChart3, description: 'MMK credit and usage history' },
  'sales-ai-topups': { icon: ShoppingBag, description: 'Payments and approval status' },
  'sales-ai-telegram': { icon: MessageCircle, description: 'Shop bot, approved groups and guest checkout' },
  chat: { icon: MessageCircle, description: "Customer conversations" },
  customers: { icon: Users, description: "Customers with shop purchases" },
  orders: { icon: ShoppingBag, description: "Orders and fulfillment" },
  catalog: { icon: Package, description: "Publish your products" },
  promotions: { icon: Tag, description: "Flash sales and coupon codes" },
  reviews: { icon: MessageCircle, description: "Shop and product feedback" },
  storefront: { icon: Store, description: "Shop details and publication" },
  contacts: { icon: Phone, description: "Phone, email and social platforms" },
  fulfillment: { icon: ShoppingBag, description: "Pickup instructions" },
  delivery: { icon: Truck, description: "Delivery areas and fees" },
  methods: { icon: CreditCard, description: "Receiving accounts and manual payments" },
  report: { icon: BarChart3, description: "Payments and order totals" },
};

export function ShopPublicationsTable({ path, render, refresh, columns, tableLabel, bulkPath, busy = false }) {
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [pendingRows, setPendingRows] = useState(new Set());
  const bulkWorking = useRef(false);
  const [state, setState] = useState({
    rows: [],
    loading: true,
    error: "",
    total: 0,
    publishedCount: 0,
  });
  const [pagination, setPagination] = useState({ path, page: 1, size: 25 });
  const page = pagination.path === path ? pagination.page : 1;
  const size = pagination.size;
  const generation = useRef(0);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setPendingRows(new Set());
    setBulkError("");
    setState((current) => ({ ...current, rows: [], loading: true, error: "" }));
    try {
      const result = await request(`${path}${path.includes("?") ? "&" : "?"}offset=${(page - 1) * size}&limit=${size}`);
      if (version !== generation.current) return;
      const total = result.total ?? result.items.length;
      const lastPage = Math.max(1, Math.ceil(total / size));
      if (page > lastPage) {
        setPagination({ path, page: lastPage, size });
        return;
      }
      setState({ rows: result.items, loading: false, error: "", total,
        publishedCount: result.published_count ?? result.items.filter((row) => row.published).length });
    } catch (error) {
      if (version === generation.current) setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, [path, page, size]);
  useEffect(() => {
    load();
    const version = generation.current;
    return () => { generation.current = version + 1; };
  }, [load, refresh]);
  const allPublished = state.total > 0 && state.publishedCount === state.total;
  async function publishAll(published) {
    if (busy || bulkWorking.current || state.loading || pendingRows.size || !state.total) return;
    bulkWorking.current = true;
    setBulkBusy(true); setBulkError("");
    const version = generation.current;
    try {
      const result = await request(bulkPath, { method: "PUT", body: JSON.stringify({ published }) });
      if (version !== generation.current) return;
      const patches = new Map(result.items.map((row) => [row.id, row]));
      setState((state) => ({ ...state, rows: state.rows.map((row) => patches.has(row.id) ? { ...row, ...patches.get(row.id) } : row),
        publishedCount: Math.max(0, Math.min(state.total, state.publishedCount + (published ? result.updated : -result.updated))) }));
    } catch (error) { if (version === generation.current) setBulkError(error.message); }
    finally { bulkWorking.current = false; setBulkBusy(false); }
  }
  const version = generation.current;
  function updateRow(id, patch) {
    if (version !== generation.current) return;
    setState((state) => {
      const current = state.rows.find((row) => row.id === id);
      if (!current) return state;
      return { ...state, rows: state.rows.map((row) => row.id === id ? { ...row, ...patch } : row),
        publishedCount: state.publishedCount + Number(!!patch.published) - Number(!!current.published) };
    });
  }
  const listEnd = (state.loading || state.error || !state.rows.length) && (
      <div className="shop-list-end">
        {state.loading ? (
          <p role="status">Loading…</p>
        ) : state.error ? (
          <div role="alert">
            {state.error}
            <button onClick={() => load()}>Retry</button>
          </div>
        ) : !state.rows.length ? (
          <p>No records found.</p>
        ) : null}
      </div>
  );
  if (columns) return (
    <div className="shop-table-card">
      {bulkPath && <AppBarActions className="shop-publication-actions">
        <button type="button" className={allPublished ? "" : "primary"} title={`All ${state.total} products matching the current filters`}
          aria-label={bulkBusy ? "Saving all filtered products" : allPublished ? "Unpublish all filtered products" : "Publish all filtered products"}
          aria-pressed={allPublished} aria-busy={bulkBusy} disabled={busy || bulkBusy || state.loading || pendingRows.size > 0 || !state.total}
          onClick={() => publishAll(!allPublished)}>
          {bulkBusy ? <span className="shop-publication-progress" role="progressbar" aria-label="Saving all filtered products" /> : allPublished ? <X size={16} /> : <Check size={16} />}
          {bulkBusy ? "Saving…" : allPublished ? "Unpublish all" : "Publish all"}
        </button>
      </AppBarActions>}
      <div className="table-wrap sheet-table shop-table-scroll" aria-busy={state.loading}>
        <table className="shop-data-table" aria-label={tableLabel}>
          <colgroup>{columns.map((column) => <col key={column.label} style={{ width: column.width }} />)}</colgroup>
          <thead><tr>{columns.map((column) => <th key={column.label} scope="col" className={column.className}>{column.label}</th>)}</tr></thead>
          <tbody>{state.rows.map((row) => render(row, { busy: bulkBusy, onSaved: (patch) => updateRow(row.id, patch), onSaving: (saving) => {
            if (version !== generation.current) return;
            setPendingRows((rows) => { const next = new Set(rows); if (saving) next.add(row.id); else next.delete(row.id); return next; });
          } }))}</tbody>
        </table>
        {bulkError && <p className="shop-bulk-error" role="alert">{bulkError}</p>}
        {listEnd}
      </div>
      <div className="shop-orders-pagination">
        <label className="shop-page-size">Rows per page
          <select aria-label="Rows per page" value={size} disabled={busy || state.loading || bulkBusy || pendingRows.size > 0}
            onChange={(event) => setPagination({ path, page: 1, size: Number(event.target.value) })}>
            {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <TablePagination page={page} pageSize={size} total={state.total}
          loading={busy || state.loading || bulkBusy || pendingRows.size > 0 || Boolean(state.error)}
          onPageChange={(next) => setPagination({ path, page: next, size })} />
      </div>
    </div>
  );
  return <>{state.rows.map(render)}{listEnd}</>;
}

export function Settings({ run, changed, section = "storefront", owner = false }) {
  const [form, setForm] = useState(null),
    [priceTypes, setPriceTypes] = useState([]),
    [saved, setSaved] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    request("/shop-admin/settings")
      .then((s) => {
        setForm(s);
        setSaved(s);
        setPriceTypes(s.price_types);
      })
      .catch((e) => setError(e.message));
  }, [changed]);
  const change = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  if (!form)
    return (
      <p role={error ? "alert" : "status"}>{error || "Loading settings…"}</p>
    );
  return (
    <form
      className="shop-settings"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await request("/shop-admin/settings", {
            method: "PUT",
            body: JSON.stringify(Object.fromEntries(Object.entries({ ...saved, ...Object.fromEntries(
              (section === "storefront" ? ["display_name", "slug", "phone", "address", "currency", "price_type", "description", "storefront_enabled", "accepting_orders", "marketplace_enabled", "opening_hours", "announcement", "closed_until"]
                : section === "fulfillment" ? ["pickup_instructions"] : ["delivery_zones"]).map((key) => [key, form[key]])
            ) }).filter(([key]) => !["payment_methods", "expiration_hours", "location", "receipt_logo_data_url"].includes(key)
              && (section === "storefront" || !["display_name", "phone", "address", "currency"].includes(key))))),
          });
          emitDataChange(["settings"], "shop");
        });
      }}
    >
      {section === "storefront" && <section className="panel">
        <h2>Storefront</h2>
        <p>Publish your customer shop and share its link.</p>
        <p>Shop name, address, phone, currency and logo are shared with main Settings.</p>
        <div className="shop-brand-profile">
          <ShopCoverSettings cover={form.cover_data_url} onChange={(cover) => change("cover_data_url", cover)} />
          <ShopLogoSettings logo={form.receipt_logo_data_url} owner={owner} onChange={(logo) => change("receipt_logo_data_url", logo)} />
          <div className="shop-logo-copy shop-brand-description">
            <strong>Logo &amp; cover photo</strong>
            <small>Personalize your storefront with a business logo and a wide landscape cover photo. Use the pencil icons to edit each image.</small>
            <small>PNG, JPG, or WebP. Logo: up to 512 KB, 2400 x 2400 px. Cover: up to 2 MB, 4800 x 4800 px.</small>
          </div>
        </div>
        <div className="shop-form-grid">
          <Field label="Public shop name">
            <input
              required
              disabled={!owner}
              value={form.display_name}
              onChange={(e) => change("display_name", e.target.value)}
            />
          </Field>
          <Field label="Shop slug">
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={(e) => change("slug", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              disabled={!owner}
              onChange={(e) => change("phone", e.target.value)}
            />
          </Field>
          <Field label="Online price type">
            <select
              value={form.price_type}
              onChange={(e) => change("price_type", e.target.value)}
            >
              {priceTypes.map((p) => (
                <option key={p.name || p} value={p.name || p}>
                  {p.name || p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Address"><input value={form.address || ""} disabled={!owner} onChange={(e) => change("address", e.target.value)} /></Field>
          <Field label="Currency"><input required maxLength={20} value={form.currency || "Ks"} disabled={!owner} onChange={(e) => change("currency", e.target.value)} /></Field>
        </div>
        <Field label="Shop description">
          <textarea
            value={form.description || ""}
            onChange={(e) => change("description", e.target.value)}
          />
        </Field>
        <div className="shop-checks">
          {[
            ["storefront_enabled", "Enable storefront"],
            ["accepting_orders", "Accept new orders"],
            ["marketplace_enabled", "List in marketplace"],
          ].map(([k, title]) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={!!form[k]}
                onChange={(e) => change(k, e.target.checked)}
              />
              {title}
            </label>
          ))}
        </div>
        {!!form.marketplace_suspended && (
          <p role="alert">
            Marketplace listing suspended: {form.marketplace_suspension_reason}
          </p>
        )}
        <p>
          Store link:{" "}
          <a
            href={`${import.meta.env.VITE_SHOP_URL || "http://localhost:5177"}/#/store/${form.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Open customer shop
          </a>
          .
        </p>
        <ShopLocationSettings location={form.location} owner={owner} onChange={(location) => change("location", location)} />
      </section>}
      {section === 'storefront' && <ShopOperatingSettings form={form} change={change} />}
      {section === "fulfillment" && <section className="panel">
        <h2>Fulfillment</h2>
        <div className="shop-form-grid">
          <Field label="Pickup instructions">
            <textarea
              value={form.pickup_instructions || ""}
              onChange={(e) => change("pickup_instructions", e.target.value)}
            />
          </Field>

        </div>
      </section>}
      <button className="primary">Save shop settings</button>
    </form>
  );
}
export function OrderDetail({ id, run, refresh, can, timezone, busy = false, onViewCustomer }) {
  const pageActive = useRetainedActivity();
  const [order, setOrder] = useState(null),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [proofRejectionReason, setProofRejectionReason] = useState(""),
    [rejectionOpen, setRejectionOpen] = useState(false),
    [rejectionBusy, setRejectionBusy] = useState(false),
    [rejectionError, setRejectionError] = useState(""),
    [historyOpen, setHistoryOpen] = useState(false),
    [processAction, setProcessAction] = useState(null),
    [processError, setProcessError] = useState(""),
    [reference, setReference] = useState(""),
    [verified, setVerified] = useState(false),
    [reviewNote, setReviewNote] = useState(""),
    [returned, setReturned] = useState(false),
    [proofUrl, setProofUrl] = useState(""),
    [proofBusy, setProofBusy] = useState(false),
    [proofError, setProofError] = useState(""),
    [proofSelection, setProofSelection] = useState(null),
    [proofRetry, setProofRetry] = useState(0);
  const orderLoadVersion = useRef(0);
  useEffect(() => { setHistoryOpen(false); setProcessAction(null); setProcessError(""); setReason(""); setReturned(false); }, [id]);
  useEffect(() => {
    let active = true;
    const version = ++orderLoadVersion.current;
    setOrder(null);
    setError("");
    setRejectionOpen(false);
    setProofRejectionReason("");
    setRejectionError("");
    request(`/shop-admin/orders/${id}`)
      .then((o) => { if (active && version === orderLoadVersion.current) { setOrder(o); setVerified(false); setReference(""); setReviewNote(""); } })
      .catch((e) => active && version === orderLoadVersion.current && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, refresh]);
  useEffect(() => {
    let active = true;
    const update = event => {
      if (Number(event.detail?.orderId) !== Number(id) && !event.detail?.orderIds?.includes(Number(id))) return;
      const version = ++orderLoadVersion.current;
      request(`/shop-admin/orders/${id}`).then(data => { if (active && version === orderLoadVersion.current) setOrder(data); }).catch(() => {});
    };
    window.addEventListener('mkpos:owner-order-activity', update);
    window.addEventListener('mkpos:shop-order-changed', update);
    return () => { active = false; window.removeEventListener('mkpos:owner-order-activity', update); window.removeEventListener('mkpos:shop-order-changed', update); };
  }, [id, pageActive]);
  const canViewProof = can("ecommerce_payments");
  const latestProof = order?.id === id ? order.payments.filter((payment) => payment.type === "proof").at(-1)?.id : null;
  const selectedProof = proofSelection?.orderId === id ? proofSelection.id : latestProof;
  useEffect(() => {
    let active = true, url;
    setProofUrl(""); setProofError(""); setProofBusy(false);
    if (!canViewProof || !selectedProof) return;
    setProofBusy(true);
    requestDownload(`/shop-admin/orders/${id}/proofs/${selectedProof}`, { accept: "image/*", timeoutMs: 15000 })
      .then((result) => { if (active) { url = URL.createObjectURL(result.blob); setProofUrl(url); } })
      .catch((e) => { if (active) setProofError(e.name === "AbortError" ? "Screenshot loading timed out. Retry or check the receiving account directly." : e.message); })
      .finally(() => { if (active) setProofBusy(false); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id, selectedProof, canViewProof, proofRetry]);
  if (!order)
    return (
      <div>
        <p role={error ? "alert" : "status"}>{error || "Loading order…"}</p>
      </div>
    );
  const transitions = (nextStates[order.status] || []).filter(
    (s) =>
      !(s === "ready_for_pickup" && order.fulfillment !== "pickup") &&
      !(s === "dispatched" && order.fulfillment !== "delivery"),
  );
  const manual = (order.payment_method.provider || "manual") === "manual";
  const canApprove = manual && can("ecommerce_payments") && ["unpaid", "proof_submitted"].includes(order.payment_status)
    && !["cancelled", "expired", "completed"].includes(order.status);
  const canRefund = manual && can("ecommerce_refunds") && order.payment_status === "refund_pending";
  const canReopen = can("ecommerce_process") && order.status === "expired" && order.payment_status === "proof_submitted";
  const canRecordLatePayment = manual && can("ecommerce_payments") && ["expired", "cancelled"].includes(order.status) && order.payment_status === "proof_submitted";
  function transition(status) {
    setProcessError("");
    run(async () => {
      try {
        await request(`/shop-admin/orders/${id}/transition`, {
          method: "POST",
          body: JSON.stringify({ status, reason: ["cancelled", "return_pending"].includes(status) ? reason : "", return_confirmed: returned }),
        });
        setProcessAction(null);
        setReason("");
        setReturned(false);
      } catch (error) { setProcessError(error.message); throw error; }
    });
  }
  return (
    <div className="shop-order-detail">
      <AppBarActions>
        {can("ecommerce_process") && transitions.map((status) => (
          <button key={status} type="button" className={status === "cancelled" ? "danger-button" : "primary"}
            disabled={busy || (status === "completed" && order.payment_status !== "paid")}
            aria-haspopup={["cancelled", "return_pending"].includes(status) ? "dialog" : undefined}
            onClick={() => {
              setProcessError("");
              if (["cancelled", "return_pending"].includes(status)) {
                setHistoryOpen(false); setReason(""); setReturned(false); setProcessAction(status);
              } else transition(status);
            }}>
            {transitionActions[status]}
          </button>
        ))}
        {canReopen && <button type="button" className="primary" disabled={busy} onClick={() => {
          if (window.confirm("Reopen this expired order for payment review? Available stock will be checked and reserved again.")) run(() => request(`/shop-admin/orders/${id}/reopen`, { method: "POST" }));
        }}>Reopen for payment review</button>}
        {order.customer_key && onViewCustomer && <button type="button" disabled={busy} onClick={() => onViewCustomer(order.customer_key)}><Users size={16} />View customer</button>}
        <button type="button" className="filter-drawer-trigger" disabled={busy} onClick={() => { setProcessAction(null); setHistoryOpen(true); }} aria-haspopup="dialog" aria-expanded={historyOpen}>
          <History size={16} /> Order history
        </button>
      </AppBarActions>
      <OrderProgress order={order} />
      <div className="shop-order-column">
      <ShopRequestReview key={id} order={order} canReview={can('ecommerce_process')} busy={busy} onSaved={saved => { setOrder(saved); window.dispatchEvent(new CustomEvent('mkpos:shop-order-updated', { detail: saved })); emitDataChange(['products', 'sales', 'reports'], 'shop'); }} />
      <section className="panel">
        <h2>{order.reference}</h2>
        <p>
          {label(order.status)} · Payment: {label(order.payment_status)} ·{" "}
          {order.origin}
        </p>
        {order.payment_status === "paid" && order.status === "pending" && <p className="shop-flow-notice">Payment approved. Accept the order to start fulfillment.</p>}
        <div className="shop-form-grid">
          <div>
            <strong>{order.customer_name}</strong>
            <p>
              {order.phone}
              <br />
              {order.email}
            </p>
          </div>
          <div>
            <strong>{label(order.fulfillment)}</strong>
            <p>
              {order.address}
              <br />
              {order.fulfillment_instructions}
            </p>
          </div>
        </div>
        <p>{order.notes}</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.product_id}>
                  <td>{i.name}</td>
                  <td>
                    {i.quantity} {i.unit_name}
                  </td>
                  <td>{amount(i.unit_price, order.currency)}</td>
                  <td>{amount(i.line_total, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Delivery fee: {amount(order.delivery_fee, order.currency)}{order.delivery_fee_recipient === "delivery_service" && <> · Customer pays the delivery service directly</>}</p>
        {order.delivery_fee_recipient === "delivery_service" && <p>Delivery fee is excluded from the shop total.</p>}
        {Number(order.discount) > 0 && <p>Coupon discount: −{amount(order.discount, order.currency)}</p>}
        {order.promotions?.length > 0 && <p>Promotions: {order.promotions.map(promotion => promotion.code || promotion.name).join(", ")}</p>}
        <h3>Total: {amount(order.total, order.currency)}</h3>
        {order.sale_id && (
          <p>
            Linked POS sale #{order.sale_id}
            {order.sale_voided ? " · Voided" : ""}
          </p>
        )}
      </section>
      {can("ecommerce_process") && <Modal open={Boolean(processAction)} title={transitionActions[processAction] || "Cancel order"} subtitle={order.reference} size="small" busy={busy} onClose={() => setProcessAction(null)} footer={<>
        <button type="button" disabled={busy} onClick={() => setProcessAction(null)}>Close</button>
        <button type="submit" form="shop-order-action-form" className="danger-button" disabled={busy || !reason.trim() || (order.status === "return_pending" && !returned)}>{transitionActions[processAction]}</button>
      </>}>
        <form id="shop-order-action-form" onSubmit={(event) => {
          event.preventDefault();
          if (!busy && reason.trim() && (order.status !== "return_pending" || returned)) transition(processAction);
        }}>
          {processError && <p role="alert">{processError}</p>}
          {processAction === "cancelled" && order.payment_status === "paid" && <p>A manual refund will be required.</p>}
          <Field label="Reason (required for cancellation or failed delivery)">
            <textarea required rows={3} maxLength={2000} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          {order.status === "return_pending" && <label className="shop-checkbox"><input type="checkbox" checked={returned} disabled={busy} onChange={(event) => setReturned(event.target.checked)} />Goods physically returned</label>}
        </form>
      </Modal>}
      </div>
      <div className="shop-order-column">
      {(can("ecommerce_payments") || can("ecommerce_refunds")) && (
        <section className="panel shop-payment-review">
          <div className="shop-payment-review-heading">
            <h2>Manual payment review</h2>
            <strong>Order total: {amount(order.total, order.currency)}</strong>
          </div>
          <p>
            {order.payment_method.name}: {order.payment_method.instructions}
          </p>
          {order.payment_method.type === "transfer" && <p>{[order.payment_method.bank, order.payment_method.account_name, order.payment_method.account_no].filter(Boolean).join(" · ")}</p>}
          {canViewProof && order.payments.some((payment) => payment.type === "proof") && <div className="shop-proof-review">
            <h3>Payment screenshot</h3>
            <div className="shop-actions">{order.payments.filter((payment) => payment.type === "proof").map((proof) => <button key={proof.id} type="button" aria-pressed={selectedProof === proof.id} onClick={() => { setProofSelection({ orderId: id, id: proof.id }); setProofRetry((value) => value + 1); }}>Proof #{proof.id}: {label(proof.status)}</button>)}</div>
            {proofBusy && <p role="status">Loading payment screenshot…</p>}
            {proofError && <div role="alert">{proofError} <button type="button" onClick={() => setProofRetry((value) => value + 1)}>Retry screenshot</button></div>}
            {proofUrl && <div className="shop-proof-preview"><img className="shop-proof-image" src={proofUrl} alt="Customer payment proof" /><a className="shop-proof-link" href={proofUrl} target="_blank" rel="noreferrer">Open full screenshot</a></div>}
          </div>}
          <p>Check the full amount against your cash receipt or receiving account. A customer screenshot alone does not confirm receipt.</p>
          {canRecordLatePayment && <p className="shop-flow-notice">If fulfillment cannot resume, record verified receipt for refund. The order stays closed and its stock stays released.</p>}
          {(canApprove || canRefund || canRecordLatePayment) && <><div className="shop-payment-review-fields"><Field label="Payment / refund reference (optional)">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Internal review note"><textarea rows={1} maxLength={2000} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} /></Field></div>
          <label className="shop-checkbox"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />{order.payment_status === "refund_pending" ? "I checked that the full refund was sent to the customer." : "I checked that the full payment was received by this shop."}</label></>}
          <div className="shop-actions">
            {(canApprove || canRecordLatePayment) && (
                <button
                  className="primary"
                  disabled={!verified}
                  onClick={() =>
                    run(() =>
                      request(`/shop-admin/orders/${id}/payments/confirm`, {
                        method: "POST",
                        body: JSON.stringify({
                          amount: Number(order.total),
                          reference,
                          verified,
                          review_note: reviewNote,
                        }),
                      }),
                    )
                  }
                >
                  {canRecordLatePayment ? "Record payment for refund" : "Approve full payment"}
                </button>
              )}
            {canRefund && (
                <button
                  className="primary"
                  disabled={!verified}
                  onClick={() =>
                    run(() =>
                      request(`/shop-admin/orders/${id}/payments/refund`, {
                        method: "POST",
                        body: JSON.stringify({
                          amount: Number(order.total),
                          reference,
                          verified,
                          review_note: reviewNote,
                        }),
                      }),
                    )
                  }
                >
                  Record full refund
                </button>
              )}
            {can("ecommerce_payments") && order.payment_status === "proof_submitted" && (
              <button type="button" className="danger-button" onClick={() => { setRejectionError(""); setRejectionOpen(true); }}>Reject proof</button>
            )}
          </div>
          {order.payments.filter((payment) => payment.type !== "proof").map((payment) => <p key={payment.id}>
            {label(payment.type)} · {amount(payment.amount, order.currency)} · {payment.reference}
            <small className="shop-cell-meta">Reviewed by staff #{payment.actor_id} · {new Date(payment.created_at.replace(" ", "T") + "Z").toLocaleString(undefined, { timeZone: timezone })}{payment.reason ? ` · ${payment.reason}` : ""}</small>
          </p>)}
          {can("ecommerce_payments") &&
            order.payment_status === "proof_submitted" && (
              <Modal open={rejectionOpen} title="Reject proof" size="small" busy={rejectionBusy} onClose={() => setRejectionOpen(false)} footer={<>
                <button type="button" disabled={rejectionBusy} onClick={() => setRejectionOpen(false)}>Cancel</button>
                <button type="submit" form="shop-proof-rejection-form" className="danger-button" disabled={rejectionBusy || !proofRejectionReason.trim()}>Reject proof</button>
              </>}>
                <form id="shop-proof-rejection-form" onSubmit={(event) => {
                  event.preventDefault();
                  if (rejectionBusy || !proofRejectionReason.trim()) return;
                  setRejectionBusy(true);
                  setRejectionError("");
                  run(async () => {
                    try {
                      await request(`/shop-admin/orders/${id}/payments/reject`, {
                        method: "POST",
                        body: JSON.stringify({ reason: proofRejectionReason }),
                      });
                      setRejectionOpen(false);
                      setProofRejectionReason("");
                    } catch (error) {
                      setRejectionError(error.message);
                      throw error;
                    } finally {
                      setRejectionBusy(false);
                    }
                  });
                }}>
                {rejectionError && <p role="alert">{rejectionError}</p>}
                <Field label="Customer-visible rejection reason">
                  <textarea
                    rows={3}
                    required
                    maxLength={2000}
                    disabled={rejectionBusy}
                    value={proofRejectionReason}
                    onChange={(e) => setProofRejectionReason(e.target.value)}
                  />
                </Field>
                </form>
              </Modal>
            )}
        </section>
      )}
      </div>
      <FilterDrawer open={historyOpen} title="Order history" eyebrow={order.reference} onClose={() => setHistoryOpen(false)} busy={busy} className="shop-history-drawer">
        {order.events.length === 0 && <p>No order history yet.</p>}
        <ol className="shop-history-list">
        {order.events.map((e) => (
          <li key={e.id}>
            <strong>{label(e.event)}</strong>
            <time dateTime={e.created_at.replace(" ", "T") + "Z"}>{new Date(e.created_at.replace(" ", "T") + "Z").toLocaleString(
              undefined,
              { timeZone: timezone },
            )}</time>
            {e.reason && <p>{e.reason}</p>}
          </li>
        ))}
        </ol>
      </FilterDrawer>
    </div>
  );
}
export function ShopScreen(props) {
  return <ShopLocationGate><ShopWorkspace {...props} /></ShopLocationGate>;
}

function ShopWorkspace({ onDetailChange, actionRequiredCount = 0 }) {
  const [session, setSession] = useState(null),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [productFilters, setProductFilters] = useState(defaultProductFilters),
    [categories, setCategories] = useState([]),
    [status, setStatus] = useState(""),
    [payment, setPayment] = useState(""),
    [needsReview, setNeedsReview] = useState(false),
    [filterOpen, setFilterOpen] = useState(false),
    [dates, setDates] = useState({ preset: "all", date_from: "", date_to: "" }),
    [appliedDates, setAppliedDates] = useState({ date_from: "", date_to: "" });
  const params = new URLSearchParams(location.search);
  const initialView = { tab: params.get("shopTab") || (params.has("shopCustomer") ? "customers" : "orders"), id: Number(params.get("shopOrder")) || null, topupId: Number(params.get("shopTopup")) || null, customerKey: params.get("shopCustomer") || null };
  const { view, go, back } = usePageNavigation("shop", initialView, (next) => {
    const url = new URL(location.href);
    for (const [key, value] of [["shopTab", next.tab], ["shopOrder", next.id], ["shopTopup", next.topupId], ["shopCustomer", next.customerKey]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    return url;
  });
  const { tab, id, customerKey } = view;
  useAiPageLink('shop', target => { if (target.tab?.startsWith('sales-ai')) go({ tab: target.tab, id: null, customerKey: null }, true); }, session?.user?.role === 'owner');
  useEffect(() => {
    request("/auth/me").then(setSession).catch((e) => setError(e.message));
  }, []);
  const can = (permission) =>
    session?.user.role === "owner" ||
    session?.permissions?.includes(permission);
  const tabs = [
    ["orders", "Orders", "ecommerce_orders"],
    ["customers", "Customers", "ecommerce_orders"],
    ["chat", "Chat", "ecommerce_orders"],
    ["catalog", "Publication", "ecommerce_catalog"],
    ["promotions", "Promotions", "ecommerce_catalog"],
    ["reviews", "Reviews", "ecommerce_orders"],
    ["report", "Report", "ecommerce_orders"],
    ["sales-ai", "Configuration", "owner_only"],
    ["sales-ai-tools", "Tool permissions", "owner_only"],
    ["sales-ai-policies", "Sales policies", "owner_only"],
    ["sales-ai-wallet", "Balance book", "owner_only"],
    ["sales-ai-topups", "Top-up requests", "owner_only"],
      ["sales-ai-telegram", "Telegram bot", "owner_only"],
    ["storefront", "Storefront", "ecommerce_settings"],
    ["contacts", "Contact", "ecommerce_settings"],
    ["fulfillment", "Fulfillment", "ecommerce_settings"],
    ["delivery", "Delivery zones", "ecommerce_settings"],
    ["methods", "Payment methods", "ecommerce_settings"],
  ].filter(
    ([, , p]) =>
      (p === 'owner_only' ? session?.user.role === 'owner' : can(p)) &&
      (session?.subscription?.is_valid ||
        !["ecommerce_catalog", "ecommerce_settings"].includes(p)),
  );
  const selected = tabs.find(([v]) => v === tab)?.[0] || tabs[0]?.[0];
  const listSelected = !id && !customerKey && ["orders", "catalog"].includes(selected);
  const activeFilterCount = selected === "catalog"
    ? [q.trim(), productFilters.category, productFilters.stock_status !== "all", productFilters.publication_status !== "all", productFilters.price_status !== "all", productFilters.sort !== "name_asc"].filter(Boolean).length
    : [q.trim(), status, payment, needsReview, appliedDates.date_from || appliedDates.date_to].filter(Boolean).length;
  useEffect(() => {
    if (selected !== "catalog") return;
    let active = true;
    request("/shop-admin/publications/filters").then((data) => { if (active) setCategories(data.categories || []); })
      .catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [selected, refresh]);
  const rangeError = dateRangeError(dates.date_from, dates.date_to);
  function changeDates(next) {
    setDates(next);
    if (!dateRangeError(next.date_from, next.date_to)) setAppliedDates(next);
  }
  useEffect(() => {
    if (!listSelected) return;
    const timer = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search, listSelected]);
  useDataRefresh(["ecommerce", "products", "sales", "settings"], "shop", () =>
    setRefresh((v) => v + 1),
  );
  const working = useRef(false);
  async function run(operation, reload = true) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await operation();
      if (reload) {
        setRefresh((v) => v + 1);
        setSuccess("Saved successfully.");
        emitDataChange(["products", "sales", "reports"], "shop");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const open = useCallback((orderId) => {
    if (orderId) go({ ...view, id: orderId });
    else back({ ...view, id: null });
  }, [go, back, view]);
  const openCustomer = useCallback((key) => {
    if (key) go({ ...view, id: null, customerKey: key });
    else back({ ...view, id: null, customerKey: null });
  }, [go, back, view]);
  useEffect(() => {
    onDetailChange?.(id ? { label: customerKey ? "Back to customer" : "Back to orders", onClick: () => open(null), disabled: busy }
      : customerKey ? { label: tab === "chat" ? "Back to chat" : tab === "report" ? "Back to report" : "Back to customers", onClick: () => openCustomer(null), disabled: busy }
      : tab === "chat" && window.history.state?.mkposDesktopNavigation?.index > 0 ? { label: "Back to previous screen", onClick: () => back({ tab: "orders", id: null, customerKey: null }) } : null);
    return () => onDetailChange?.(null);
  }, [id, customerKey, tab, busy, open, openCustomer, back, onDetailChange]);
  return (
    <div className="shop-admin">
      {listSelected && (
        <>
          <AppBarSearch className={selected === "catalog" ? "shop-product-search" : ""}>
            <form onSubmit={(event) => { event.preventDefault(); setQ(search.trim()); }}>
              <label><Search size={16} /><input disabled={busy} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={selected === "orders" ? "Order reference or customer" : "Search name, SKU, barcode or category"} aria-label={selected === "orders" ? "Search online orders" : "Search products"} /></label>
            </form>
          </AppBarSearch>
          {listSelected && (
            <AppBarActions>
              <button type="button" className="filter-drawer-trigger" disabled={busy} onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}>
                <Filter size={16} /> Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </button>
            </AppBarActions>
          )}
        </>
      )}
      <div role="alert">{error}</div>
      {success && <p role="status">{success}</p>}
      <fieldset disabled={busy}>
        <RetainedViews activeKey={id ? `order:${id}` : customerKey ? `customer:${customerKey}` : "list"}>
        {id ? (
          <OrderDetail
            id={id}
            run={run}
            busy={busy}
            refresh={refresh}
            can={can}
            timezone={session?.business.timezone || "Asia/Rangoon"}
            onViewCustomer={openCustomer}
          />
        ) : customerKey ? (
          <ShopCustomerDetail key={customerKey} customerKey={customerKey} refresh={refresh} timezone={session?.business.timezone || "Asia/Rangoon"} onViewOrder={open} canBlock={can("ecommerce_process")} canAddCredit={can("customers")} canChat={can("ecommerce_process")} />
        ) : (
          <div className="shop-workspace">
            <nav className="shop-tabs shop-side-tabs" aria-label="Shop management sections">
              {tabs.map(([v, title]) => {
                const { icon: Icon, description } = sectionDetails[v];
                return (
                <React.Fragment key={v}>
                {v === "sales-ai" && <h2 className="shop-nav-section-heading">Sales AI</h2>}
                {v === "storefront" && <h2 className="shop-nav-section-heading">Settings</h2>}
                <button
                  type="button"
                  aria-label={title}
                  aria-current={selected === v ? "page" : undefined}
                  className={selected === v ? "primary" : ""}
                  onClick={() => { go({ tab: v, id: null, customerKey: null }, !(v.startsWith('sales-ai') && selected?.startsWith('sales-ai'))); setFilterOpen(false); setSearch(""); setQ(""); }}
                >
                  <Icon size={18} />
                  <span className="shop-tab-copy"><strong>{title}</strong><small>{description}</small></span>
                  {v === "orders" && actionRequiredCount > 0 && <span className="shop-order-action-badge" title={`${actionRequiredCount} orders need action`} aria-label={`${actionRequiredCount} orders need action`}>{actionRequiredCount > 99 ? '99+' : actionRequiredCount}</span>}
                </button>
                </React.Fragment>
                );
              })}
            </nav>
            <div className="shop-workspace-content">
            {!session && <p role="status">Loading shop administration…</p>}
            {["storefront", "fulfillment"].includes(selected) && <Settings run={run} changed={refresh} section={selected} owner={session?.user.role === "owner"} />}
            {selected === "chat" && <ShopChat refresh={refresh} canSend={can("ecommerce_process")} onViewCustomer={openCustomer} />}
            {session?.user.role === 'owner' && <RetainedViews activeKey={selected?.startsWith('sales-ai') ? 'sales-ai' : 'other'}>{selected?.startsWith('sales-ai') ? <ShopSalesAi refresh={refresh} topupId={view.topupId} onTopupClose={() => go({ ...view, topupId: null }, true)} section={selected === 'sales-ai' ? 'settings' : selected.slice('sales-ai-'.length)} onSectionChange={section => go({ tab: section === 'settings' ? 'sales-ai' : `sales-ai-${section}`, id: null, topupId: null, customerKey: null })} /> : null}</RetainedViews>}
            {selected === "delivery" && <ShopDeliveryZones run={run} refresh={refresh} busy={busy} />}
            {selected === "contacts" && <ShopContacts run={run} refresh={refresh} busy={busy} />}
            {selected === "customers" && <ShopCustomers refresh={refresh} timezone={session?.business.timezone || "Asia/Rangoon"} onViewOrder={open} onViewCustomer={openCustomer} />}
            {selected === "methods" && <ShopPaymentMethods run={run} refresh={refresh} busy={busy} />}
            {selected === "catalog" && (
              <>
                <ShopPublicationsTable
                  path={`/shop-admin/publications?${new URLSearchParams({ q, ...productFilters })}`}
                  refresh={refresh}
                  bulkPath={`/shop-admin/publications/bulk?${new URLSearchParams({ q, ...productFilters })}`}
                  busy={busy || search.trim() !== q}
                  tableLabel="Product publication"
                  columns={[
                    { label: "Product", width: "30%" },
                    { label: "Stock", width: "12%" },
                    { label: "Unit", width: "10%" },
                    { label: "Online price", width: "24%", className: "shop-money-cell" },
                    { label: "Publication", width: "24%" },
                  ]}
                  render={(p, row) => (
                    <ShopPublicationRow
                      key={`${p.id}-${refresh}`}
                      product={p}
                      busy={busy || row.busy}
                      onSaved={row.onSaved}
                      onSaving={row.onSaving}
                    />
                  )}
                />
              </>
            )}
            {selected === "orders" && (
              <>
                  <ShopOrdersTable
                    path={`/shop-admin/orders?q=${encodeURIComponent(q)}&status=${status}&payment_status=${payment}&date_from=${appliedDates.date_from}&date_to=${appliedDates.date_to}&requests=${needsReview ? '1' : '0'}`}
                    backgroundRefresh
                    refresh={refresh}
                    onSaved={() => window.dispatchEvent(new CustomEvent('mkpos:owner-order-activity'))}
                    tableLabel="Online orders"
                    columns={[
                      { label: "Order", width: "28%" },
                      { label: "Customer" },
                      { label: "Order status", width: "16%" },
                      { label: "Payment status", width: "14%" },
                      { label: "Total", width: "11%", className: "shop-money-cell" },
                      { label: "Actions", width: 88, className: "table-actions-cell" },
                    ]}
                    render={(o, row) => (
                      <tr className="shop-order-row" key={o.id}>
                        <td><button type="button" className="shop-order-link" onClick={() => open(o.id)}>{o.reference}</button>{o.request_count > 0 && <span className="status-badge warn">{o.request_count} request(s)</span>}<small className="shop-cell-meta">{new Date(`${o.created_at.replace(" ", "T")}Z`).toLocaleString(undefined, { timeZone: session?.business.timezone || "Asia/Rangoon" })}</small></td>
                        <td>{o.customer_key ? <button type="button" className="shop-order-link" onClick={() => openCustomer(o.customer_key)}>{o.customer_name}</button> : <strong>{o.customer_name}</strong>}</td>
                        <td><span className={`status-badge ${statusTone(o.status)}`}>{label(o.status)}</span></td>
                        <td><span className={`status-badge ${o.payment_status === "unpaid" && o.status !== "cancelled" ? "warn" : statusTone(o.payment_status)}`}>{label(o.payment_status)}</span></td>
                        <td className="shop-money-cell"><strong>{amount(o.total, o.currency)}</strong></td>
                        <td className="table-actions-cell"><ShopOrderRowActions order={o} can={can} busy={busy} onSaved={row.onSaved} onView={() => open(o.id)} timezone={session?.business.timezone || "Asia/Rangoon"} /></td>
                      </tr>
                    )}
                  />
              </>
            )}
            <RetainedViews activeKey={["report", "promotions", "reviews"].includes(selected) ? selected : "other"}>
              {selected === "reviews" ? <ShopReviews canReply={can('ecommerce_process')} timezone={session?.business.timezone || 'Asia/Rangoon'} /> : selected === "report" ? <ShopReport refresh={refresh} onViewCustomer={openCustomer} /> : selected === "promotions" ? <ShopPromotions refresh={refresh} timezone={session?.business.timezone || "Asia/Rangoon"} currency={session?.business.currency || "Ks"} /> : null}
            </RetainedViews>
            </div>
          </div>
        )}
        </RetainedViews>
      </fieldset>
      <FilterDrawer open={filterOpen && !id && selected === "catalog"} title="Product filters" onClose={() => setFilterOpen(false)} busy={busy}>
        <div className="drawer-filter-form">
          <Field label="Category"><select value={productFilters.category} onChange={(event) => setProductFilters((filters) => ({ ...filters, category: event.target.value }))}>
            <option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select></Field>
          <Field label="Stock status"><select value={productFilters.stock_status} onChange={(event) => setProductFilters((filters) => ({ ...filters, stock_status: event.target.value }))}>
            <option value="all">All stock levels</option><option value="in_stock">Healthy stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option>
          </select></Field>
          <Field label="Publication status"><select value={productFilters.publication_status} onChange={(event) => setProductFilters((filters) => ({ ...filters, publication_status: event.target.value }))}>
            <option value="all">All publications</option><option value="published">Published</option><option value="unpublished">Unpublished</option>
          </select></Field>
          <Field label="Online price"><select value={productFilters.price_status} onChange={(event) => setProductFilters((filters) => ({ ...filters, price_status: event.target.value }))}>
            <option value="all">All prices</option><option value="priced">Price set</option><option value="missing">Missing or zero price</option>
          </select></Field>
          <Field label="Sort products"><select value={productFilters.sort} onChange={(event) => setProductFilters((filters) => ({ ...filters, sort: event.target.value }))}>
            <option value="name_asc">Name: A to Z</option><option value="name_desc">Name: Z to A</option><option value="low_stock_first">Low stock first</option>
            <option value="stock_asc">Stock: lowest first</option><option value="stock_desc">Stock: highest first</option>
            <option value="price_asc">Price: lowest first</option><option value="price_desc">Price: highest first</option>
            <option value="newest">Newest products first</option><option value="oldest">Oldest products first</option>
          </select></Field>
          <div className="drawer-filter-actions">
            <button type="button" onClick={() => { setSearch(""); setQ(""); setProductFilters(defaultProductFilters); setFilterOpen(false); }}>Clear</button>
            <button type="button" className="primary" onClick={() => setFilterOpen(false)}>Done</button>
          </div>
        </div>
      </FilterDrawer>
      <FilterDrawer open={filterOpen && !id && selected === "orders"} title="Order filters" onClose={() => setFilterOpen(false)} busy={busy}>
        <div className="drawer-filter-form">
          <Field label="Date range">
            <select aria-label="Date range" value={dates.preset} onChange={(event) => changeDates(event.target.value === "custom" ? { ...dates, preset: "custom" } : orderDateRange(event.target.value, session?.business.timezone || "Asia/Rangoon"))}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom range</option>
            </select>
          </Field>
          <Field label="From"><input type="date" value={dates.date_from} max={dates.date_to || undefined} onChange={(event) => changeDates({ ...dates, preset: "custom", date_from: event.target.value })} /></Field>
          <Field label="To"><input type="date" value={dates.date_to} min={dates.date_from || undefined} onChange={(event) => changeDates({ ...dates, preset: "custom", date_to: event.target.value })} /></Field>
          {rangeError && <p role="alert">{rangeError}</p>}
          <Field label="Order status">
            <select aria-label="Order status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All order states</option>
              {Object.keys(nextStates).concat(["completed", "cancelled", "expired"]).map((state) => <option key={state} value={state}>{label(state)}</option>)}
            </select>
          </Field>
          <Field label="Payment status">
            <select aria-label="Payment status" value={payment} onChange={(event) => setPayment(event.target.value)}>
              <option value="">All payment states</option>
              {["unpaid", "proof_submitted", "paid", "refund_pending", "refunded"].map((state) => <option key={state} value={state}>{label(state)}</option>)}
            </select>
          </Field>
          <label className="shop-hours-enable"><input type="checkbox" checked={needsReview} onChange={e => setNeedsReview(e.target.checked)} />Customer requests needing review</label>
          <div className="drawer-filter-actions">
            <button type="button" onClick={() => { setSearch(""); setQ(""); setStatus(""); setPayment(""); setNeedsReview(false); changeDates(orderDateRange("all")); setFilterOpen(false); }}>Clear</button>
            <button type="button" className="primary" disabled={Boolean(rangeError)} onClick={() => setFilterOpen(false)}>Done</button>
          </div>
        </div>
      </FilterDrawer>
    </div>
  );
}
