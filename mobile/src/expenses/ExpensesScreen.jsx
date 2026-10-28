import { MobileFilterResetButton } from '../components/MobilePrimitives';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { FloatingActionButton, InputGroup, ChoiceGroup, Button, IconButton, Input, Radio, SearchInput, Select, Textarea } from '../components/Controls';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleLocalizationBoundary } from "../localization/ModuleLocalizationBoundary";
import {
  REMAINING_PAGE_MESSAGES,
  REMAINING_PAGE_PATTERNS,
} from "../localization/remainingPagesLocale";
import { ArrowLeft, CalendarDays, CalendarRange, Check, ChevronRight, Edit3, EllipsisVertical, Plus, RefreshCw, Tag, Truck, Zap, House, Trash2, WalletCards } from 'lucide-react';
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
  EMPTY_EXPENSE_SUMMARY,
  blankExpenseFilters,
  blankExpenseForm,
  cleanExpensePaymentMethods,
  expenseDateError,
  expenseListPath,
  expensePageFromPath,
  expensePayload,
  expensePresetRange,
  expenseSummaryPath,
} from "./expenseUtils";

import { CsvExportButton } from "../components/CsvExportButton";
import { csvFilename, exportFilteredCsv } from "../utils/csvExport";

const PAGE_SIZE = 20;

function openNativeDatePicker(event) {
  const input = event.currentTarget.querySelector('input[type="date"]');
  if (!input) return;
  if (event.target !== input) event.preventDefault();
  input.focus({ preventScroll: true });
  try {
    input.showPicker?.();
  } catch {
    // Focusing preserves native date entry where showPicker is unavailable.
  }
}

function fieldErrorsFrom(error) {
  return Object.fromEntries(
    Object.entries(error?.payload?.errors || {}).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ]),
  );
}

function ExpenseForm({
  editing,
  form,
  errors,
  methods,
  categories,
  saving,
  onChange,
  onCancel,
  onSubmit,
}) {
  return (
    <form id={editing ? "expense-reference-edit-form" : "expense-reference-new-form"} className={`expense-mobile-form${editing ? " is-editing" : ""}`} onSubmit={onSubmit} noValidate>
      {Object.values(errors).some(Boolean) && <div className="expense-validation-banner" role="alert"><strong>Please correct the highlighted field.</strong><span>{"Review the fields below."}</span></div>}
      {errors.general && (
        <div className="mobile-notice mobile-notice--error" role="alert">
          {errors.general}
        </div>
      )}
      <section className="mobile-form-section">
        <div className="mobile-section-heading">
          <span>01</span>
          <div>
            <h3>Expense information</h3>
            <p>Date, title and reporting category</p>
          </div>
        </div>
        <div className="expense-two-fields">
          <MobileField
            id="expense-date"
            label="Date"
            error={errors.expense_date}
          >
            <InputGroup as="span" className="expense-native-control"><CalendarDays size={19} /><Input
              id="expense-date"
              type="date"
              value={form.expense_date}
              onChange={(event) => onChange("expense_date", event.target.value)}
              aria-describedby={
                errors.expense_date ? "expense-date-error" : undefined
              }
            /></InputGroup>
          </MobileField>
          <MobileField id="expense-title" label="Title" error={errors.title}>
            <Input
              aria-invalid={Boolean(errors.title)}
              id="expense-title"
                  required
              value={form.title}
              onChange={(event) => onChange("title", event.target.value)}
              aria-describedby={
                errors.title ? "expense-title-error" : undefined
              }
              placeholder="What was this expense for?"
            />
          </MobileField>
          <MobileField
            id="expense-category"
            label="Category"
            error={errors.category}
          >
            <InputGroup as="span" className="expense-native-control"><Tag size={19} /><Input
              id="expense-category"
              list="expense-category-options"
              value={form.category}
              onChange={(event) => onChange("category", event.target.value)}
              aria-describedby={
                errors.category ? "expense-category-error" : undefined
              }
              placeholder="Rent, utilities, transport…"
            /></InputGroup>
          </MobileField>
        </div>
      </section>
      <section className="mobile-form-section">
        <div className="mobile-section-heading">
          <span>02</span>
          <div>
            <h3>Amount and payment</h3>
            <p>Value, payment method and optional note</p>
          </div>
        </div>
        <div className="expense-two-fields">
          <MobileField id="expense-amount" label="Amount (Ks)" error={errors.amount}>
            <Input
              aria-label="Amount"
              aria-invalid={Boolean(errors.amount)}
              id="expense-amount"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={form.amount}
              onChange={(event) => onChange("amount", event.target.value)}
              aria-describedby={
                errors.amount ? "expense-amount-error" : undefined
              }
            />
          </MobileField>
          <MobileField
            id="expense-payment"
            label="Payment method"
            error={errors.payment_method}
          >
            <InputGroup as="span" className="expense-native-control"><WalletCards size={19} /><Select
              id="expense-payment"
              value={form.payment_method}
              onChange={(event) =>
                onChange("payment_method", event.target.value)
              }
              aria-describedby={
                errors.payment_method ? "expense-payment-error" : undefined
              }
            >
              {methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select></InputGroup>
          </MobileField>
        </div>
        <MobileField id="expense-note" label="Note (optional)" error={errors.note}>
          <Textarea
            id="expense-note"
            rows="3"
            value={form.note}
            onChange={(event) => onChange("note", event.target.value)}
            aria-describedby={errors.note ? "expense-note-error" : undefined}
            placeholder="Optional reference or note"
          />
        </MobileField>
      </section>
      <datalist id="expense-category-options">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <div className="mobile-form-actions" hidden={editing}>
        <Button variant="secondary" className="mobile-secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" className="mobile-primary" type="submit" disabled={saving}>
          {saving && <RefreshCw className="spin" size={17} />}
          {saving ? "Saving…" : editing ? "Save changes" : "Save expense"}
        </Button>
      </div>
    </form>
  );
}

export function ExpensesScreen(props) {
  return (
    <ModuleLocalizationBoundary
      messages={REMAINING_PAGE_MESSAGES}
      patterns={REMAINING_PAGE_PATTERNS}
    >
      <ExpensesScreenContent {...props} />
    </ModuleLocalizationBoundary>
  );
}

function ExpensesScreenContent({ pathname, onNavigate }) {
  
  const [localPathname, setLocalPathname] = useState("/expenses");
  const currentPathname = pathname || localPathname;
  const page = useMemo(
    () => expensePageFromPath(currentPathname),
    [currentPathname],
  );
  const [draftFilters, setDraftFilters] = useState(blankExpenseFilters());
  const [appliedFilters, setAppliedFilters] = useState(blankExpenseFilters());
  const [summary, setSummary] = useState(EMPTY_EXPENSE_SUMMARY);
  const [settings, setSettings] = useState({});
  const [knownCategories, setKnownCategories] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState(blankExpenseForm());
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [notice, setNotice] = useState(null);
  const [actionExpense, setActionExpense] = useState(null);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const [adminPin, setAdminPin] = useState("");
  const [deletePinRequired, setDeletePinRequired] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const paymentMethods = useMemo(() => {
    const methods = cleanExpensePaymentMethods(settings);
    const current = String(form.payment_method || "").trim();
    return current && !methods.includes(current)
      ? [...methods, current]
      : methods;
  }, [form.payment_method, settings]);

  function navigateTo(path, options = {}) {
    if (onNavigate) onNavigate(path, options);
    else setLocalPathname(path);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = draftFilters.q.trim();
      setAppliedFilters((current) =>
        current.q === q ? current : { ...current, q },
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draftFilters.q]);

  const loadExpensePage = useCallback(
    async ({ limit, offset, signal }) => {
      const response = await apiRequest(
        expenseListPath(appliedFilters, limit, offset),
        { signal },
      );
      const categories = (response.items || [])
        .map((expense) => expense.category)
        .filter(Boolean);
      if (categories.length)
        setKnownCategories((current) =>
          [...new Set([...current, ...categories])].sort(),
        );
      return response;
    },
    [appliedFilters],
  );
  const expenseList = useEndlessList({
    loadPage: loadExpensePage,
    queryKey: JSON.stringify(appliedFilters),
    pageSize: PAGE_SIZE,
    enabled: page.kind === "list",
  });

  function exportExpenses() {
    const raw = expenseListPath(appliedFilters, PAGE_SIZE, 0);
    const url = new URL(raw, window.location.origin);
    url.searchParams.delete("limit");
    url.searchParams.delete("offset");
    url.searchParams.delete("with_total");
    return exportFilteredCsv({
      path: `${url.pathname}${url.search}`,
      filename: csvFilename("expenses"),
      emptyMessage: "No expenses match the current filters.",
      columns: [
        { label: "Date", value: (row) => row.expense_date },
        { label: "Title", value: (row) => row.title },
        { label: "Category", value: (row) => row.category || "" },
        { label: "Payment Method", value: (row) => row.payment_method || "" },
        { label: "Amount", value: (row) => row.amount },
        { label: "Note", value: (row) => row.note || "" },
        { label: "Status", value: (row) => row.status || "completed" },
      ],
    });
  }

  const loadSummary = useCallback(
    async (signal) => {
      const response = await apiRequest(
        expenseSummaryPath(appliedFilters),
        signal ? { signal } : undefined,
      );
      setSummary(response || EMPTY_EXPENSE_SUMMARY);
      if (
        response?.top_category?.category &&
        response.top_category.category !== "Uncategorized"
      )
        setKnownCategories((current) =>
          [...new Set([...current, response.top_category.category])].sort(),
        );
      return response;
    },
    [appliedFilters],
  );

  const loadSettings = useCallback(async (signal) => {
    const response = await apiRequest(
      "/settings",
      signal ? { signal } : undefined,
    );
    setSettings(response || {});
    return response;
  }, []);

  const loadEditingExpense = useCallback(async (expenseId, signal) => {
    const expense = await apiRequest(
      `/expenses/${expenseId}`,
      signal ? { signal } : undefined,
    );
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date || "",
      title: expense.title || "",
      category: expense.category || "",
      amount: expense.amount || "",
      payment_method: expense.payment_method || "Cash",
      note: expense.note || "",
    });
    setFormErrors({});
    return expense;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSettings(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [loadSettings]);

  useEffect(() => {
    if (page.kind !== "list") return undefined;
    const controller = new AbortController();
    loadSummary(controller.signal).catch((error) => {
      if (!controller.signal.aborted)
        setNotice({
          type: "error",
          text: `Cannot load expense summary. ${error.message}`,
        });
    });
    return () => controller.abort();
  }, [loadSummary, page.kind]);

  useEffect(() => {
    setRouteError("");
    if (page.kind === "new") {
      setEditingId(null);
      setForm(blankExpenseForm());
      setFormErrors({});
      setRouteLoading(false);
      return undefined;
    }
    if (page.kind !== "edit") {
      setRouteLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setRouteLoading(true);
    loadEditingExpense(page.expenseId, controller.signal)
      .catch((error) => {
        if (!controller.signal.aborted)
          setRouteError(error.message || "Cannot load this expense.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });
    return () => controller.abort();
  }, [loadEditingExpense, page.expenseId, page.kind]);

  usePageRefresh(() => {
    if (page.kind === "list")
      return Promise.all([expenseList.reload(), loadSummary(), loadSettings()]);
    if (page.kind === "edit")
      return Promise.all([loadEditingExpense(page.expenseId), loadSettings()]);
    return loadSettings();
  });

  function setPreset(preset) {
    const next = { ...draftFilters, preset, ...(preset === "custom" ? {} : expensePresetRange(preset)) };
    setDraftFilters(next);
  }

  function applyFilters(event) {
    event.preventDefault();
    const error = expenseDateError(draftFilters);
    if (error) {
      setNotice({ type: "error", text: error });
      return;
    }
    setAppliedFilters({ ...draftFilters, q: draftFilters.q.trim() });
    setFiltersOpen(false);
  }

  function clearFilters() {
    const next = blankExpenseFilters();
    setDraftFilters(next);
    setAppliedFilters(next);
    setFiltersOpen(false);
  }

  async function saveExpense(event) {
    event.preventDefault();
    const payload = expensePayload(form);
    const errors = {};
    if (!payload.title) errors.title = "Expense title is required.";
    if (!Number.isInteger(payload.amount) || payload.amount <= 0)
      errors.amount =
        "Expense amount must be a whole number greater than zero.";
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    setFormErrors({});
    try {
      await apiRequest(editingId ? `/expenses/${editingId}` : "/expenses", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setNotice({
        type: "success",
        text: editingId ? "Expense updated." : "Expense created.",
      });
      if (!editingId) setForm(blankExpenseForm());
      navigateTo("/expenses", { back: true });
      void loadSummary().catch(() => undefined);
    } catch (error) {
      const serverErrors = fieldErrorsFrom(error);
      setFormErrors(
        Object.keys(serverErrors).length
          ? serverErrors
          : { general: error.message },
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(event) {
    event.preventDefault();
    if (deletePinRequired && !adminPin.trim()) {
      setNotice({ type: "error", text: "Admin PIN is required." });
      return;
    }
    setDeleting(true);
    try {
      const options = { method: "DELETE" };
      if (deletePinRequired)
        options.body = JSON.stringify({ admin_pin: adminPin });
      await apiRequest(`/expenses/${deleteExpense.id}`, options);
      setDeleteExpense(null);
      setAdminPin("");
      setNotice({
        type: "success",
        text: "Expense deleted from history and reports.",
      });
      await Promise.all([expenseList.reload(), loadSummary()]);
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setDeleting(false);
    }
  }

  async function openDeleteExpense(expense) {
    try {
      const currentSettings = Object.prototype.hasOwnProperty.call(
        settings,
        "admin_pin_set",
      )
        ? settings
        : await loadSettings();
      setDeletePinRequired(String(currentSettings?.admin_pin_set) === "1");
      setDeleteExpense(expense);
      setAdminPin("");
    } catch (error) {
      setNotice({
        type: "error",
        text: `Cannot check Admin PIN protection. ${error.message}`,
      });
    }
  }

  if (page.kind === "edit" && routeError)
    return (
      <main className="expense-page expense-reference-page">
        <Button variant="plain"
          className="submission-back"
          type="button"
          onClick={() => navigateTo("/expenses", { back: true })}
        >
          <ArrowLeft size={19} />
          Back to expenses
        </Button>
        <div className="endless-first-error">
          <p>{routeError}</p>
        </div>
      </main>
    );
  if (page.kind === "edit" && (routeLoading || editingId !== page.expenseId))
    return (
      <main className="expense-page expense-reference-page">
        <p className="mobile-inline-loading" role="status">
          <RefreshCw className="spin" size={18} />
          Loading expense…
        </p>
      </main>
    );

  if (page.kind === "new" || page.kind === "edit") {
    return (
      <main className="expense-page expense-form-page expense-reference-page">
        <PageAppBar className="retail-sale-header expense-reference-header">
          <IconButton variant="ghost" type="button" aria-label="Back to expenses" onClick={() => navigateTo("/expenses", { back: true })}><ArrowLeft size={23} /></IconButton>
          <h1>{editingId ? "Edit expense" : "New expense"}</h1>
          {editingId && <div className="expense-header-actions"><Button variant="plain" type="button" onClick={() => navigateTo("/expenses", { back: true })}>Cancel</Button><Button variant="plain" type="submit" form="expense-reference-edit-form" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></div>}
        <AppBarMenu /></PageAppBar>
        {editingId && <div className="expense-reference-identity"><WalletCards size={24} /><span><small>Expense ID</small><strong>#{editingId}</strong><small>{form.expense_date}</small></span></div>}
        <MobileNotice notice={notice} onClose={() => setNotice(null)} />
        <ExpenseForm
          editing={Boolean(editingId)}
          form={form}
          errors={formErrors}
          methods={paymentMethods}
          categories={knownCategories}
          saving={saving}
          onChange={(field, value) => {
            setForm((current) => ({ ...current, [field]: value }));
            setFormErrors((current) => ({ ...current, [field]: "" }));
          }}
          onCancel={() => navigateTo("/expenses", { back: true })}
          onSubmit={saveExpense}
        />
      </main>
    );
  }

  const activeFilterCount = [
    draftFilters.category,
    draftFilters.payment_method,
    draftFilters.preset !== "today" ? draftFilters.preset : "",
  ].filter(Boolean).length;

  return (
    <main className="expense-page expense-reference-page has-create-fab">
      <PageAppBar className="retail-sale-header expense-reference-header"><h1>Expenses</h1><CsvExportButton
            compact
            onExport={exportExpenses}
            onNotice={setNotice}
          /><AppBarMenu /></PageAppBar><FloatingActionButton label="New expense" onClick={() => navigateTo("/expenses/new")}><Plus size={24} aria-hidden="true" /></FloatingActionButton>
      <div className="expense-reference-period"><span>{appliedFilters.date_from || "All dates"}{appliedFilters.date_to && appliedFilters.date_to !== appliedFilters.date_from ? ` - ${appliedFilters.date_to}` : ""}</span><span><CalendarDays size={14} />Filtered period</span></div>
      <MobileNotice notice={notice} onClose={() => setNotice(null)} />
      <section className="expense-summary-grid">
        <span>
          <span className="expense-summary-icon today">
            <CalendarDays size={18} />
          </span>
          <small>Today</small>
          <strong>{money(summary.today_total)}</strong>
        </span>
        <span>
          <span className="expense-summary-icon month">
            <CalendarRange size={18} />
          </span>
          <small>This month</small>
          <strong>{money(summary.month_total)}</strong>
        </span>
      </section>
      <details className="expense-reference-more"><summary>Spending details</summary><div><span>Filtered total<strong>{money(summary.filter_total)}</strong></span><span>Top category<strong>{summary.top_category?.category || "No category"}</strong></span></div></details>
      
      <section className="mobile-product-controls expense-controls">
        <SearchInput className="mobile-search product-search" aria-label="Search expenses" value={draftFilters.q} onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                q: event.target.value,
              }))
            } placeholder="Search expenses" type="text" onClear={() =>
                setDraftFilters((current) => ({ ...current, q: "" }))
              } clearLabel="Clear expense search" />
        <div className="mobile-control-row expense-control-row">
          <MobileFilterToggle
            open={filtersOpen}
            onToggle={() => setFiltersOpen((open) => !open)}
            controls="expense-filters"
            count={activeFilterCount}
            className="product-toolbar-toggle"
          />
          
        </div>
        <MobileFilterPanel
          onClose={() => setFiltersOpen(false)} open={filtersOpen}
          id="expense-filters"
          className="product-filter-panel expense-filter-panel"
          onSubmit={applyFilters}
        >
          <ChoiceGroup className="expense-filter-choices"><legend>Date</legend>{[["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "This year"], ["all", "All dates"], ["custom", "Custom dates"]].map(([preset, label]) => <label key={preset} className={draftFilters.preset === preset ? "is-selected" : ""}><span>{label}</span><Radio type="radio" name="expense-date-range" checked={draftFilters.preset === preset} onChange={() => setPreset(preset)} /></label>)}</ChoiceGroup>
          <ChoiceGroup className="expense-filter-choices"><legend>Category</legend>{["", ...knownCategories].map(category => <label key={category} className={draftFilters.category === category ? "is-selected" : ""}><Tag size={18} /><span>{category || "All categories"}</span><Radio type="radio" name="expense-category-filter" checked={draftFilters.category === category} onChange={() => setDraftFilters(current => ({ ...current, category }))} /></label>)}</ChoiceGroup>
          <ChoiceGroup className="expense-filter-choices"><legend>Payment method</legend>{["", ...paymentMethods].map(method => <label key={method} className={draftFilters.payment_method === method ? "is-selected" : ""}><WalletCards size={18} /><span>{method || "All methods"}</span><Radio type="radio" name="expense-payment-filter" checked={draftFilters.payment_method === method} onChange={() => setDraftFilters(current => ({ ...current, payment_method: method }))} /></label>)}</ChoiceGroup>
          <label
            className="product-filter-field product-filter-date"
            htmlFor="expense-filter-from"
            onClick={openNativeDatePicker}
          >
            <span>
              <small>From</small>
              <Input
                id="expense-filter-from"
                type="date"
                value={draftFilters.date_from}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    preset: "custom",
                    date_from: event.target.value,
                  }))
                }
              />
            </span>
          </label>
          <label
            className="product-filter-field product-filter-date"
            htmlFor="expense-filter-to"
            onClick={openNativeDatePicker}
          >
            <span>
              <small>To</small>
              <Input
                id="expense-filter-to"
                type="date"
                value={draftFilters.date_to}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    preset: "custom",
                    date_to: event.target.value,
                  }))
                }
              />
            </span>
          </label>
          <div className="product-filter-actions">
            <MobileFilterResetButton variant="secondary" type="button" onClick={clearFilters}>
              Reset
            </MobileFilterResetButton>
            <Button variant="primary" className="mobile-primary" type="submit">
              <Check size={18} />
              Apply filters
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
          </div>
        </MobileFilterPanel>
      </section>
      <div className="mobile-list-heading">
        <h2>Expense history</h2>
        <span>
          {expenseList.total ??
            summary.matching_count ??
            expenseList.items.length}{" "}
          records
        </span>
      </div>
      {expenseList.initialLoading ? (
        <div
          className="expense-card-list"
          role="status"
          aria-label="Loading expenses"
        >
          {[1, 2, 3].map((key) => (
            <div className="expense-card expense-card--skeleton" key={key}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : expenseList.error && !expenseList.items.length ? (
        <div className="endless-first-error">
          <p>Cannot load expenses. {expenseList.error}</p>
          <Button variant="plain" type="button" onClick={expenseList.retry}>
            Try again
          </Button>
        </div>
      ) : expenseList.items.length ? (
        <>
          <div className="expense-card-list">
            {expenseList.items.map((expense) => (
              <article className="expense-card" key={expense.id}>
                <div className="expense-card-row">
                  <span className="expense-reference-icon">{expense.category === "Transport" ? <Truck size={21} /> : expense.category === "Utilities" ? <Zap size={21} /> : expense.category === "Rent" ? <House size={21} /> : <Tag size={21} />}</span>
                  <div className="expense-card-copy">
                    <small>{expense.expense_date}</small>
                    <strong>{expense.title}</strong>
                    <span>
                      <em>
                        <Tag size={13} />
                        {expense.category || "Uncategorized"}
                      </em>

                    </span>
                    {expense.note && (
                      <small className="expense-card-note">
                        {expense.note}
                      </small>
                    )}
                  </div>
                  <span className="expense-reference-value"><strong className="expense-card-amount">{money(expense.amount)}</strong><small><WalletCards size={12} />{expense.payment_method || "Cash"}</small></span>
                  <IconButton variant="ghost"
                    className="expense-card-menu"
                    type="button"
                    aria-label={`Actions for ${expense.title}`}
                    onClick={() => setActionExpense(expense)}
                  >
                    <EllipsisVertical size={20} />
                  </IconButton>
                </div>
              </article>
            ))}
          </div>
          <EndlessListFooter
            list={expenseList}
            count={expenseList.items.length}
            noun="expenses"
          />
        </>
      ) : (
        <div className="mobile-empty-state">
          <span>
            <WalletCards size={28} />
          </span>
          <h2>No expenses found</h2>
          <p>Change the filters or add the first expense for this period.</p>
          <Button variant="primary"
            className="mobile-primary"
            type="button"
            onClick={() => navigateTo("/expenses/new")}
          >
            <Plus size={18} />
            New expense
          </Button>
        </div>
      )}
      <MobileSheet
        className="mobile-sheet--action-menu"
        open={Boolean(actionExpense)}
        title="Expense actions"
        description={
          actionExpense
            ? `${actionExpense.title} · ${money(actionExpense.amount)}`
            : ""
        }
        onClose={() => setActionExpense(null)}
      >
        <div className="mobile-action-menu">
          <Button variant="plain"
            type="button"
            aria-label={`Edit ${actionExpense?.title}`}
            onClick={() => {
              const expense = actionExpense;
              setActionExpense(null);
              navigateTo(`/expenses/${expense.id}/edit`);
            }}
          >
            <Edit3 size={19} />
            <span>
              <strong>Edit expense</strong>
              <small>Update expense information</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
          <Button variant="danger-ghost"
            className="danger-action"
            type="button"
            aria-label={`Delete ${actionExpense?.title}`}
            onClick={() => {
              const expense = actionExpense;
              setActionExpense(null);
              void openDeleteExpense(expense);
            }}
          >
            <Trash2 size={19} />
            <span>
              <strong>Delete expense</strong>
              <small>Permanently remove it from reports</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
        </div>
      </MobileSheet>
      <MobileDeleteSheet open={Boolean(deleteExpense)} title="Delete expense?" description="This expense will be permanently removed from history and reports." itemTitle={deleteExpense?.title} itemDescription={money(deleteExpense?.amount)} confirmLabel="Delete expense" busy={deleting} onClose={() => setDeleteExpense(null)} onConfirm={confirmDelete}>
        {deletePinRequired && <MobileField id="expense-admin-pin" label="Admin PIN"><Input id="expense-admin-pin" autoFocus type="password" inputMode="numeric" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="Enter admin PIN" /></MobileField>}
      </MobileDeleteSheet>
    </main>
  );
}
