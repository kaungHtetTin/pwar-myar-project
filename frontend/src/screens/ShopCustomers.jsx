import React, { useEffect, useState } from "react";
import { Ban, CheckCircle2, Eye, Filter, History, Search } from "lucide-react";
import { AppBarActions, AppBarSearch } from "../components/WorkspaceHeader";
import { Field, FilterDrawer, Modal } from "../components/common";
import { RowActions } from "../components/RowActions";
import { ShopOrdersTable } from "./ShopOrdersTable";

export function ShopCustomers({ refresh, timezone, onViewOrder, onViewCustomer }) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [account, setAccount] = useState("all");
  const [blockStatus, setBlockStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [filterOpen, setFilterOpen] = useState(false);
  const [customer, setCustomer] = useState(null);
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const date = (value) => new Date(`${value.replace(" ", "T")}Z`).toLocaleString(undefined, { timeZone: timezone });
  const filterCount = Number(account !== "all") + Number(sort !== "recent") + Number(blockStatus !== "all");
  const params = new URLSearchParams({ q, account, sort });
  if (blockStatus !== "all") params.set("block_status", blockStatus);
  return <>
    <AppBarSearch className="shop-product-search"><form onSubmit={(event) => { event.preventDefault(); setQ(search.trim()); }}>
      <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Customer name, phone or email" aria-label="Search shop customers" /></label>
    </form></AppBarSearch>
    <AppBarActions><button type="button" className="filter-drawer-trigger" aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => setFilterOpen(true)}><Filter size={16} /> Filters{filterCount > 0 && <span className="filter-count">{filterCount}</span>}</button></AppBarActions>
    <p className="shop-customer-description">Customers with completed shop purchases. Credit customers are managed separately in the main Customers menu.</p>
    <ShopOrdersTable path={`/shop-admin/customers?${params}`} refresh={refresh} tableLabel="Shop customers"
      columns={[{ label: "Customer", width: "34%" }, { label: "Account", width: "16%" }, { label: "Block status", width: "14%" }, { label: "Purchases", width: "10%" }, { label: "Last purchase", width: "20%" }, { label: "Actions", width: 88, className: "table-actions-cell" }]}
      render={(buyer) => <tr key={buyer.id}>
        <td><button type="button" className="shop-order-link" onClick={() => onViewCustomer?.(buyer.customer_key)}>{buyer.customer_name}</button>{buyer.phone && <small className="shop-cell-meta">{buyer.phone}</small>}{buyer.email && <small className="shop-cell-meta">{buyer.email}</small>}</td>
        <td>{buyer.account_type === "account" ? "Platform account" : "Guest"}</td>
        <td><span className={`status-badge shop-customer-block-status ${buyer.blocked ? "voided" : "completed"}`} role="img" aria-label={buyer.blocked ? "Blocked" : "Not blocked"} title={buyer.blocked ? "Blocked" : "Not blocked"}>{buyer.blocked ? <Ban size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}</span></td>
        <td>{buyer.purchase_count}</td><td>{date(buyer.last_purchase_at)}</td>
        <td className="table-actions-cell"><RowActions label={buyer.customer_name}><button type="button" onClick={() => onViewCustomer?.(buyer.customer_key)}><Eye size={15} /> View customer</button><button type="button" aria-haspopup="dialog" onClick={() => setCustomer(buyer)}><History size={15} /> View purchases</button></RowActions></td>
      </tr>} />
    <FilterDrawer open={filterOpen} title="Customer filters" onClose={() => setFilterOpen(false)}>
      <div className="drawer-filter-form">
      <Field label="Customer account"><select value={account} onChange={(event) => setAccount(event.target.value)}><option value="all">All customers</option><option value="guest">Guest</option><option value="account">Platform account</option></select></Field>
      <Field label="Block status"><select value={blockStatus} onChange={(event) => setBlockStatus(event.target.value)}><option value="all">All customers</option><option value="blocked">Blocked</option><option value="not_blocked">Not blocked</option></select></Field>
      <Field label="Sort customers"><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Latest purchase first</option><option value="name">Name: A to Z</option><option value="purchases">Most purchases first</option></select></Field>
      <div className="drawer-filter-actions"><button type="button" onClick={() => { setAccount("all"); setBlockStatus("all"); setSort("recent"); setSearch(""); setQ(""); setFilterOpen(false); }}>Clear</button><button type="button" className="primary" onClick={() => setFilterOpen(false)}>Apply Filter</button></div>
      </div>
    </FilterDrawer>
    <Modal open={Boolean(customer)} title="Customer purchases" subtitle={customer?.customer_name || ""} size="medium" onClose={() => setCustomer(null)} footer={<button type="button" onClick={() => setCustomer(null)}>Close</button>}>
      {customer && <ShopOrdersTable path={`/shop-admin/customers/${encodeURIComponent(customer.customer_key)}/orders`} refresh={refresh} tableLabel="Customer purchases"
        columns={[{ label: "Order", width: "40%" }, { label: "Purchased at", width: "35%" }, { label: "Total", width: "25%", className: "shop-money-cell" }]}
        render={(order) => <tr key={order.id}><td><button type="button" className="shop-order-link" onClick={() => { setCustomer(null); onViewOrder(order.id); }}>{order.reference}</button></td><td>{date(order.created_at)}</td><td className="shop-money-cell">{Number(order.total).toLocaleString()} {order.currency}</td></tr>} />}
    </Modal>
  </>;
}
