import { MobileFilterResetButton } from '../components/MobilePrimitives';
import { AccountPaymentForm } from '../components/AccountPaymentForm';
import { Button, IconButton, Input, SearchInput, Select, Textarea } from '../components/Controls';
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ModuleLocalizationBoundary } from "../localization/ModuleLocalizationBoundary";
import { CUSTOMER_MESSAGES, CUSTOMER_PATTERNS } from './customerLocale';
import { ArrowLeft, Check, ChevronRight, Edit3, Eye, MapPin, Mail, Download, Plus, Printer, ReceiptText, RefreshCw, Trash2, Phone, UsersRound, WalletCards } from 'lucide-react';
import { apiRequest } from "../api/client";
import {
  EndlessListFooter,
  MobileDeleteSheet,
  MobileField,
  MobileFilterPanel,
  MobileFilterToggle,
  MobileNotice,
  MobileSheet,
} from "../components/MobilePrimitives";
import { useEndlessList } from "../hooks/useEndlessList";
import { usePageRefresh } from "../navigation/pageRefresh";
import { money } from "../products/productUtils";
import {
  isNativeAndroidPrinting,
  printDocumentHtml,
  reserveBrowserPrintWindow,
} from "../utils/printing";
import {
  balanceState,
  customerInitials,
  blankCustomerForm,
  blankCustomerHistoryFilters,
  blankCustomerPaymentForm,
  cleanPaymentMethods,
  customerHistoryPath,
  customerPageFromPath,
  customerPayload,
  customerStatementHtml,
  customerStatementPath,
  paymentPayload,
} from "./customerUtils";
import { CustomerReferenceHeader, CustomerReferenceSale, CustomerReferencePayment, CustomerBalanceChoices } from './CustomerReferenceParts';
import { CsvExportButton } from "../components/CsvExportButton";
import { csvFilename, exportFilteredCsv } from "../utils/csvExport";

const PAGE_SIZE = 20;

function fieldErrorsFrom(error) {
  return Object.fromEntries(
    Object.entries(error?.payload?.errors || {}).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ]),
  );
}

export function CustomerForm({
  editing,
  form,
  errors,
  saving,
  onChange,
  onCancel,
  onSubmit,
  cancelLabel = "Cancel",
  submitLabel,
}) {
  return <form className={`customer-mobile-form customer-reference-contact-form ${editing ? 'is-editing' : 'is-creating'}`} onSubmit={onSubmit} noValidate>
    {errors.general && <div className="mobile-notice mobile-notice--error" role="alert">{errors.general}</div>}
    <fieldset disabled={saving}>
      <section className="customer-reference-panel"><h2>{editing ? 'Customer information' : 'Contact information'}</h2>
        <MobileField id="customer-name" label={editing ? 'Full name' : <>Name <em className="customer-required-mark">*</em></>} error={errors.name}><Input id="customer-name" aria-label="Customer name" autoFocus required value={form.name} onChange={event => onChange('name', event.target.value)} placeholder="Enter customer name" aria-describedby={errors.name ? 'customer-name-error' : undefined} /></MobileField>
        <MobileField id="customer-phone" label={editing ? 'Phone number' : 'Phone'} error={errors.phone}><Input id="customer-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={event => onChange('phone', event.target.value)} placeholder="Enter phone number" aria-describedby={errors.phone ? 'customer-phone-error' : undefined} /></MobileField>
        <MobileField id="customer-email" label={editing ? "Email address" : "Email (optional)"} error={errors.email}><Input id="customer-email" aria-label="Email (optional)" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={form.email} onChange={event => onChange('email', event.target.value)} placeholder="Enter email address" aria-describedby={errors.email ? 'customer-email-error' : undefined} /></MobileField>
      </section>
      <section className="customer-reference-panel"><h2>{editing ? 'Address' : 'Additional details'}</h2>
        <MobileField id="customer-address" label={editing ? 'Address' : 'Address (optional)'} error={errors.address}><Textarea id="customer-address" rows="3" value={form.address} onChange={event => onChange('address', event.target.value)} placeholder="Enter address" aria-describedby={errors.address ? 'customer-address-error' : undefined} /></MobileField>{!editing && <small className="customer-character-count">{form.address.length} characters</small>}
        {!editing && <MobileField id="customer-note" label="Note (optional)" error={errors.note}><Textarea id="customer-note" rows="3" value={form.note} onChange={event => onChange('note', event.target.value)} placeholder="Add a note about this customer" aria-describedby={errors.note ? 'customer-note-error' : undefined} /><small className="customer-character-count">{form.note.length} characters</small></MobileField>}
      </section>
      {editing && <section className="customer-reference-panel"><h2>Additional information</h2><MobileField id="customer-note" label="Note (optional)" error={errors.note}><Textarea id="customer-note" rows="3" value={form.note} onChange={event => onChange('note', event.target.value)} placeholder="Add a note about this customer" aria-describedby={errors.note ? 'customer-note-error' : undefined} /><small className="customer-character-count">{form.note.length} characters</small></MobileField></section>}
    </fieldset>
    <div className="mobile-form-actions customer-reference-form-actions"><Button variant="secondary" className="mobile-secondary" type="button" disabled={saving} onClick={onCancel}>{cancelLabel}</Button><Button variant="primary" className="mobile-primary" type="submit" disabled={saving}>{saving && <RefreshCw className="spin" size={17} />}{saving ? 'Saving\u2026' : submitLabel || (editing ? 'Save changes' : 'Save customer')}</Button></div>
  </form>;
}

export function CustomersScreen(props) {
  return (
    <ModuleLocalizationBoundary
      messages={CUSTOMER_MESSAGES}
      patterns={CUSTOMER_PATTERNS}
    >
      <CustomersScreenContent {...props} />
    </ModuleLocalizationBoundary>
  );
}


function CustomerSkeleton() {
  return (
    <div
      className="customer-mobile-card-list"
      role="status"
      aria-label="Loading customers"
    >
      {[1, 2, 3].map((key) => (
        <div
          className="customer-mobile-card customer-mobile-card--skeleton"
          key={key}
        >
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function CustomersScreenContent({ pathname, onNavigate, session }) {
  const currency = session?.business?.currency || 'Ks';
  const [localPathname, setLocalPathname] = useState("/customers");
  const currentPathname = pathname || localPathname;
  const page = useMemo(
    () => customerPageFromPath(currentPathname),
    [currentPathname],
  );
  const [indexFilters, setIndexFilters] = useState({ account_status: 'all', sale_activity: 'all' });
  const [indexFilterDraft, setIndexFilterDraft] = useState({ account_status: 'all', sale_activity: 'all' });
  const [historySearch, setHistorySearch] = useState('');
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(blankCustomerForm());
  const [formErrors, setFormErrors] = useState({});
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [paymentForm, setPaymentForm] = useState(blankCustomerPaymentForm());
  const [paymentErrors, setPaymentErrors] = useState({});
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [notice, setNotice] = useState(null);
  const [draftFilters, setDraftFilters] = useState(
    blankCustomerHistoryFilters(),
  );
  const [appliedFilters, setAppliedFilters] = useState(
    blankCustomerHistoryFilters(),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState("sales");
  const [deleteCustomer, setDeleteCustomer] = useState(null);
  const [actionCustomer, setActionCustomer] = useState(null);
  const [actionPayment, setActionPayment] = useState(null);
  const [deletePayment, setDeletePayment] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false), [exportBusy, setExportBusy] = useState(false), [exportError, setExportError] = useState('');
  const exporting = useRef(false);

  const paymentMethods = useMemo(() => {
    const methods = cleanPaymentMethods(settings);
    const current = String(paymentForm.payment_method || "").trim();
    return current && !methods.includes(current)
      ? [...methods, current]
      : methods;
  }, [paymentForm.payment_method, settings]);

  function navigateTo(path, options = {}) {
    if (onNavigate) onNavigate(path, options);
    else setLocalPathname(path);
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => { const timer = window.setTimeout(() => setAppliedFilters(current => (current.q || '') === historySearch.trim() ? current : ({ ...current, q: historySearch.trim() })), 250); return () => window.clearTimeout(timer); }, [historySearch]);

  const loadCustomerPage = useCallback(
    async ({ limit, offset, signal }) => {
      const params = new URLSearchParams({
        with_total: "true",
        limit: String(limit),
        offset: String(offset),
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (indexFilters.account_status !== "all") params.set("account_status", indexFilters.account_status);
      if (indexFilters.sale_activity !== "all") params.set("sale_activity", indexFilters.sale_activity);
      const response = await apiRequest(`/customers?${params}`, { signal });
      return response;
    },
    [debouncedSearch, indexFilters],
  );
  const customerList = useEndlessList({
    loadPage: loadCustomerPage,
    queryKey: JSON.stringify([debouncedSearch, indexFilters]),
    pageSize: PAGE_SIZE,
    enabled: page.kind === "list",
  });

  const loadDetail = useCallback(async (customerId, signal) => {
    const response = await apiRequest(
      `/customers/${customerId}/detail`,
      signal ? { signal } : undefined,
    );
    setDetail(response);
    return response;
  }, []);

  const loadSalesPage = useCallback(
    ({ limit, offset, signal }) =>
      apiRequest(
        customerHistoryPath(
          page.customerId,
          "sales",
          appliedFilters,
          limit,
          offset,
        ),
        { signal },
      ),
    [appliedFilters, page.customerId],
  );
  const salesList = useEndlessList({
    loadPage: loadSalesPage,
    queryKey: JSON.stringify([page.customerId, appliedFilters]),
    pageSize: PAGE_SIZE,
    enabled: page.kind === "detail" && historyTab === "sales",
  });
  const loadPaymentsPage = useCallback(
    ({ limit, offset, signal }) =>
      apiRequest(
        customerHistoryPath(
          page.customerId,
          "payments",
          appliedFilters,
          limit,
          offset,
        ),
        { signal },
      ),
    [appliedFilters, page.customerId],
  );
  const paymentsList = useEndlessList({
    loadPage: loadPaymentsPage,
    queryKey: JSON.stringify([page.customerId, appliedFilters]),
    pageSize: PAGE_SIZE,
    enabled: page.kind === "detail" && historyTab === "payments",
  });

  function exportCustomers() {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (indexFilters.account_status !== "all") params.set("account_status", indexFilters.account_status);
    if (indexFilters.sale_activity !== "all") params.set("sale_activity", indexFilters.sale_activity);
    return exportFilteredCsv({
      path: `/customers${params.toString() ? `?${params}` : ""}`,
      filename: csvFilename("customers"),
      columns: [
        { label: "Name", value: (row) => row.name },
        { label: "Phone", value: (row) => row.phone || "" },
        { label: "Email", value: (row) => row.email || "" },
        { label: "Address", value: (row) => row.address || "" },
        { label: "Balance", value: (row) => row.balance || 0 },
        { label: "Note", value: (row) => row.note || "" },
      ],
    });
  }

  function exportCustomerHistory(kind) {
    const raw = customerHistoryPath(
      page.customerId,
      kind,
      appliedFilters,
      PAGE_SIZE,
      0,
    );
    const url = new URL(raw, window.location.origin);
    url.searchParams.delete("limit");
    url.searchParams.delete("offset");
    url.searchParams.delete("with_total");
    const sales = kind === "sales";
    return exportFilteredCsv({
      path: `${url.pathname}${url.search}`,
      filename: csvFilename(
        `customer-${page.customerId}-${sales ? "credit-sales" : "payments"}`,
      ),
      columns: sales
        ? [
            { label: "Date", value: (row) => row.created_at },
            { label: "Receipt", value: (row) => row.receipt_no },
            { label: "Total", value: (row) => row.total },
            { label: "Paid", value: (row) => row.paid_amount },
            { label: "Credit", value: (row) => row.credit_amount },
            { label: "Payment Type", value: (row) => row.payment_type || "" },
            {
              label: "Payment Method",
              value: (row) => row.payment_method || "",
            },
            { label: "Status", value: (row) => row.status || "" },
          ]
        : [
            { label: "Date", value: (row) => row.created_at },
            {
              label: "Direction",
              value: (row) =>
                row.direction === "shop_to_customer"
                  ? "Shop pays customer"
                  : "Customer pays shop",
            },
            { label: "Method", value: (row) => row.payment_method || "Cash" },
            { label: "Amount", value: (row) => row.amount },
            { label: "Note", value: (row) => row.note || "" },
            { label: "Status", value: (row) => row.status || "" },
          ],
    });
  }

  async function runCustomerExport(kind) {
    if (exporting.current) return;
    exporting.current = true; setExportBusy(true); setExportError('');
    try { const count = await exportCustomerHistory(kind); setExportOpen(false); setNotice({type:'success',text:`Exported ${count} matching record${count === 1 ? '' : 's'}.`}); }
    catch (error) { setExportError(error.message); }
    finally { exporting.current = false; setExportBusy(false); }
  }

  const loadSettings = useCallback(async (signal) => {
    const response = await apiRequest(
      "/settings",
      signal ? { signal } : undefined,
    );
    setSettings(response || {});
    return response;
  }, []);

  useEffect(() => {
    setRouteError("");
    if (page.kind === "list") {
      setRouteLoading(false);
      return undefined;
    }
    if (page.kind === "new") {
      setEditingCustomerId(null);
      setForm(blankCustomerForm());
      setFormErrors({});
      setRouteLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setRouteLoading(true);
    const detailRequest = loadDetail(page.customerId, controller.signal);
    let routeRequest = detailRequest;
    if (page.kind === "edit") {
      routeRequest = detailRequest.then((response) => {
        const customer = response.customer;
        setEditingCustomerId(customer.id);
        setForm({
          name: customer.name || "",
          phone: customer.phone || "",
          email: customer.email || "",
          address: customer.address || "",
          note: customer.note || "",
        });
        setFormErrors({});
      });
    } else if (page.kind === "payment-new") {
      setPaymentForm(blankCustomerPaymentForm());
      setPaymentErrors({});
      routeRequest = Promise.all([
        detailRequest,
        loadSettings(controller.signal),
      ]);
    } else if (page.kind === "payment-edit") {
      routeRequest = Promise.all([
        detailRequest,
        loadSettings(controller.signal),
        apiRequest(`/customer-payments/${page.paymentId}`, {
          signal: controller.signal,
        }),
      ]).then(([, , payment]) => {
        if (Number(payment.customer_id) !== page.customerId)
          throw new Error("Payment does not belong to this customer.");
        setPaymentForm({
          id: payment.id,
          direction: payment.direction || "customer_to_shop",
          payment_method: payment.payment_method || "Cash",
          amount: payment.amount,
          note: payment.note || "",
          created_at: payment.created_at,
          created_by_name: payment.created_by_name,
        });
        setPaymentErrors({});
      });
    }
    routeRequest
      .catch((error) => {
        if (!controller.signal.aborted)
          setRouteError(error.message || "Cannot load this customer.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });
    return () => controller.abort();
  }, [loadDetail, loadSettings, page.customerId, page.kind, page.paymentId]);

  usePageRefresh(() => {
    if (page.kind === "list") return customerList.reload();
    if (page.kind === "detail")
      return Promise.all([
        loadDetail(page.customerId),
        historyTab === "sales" ? salesList.reload() : paymentsList.reload(),
      ]);
    if (page.kind === "edit" || page.kind.startsWith("payment-"))
      return loadDetail(page.customerId);
    return Promise.resolve();
  });

  async function saveCustomer(event) {
    event.preventDefault();
    const payload = customerPayload(form);
    if (!payload.name) {
      setFormErrors({ name: "Customer name is required." });
      return;
    }
    setSaving(true);
    setFormErrors({});
    try {
      const customer = await apiRequest(
        editingCustomerId ? `/customers/${editingCustomerId}` : "/customers",
        {
          method: editingCustomerId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setNotice({
        type: "success",
        text: editingCustomerId ? "Customer updated." : "Customer created.",
      });
      if (!editingCustomerId) setForm(blankCustomerForm());
      navigateTo(`/customers/${customer.id}`, { replace: true });
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      setFormErrors(
        Object.keys(errors).length ? errors : { general: error.message },
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePayment(event) {
    event.preventDefault();
    const payload = paymentPayload(paymentForm);
    if (!Number.isInteger(payload.amount) || payload.amount <= 0) {
      setPaymentErrors({
        amount: "Payment amount must be a whole number greater than zero.",
      });
      return;
    }
    setSaving(true);
    setPaymentErrors({});
    try {
      if (paymentForm.id)
        await apiRequest(`/customer-payments/${paymentForm.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...payload, customer_id: page.customerId }),
        });
      else
        await apiRequest(`/customers/${page.customerId}/payments`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      setNotice({
        type: "success",
        text: paymentForm.id ? "Payment updated." : "Payment saved.",
      });
      if (!paymentForm.id) setPaymentForm(blankCustomerPaymentForm());
      navigateTo(`/customers/${page.customerId}`, { replace: true });
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      setPaymentErrors(
        Object.keys(errors).length ? errors : { general: error.message },
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmCustomerDelete() {
    if (!deleteCustomer) return;
    setDeleting(true);
    try {
      await apiRequest(`/customers/${deleteCustomer.id}`, { method: "DELETE" });
      setDeleteCustomer(null);
      setNotice({
        type: "success",
        text: "Customer deleted. Sales and payment history were preserved.",
      });
      navigateTo("/customers", { replace: true });
      await customerList.reload();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setDeleting(false);
    }
  }

  async function confirmPaymentDelete() {
    if (!deletePayment) return;
    setDeleting(true);
    try {
      await apiRequest(`/customer-payments/${deletePayment.id}`, {
        method: "DELETE",
      });
      setDeletePayment(null);
      setNotice({
        type: "success",
        text: "Payment deleted and customer balance recalculated.",
      });
      await Promise.all([loadDetail(page.customerId), paymentsList.reload()]);
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setDeleting(false);
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    if (
      draftFilters.start &&
      draftFilters.end &&
      draftFilters.start > draftFilters.end
    ) {
      setNotice({
        type: "error",
        text: "The start date must be before the end date.",
      });
      return;
    }
    setAppliedFilters({ ...draftFilters, q: historySearch.trim() });
    setFiltersOpen(false);
  }

  function clearFilters() {
    const next = blankCustomerHistoryFilters();
    setHistorySearch("");
    setDraftFilters(next);
    setAppliedFilters(next);
    setFiltersOpen(false);
  }

  async function printStatement() {
    const printWindow = reserveBrowserPrintWindow(
      "_blank",
      "width=860,height=760",
    );
    if (!isNativeAndroidPrinting() && !printWindow) {
      setNotice({
        type: "error",
        text: "Cannot open statement preview. Please allow pop-ups.",
      });
      return;
    }
    setPrinting(true);
    try {
      const [statement, shopSettings] = await Promise.all([
        apiRequest(customerStatementPath(page.customerId, appliedFilters)),
        apiRequest("/settings"),
      ]);
      const printed = await printDocumentHtml({
        title: `${statement.customer?.name || detail.customer.name} statement`,
        documentHtml: customerStatementHtml(statement, shopSettings),
        popup: printWindow,
      });
      if (!printed)
        setNotice({
          type: "error",
          text: "Cannot open statement preview. Please allow pop-ups.",
        });
    } catch (error) {
      printWindow?.close();
      setNotice({
        type: "error",
        text: `Cannot print statement. ${error.message}`,
      });
    } finally {
      setPrinting(false);
    }
  }

  const routeNeedsData = [
    "edit",
    "detail",
    "payment-new",
    "payment-edit",
  ].includes(page.kind);
  if (routeNeedsData && routeError)
    return (
      <main className="sale-retail-page customer-reference-page customer-page">
        <Button variant="plain"
          className="submission-back"
          type="button"
          onClick={() => navigateTo(page.kind === "detail" ? "/customers" : `/customers/${page.customerId}`, { replace: true })}
        >
          <ArrowLeft size={19} />
          {page.kind === "detail" ? "Back to customers" : "Back to customer"}
        </Button>
        <div className="endless-first-error">
          <p>{routeError}</p>
        </div>
      </main>
    );
  if (
    routeNeedsData &&
    (routeLoading ||
      !detail?.customer ||
      detail.customer.id !== page.customerId)
  )
    return (
      <main className="sale-retail-page customer-reference-page customer-page">
        <p className="mobile-inline-loading" role="status">
          <RefreshCw className="spin" size={18} />
          Loading customer…
        </p>
      </main>
    );

  if (page.kind === "new" || page.kind === "edit") {
    return (
      <main className="sale-retail-page customer-reference-page customer-page customer-form-page">
        <CustomerReferenceHeader title={editingCustomerId ? 'Edit customer' : 'New customer'} onBack={() => navigateTo(editingCustomerId ? `/customers/${editingCustomerId}` : '/customers', { back: true })} />
        <MobileNotice notice={notice} onClose={() => setNotice(null)} />
        <CustomerForm
          editing={Boolean(editingCustomerId)}
          form={form}
          errors={formErrors}
          saving={saving}
          onChange={(field, value) => {
            setForm((current) => ({ ...current, [field]: value }));
            setFormErrors((current) => ({ ...current, [field]: "" }));
          }}
          onCancel={() =>
            navigateTo(
              editingCustomerId
                ? `/customers/${editingCustomerId}`
                : "/customers",
              { replace: true },
            )
          }
          onSubmit={saveCustomer}
        />
      </main>
    );
  }

  if (page.kind === "payment-new" || page.kind === "payment-edit") {
    return (
      <main className="sale-retail-page customer-reference-page customer-page customer-form-page">
        <CustomerReferenceHeader title={paymentForm.id ? 'Edit payment' : 'New payment'} backPath={`/customers/${page.customerId}`} onBack={() => navigateTo(`/customers/${page.customerId}`, { back: true })} />
        <MobileNotice notice={notice} onClose={() => setNotice(null)} />
        <AccountPaymentForm
          currency={currency}
          editing={Boolean(paymentForm.id)}
          account={detail.customer}
          form={paymentForm}
          errors={paymentErrors}
          methods={paymentMethods}
          saving={saving}
          onChange={(field, value) => {
            setPaymentForm((current) => ({ ...current, [field]: value }));
            setPaymentErrors((current) => ({ ...current, [field]: "" }));
          }}
          onCancel={() =>
            navigateTo(`/customers/${page.customerId}`, { back: true })
          }
          onSubmit={savePayment}
        />
      </main>
    );
  }

  if (page.kind === "detail") {
    const customer = detail.customer;
    const balance = balanceState(detail.summary?.balance ?? customer.balance);
    const activeList = historyTab === "sales" ? salesList : paymentsList;
    const historyCount = activeList.total ?? activeList.items.length;
    return (
      <main className="sale-retail-page customer-reference-page customer-page customer-detail-page">
        <CustomerReferenceHeader actions={<><IconButton variant="ghost" type="button" aria-label="Statement" title="Print statement" busy={printing} onClick={printStatement}><Printer size={20} aria-hidden="true"/></IconButton><IconButton variant="ghost" type="button" aria-label="Export CSV" title="Export CSV" onClick={()=>{setExportError('');setExportOpen(true);}}><Download size={20} aria-hidden="true"/></IconButton></>} title={customer.name} onBack={() => navigateTo('/customers', { back: true })} />
        <MobileNotice notice={notice} onClose={() => setNotice(null)} />
        <MobileSheet className="mobile-sheet--action-menu" open={exportOpen} title="Export customer data" description={customer.name} onClose={()=>{if(!exporting.current)setExportOpen(false);}}>{exportBusy&&<p role="status">Exporting...</p>}{exportError&&<p role="alert" className="mobile-notice mobile-notice--error">{exportError}</p>}<div className="mobile-action-menu">{[['sales','Credit sales CSV',ReceiptText],['payments','Payment records CSV',WalletCards]].map(([kind,label,Icon])=><Button variant="plain" type="button" key={kind} disabled={exportBusy} onClick={()=>runCustomerExport(kind)}><Icon size={19} aria-hidden="true"/><span>{label}</span><Download size={18} aria-hidden="true"/></Button>)}</div></MobileSheet>
        <section className="customer-profile-card" aria-label="Customer profile">
          <span className="customer-reference-avatar">{customerInitials(customer.name)}</span><div className="customer-profile-identity"><strong data-no-localize>{customer.name}</strong><span><Phone size={14} /><span data-no-localize>{customer.phone || 'No phone number'}</span></span>{customer.email && <span><Mail size={14} /><span data-no-localize>{customer.email}</span></span>}{customer.address && <span><MapPin size={14} /><span><span className="sr-only">Address </span><span data-no-localize>{customer.address}</span></span></span>}{customer.note && <span className="customer-profile-note"><span>Note</span><span data-no-localize>{customer.note}</span></span>}</div>
        </section>
        <section className="customer-account-card" aria-label="Customer account"><section className="customer-detail-summary">
          <span className={`customer-balance-card balance-${balance.key}`}><small>{balance.key === 'receivable' ? 'Customer owes shop' : balance.key === 'payable' ? 'Shop owes customer' : 'Settled'}</small><strong>{money(balance.amount, currency)}</strong></span>
          <span><small>Total sales</small><strong>{money(detail.summary?.total_sales, currency)}</strong></span><span><small>Total paid</small><strong>{money(detail.summary?.total_sales !== undefined ? Number(detail.summary.total_sales) - Number(detail.summary.credit_total || 0) + Number(detail.summary.paid_total || 0) : detail.summary?.paid_total, currency)}</strong></span>
          {Number(detail.summary?.payout_total) > 0 && <span><small>Shop payouts</small><strong>{money(detail.summary.payout_total, currency)}</strong></span>}
        </section>
        <div className="customer-detail-primary-actions"><Button variant="primary" className="mobile-primary" type="button" aria-label="New payment" title="Add payment" onClick={() => navigateTo(`/customers/${customer.id}/payments/new`)}><Plus size={16} aria-hidden="true"/>Payment</Button><Button variant="secondary" className="mobile-secondary" type="button" aria-label="Edit customer" onClick={() => navigateTo(`/customers/${customer.id}/edit`)}><Edit3 size={16} aria-hidden="true"/>Edit</Button><Button variant="danger-ghost" className="customer-delete-action" type="button" aria-label="Delete customer" onClick={()=>setDeleteCustomer(customer)}><Trash2 size={16} aria-hidden="true"/>Delete</Button></div></section>
        <nav className="transaction-tabs customer-detail-tabs" aria-label="Customer detail sections"><Button variant="plain" type="button" role="tab" aria-selected={historyTab === 'sales'} className={historyTab === 'sales' ? 'is-active' : ''} onClick={() => setHistoryTab('sales')}>Credit sales</Button><Button variant="plain" type="button" role="tab" aria-selected={historyTab === 'payments'} className={historyTab === 'payments' ? 'is-active' : ''} onClick={() => setHistoryTab('payments')}>Payment records</Button></nav>
        <section className="customer-history-controls">
          <div className="customer-reference-history-toolbar" role="group" aria-label="Customer history actions">{historyTab === 'sales' && <SearchInput className="mobile-search" aria-label="Search customer sales" placeholder="Search sales (invoice no. or method)" value={historySearch} onChange={event => setHistorySearch(event.target.value)} type="text" />}<MobileFilterToggle open={filtersOpen} onToggle={() => setFiltersOpen(open => !open)} controls="customer-history-filters" count={[appliedFilters.start, appliedFilters.end].filter(Boolean).length} /></div>
          <div className="customer-reference-history-count">{historyCount} {historyTab === 'sales' ? historyCount === 1 ? 'sale' : 'sales' : historyCount === 1 ? 'payment' : 'payments'}{historyTab === 'sales' && <> · {salesList.hasMore ? 'Loaded total' : 'Total'} {money(salesList.items.reduce((sum, sale) => sum + Number(sale.total || 0), 0), currency)} · Due {money(salesList.items.reduce((sum, sale) => sum + Number(sale.credit_amount || 0), 0), currency)}</>}{historyTab === 'payments' && <> {'\u00b7'} {paymentsList.hasMore ? 'Loaded received' : 'Total received'} {money(paymentsList.items.filter(payment => payment.direction !== 'shop_to_customer').reduce((sum, payment) => sum + Number(payment.amount || 0), 0), currency)}</>}</div>
          <MobileFilterPanel onClose={() => setFiltersOpen(false)} open={filtersOpen} id="customer-history-filters" className="product-filter-panel customer-history-filters" onSubmit={applyFilters}>
              <MobileField id="customer-history-from" label="From">
                <Input
                  id="customer-history-from"
                  type="date"
                  value={draftFilters.start}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      start: event.target.value,
                    }))
                  }
                />
              </MobileField>
              <MobileField id="customer-history-to" label="To">
                <Input
                  id="customer-history-to"
                  type="date"
                  value={draftFilters.end}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      end: event.target.value,
                    }))
                  }
                />
              </MobileField>
              <div className="customer-history-filter-actions">
                <MobileFilterResetButton variant="secondary"
                  type="button"
                  onClick={clearFilters}
                >
                  Reset
                </MobileFilterResetButton>
                <Button variant="primary" className="mobile-primary" type="submit">
                  <Check size={18} />Apply filters
                </Button>
              </div>
          </MobileFilterPanel>
        </section>
        {activeList.initialLoading ? (
          <div className="customer-history-skeleton" role="status">
            <span />
            <span />
            <span />
          </div>
        ) : activeList.error && !activeList.items.length ? (
          <div className="endless-first-error">
            <p>Cannot load account history. {activeList.error}</p>
            <Button variant="plain" type="button" onClick={activeList.retry}>
              Try again
            </Button>
          </div>
        ) : historyTab === "sales" ? (
          salesList.items.length ? (
            <>
              <div className="customer-sales-list">
                {salesList.items.map((sale) => (
                  <CustomerReferenceSale key={sale.id} sale={sale} currency={currency} onOpen={() => navigateTo(`/sales/${sale.id}`)} />
                ))}
              </div>
              <EndlessListFooter
                list={salesList}
                count={salesList.items.length}
                noun="sales"
              />
            </>
          ) : (
            <div className="mobile-empty-state">
              <span>
                <ReceiptText size={28} />
              </span>
              <h2>No credit sales</h2>
              <p>No credit sales match the selected date range.</p>
            </div>
          )
        ) : paymentsList.items.length ? (
          <>
            <div className="customer-payment-list">
              {paymentsList.items.map((payment) => (
                <CustomerReferencePayment key={payment.id} payment={payment} currency={currency} onActions={() => setActionPayment(payment)} />
              ))}
            </div>
            <EndlessListFooter
              list={paymentsList}
              count={paymentsList.items.length}
              noun="payments"
            />
          </>
        ) : (
          <div className="mobile-empty-state">
            <span>
              <WalletCards size={28} />
            </span>
            <h2>No payments</h2>
            <p>No payments match the selected date range.</p>
            <Button variant="primary"
              className="mobile-primary"
              type="button"
              onClick={() =>
                navigateTo(`/customers/${customer.id}/payments/new`)
              }
            >
              <Plus size={17} />
              New payment
            </Button>
          </div>
        )}

        <MobileSheet
          className="mobile-sheet--action-menu"
          open={Boolean(actionPayment)}
          title="Payment actions"
          description={
            actionPayment
              ? `${money(actionPayment.amount)} · ${actionPayment.payment_method || "Cash"}`
              : ""
          }
          onClose={() => setActionPayment(null)}
        >
          <div className="mobile-action-menu">
            <Button variant="plain"
              type="button"
              aria-label={`Edit payment ${actionPayment?.id}`}
              onClick={() => {
                const payment = actionPayment;
                setActionPayment(null);
                navigateTo(
                  `/customers/${customer.id}/payments/${payment.id}/edit`,
                );
              }}
            >
              <Edit3 size={19} />
              <span>
                <strong>Edit payment</strong>
                <small>Update amount, method, direction or note</small>
              </span>
              <ChevronRight className="mobile-action-chevron" size={18} />
            </Button>
            <Button variant="danger-ghost"
              className="danger-action"
              type="button"
              aria-label={`Delete payment ${actionPayment?.id}`}
              onClick={() => {
                const payment = actionPayment;
                setActionPayment(null);
                setDeletePayment(payment);
              }}
            >
              <Trash2 size={19} />
              <span>
                <strong>Delete payment</strong>
                <small>Remove record and recalculate the balance</small>
              </span>
              <ChevronRight className="mobile-action-chevron" size={18} />
            </Button>
          </div>
        </MobileSheet>
        <MobileDeleteSheet open={Boolean(deleteCustomer)} title="Delete customer?" description="Sales and payment history will remain linked and available in reports." itemTitle={deleteCustomer?.name} itemDescription="Only the active customer directory entry will be removed." confirmLabel="Delete customer" busy={deleting} onClose={() => setDeleteCustomer(null)} onConfirm={confirmCustomerDelete} />
        <MobileDeleteSheet open={Boolean(deletePayment)} title="Delete payment?" description="The customer balance will be recalculated immediately." itemTitle={money(deletePayment?.amount, currency)} itemDescription={deletePayment?.note || "Payment record"} confirmLabel="Delete payment" busy={deleting} onClose={() => setDeletePayment(null)} onConfirm={confirmPaymentDelete} />
      </main>
    );
  }

  return (
    <main className="sale-retail-page customer-reference-page customer-page customer-index-page has-create-fab">
      <CustomerReferenceHeader actions={<CsvExportButton
          compact
          onExport={exportCustomers}
          onNotice={setNotice}
        />} title="Customers" onNew={() => navigateTo('/customers/new')} />
      <MobileNotice notice={notice} onClose={() => setNotice(null)} />
      <section className="mobile-product-controls customer-controls">
        <SearchInput className="mobile-search" aria-label="Search customers" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" type="text" onClear={() => setSearch("")} clearLabel="Clear customer search" />
        <MobileFilterToggle open={filtersOpen} onToggle={() => setFiltersOpen(open => !open)} controls="customer-index-filters" count={Object.values(indexFilters).filter(value => value !== 'all').length} />
        
      </section>
      <MobileFilterPanel open={filtersOpen} id="customer-index-filters" className="customer-reference-index-filters" onClose={() => setFiltersOpen(false)} onSubmit={event => { event.preventDefault(); setIndexFilters({ ...indexFilterDraft }); setFiltersOpen(false); }}><CustomerBalanceChoices value={indexFilterDraft.account_status} onChange={value => setIndexFilterDraft(current => ({ ...current, account_status: value }))} /><div className="customer-sort-summary"><h3>Sort by</h3><p><Check size={18} />Name (A - Z)</p></div><details className="customer-extra-filters"><summary>More filters<ChevronRight size={16} /></summary><MobileField id="customer-sale-activity" label="Sale activity"><Select id="customer-sale-activity" value={indexFilterDraft.sale_activity} onChange={event => setIndexFilterDraft(current => ({ ...current, sale_activity: event.target.value }))}><option value="all">All customers</option><option value="with_sales">With sales</option><option value="without_sales">Without sales</option></Select></MobileField></details><div className="customer-history-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={() => { const blank = { account_status: 'all', sale_activity: 'all' }; setIndexFilters(blank); setIndexFilterDraft(blank); setFiltersOpen(false); }}>Reset</MobileFilterResetButton><Button variant="primary" className="mobile-primary" type="submit">Apply filters</Button></div></MobileFilterPanel>
      <div className="mobile-list-heading">
        <h2>Customer directory</h2>
        <span>{customerList.total ?? customerList.items.length} customers</span>
      </div>
      {customerList.initialLoading ? (
        <CustomerSkeleton />
      ) : customerList.error && !customerList.items.length ? (
        <div className="endless-first-error">
          <p>Cannot load customers. {customerList.error}</p>
          <Button variant="plain" type="button" onClick={customerList.retry}>
            Try again
          </Button>
        </div>
      ) : customerList.items.length ? (
        <>
          <div className="customer-mobile-card-list">
            {customerList.items.map((customer) => {
              const balance = balanceState(customer.balance);
              return (
                <article className="customer-mobile-card" key={customer.id}>
                  <div className="customer-mobile-card-row">
                    <Button variant="plain"
                      className="customer-mobile-card-main"
                      type="button"
                      aria-label={`View ${customer.name}`}
                      onClick={() => navigateTo(`/customers/${customer.id}`)}
                    >
                      <span className="customer-reference-avatar">{customerInitials(customer.name)}</span><span className="customer-mobile-card-copy">
                        <strong>{customer.name}</strong>
                        <small>{customer.phone || "No phone number"}</small>
                        
                      </span>
                      <span
                        className={`customer-mobile-balance balance-${balance.key}`}
                      >
                        <small>{balance.key === 'receivable' ? 'Owes you' : balance.key === 'payable' ? 'You owe' : 'Settled'}</small><strong>{balance.amount ? money(balance.amount, currency) : '-'}</strong>
                      </span>
                    </Button>
                    <IconButton variant="ghost"
                      className="customer-mobile-card-menu"
                      type="button"
                      aria-label={`Actions for ${customer.name}`}
                      onClick={() => setActionCustomer(customer)}
                    >
                      <ChevronRight size={20} />
                    </IconButton>
                  </div>
                </article>
              );
            })}
          </div>
          <EndlessListFooter
            list={customerList}
            count={customerList.items.length}
            noun="customers"
          />
        </>
      ) : (
        <div className="mobile-empty-state">
          <span>
            <UsersRound size={28} />
          </span>
          <h2>No customers found</h2>
          <p>
            {debouncedSearch
              ? "Try another name, phone number, email or address."
              : "Add your first customer to track credit sales and payments."}
          </p>
          {!debouncedSearch && (
            <Button variant="primary"
              className="mobile-primary"
              type="button"
              onClick={() => navigateTo("/customers/new")}
            >
              <Plus size={18} />
              New customer
            </Button>
          )}
        </div>
      )}
      <MobileSheet
        className="mobile-sheet--action-menu"
        open={Boolean(actionCustomer)}
        title="Customer actions"
        description={actionCustomer?.name || ""}
        onClose={() => setActionCustomer(null)}
      >
        <div className="mobile-action-menu">
          <Button variant="plain"
            type="button"
            aria-label="View details"
            onClick={() => {
              const customer = actionCustomer;
              setActionCustomer(null);
              navigateTo(`/customers/${customer.id}`);
            }}
          >
            <Eye size={19} />
            <span>
              <strong>View details</strong>
              <small>Open account and activity</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
          <Button variant="plain"
            type="button"
            aria-label="Edit"
            onClick={() => {
              const customer = actionCustomer;
              setActionCustomer(null);
              navigateTo(`/customers/${customer.id}/edit`);
            }}
          >
            <Edit3 size={19} />
            <span>
              <strong>Edit</strong>
              <small>Update customer information</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
          <Button variant="danger-ghost"
            className="danger-action"
            type="button"
            aria-label="Delete"
            onClick={() => {
              const customer = actionCustomer;
              setActionCustomer(null);
              setDeleteCustomer(customer);
            }}
          >
            <Trash2 size={19} />
            <span>
              <strong>Delete</strong>
              <small>Remove customer and preserve history</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
        </div>
      </MobileSheet>
      <MobileDeleteSheet open={Boolean(deleteCustomer)} title="Delete customer?" description="Sales and payment history will remain linked and available in reports." itemTitle={deleteCustomer?.name} itemDescription="Only the active customer directory entry will be removed." confirmLabel="Delete customer" busy={deleting} onClose={() => setDeleteCustomer(null)} onConfirm={confirmCustomerDelete} />
    </main>
  );
}
