import { ProfileAvatar } from '../components/ProfileAvatar';
import React, { useEffect, useState } from "react";
import { Ban, BarChart3, CheckCircle2, Clock, Filter, Mail, MapPin, Phone, Search, ShoppingBag, User, UserPlus, XCircle } from "lucide-react";
import { request } from "../api";
import { dateRangeError } from "../dateRanges";
import { AppBarActions, AppBarSearch } from "../components/WorkspaceHeader";
import { Field, FilterDrawer, Modal } from "../components/common";
import { emitDataChange } from "../dataEvents";
import { ShopOrdersTable } from "./ShopOrdersTable";
import { ShopCustomerChat } from "./ShopCustomerChat";

const title = (value) => value.replaceAll("_", " ");
const tone = (value) => ["completed", "paid", "refunded"].includes(value) ? "completed" : ["cancelled", "expired"].includes(value) ? "voided" : "warn";
export function ShopCustomerDetail({ customerKey, refresh, timezone, onViewOrder, canBlock = false, canAddCredit = false, canChat = false }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [dates, setDates] = useState({ date_from: "", date_to: "" });
  const [appliedDates, setAppliedDates] = useState({ date_from: "", date_to: "" });
  const rangeError = dateRangeError(dates.date_from, dates.date_to);
  const changeDates = (next) => {
    setDates(next);
    if (!dateRangeError(next.date_from, next.date_to)) setAppliedDates(next);
  };
  const filterCount = Number(Boolean(status)) + Number(Boolean(appliedDates.date_from || appliedDates.date_to));
  const historyParams = new URLSearchParams({ q, status });
  Object.entries(appliedDates).forEach(([key, value]) => { if (value) historyParams.set(key, value); });
  const path = `/shop-admin/customers/${encodeURIComponent(customerKey)}`;
  useEffect(() => {
    let active = true;
    setState({ loading: true, data: null, error: "" });
    request(path).then((data) => { if (active) setState({ loading: false, data, error: "" }); })
      .catch((error) => { if (active) setState({ loading: false, data: null, error: error.message }); });
    return () => { active = false; };
  }, [path, refresh, retry]);
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const date = (value) => value ? new Date(`${value.replace(" ", "T")}Z`).toLocaleString(undefined, { timeZone: timezone }) : "—";
  if (state.loading) return <p role="status">Loading customer…</p>;
  if (state.error) return <p role="alert">{state.error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>;
  const { customer, report } = state.data;
  const openAction = (value) => { setActionError(""); setAction(value); };
  const submitAction = async () => {
    setActionBusy(true); setActionError("");
    try {
      const result = await request(`${path}/${action === "block" ? "block" : "credit-contact"}`, action === "block"
        ? { method: "PUT", body: JSON.stringify({ blocked: !customer.blocked }) } : { method: "POST" });
      setState((current) => ({ ...current, data: { ...current.data, customer: result.customer } }));
      if (action === "credit") emitDataChange(["customers"], "shop");
      setAction(null);
    } catch (error) { setActionError(error.message); }
    finally { setActionBusy(false); }
  };
  const initials = (customer.customer_name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <div className="shop-customer-detail">
    {canChat && customer.account_type === "account" && <ShopCustomerChat key={customerKey} customer={customer} customerKey={customerKey} />}
    <AppBarSearch className="shop-customer-search"><form onSubmit={(event) => { event.preventDefault(); setQ(search.trim()); }}>
      <label><Search size={16} /><input aria-label="Search customer order history" placeholder="Order reference" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    </form></AppBarSearch>
    <AppBarActions>
      {canBlock && <button type="button" className={customer.blocked ? "" : "danger"} aria-label={customer.blocked ? "Unblock customer" : "Block customer"} title={customer.blocked ? "Unblock customer" : "Block customer"} aria-haspopup="dialog" onClick={() => openAction("block")}><Ban size={16} />{customer.blocked ? "Unblock customer" : "Block customer"}</button>}
      {canAddCredit && <button type="button" disabled={Boolean(customer.credit_customer_id)} aria-label={customer.credit_customer_id ? "Added to credit customers" : "Add to credit customers"} title={customer.credit_customer_id ? "Added to credit customers" : "Add to credit customers"} aria-haspopup="dialog" onClick={() => openAction("credit")}><UserPlus size={16} />{customer.credit_customer_id ? "Added to credit customers" : "Add to credit customers"}</button>}
      <button type="button" className="filter-drawer-trigger" aria-label={filterCount ? `Filters, ${filterCount} active` : "Filters"} title="Filters" aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => setFilterOpen(true)}><Filter size={16} /> Filters{filterCount > 0 && <span className="filter-count">{filterCount}</span>}</button>
    </AppBarActions>
    <section className="panel shop-customer-profile" aria-label="Shop customer details">
      <div className="shop-customer-identity"><div className="shop-customer-avatar" aria-hidden="true"><ProfileAvatar url={customer.avatar_url}>{initials}</ProfileAvatar></div><h2>{customer.customer_name}</h2><span className="status-badge shop-status-neutral">{customer.account_type === "account" ? "Platform account" : "Guest"}</span></div>
      {customer.blocked && <p className="shop-customer-blocked"><span className="status-badge voided">Blocked</span></p>}
      <section className="shop-customer-spending" aria-label="Customer spending report"><h3>Spending report</h3>
        {report.currencies.map((row) => <div className="shop-customer-currency" key={row.currency}><span className="shop-customer-currency-label">{row.currency}</span><dl>{[["Completed spending", row.completed_spend], ["Average purchase", row.average_purchase], ["Refunded", row.refunded], ["Refund pending", row.refund_pending]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} {row.currency}</dd></div>)}</dl></div>)}
        <p className="shop-customer-description">All-time totals by currency. Completed spending excludes cancelled and expired orders.</p>
      </section>
    </section>
    <div className="shop-customer-main">
    <div className="shop-customer-overview">
      <section className="panel shop-customer-contact" aria-label="Customer contact information"><h2><User size={19} />Contact</h2>
        <dl>{[["Phone", customer.phone, Phone], ["Email", customer.email, Mail], ["Address", customer.address, MapPin]].map(([label, value, Icon]) => <div key={label}><Icon size={18} aria-hidden="true" /><div><dt>{label}</dt><dd>{value || "—"}</dd></div></div>)}</dl>
      </section>
      <section aria-label="Customer purchase summary" className="panel shop-customer-summary"><h2><BarChart3 size={19} />Overview</h2><div className="shop-customer-metrics">
        {[["Total orders", report.total_orders, ShoppingBag], ["Completed purchases", report.completed_orders, CheckCircle2], ["Active orders", report.active_orders, Clock], ["Cancelled orders", report.cancelled_orders, XCircle]].map(([label, value, Icon]) => <article key={label}><div className="shop-customer-metric-icon"><Icon size={19} /></div><div><strong>{Number(value).toLocaleString()}</strong><span>{label}</span></div></article>)}
      </div><div className="shop-customer-purchase-dates"><div><strong>First purchase</strong><span>{date(report.first_purchase_at)}</span></div><div><strong>Last purchase</strong><span>{date(report.last_purchase_at)}</span></div>{report.expired_orders > 0 && <div><strong>Expired orders</strong><span>{report.expired_orders}</span></div>}</div></section>
    </div>
    <section aria-label="Customer order history"><h2>Order history</h2>
      <ShopOrdersTable path={`${path}/history?${historyParams}`} refresh={refresh} tableLabel="Customer order history" backgroundRefresh
        columns={[{ label: "Order", width: "27%" }, { label: "Date", width: "23%" }, { label: "Fulfillment", width: "12%" }, { label: "Order status", width: "14%" }, { label: "Payment status", width: "14%" }, { label: "Total", width: "10%", className: "shop-money-cell" }]}
        render={(order) => <tr key={order.id}><td><button type="button" className="shop-order-link" onClick={() => onViewOrder(order.id)}>{order.reference}</button></td><td>{date(order.created_at)}</td><td>{title(order.fulfillment)}</td><td><span className={`status-badge ${tone(order.status)}`}>{title(order.status)}</span></td><td><span className={`status-badge ${order.payment_status === "unpaid" && order.status === "cancelled" ? "shop-status-neutral" : tone(order.payment_status)}`}>{title(order.payment_status)}</span></td><td className="shop-money-cell">{Number(order.total).toLocaleString()} {order.currency}</td></tr>} />
    </section>
    </div>
    <FilterDrawer open={filterOpen} title="Order history filters" onClose={() => setFilterOpen(false)}>
      <div className="drawer-filter-form">
      <Field label="From"><input type="date" value={dates.date_from} max={dates.date_to || undefined} onChange={(event) => changeDates({ ...dates, date_from: event.target.value })} /></Field>
      <Field label="To"><input type="date" value={dates.date_to} min={dates.date_from || undefined} onChange={(event) => changeDates({ ...dates, date_to: event.target.value })} /></Field>
      {rangeError && <p role="alert">{rangeError}</p>}
      <Field label="Order status"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All orders</option>{["pending", "accepted", "packing", "ready_for_pickup", "dispatched", "return_pending", "completed", "cancelled", "expired"].map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></Field>
      <div className="drawer-filter-actions"><button type="button" onClick={() => { setStatus(""); setSearch(""); setQ(""); changeDates({ date_from: "", date_to: "" }); setFilterOpen(false); }}>Clear</button><button type="button" className="primary" disabled={Boolean(rangeError)} onClick={() => setFilterOpen(false)}>Apply Filter</button></div>
      </div>
    </FilterDrawer>
    <Modal open={Boolean(action)} title={action === "block" ? (customer.blocked ? "Unblock customer" : "Block customer") : "Add to credit customers"} subtitle={customer.customer_name} size="small" busy={actionBusy} onClose={() => setAction(null)} footer={<>
      <button type="button" disabled={actionBusy} onClick={() => setAction(null)}>Cancel</button>
      <button type="button" disabled={actionBusy} className={action === "block" && !customer.blocked ? "danger-button" : "primary"} onClick={submitAction}>{actionBusy ? "Saving…" : action === "block" ? (customer.blocked ? "Unblock customer" : "Block customer") : "Add to credit customers"}</button>
    </>}>
      {actionError && <p role="alert">{actionError}</p>}
      <p>{action === "block" ? customer.blocked ? "Allow this customer to place new orders at this shop again." : "Prevent new orders at this shop for this customer account or checkout phone. Existing orders and their history remain available." : "Add this buyer to the main POS Customers list using their name, phone, email and address. An existing contact with the same phone or email will be reused. Shop orders do not create a credit balance."}</p>
    </Modal>
  </div>;
}
