import '../../shared/theme/auth-locale.css';
import { officeAuthText } from './officeAuthLocale';
import { AgentSkillsPage, AgentAssignmentsPage } from './AgentSkillsPage';
import { AiUsageReportPage } from './AiReportsPages';
import { AiBalanceBookPage } from './AiBalanceBookPage';
import { SalesAiTopupsPage } from './SalesAiTopupsPage';
import { SalesAiBalanceForm } from './SalesAiBalanceForm';
import { OverviewPage } from './OverviewPage';
import { ServerHealthPage } from './ServerHealthPage';
import { AiAssistantSettingsPage } from './AiAssistantSettingsPage';
import TelegramSupportSettingsPage from './TelegramSupportSettingsPage';
import { SubscriptionBankBook, PaymentApprovalModal } from './SubscriptionBankBook';
import { AdminsPage, ActivityLogPage, BankBooksPage, BrandingPage } from './OfficeManagementPages';
import { BrandImage } from './platformBranding';
import { startBranding } from './platformBranding';
import { officeDate, officeDateTime, paymentMatchesDates } from './dateTime';
import { BusinessOwnerEmail } from './BusinessOwnerEmail';
import { ActivityAlerts } from './ActivityAlerts';
import { OfficeModal } from './OfficeModal';
import { ShopReviewsPage } from './ShopReviewsPage';
import { ProductReviewsPage } from './ProductReviewsPage';
import { FinancialBookPage } from './FinancialBookPage';
import { FounderSettingsPage } from './FounderSettingsPage';
import { BusinessStorefront, ShopGpsPosition } from './BusinessStorefront';
import { BillingHistoryTable } from './BillingHistoryTable';
import {OfficeTableLoading, OfficeActionHeader, OfficeActionCell, OfficeTablePagination} from './OfficeTable';
import { OfficeAppBarContext } from './OfficePageToolbar';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BusinessesPage, initialBusinessQuery } from './BusinessesPage';
import { TutorialsPage } from './TutorialsPage';
import { MarketplaceCategoriesPage } from './MarketplaceCategoriesPage';
import { MarketplaceProductsPage } from './MarketplaceProductsPage';
import { ErrorReportsPage } from './ErrorReportsPage';
import { PlatformUsersPage } from './PlatformUsersPage';
import { ContactSettingsPage } from './ContactSettingsPage';
import { PaymentReceiptCheck } from './PaymentReceiptCheck';
import { ShopReportsPage, initialReportQuery } from './ShopReportsPage';
import { FilterDrawer } from './FilterDrawer';
import { RowActions } from './RowActions';
import {
  ArrowLeft,
  Ban,
  Boxes,
  Bot,
  Building2,
  CalendarDays,
  ChartColumnIncreasing,
  Check,
  ClipboardList,
  Clock3,
  CreditCard,
  Download,
  CircleDollarSign,
  Eye,
  EyeOff,
  Filter,
  Flag,
  KeyRound,
  Image as ImageIcon,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  Menu,
  MessageSquare,
  MonitorDown,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ReceiptText,
  Save,
  Search,
  Settings,
  Smartphone,
  ShoppingCart,
  ShieldCheck,
  TrendingUp,
  Truck,
  Trash2,
  Upload,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { api, apiBlob, apiUpload, officeApiBase } from './api';
import { RetainedViews } from './RetainedViews';
import { clearOfficeNavigation, normalizeOfficePage, readOfficeNavigation, restoreOfficeNavigation, writeOfficeNavigation } from './officeNavigation';
import { subscriptionAccessState, subscriptionDetailPresentation } from './subscriptionUi';
import '../../frontend/src/styles.css';
import '../../frontend/src/styles/responsive.css';
import '../../frontend/src/styles/auth.css';
import './styles.css';
import './tutorials.css';
import './desktop-parity.css';
import './shop-reports.css';

const emptyPlan = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  currency: 'Ks',
  duration_days: 30,
  features: '',
  is_active: true,
  sort_order: 0,
};

const emptyPaymentMethod = {
  bank: '',
  account_name: '',
  account_no: '',
  is_active: true,
  sort_order: 0,
};

const initialPaymentQuery = { q: '', view: 'pending', currency: '', type: 'all', from: '', to: '', per_page: 25, page: 1 };

const BRAND_LOGO = `${import.meta.env.BASE_URL}branding/pwarmyar-mark.png`;
const money = (value, currency = 'Ks') => `${Number(value || 0).toLocaleString()} ${currency}`;
const number = (value) => Number(value || 0).toLocaleString([], { maximumFractionDigits: 3 });
const date = officeDate;
const dateTime = value => officeDateTime(value, { dateStyle: 'medium', timeStyle: 'short' });
const fileSize = (value) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const pageCopy = {
  'server-health': ['Server health', 'Check required services, configuration and deployment readiness.'],
  'platform-users': ['Platform users', 'Manage customer accounts registered across all shops.'],
  'shop-reviews': ['Shop reviews', 'Manage customer shop ratings and reviews across all shops.'],
  'product-reviews': ['Product reviews', 'Manage customer product ratings and reviews across all shops.'],
  'shop-reports': ['Shop reports', 'Review customer reports and share Office responses.'],
  'error-reports': ['Error reports', 'Review application issues submitted by business owners and PwarMyar AI.'],
  overview: ['Overview', 'Business access, payments, revenue, and AI credit.'],
  businesses: ['Businesses', 'Manage owner access and subscription periods.'],
  'business-detail': ['Business details', 'Owner access, current billing status, and subscription history.'],
  plans: ['Plans', 'Create and maintain the plans available to business owners.'],
  'payment-methods': ['Payment methods', 'Manage the bank accounts clients can use for subscription payments.'],
  requests: ['Payment', 'Review payments awaiting approval and browse payment records.'],
  admins: ['Administrators', 'Manage Office sign-in accounts and access levels.'],
  'activity-log': ['Activity log', 'Trace payment approvals, subscription access and other admin actions.'],
  'bank-books': ['Bank books', 'Manage balance books and subscription receipts.'],
  'ai-usage': ['Usage Report', 'Review AI assistant request counts and token usage.'],
  'ai-requests': ['AI balance book', 'Manage internal AI credits and estimated usage costs.'],
  'sales-ai-topups': ['Sales AI top-ups', 'Review business credit payments for Sales AI.'],
  branding: ['Branding', 'Set the PwarMyar theme, logo and web icons.'],
  founders: ['Founder settings', 'Manage founders and profit shares.'],
  'financial-book': ['Financial book', 'Track bank books, transfers, expenses, and founder profit.'],
  financial: ['Financial report', 'Subscription sales performance across month, year, and all time.'],
  settings: ['Settings', 'Manage your Office account, application downloads, and platform settings.'],
  'agent-skills': ['Skills', 'Manage published AI workflows and communication.'],
  'agent-assignments': ['Agent assignments', 'Assign shared skills to Wyne Wyne, Kaung Kaung and Sale AI.'],
  tutorials: ['Tutorials', 'Manage video tutorials published on the PwarMyar portfolio.'],
  'marketplace-categories': ['Marketplace categories', 'Manage the shared category tree across PwarMyar shops.'],
  'marketplace-products': ['Marketplace products', 'Review shop products and manage their marketplace category links.'],
};

function StatusBadge({ status, children }) {
  return <span className={`office-status office-status-${status}`}>{children ?? status}</span>;
}

function EmptyState({ icon: Icon = ClipboardList, title, message }) {
  return (
    <div className="office-empty">
      <span className="office-empty-icon">{React.createElement(Icon, { size: 20 })}</span>
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

function Login({ onLogin }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('mkpos.office.language') === 'my' ? 'my' : 'en');
  const text = value => officeAuthText(value, language);
  function changeLanguage(locale) {
    setLanguage(locale);
    localStorage.setItem('mkpos.office.language', locale);
  }
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api('/office/auth/login', { method: 'POST', body: JSON.stringify(form) }));
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="office-login-page" lang={language}>
      <div className="office-login-shell">
        <section className="office-login-intro">
          <div className="office-login-brand">
            <span><BrandImage src={BRAND_LOGO} alt="" /></span>
            <div><strong>PwarMyar</strong><small>{text('Office')}</small></div>
          </div>
          <div className="office-login-copy">
            <span className="office-login-kicker"><ShieldCheck size={14} />{text('Platform operations')}</span>
            <h1>{text('Run every PwarMyar business from one place.')}</h1>
            <p>{text('Manage subscriptions, business access, plans, and renewal requests from your private Office console.')}</p>
          </div>
          <div className="office-login-points">
            <div><Check size={15} /><span><strong>{text('Protected access')}</strong><small>{text('For authorized Office administrators')}</small></span></div>
            <div><Check size={15} /><span><strong>{text('Central control')}</strong><small>{text('One workspace for every tenant')}</small></span></div>
          </div>
          <small className="office-login-copyright">{text('PwarMyar Platform Administration')}</small>
        </section>

        <form onSubmit={submit} className="office-login-form">
          <div className="auth-locale-row" data-no-localize><div className="auth-locale-toggle" role="group" aria-label="Language / ဘာသာစကား">{[['en', 'English'], ['my', 'မြန်မာ']].map(([locale, label]) => <button key={locale} type="button" lang={locale} aria-pressed={language === locale} onClick={() => changeLanguage(locale)}>{label}</button>)}</div></div>
          <div className="office-login-form-heading">
            <span><LockKeyhole size={19} /></span>
            <div><h2>{text('Welcome back')}</h2><p>{text('Sign in with your Office administrator account.')}</p></div>
          </div>
          <div className="auth-form">
            <label>
              {text('Email address')}
              <span className="office-auth-input"><Mail size={16} /><input required type="email" autoComplete="email" placeholder="owner@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></span>
            </label>
            <label>
              {text('Password')}
              <span className="office-auth-input office-auth-password"><LockKeyhole size={16} /><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={text('Enter your password')} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={text(showPassword ? 'Hide password' : 'Show password')}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
            </label>
            <label className="office-remember"><input type="checkbox" checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} /><span>{text('Keep me signed in on this device')}</span></label>
            {error && <div className="feedback error" role="alert">{error}</div>}
            <button className="auth-submit office-login-submit" disabled={busy}>{text(busy ? 'Signing in…' : 'Sign in to Office')}</button>
          </div>
          <p className="office-login-help"><ShieldCheck size={14} />{text('Your Office access is protected by an authenticated connection.')}</p>
        </form>
      </div>
    </main>
  );
}

function PlanModal({ plan, onClose, onSaved }) {
  const [form, setForm] = useState(plan ? { ...plan, features: (plan.features || []).join(', ') } : emptyPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      ...form,
      price: Number(form.price),
      duration_days: Number(form.duration_days),
      sort_order: Number(form.sort_order),
      features: form.features.split(',').map((item) => item.trim()).filter(Boolean),
    };
    try {
      await api(plan ? `/office/plans/${plan.id}` : '/office/plans', {
        method: plan ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="office-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="office-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="plan-dialog-title">
        <div className="office-modal-header">
          <div>
            <h2 id="plan-dialog-title">{plan ? 'Edit subscription plan' : 'Create subscription plan'}</h2>
            <p>{plan ? 'Update pricing, term, and availability.' : 'Set up a plan business owners can purchase.'}</p>
          </div>
          <button type="button" className="office-icon-button mkpos-dismiss-icon" onClick={onClose} aria-label="Close plan editor"><X size={17} /></button>
        </div>
        <div className="office-modal-body">
          <div className="office-form-grid">
            <label>Plan name<input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Business Monthly" /></label>
            <label>Slug<input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Generated automatically" /></label>
            <label>Price<input required min="0" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            <label>Currency<input required value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></label>
            <label>Duration in days<input required min="1" type="number" value={form.duration_days} onChange={(event) => setForm({ ...form, duration_days: event.target.value })} /></label>
            <label>Sort order<input min="0" type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></label>
          </div>
          <label>Description<textarea rows="3" value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A short explanation shown to business owners" /></label>
          <label>Features<textarea rows="3" value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} placeholder="POS, Inventory, Reports (separate with commas)" /></label>
          <label className="office-switch-row">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            <span><strong>Available for purchase</strong><small>Business owners can see and request this plan.</small></span>
          </label>
          {error && <div className="feedback error">{error}</div>}
        </div>
        <div className="office-modal-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="office-button-primary" disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save plan'}</button>
        </div>
      </form>
    </div>
  );
}

function PaymentMethodModal({ paymentMethod, onClose, onSaved }) {
  const [form, setForm] = useState(paymentMethod ? { ...paymentMethod } : emptyPaymentMethod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(paymentMethod ? `/office/payment-methods/${paymentMethod.id}` : '/office/payment-methods', {
        method: paymentMethod ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, sort_order: Number(form.sort_order) }),
      });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="office-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="office-modal office-payment-method-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="payment-method-dialog-title">
        <div className="office-modal-header">
          <div>
            <h2 id="payment-method-dialog-title">{paymentMethod ? 'Edit payment method' : 'Add payment method'}</h2>
            <p>This bank account will be displayed to clients when they pay for a plan.</p>
          </div>
          <button type="button" className="office-icon-button mkpos-dismiss-icon" onClick={onClose} aria-label="Close payment method editor"><X size={17} /></button>
        </div>
        <div className="office-modal-body">
          <div className="office-form-grid">
            <label>Bank<input required autoFocus value={form.bank} onChange={(event) => setForm({ ...form, bank: event.target.value })} placeholder="e.g. KBZ Bank" /></label>
            <label>Account name<input required value={form.account_name} onChange={(event) => setForm({ ...form, account_name: event.target.value })} placeholder="Account holder name" /></label>
            <label>Account number<input required value={form.account_no} onChange={(event) => setForm({ ...form, account_no: event.target.value })} placeholder="Bank account or wallet number" /></label>
            <label>Sort order<input min="0" type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></label>
          </div>
          <label className="office-switch-row">
            <input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            <span><strong>Available to clients</strong><small>Clients can select this account on the subscription payment screen.</small></span>
          </label>
          {error && <div className="feedback error">{error}</div>}
        </div>
        <div className="office-modal-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="office-button-primary" disabled={busy}><Save size={16} /> {busy ? 'Saving...' : 'Save payment method'}</button>
        </div>
      </form>
    </div>
  );
}

function FinancialReportPage({ report, busy, onAction }) {
  if (!report) return <EmptyState icon={ChartColumnIncreasing} title="No financial data" message="Subscription sales will appear after a plan is assigned or renewed." />;

  const { currency, current_year: currentYear, summary, monthly, yearly, recent_sales: recentSales } = report;
  const maxMonth = Math.max(...monthly.map((item) => item.amount), 0);
  const maxYear = Math.max(...yearly.map((item) => item.amount), 0);
  const yearChange = summary.year_over_year_percent;
  const stats = [
    { label: 'This month', value: money(summary.this_month, currency), hint: 'Subscription sales this month', icon: CalendarDays, tone: 'green' },
    { label: 'This year', value: money(summary.this_year, currency), hint: `${currentYear} revenue`, icon: ChartColumnIncreasing, tone: 'blue' },
    { label: 'All-time revenue', value: money(summary.all_time, currency), hint: 'Recorded subscription revenue', icon: WalletCards, tone: 'purple' },
    { label: 'All-time sales', value: summary.all_time_sales.toLocaleString(), hint: 'Assignments and renewals', icon: ReceiptText, tone: 'amber' },
    { label: 'Year over year', value: yearChange === null ? '—' : `${yearChange > 0 ? '+' : ''}${yearChange}%`, hint: money(summary.previous_year, currency) + ' previous year', icon: TrendingUp, tone: yearChange !== null && yearChange < 0 ? 'red' : 'green' },
  ];

  return (
    <div className="office-page-stack office-financial-report">
      <section className="office-stat-grid office-financial-stats" aria-label="Financial summary">
        {stats.map(({ label, value, hint, icon: Icon, tone }) => <article className="office-stat-card" key={label}>
          <span className={`office-stat-icon office-tone-${tone}`}>{React.createElement(Icon, { size: 18 })}</span>
          <div><span>{label}</span><strong title={String(value)}>{value}</strong><small>{hint}</small></div>
        </article>)}
      </section>

      <section className="office-financial-chart-grid">
        <article className="office-panel office-financial-chart-panel">
          <div className="office-panel-header"><div><h2>Monthly sales</h2><p>Subscription revenue by month in {currentYear}.</p></div><strong>{money(summary.this_year, currency)}</strong></div>
          <div className="office-month-chart" role="img" aria-label={`Monthly subscription revenue for ${currentYear}`}>
            {monthly.map((item) => {
              const height = maxMonth ? Math.max((item.amount / maxMonth) * 100, item.amount ? 8 : 0) : 0;
              return <div className="office-month-column" key={item.month} title={`${item.label}: ${money(item.amount, currency)} · ${item.sales} sales`}>
                <span className="office-month-value">{item.sales || ''}</span>
                <div className="office-month-track"><span style={{ height: `${height}%` }} /></div>
                <small>{item.label}</small>
              </div>;
            })}
          </div>
          <div className="office-chart-legend"><span><i /> Revenue</span><small>Number above each bar is the sale count.</small></div>
        </article>

        <article className="office-panel office-financial-chart-panel">
          <div className="office-panel-header"><div><h2>Year over year</h2><p>Annual subscription revenue comparison.</p></div><TrendingUp size={18} /></div>
          {yearly.length ? <div className="office-year-chart">
            {yearly.map((item) => <div className="office-year-row" key={item.year}>
              <strong>{item.year}</strong>
              <div><span style={{ width: `${maxYear ? Math.max((item.amount / maxYear) * 100, 4) : 0}%` }} /></div>
              <span><strong>{money(item.amount, currency)}</strong><small>{item.sales} sale{item.sales === 1 ? '' : 's'}</small></span>
            </div>)}
          </div> : <EmptyState icon={TrendingUp} title="No yearly revenue" message="Annual comparison will appear after the first sale." />}
        </article>
      </section>

      <section className="office-panel office-table-panel office-financial-sales">
        <div className="office-panel-header"><div><h2>Recent subscription sales</h2><p>Latest plan assignments, extensions, and renewals.</p></div><span>{recentSales.length} recent</span></div>
        {recentSales.length ? <div className="office-table-scroll"><table className="office-data-table">
          <thead><tr><th>Date</th><th>Business</th><th>Plan</th><th>Sale type</th><th>Term</th><th>Amount</th><th>Processed by</th><OfficeActionHeader /></tr></thead>
          <tbody>{recentSales.map((sale) => <tr key={sale.id}>
            <td>{dateTime(sale.paid_at)}</td>
            <td><strong>{sale.business_name}</strong></td>
            <td>{sale.plan_name}</td>
            <td><StatusBadge status={sale.type === 'renewal' ? 'approved' : 'active'}>{sale.type}</StatusBadge></td>
            <td>{sale.duration_days} days</td>
            <td><strong className="office-price">{money(sale.amount, sale.currency)}</strong></td>
            <td>{sale.created_by_name || 'System'}</td>
            <OfficeActionCell><RowActions label={`financial record ${sale.id}`} disabled={Boolean(busy)}><button type="button" className="danger-button" onClick={() => {
              if (window.confirm(`Permanently delete financial record #${sale.id} for ${sale.business_name}: ${money(sale.amount, sale.currency)} (${sale.plan_name})? This removes it from revenue totals and payment history. Subscription access and dates will not change. This cannot be undone.`)) {
                onAction(`delete-financial-${sale.id}`, `/office/financial-records/${sale.id}`, { method: 'DELETE' });
              }
            }}><Trash2 size={14} /> Delete record</button></RowActions></OfficeActionCell>
          </tr>)}</tbody>
        </table></div> : <EmptyState icon={ReceiptText} title="No subscription sales" message="Assigned and renewed plans will be recorded here." />}
      </section>
    </div>
  );
}


function BusinessDetailPage({ businessId, activePlans, busy, onAction, onBack, refreshToken = 0 }) {
  const [detail, setDetail] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false), [emailNotice, setEmailNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState({ password: '', password_confirmation: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [recordFinancial, setRecordFinancial] = useState(true);
  const [subscriptionBook, setSubscriptionBook] = useState('');
  const [trialExtension, setTrialExtension] = useState({ days: '7', note: '' });

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDetail(await api(`/office/businesses/${businessId}`));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    const timer = window.setTimeout(loadDetail, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetail, refreshToken]);

  async function resetPassword(event) {
    event.preventDefault();
    setResetBusy(true);
    setError('');
    setResetSuccess('');
    try {
      await api(`/office/businesses/${businessId}/owner-password`, {
        method: 'PUT',
        body: JSON.stringify(password),
      });
      setPassword({ password: '', password_confirmation: '' });
      setResetSuccess('Owner password reset successfully.');
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setResetBusy(false);
    }
  }

  async function extendTrial(event) {
    event.preventDefault();
    const days = Number(trialExtension.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setError('Trial extension must be between 1 and 365 whole days.');
      return;
    }
    setError('');
    await onAction(`extend-trial-${businessId}`, `/office/businesses/${businessId}/subscription/trial/extend`, {
      method: 'POST',
      body: JSON.stringify({ days, note: trialExtension.note.trim() || null }),
    });
  }

  async function changeSubscriptionStatus(status) {
    const actionName = status === 'suspended' ? 'suspend' : 'reactivate';
    const confirmed = window.confirm(
      status === 'suspended'
        ? `Suspend ${business.name}'s subscription? They will keep read-only access until the paid-through date.`
        : `Reactivate ${business.name}'s subscription? Business changes will be enabled immediately.`,
    );
    if (!confirmed) return;

    await onAction(
      `${actionName}-${businessId}`,
      `/office/businesses/${businessId}/subscription/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    );
  }

  if (loading) return <div className="office-loading"><RefreshCw size={20} className="office-spin" /><strong>Loading business details</strong><span>Retrieving billing and owner information…</span></div>;
  if (!detail) return <div className="office-detail-error"><div className="feedback error">{error || 'Business details could not be loaded.'}</div><button onClick={onBack}><ArrowLeft size={15} /> Back to businesses</button></div>;

  const { business, billing, business_summary: summary = {}, billing_history: history, sales_ai_wallet: salesWallet, sales_ai_topups: salesTopups = [] } = detail;
  const current = billing.subscription;
  const accessState = subscriptionAccessState(billing);
  const detailPresentation = subscriptionDetailPresentation(billing);
  const statusLabel = accessState.label;
  const summaryCards = [
    { label: 'Customers', value: number(summary.customer_count), hint: 'Active customer accounts', icon: Users, tone: 'green' },
    { label: 'Products', value: number(summary.product_count), hint: `${number(summary.low_stock_count)} low · ${number(summary.out_of_stock_count)} out`, icon: Package, tone: 'purple' },
    { label: 'Suppliers', value: number(summary.supplier_count), hint: 'Active supplier records', icon: Truck, tone: 'blue' },
    { label: 'Staff', value: number(summary.staff_count), hint: 'Active non-owner users', icon: UserRound, tone: 'blue' },
    { label: 'Transactions', value: number(summary.transaction_count), hint: `${number(summary.sale_count)} sales · ${number(summary.purchase_count)} purchases · ${number(Number(summary.customer_payment_count || 0) + Number(summary.supplier_payment_count || 0))} payments`, icon: ReceiptText, tone: 'green' },
    { label: 'Stock units', value: number(summary.stock_units), hint: `${money(summary.inventory_cost, business.currency)} inventory cost`, icon: Boxes, tone: 'amber' },
    { label: 'Sales value', value: money(summary.sales_total, business.currency), hint: `${number(summary.sale_count)} completed sales`, icon: CircleDollarSign, tone: 'green' },
    { label: 'Customer credit', value: money(summary.outstanding_credit, business.currency), hint: 'Net amount owed to business', icon: WalletCards, tone: Number(summary.outstanding_credit) > 0 ? 'red' : 'green' },
    { label: 'Purchases', value: money(summary.purchase_total, business.currency), hint: `${number(summary.purchase_count)} completed purchases`, icon: ShoppingCart, tone: 'purple' },
    { label: 'Supplier payable', value: money(summary.supplier_payable, business.currency), hint: 'Outstanding purchase credit', icon: Truck, tone: Number(summary.supplier_payable) > 0 ? 'amber' : 'green' },
    { label: 'Expenses', value: money(summary.expense_total, business.currency), hint: `${number(summary.expense_count)} completed expenses`, icon: ClipboardList, tone: 'red' },
  ];

  return (
    <div className="office-business-detail">
      {emailNotice && <p className="office-success" role="status">{emailNotice}</p>}
      {emailOpen && <BusinessOwnerEmail business={business} onClose={() => setEmailOpen(false)} onSent={message => { setEmailNotice(message); setEmailOpen(false); }} />}
      {error && <div className="feedback error">{error}</div>}
      {billing.pending_request && <div className="office-billing-notice"><Clock3 size={16} /><span><strong>Subscription request pending</strong><small>{billing.pending_request.plan_name} · {money(billing.pending_request.price, billing.pending_request.currency)}</small></span></div>}

      <section className="office-detail-stats" aria-label="Current billing summary">
        <article><span className={`office-tone-${billing.is_valid ? 'green' : 'red'}`}><ShieldCheck size={17} /></span><div><small>Billing status</small><strong>{statusLabel}</strong></div></article>
        <article><span className="office-tone-purple"><CreditCard size={17} /></span><div><small>Current plan</small><strong>{detailPresentation.planLabel}</strong></div></article>
        <article><span className="office-tone-blue"><CalendarDays size={17} /></span><div><small>Period</small><strong>{date(detailPresentation.startsAt)} → {date(detailPresentation.endsAt)}</strong></div></article>
        {detailPresentation.daysRemaining !== null && <article><span className="office-tone-amber"><Clock3 size={17} /></span><div><small>Trial remaining</small><strong>{detailPresentation.daysRemaining} days</strong></div></article>}
        <article><span className="office-tone-amber"><CircleDollarSign size={17} /></span><div><small>Amount paid</small><strong>{current ? money(current.price_paid, business.currency) : '—'}</strong></div></article>
        {salesWallet && <article><span className="office-tone-green"><Bot size={17} /></span><div><small>Sales AI balance</small><strong>{Number(salesWallet.available).toLocaleString(undefined, { maximumFractionDigits: 6 })} MMK</strong><small>{Number(salesWallet.reserved).toLocaleString(undefined, { maximumFractionDigits: 6 })} MMK reserved</small></div></article>}
      </section>

      <div className="office-detail-grid">
        <div className="office-detail-main">
          <section className="office-panel office-business-summary" aria-labelledby="office-business-summary-title">
            <div className="office-panel-header">
              <div><h2 id="office-business-summary-title">Business overview</h2><p>All-time operational summary for this business.</p></div>
              <span className="office-business-last-activity"><Clock3 size={14} /> Last activity {dateTime(summary.last_activity_at)}</span>
            </div>
            <div className="office-stat-grid office-business-summary-grid">
              {summaryCards.map(({ label, value, hint, icon: Icon, tone }) => <article className="office-stat-card" key={label}>
                <span className={`office-stat-icon office-tone-${tone}`}>{React.createElement(Icon, { size: 18 })}</span>
                <div><span>{label}</span><strong title={String(value)}>{value}</strong><small title={hint}>{hint}</small></div>
              </article>)}
            </div>
          </section>

          <ShopGpsPosition location={detail.shop_location} />

          <section className="office-panel office-table-panel office-billing-history">
            <div className="office-panel-header"><div><h2>Billing history</h2><p>Subscriptions and Sales AI top-ups.</p></div><span>{history.length + salesTopups.length} record{history.length + salesTopups.length === 1 ? '' : 's'}</span></div>
            {history.length + salesTopups.length > 0 ? <BillingHistoryTable businessId={businessId} history={history} topups={salesTopups} currency={business.currency} disabled={Boolean(busy)} onSaved={setDetail} onTopupSaved={result => setDetail(current => ({ ...current, sales_ai_wallet: result.wallet, sales_ai_topups: current.sales_ai_topups.map(row => row.id === result.request.id ? { ...row, ...result.request } : row) }))} /> : <EmptyState icon={ReceiptText} title="No billing history" message="Subscriptions and Sales AI top-ups will appear here." />}
          </section>
        </div>

        <aside className="office-detail-sidebar">
          {salesWallet && <SalesAiBalanceForm businessId={businessId} wallet={salesWallet} onSaved={wallet => setDetail(current => ({ ...current, sales_ai_wallet: wallet }))} />}
          {detail.storefront && <BusinessStorefront businessId={businessId} storefront={detail.storefront} disabled={Boolean(busy)} onSaved={storefront => setDetail(current => ({ ...current, storefront }))} />}
          <section className="office-panel office-owner-card">
            <div className="office-panel-header"><div><h2>Business owner</h2><p>Primary account for this tenant.</p></div><button type="button" disabled={!business.owner_email} title={!business.owner_email ? 'No owner email available' : undefined} onClick={() => { setEmailNotice(''); setEmailOpen(true); }}><Mail size={14} />Email owner</button></div>
            <div className="office-owner-profile"><span>{business.owner_name?.charAt(0).toUpperCase() || 'O'}</span><div><strong>{business.owner_name || 'No owner'}</strong><small>{business.owner_email || '—'}</small></div></div>
            <dl><div><dt>Account</dt><dd><StatusBadge status={business.owner_is_active ? 'active' : 'blocked'}>{business.owner_is_active ? 'Active' : 'Disabled'}</StatusBadge></dd></div><div><dt>Business</dt><dd>{business.status}</dd></div><div><dt>Currency</dt><dd>{business.currency}</dd></div><div><dt>Timezone</dt><dd>{business.timezone}</dd></div></dl>
          </section>

          <section className="office-panel office-subscription-controls">
            <div className="office-panel-header"><div><h2>Subscription controls</h2><p>Manage this business&apos;s access.</p></div><span><CreditCard size={16} /></span></div>
            <div className="office-subscription-control-body">
              {detailPresentation.conversionMessage && <div className="office-billing-notice" role="status"><CalendarDays size={16} /><span><strong>Convert trial to paid access</strong><small>{detailPresentation.conversionMessage}</small></span></div>}
              {detailPresentation.canExtendTrial && <form className="office-trial-extension" onSubmit={extendTrial}>
                <div><strong>Extend free trial</strong><small>{detailPresentation.trialExtensionMessage}</small></div>
                <label>Additional days
                  <input type="number" min="1" max="365" step="1" required value={trialExtension.days} onChange={(event) => setTrialExtension({ ...trialExtension, days: event.target.value })} />
                </label>
                <label>Admin note <span>(optional)</span>
                  <textarea rows="2" maxLength="500" value={trialExtension.note} onChange={(event) => setTrialExtension({ ...trialExtension, note: event.target.value })} placeholder="Reason for this extension" />
                </label>
                <button className="office-button-trial" disabled={busy === `extend-trial-${businessId}`}><CalendarDays size={15} /> {busy === `extend-trial-${businessId}` ? 'Extendingâ€¦' : 'Extend trial'}</button>
              </form>}
              <label>Assign or replace plan
                <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                  <option value="">Choose plan</option>
                  {activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price, plan.currency)}</option>)}
                </select>
              </label>
              <SubscriptionBankBook value={subscriptionBook} onChange={setSubscriptionBook} disabled={Boolean(busy)} />
              <label className="office-financial-toggle"><input type="checkbox" checked={recordFinancial} disabled={Boolean(busy)} onChange={event => setRecordFinancial(event.target.checked)} />Record in financial report</label>
              {!recordFinancial && <small>Gift: access is granted without a payment or revenue record. This applies to Assign plan only.</small>}
              <button className="office-button-primary" disabled={!selectedPlanId || busy === `assign-${businessId}`} onClick={() => onAction(`assign-${businessId}`, `/office/businesses/${businessId}/subscription`, { method: 'PUT', body: JSON.stringify({ subscription_plan_id: Number(selectedPlanId), record_financial: recordFinancial, ...(subscriptionBook ? { account_id: Number(subscriptionBook) } : {}) }) })}><CreditCard size={15} /> {busy === `assign-${businessId}` ? 'Assigning…' : 'Assign plan'}</button>
              {detailPresentation.canRenew && <div className="office-subscription-action-row">
                <button disabled={busy === `renew-${businessId}`} onClick={() => onAction(`renew-${businessId}`, `/office/businesses/${businessId}/subscription/renew`, { method: 'POST', body: JSON.stringify(subscriptionBook ? { account_id: Number(subscriptionBook) } : {}) })}><RefreshCw size={14} /> {busy === `renew-${businessId}` ? 'Renewing…' : 'Renew current'}</button>
                {current.status === 'active' && billing.is_valid && <button className="office-button-danger" disabled={busy === `suspend-${businessId}`} onClick={() => changeSubscriptionStatus('suspended')}><Ban size={14} /> {busy === `suspend-${businessId}` ? 'Suspending…' : 'Suspend'}</button>}
                {billing.reason === 'cancelled' && <button className="office-button-primary" disabled={busy === `reactivate-${businessId}`} onClick={() => changeSubscriptionStatus('active')}><ShieldCheck size={14} /> {busy === `reactivate-${businessId}` ? 'Reactivating…' : 'Reactivate'}</button>}
              </div>}
            </div>
          </section>

          <form className="office-panel office-password-reset" onSubmit={resetPassword}>
            <div className="office-panel-header"><div><h2>Reset owner password</h2><p>Replace the password used at the next sign-in.</p></div><span><KeyRound size={16} /></span></div>
            <div className="office-password-reset-body">
              <label>New password<span className="office-settings-password"><LockKeyhole size={15} /><input required minLength="8" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password.password} onChange={(event) => setPassword({ ...password, password: event.target.value })} placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label>
              <label>Confirm password<span className="office-settings-password"><LockKeyhole size={15} /><input required minLength="8" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password.password_confirmation} onChange={(event) => setPassword({ ...password, password_confirmation: event.target.value })} placeholder="Repeat the new password" /></span></label>
              {resetSuccess && <div className="office-success" role="status"><Check size={15} /> {resetSuccess}</div>}
              <button className="office-button-primary" disabled={resetBusy}><KeyRound size={15} /> {resetBusy ? 'Resetting…' : 'Reset password'}</button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function PlansPage({ plans, onEdit }) {
  return (
    <section className="office-panel office-table-panel">
      <div className="office-table-summary">
        <div><strong>{plans.length} subscription plan{plans.length === 1 ? '' : 's'}</strong><span>{plans.filter((plan) => plan.is_active && plan.is_public && !plan.is_system).length} currently available for purchase</span></div>
      </div>
      {plans.length ? (
        <div className="office-table-scroll">
          <table className="office-data-table office-plan-table">
            <thead><tr><th>Plan</th><th>Price</th><th>Billing term</th><th>Features</th><th>Availability</th><th>Order</th><OfficeActionHeader /></tr></thead>
            <tbody>{plans.map((plan) => (
              <tr key={plan.id}>
                <td><div className="office-cell-stack"><strong>{plan.name}</strong><small>{plan.description || 'No description'}</small></div></td>
                <td><strong className="office-price">{money(plan.price, plan.currency)}</strong></td>
                <td>{plan.duration_days} days</td>
                <td><div className="office-feature-list">{plan.features?.length ? plan.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>) : <small>No features listed</small>}{plan.features?.length > 3 && <span>+{plan.features.length - 3}</span>}</div></td>
                <td><StatusBadge status={plan.is_system ? 'pending' : plan.is_active ? 'active' : 'hidden'}>{plan.is_system ? 'System' : plan.is_active ? 'Published' : 'Hidden'}</StatusBadge></td>
                <td>{plan.sort_order}</td>
                <OfficeActionCell>{plan.is_system ? <span className="office-muted">—</span> : <RowActions label={plan.name}><button type="button" onClick={() => onEdit(plan)}><Pencil size={14} /> Edit plan</button></RowActions>}</OfficeActionCell>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState icon={CreditCard} title="No plans yet" message="Create the first subscription plan to begin selling access." />}
    </section>
  );
}

function PaymentMethodsPage({ paymentMethods, busy, onEdit, onDelete }) {
  return (
    <section className="office-panel office-table-panel">
      <div className="office-table-summary">
        <div><strong>{paymentMethods.length} payment method{paymentMethods.length === 1 ? '' : 's'}</strong><span>{paymentMethods.filter((item) => item.is_active).length} currently visible to clients</span></div>
      </div>
      {paymentMethods.length ? (
        <div className="office-table-scroll">
          <table className="office-data-table office-payment-method-table">
            <thead><tr><th>Bank</th><th>Account name</th><th>Account number</th><th>Availability</th><th>Order</th><OfficeActionHeader /></tr></thead>
            <tbody>{paymentMethods.map((item) => (
              <tr key={item.id}>
                <td><div className="office-entity"><span><Landmark size={16} /></span><div><strong>{item.bank}</strong><small>Payment method #{item.id}</small></div></div></td>
                <td><strong>{item.account_name}</strong></td>
                <td><span className="office-account-number">{item.account_no}</span></td>
                <td><StatusBadge status={item.is_active ? 'active' : 'hidden'}>{item.is_active ? 'Available' : 'Hidden'}</StatusBadge></td>
                <td>{item.sort_order}</td>
                <OfficeActionCell><RowActions label={`${item.bank} payment method`} disabled={busy === `delete-payment-${item.id}`}>
                  <button type="button" onClick={() => onEdit(item)}><Pencil size={14} /> Edit method</button>
                  <button type="button" className="danger-button" onClick={() => onDelete(item)}><Trash2 size={14} /> Delete method</button>
                </RowActions></OfficeActionCell>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState icon={Landmark} title="No payment methods yet" message="Add a bank account before clients submit subscription payments." />}
    </section>
  );
}

function PaymentProofModal({ proof, busy, onApprove, onClose }) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    apiBlob(proof.payment_screenshot_url)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((loadError) => active && setError(loadError.message));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proof.payment_screenshot_url]);

  return (
    <div className="office-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="office-modal office-proof-modal" role="dialog" aria-modal="true" aria-labelledby="payment-proof-title">
        <div className="office-modal-header">
          <div><h2 id="payment-proof-title">Payment screenshot</h2><p>{proof.business_name} · {proof.plan_name} · {money(proof.price, proof.currency)}</p></div>
          <button type="button" className="office-icon-button mkpos-dismiss-icon" onClick={onClose} aria-label="Close payment screenshot"><X size={17} /></button>
        </div>
        <div className="office-proof-details"><Landmark size={16} /><span><strong>{proof.payment_bank}</strong>{proof.payment_account_name} · {proof.payment_account_no}</span></div>
        <PaymentReceiptCheck validation={proof.prevalidation} />
        <div className="office-proof-image">
          {!imageUrl && !error && <div className="office-loading"><RefreshCw size={20} className="office-spin" /><strong>Loading payment proof</strong></div>}
          {error && <div className="feedback error" role="alert">{error}</div>}
          {imageUrl && <img src={imageUrl} alt={`Payment screenshot from ${proof.business_name}`} />}
        </div>
        <div className="office-modal-footer"><button type="button" onClick={onClose}>Close</button>{proof.status === 'pending' && <button className="office-button-approve" disabled={busy === `approve-${proof.id}`} onClick={() => { onClose(); onApprove(proof); }}><Check size={14} /> Approve payment</button>}</div>
      </div>
    </div>
  );
}

function RequestsPage({ requests, busy, onAction, onOpenBusiness, query, onQueryChange, refreshToken = 0, filterOpen = false, onFilterClose = () => {}, alertTarget }) {
  const [rejectingRequest, setRejectingRequest] = useState(null), [rejectionReason, setRejectionReason] = useState(''), [rejectionError, setRejectionError] = useState('');
  const rejectionSaving = useRef(false), rejectionFormId = useId();
  const rejectionBusy = Boolean(rejectingRequest && busy === `reject-${rejectingRequest.id}`);
  async function submitRejection(event) {
    event.preventDefault();if (rejectionSaving.current || !rejectingRequest) return;
    if (rejectionReason.trim().length < 5) { setRejectionError('Enter a reason of at least 5 characters.');return; }
    rejectionSaving.current = true;setRejectionError('');
    try {
      const saved = await onAction(`reject-${rejectingRequest.id}`, `/office/subscription-requests/${rejectingRequest.id}/reject`, { method: 'POST', body: JSON.stringify({ admin_note: rejectionReason.trim() }) });
      if (saved) setRejectingRequest(null);else setRejectionError('Could not reject this request. Your reason is kept; please try again.');
    } finally { rejectionSaving.current = false; }
  }
  const [filterDraft, setFilterDraft] = useState(query);
  const [previousFilterOpen, setPreviousFilterOpen] = useState(filterOpen);
  if (previousFilterOpen !== filterOpen) {
    setPreviousFilterOpen(filterOpen);
    if (filterOpen) setFilterDraft(query);
  }
  const [proof, setProof] = useState(null), [approvingRequest, setApprovingRequest] = useState(null);
  const openedAlerts = useRef(new Set());
  useEffect(() => {
    if (!alertTarget || openedAlerts.current.has(alertTarget.key)) return;
    let active = true;
    api('/office/subscription-requests').then(data => {
      if (!active) return;
      const row = data.items?.find(item => Number(item.id) === Number(alertTarget.id));
      if (row) { openedAlerts.current.add(alertTarget.key); setProof(row); }
    }).catch(() => {});
    return () => { active = false; };
  }, [alertTarget]);
  const [history, setHistory] = useState({ key: '', data: null, error: '' });
  const [retry, setRetry] = useState(0);
  const historyParams = new URLSearchParams({ q: query.q, currency: query.currency, type: query.type, from: query.from || '', to: query.to || '', per_page: query.per_page, page: query.page });
  const historyKey = `${historyParams}&refresh=${refreshToken}&retry=${retry}`;
  const historyLoading = query.view === 'history' && history.key !== historyKey;
  const historyData = query.view === 'history' && !historyLoading ? history.data : null;
  const historyError = query.view === 'history' && !historyLoading ? history.error : '';
  const counts = useMemo(() => requests.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }), {}), [requests]);
  const search = query.q.toLowerCase();
  const filtered = requests.filter(item => paymentMatchesDates(item, query) && (query.view === 'all' || item.status === query.view) && (!search || [item.business_name, item.plan_name, item.payment_bank].some(value => String(value || '').toLowerCase().includes(search))));
  const historyItems = historyData?.items || [];
  const hasRows = query.view === 'history' ? historyItems.length > 0 : filtered.length > 0;

  useEffect(() => {
    if (query.view !== 'history' && (!filterOpen || filterDraft.view !== 'history')) return undefined;
    let current = true;
    api(`/office/subscription-payments?${historyKey}`)
      .then(data => { if (current) setHistory({ key: historyKey, data, error: '' }); })
      .catch(error => { if (current) setHistory({ key: historyKey, data: null, error: error.message }); });
    return () => { current = false; };
  }, [query, filterOpen, filterDraft.view, historyKey]);

  return (
    <section className="office-panel office-table-panel">
      <FilterDrawer open={filterOpen} title="Payment filters" onClose={onFilterClose}>
        <form className="office-drawer-filter-form" aria-label="Payment filters" onSubmit={(event) => { event.preventDefault(); if (filterDraft.from && filterDraft.to && filterDraft.from > filterDraft.to) return; onQueryChange({ ...query, view: filterDraft.view, from: filterDraft.from || '', to: filterDraft.to || '', currency: filterDraft.view === 'history' ? filterDraft.currency : '', type: filterDraft.view === 'history' ? filterDraft.type : 'all', page: 1 }); onFilterClose(); }}>
          <div className="office-drawer-filter-fields">
            <label>Show<select value={filterDraft.view} onChange={event => setFilterDraft(current => ({ ...current, view: event.target.value }))}><option value="pending">Needs approval ({counts.pending || 0})</option><option value="approved">Approved requests ({counts.approved || 0})</option><option value="rejected">Rejected requests ({counts.rejected || 0})</option><option value="all">All requests ({requests.length})</option><option value="history">Recorded payments</option></select></label>
            {filterDraft.from && filterDraft.to && filterDraft.from > filterDraft.to && <p className="feedback error" role="alert">From date cannot be later than To date.</p>}
            <label>From date<input type="date" value={filterDraft.from || ''} max={filterDraft.to || undefined} onChange={event => setFilterDraft(current => ({ ...current, from: event.target.value }))} /></label>
            <label>To date<input type="date" value={filterDraft.to || ''} min={filterDraft.from || undefined} onChange={event => setFilterDraft(current => ({ ...current, to: event.target.value }))} /></label>
            {filterDraft.view === 'history' && <>
              <label>Currency<select value={filterDraft.currency} onChange={event => setFilterDraft(current => ({ ...current, currency: event.target.value }))}><option value="">All currencies</option>{(history.data?.currencies || []).map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
              <label>Type<select value={filterDraft.type} onChange={event => setFilterDraft(current => ({ ...current, type: event.target.value }))}><option value="all">All types</option><option value="assignment">New subscription</option><option value="renewal">Renewal</option></select></label>
            </>}
          </div>
          <div className="office-drawer-filter-actions"><button type="button" onClick={() => { setFilterDraft(initialPaymentQuery); onQueryChange({ ...query, view: 'pending', currency: '', type: 'all', from: '', to: '', page: 1 }); onFilterClose(); }}>Reset to needs approval</button><button type="submit" className="office-button-primary">Apply filters</button></div>
        </form>
      </FilterDrawer>
      {historyError && <div className="feedback error" role="alert">{historyError} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
      {historyLoading ? <OfficeTableLoading columns={["Business", "Plan", "Amount", "Payment", "Date", "Details", "Status"]} label="Loading payments..."/> : hasRows ? (
        <div className="office-table-scroll">
          <table className="office-data-table office-request-table">
            <thead><tr><th>Business</th><th>Plan</th><th>Amount</th><th>Payment</th><th>Date</th><th>Details</th><th>Status</th><OfficeActionHeader /></tr></thead>
            <tbody>{query.view === 'history' ? historyItems.map(item => <tr key={`payment-${item.id}`}>
              <td><div className="office-entity"><span><Building2 size={16} /></span><div><strong>{item.business_name}</strong><small>Payment #{item.id}</small></div></div></td>
              <td><div className="office-cell-stack"><strong>{item.plan_name}</strong><small>{item.duration_days} days</small></div></td>
              <td><strong>{money(item.amount, item.currency)}</strong></td>
              <td><div className="office-cell-stack"><strong>{item.type === 'renewal' ? 'Renewal' : 'New subscription'}</strong><small>{item.created_by_name ? `Recorded by ${item.created_by_name}` : 'System record'}</small></div></td>
              <td>{dateTime(item.paid_at)}</td>
              <td><span className="office-message" title={item.note || ''}>{item.note || '—'}</span></td>
              <td><StatusBadge status="approved">Paid</StatusBadge></td>
              <OfficeActionCell><RowActions label={`payment ${item.id}`}><button type="button" onClick={() => onOpenBusiness(item.business_id)}><Eye size={14} /> View business</button></RowActions></OfficeActionCell>
            </tr>) : filtered.map((item) => (
              <tr key={item.id}>
                <td><div className="office-entity"><span><Building2 size={16} /></span><div><strong>{item.business_name}</strong><small>Request #{item.id}</small></div></div></td>
                <td><div className="office-cell-stack"><strong>{item.plan_name}</strong><small>{item.duration_days} days</small></div></td>
                <td><strong>{money(item.price, item.currency)}</strong></td>
                <td><div className="office-cell-stack"><strong>{item.payment_bank || 'Not recorded'}</strong><small>{item.payment_account_name || ''}{item.payment_account_no ? ` · ${item.payment_account_no}` : ''}</small>{item.payment_screenshot_available && <small>Screenshot attached</small>}</div></td>
                <td>{dateTime(item.created_at)}</td>
                <td><span className="office-message" title={item.message || ''}>{item.message || '—'}</span></td>
                <td><div className="office-cell-stack"><StatusBadge status={item.status} /><PaymentReceiptCheck validation={item.prevalidation} compact /></div></td>
                <OfficeActionCell>{(item.payment_screenshot_available || item.status === 'pending') ? <RowActions label={`request ${item.id}`} disabled={Boolean(busy)}>
                  {item.payment_screenshot_available && <button type="button" onClick={() => setProof(item)}><ImageIcon size={14} /> View screenshot</button>}
                  {item.status === 'pending' && <button type="button" onClick={() => setApprovingRequest(item)}><Check size={14} /> Approve request</button>}
                  {item.status === 'pending' && <button type="button" className="danger-button" onClick={() => { setRejectingRequest(item);setRejectionReason('');setRejectionError(''); }}><X size={14} /> Reject request</button>}
                </RowActions> : <span className="office-muted">—</span>}</OfficeActionCell>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : !historyError && <EmptyState icon={ReceiptText} title={query.view === 'history' ? 'No recorded payments' : 'No payments in this view'} message={query.view === 'pending' ? 'New payment requests awaiting approval will appear here.' : 'Adjust the payment filters or search.'} />}
      {query.view === 'history' && historyData && <OfficeTablePagination label="Payment" total={historyData.total} page={historyData.page} perPage={historyData.per_page || query.per_page} lastPage={historyData.last_page} disabled={Boolean(busy)} onPageChange={page => onQueryChange({ ...query, page })} onPerPageChange={per_page => onQueryChange({ ...query, per_page, page: 1 })} />}
      {proof && <PaymentProofModal proof={requests.find(item => item.id === proof.id) || proof} busy={busy} onApprove={setApprovingRequest} onClose={() => setProof(null)} />}
      {approvingRequest && <PaymentApprovalModal request={requests.find(item => item.id === approvingRequest.id) || approvingRequest} onClose={() => setApprovingRequest(null)} onAction={onAction} />}
      {rejectingRequest && <OfficeModal title="Reject subscription request" description={rejectingRequest.business_name} closeLabel="Close rejection form" busy={rejectionBusy} onClose={() => { if (!rejectionSaving.current) setRejectingRequest(null); }} footer={<><button type="button" disabled={rejectionBusy} onClick={() => setRejectingRequest(null)}>Cancel</button><button type="submit" form={rejectionFormId} className="danger-button" disabled={rejectionBusy}>{rejectionBusy ? 'Rejecting...' : 'Reject request'}</button></>}><form id={rejectionFormId} onSubmit={submitRejection}><label>Reason sent to owner<textarea required minLength={5} maxLength={2000} value={rejectionReason} disabled={rejectionBusy} onChange={event => setRejectionReason(event.target.value)} /></label>{rejectionError && <p role="alert">{rejectionError}</p>}</form></OfficeModal>}
    </section>
  );
}

const releasePlatforms = [
  { key: 'windows', label: 'Windows 64-bit', extension: '.exe', icon: MonitorDown, description: '64-bit portable or installer build for modern Windows computers.' },
  { key: 'windows32', label: 'Windows 32-bit', extension: '.exe', icon: MonitorDown, description: '32-bit portable build for older x86 Windows computers.' },
  { key: 'android', label: 'Android mobile', extension: '.apk', icon: Smartphone, description: 'Installable Android application package.' },
];

function ReleaseSettings({ refreshToken = 0 }) {
  const [releaseData, setReleaseData] = useState(null);
  const [forms, setForms] = useState({
    windows: { version: '', release_notes: '', file: null },
    windows32: { version: '', release_notes: '', file: null },
    android: { version: '', release_notes: '', file: null },
  });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadReleases = useCallback(async () => {
    setError('');
    try {
      setReleaseData(await api('/office/app-releases'));
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadReleases, 0);
    return () => window.clearTimeout(timer);
  }, [loadReleases, refreshToken]);

  function field(platform, name, value) {
    setForms((current) => ({ ...current, [platform]: { ...current[platform], [name]: value } }));
  }

  async function publish(event, platform, currentRelease) {
    event.preventDefault();
    const form = forms[platform];
    const platformInfo = releasePlatforms.find((item) => item.key === platform);
    if (!form.file) {
      setError(`Choose the ${platformInfo.extension} file to publish.`);
      return;
    }
    if (currentRelease && !window.confirm(`Replace the published ${platformInfo.label} version ${currentRelease.version}?`)) return;

    setBusy(platform);
    setError('');
    setSuccess('');
    try {
      await apiUpload(`/office/app-releases/${platform}`, form.file, {
        version: form.version.trim(),
        release_notes: form.release_notes.trim(),
      });
      setForms((current) => ({ ...current, [platform]: { version: '', release_notes: '', file: null } }));
      setSuccess(`${platformInfo.label} version ${form.version.trim()} is now published on the landing page.`);
      await loadReleases();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy('');
    }
  }

  const byPlatform = Object.fromEntries((releaseData?.items || []).map((item) => [item.platform, item.release]));

  return (
    <section className="office-panel office-release-settings">
      {releaseData && <p className="office-release-limit">Maximum file size: {fileSize(releaseData.max_file_size)}</p>}

      {error && <div className="feedback error" role="alert">{error}</div>}
      {success && <div className="office-success" role="status"><Check size={15} /> {success}</div>}

      {!releaseData ? <div className="office-release-loading"><RefreshCw size={16} className="office-spin" /> Loading published applications…</div> : (
        <div className="office-release-grid">
          {releasePlatforms.map(({ key, label, extension, icon: Icon, description }) => {
            const release = byPlatform[key];
            const form = forms[key];
            return (
              <form className="office-release-card" key={`${key}-${release?.published_at || 'new'}`} onSubmit={(event) => publish(event, key, release)}>
                <div className="office-release-card-heading">
                  <span>{React.createElement(Icon, { size: 19 })}</span>
                  <div><h3>{label}</h3><p>{description}</p></div>
                  <StatusBadge status={release ? 'active' : 'none'}>{release ? 'Published' : 'Not published'}</StatusBadge>
                </div>

                {release ? (
                  <div className="office-release-current">
                    <div><small>Current version</small><strong>{release.version}</strong></div>
                    <div><small>File size</small><strong>{fileSize(release.file_size)}</strong></div>
                    <div><small>Published</small><strong>{dateTime(release.published_at)}</strong></div>
                    <a href={release.download_url}><Download size={14} /> Test download</a>
                  </div>
                ) : <div className="office-release-empty">Upload the first {extension} file to enable its website download button.</div>}

                <div className="office-release-fields">
                  <label>Version<input required maxLength="40" placeholder="e.g. 1.0.0" value={form.version} onChange={(event) => field(key, 'version', event.target.value)} /></label>
                  <label className="office-release-file">Application file<input required type="file" accept={extension} onChange={(event) => field(key, 'file', event.target.files?.[0] || null)} /><span><Upload size={14} /> {form.file ? `${form.file.name} · ${fileSize(form.file.size)}` : `Choose ${extension} file`}</span></label>
                  <label className="office-release-notes">Release notes <span>(optional)</span><textarea maxLength="2000" rows="3" placeholder="What changed in this release?" value={form.release_notes} onChange={(event) => field(key, 'release_notes', event.target.value)} /></label>
                </div>
                <footer><span>{release ? 'Uploading replaces the current public file.' : 'The file becomes public after upload completes.'}</span><button className="office-button-primary" disabled={busy === key}><Upload size={14} /> {busy === key ? 'Publishing…' : release ? 'Replace release' : 'Publish release'}</button></footer>
              </form>
            );
          })}
        </div>
      )}
    </section>
  );
}

const officeSettingsTabs = [
  { id: 'account', label: 'Account', subtitle: 'Profile and sign-in security', description: 'Manage your Office profile and sign-in credentials.', icon: UserRound },
  { id: 'contacts', label: 'Community & contact', subtitle: 'Public support information', description: 'Set the support channels and community link shown across PwarMyar.', icon: MessageCircle },
  { id: 'downloads', label: 'Application downloads', subtitle: 'Published app releases', description: 'Publish Android and Windows downloads shown on the PwarMyar website.', icon: Download },
  { id: 'theme', label: 'Theme & branding', subtitle: 'Colors and appearance for all apps', description: 'Manage the shared light and dark theme, palette and brand assets.', icon: Settings, superAdminOnly: true },
  { id: 'ai-provider', label: 'AI provider', subtitle: 'DeepSeek credentials & connection', description: 'Manage the shared DeepSeek API key and test its connection.', icon: Bot, superAdminOnly: true },
  { id: 'ai-assistant', label: 'Wyne Wyne AI assistant', subtitle: 'Model, availability & request limits', description: 'Configure the in-app Wyne Wyne assistant.', icon: Bot, superAdminOnly: true },
  { id: 'ai-pricing', label: 'Sales AI pricing', subtitle: 'Exchange rate & platform markup', description: 'Configure currency conversion and Sales AI usage pricing.', icon: Bot, superAdminOnly: true },
  { id: 'telegram-support', label: 'Telegram customer service', subtitle: 'Support bot configuration', description: 'Connect and configure the PwarMyar customer-service Telegram bot.', icon: Bot, superAdminOnly: true },
];

function SettingsPage({ session, onSessionChange, refreshToken = 0, activeTab = 'account', onTabChange }) {
  const [themeVisited, setThemeVisited] = useState(activeTab === 'theme');
  const aiTabs = ['ai-provider', 'ai-assistant', 'ai-pricing'];
  const [assistantVisited, setAssistantVisited] = useState(aiTabs.includes(activeTab));
  const [telegramVisited, setTelegramVisited] = useState(activeTab === 'telegram-support');
  const settingsTabs = officeSettingsTabs.filter(tab => !tab.superAdminOnly || session.admin.role === 'super_admin');
  const selectedTab = settingsTabs.some(tab => tab.id === activeTab) ? activeTab : 'account';
  const activeTabInfo = settingsTabs.find(tab => tab.id === selectedTab);
  if (selectedTab === 'theme' && !themeVisited) setThemeVisited(true);
  if (aiTabs.includes(selectedTab) && !assistantVisited) setAssistantVisited(true);
  if (selectedTab === 'telegram-support' && !telegramVisited) setTelegramVisited(true);
  const [form, setForm] = useState({
    name: session.admin.name || '',
    email: session.admin.email || '',
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [visible, setVisible] = useState({ current: false, next: false, confirmation: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function field(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const nextSession = await api('/office/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      onSessionChange(nextSession);
      setForm((current) => ({ ...current, current_password: '', password: '', password_confirmation: '' }));
      setSuccess(form.password ? 'Profile and sign-in password updated.' : 'Profile credentials updated.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  function passwordField(label, name, visibilityKey, autoComplete, placeholder) {
    return (
      <label>
        {label}
        <span className="office-settings-password">
          <LockKeyhole size={15} />
          <input required={name === 'current_password'} minLength={name === 'password' ? 8 : undefined} type={visible[visibilityKey] ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} value={form[name]} onChange={(event) => field(name, event.target.value)} />
          <button type="button" onClick={() => setVisible({ ...visible, [visibilityKey]: !visible[visibilityKey] })} aria-label={visible[visibilityKey] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>{visible[visibilityKey] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </span>
      </label>
    );
  }

  return (
    <div className="office-settings-workspace">
      <nav className="office-settings-side-tabs" aria-label="Settings sections">
        {[{ label: 'General settings', ai: false }, { label: 'AI settings', ai: true }].map(group => {
          const items = settingsTabs.filter(tab => (aiTabs.includes(tab.id) || tab.id === 'telegram-support') === group.ai);
          return items.length > 0 && <section className="office-settings-menu-group" key={group.label} aria-label={group.label}>
          <h2>{group.label}</h2>
          {items.map(tab => <button key={tab.id} type="button" aria-current={selectedTab === tab.id ? 'page' : undefined} className={selectedTab === tab.id ? 'selected' : ''} onClick={() => onTabChange(tab.id)}>
          <tab.icon size={18} /><span><strong>{tab.label}</strong><small>{tab.subtitle}</small></span>
          </button>)}
          </section>;
        })}
      </nav>
      <div className="office-settings-panel">
        <div className="office-settings-panel-heading"><span className="office-settings-panel-icon"><activeTabInfo.icon size={20} /></span><div><strong>{activeTabInfo.label}</strong><span>{activeTabInfo.description}</span></div></div>
        {selectedTab === 'account' && <div className="office-settings-account-content">
      <aside className="office-panel office-account-card">
        <div className="office-account-avatar">{session.admin.name?.charAt(0).toUpperCase() || 'O'}</div>
        <h2>{session.admin.name}</h2>
        <p>{session.admin.email}</p>
        <StatusBadge status="active">Active owner</StatusBadge>
        <div className="office-account-note"><ShieldCheck size={16} /><span><strong>Protected account</strong><small>Your current password is required before any credential can be changed.</small></span></div>
      </aside>

      <form className="office-panel office-settings-form" onSubmit={submit}>
        <section>
          <div className="office-settings-section-heading"><span><UserRound size={17} /></span><div><h2>Account profile</h2><p>This information identifies your administrator account inside Office.</p></div></div>
          <div className="office-settings-grid">
            <label>Display name<span className="office-settings-input"><UserRound size={15} /><input required autoComplete="name" value={form.name} onChange={(event) => field('name', event.target.value)} /></span></label>
            <label>Email address<span className="office-settings-input"><Mail size={15} /><input required type="email" autoComplete="email" value={form.email} onChange={(event) => field('email', event.target.value)} /></span></label>
          </div>
        </section>

        <section className="office-settings-security">
          <div className="office-settings-section-heading"><span><LockKeyhole size={17} /></span><div><h2>Sign-in security</h2><p>Confirm your current password. Leave the new password fields empty to keep it unchanged.</p></div></div>
          <div className="office-settings-current">{passwordField('Current password', 'current_password', 'current', 'current-password', 'Required to save changes')}</div>
          <div className="office-settings-grid">
            {passwordField('New password', 'password', 'next', 'new-password', 'At least 8 characters')}
            {passwordField('Confirm new password', 'password_confirmation', 'confirmation', 'new-password', 'Repeat the new password')}
          </div>
        </section>

        {error && <div className="feedback error" role="alert">{error}</div>}
        {success && <div className="office-success" role="status"><Check size={15} /> {success}</div>}
        <footer className="office-settings-footer"><span>Changes take effect immediately.</span><button className="office-button-primary" disabled={busy}><Save size={15} /> {busy ? 'Saving…' : 'Save credentials'}</button></footer>
      </form>
        </div>}
        {selectedTab === 'downloads' && <ReleaseSettings refreshToken={refreshToken} />}
        {selectedTab === 'contacts' && <ContactSettingsPage refreshToken={refreshToken} />}
        {themeVisited && session.admin.role === 'super_admin' && <div className="office-settings-detail-content" hidden={selectedTab !== 'theme'}><BrandingPage refreshToken={refreshToken} /></div>}
        {assistantVisited && session.admin.role === 'super_admin' && <div className="office-settings-detail-content" hidden={!aiTabs.includes(selectedTab)}><AiAssistantSettingsPage refreshToken={refreshToken} view={selectedTab === 'ai-provider' ? 'provider' : selectedTab === 'ai-pricing' ? 'pricing' : 'assistant'} /></div>}
        {telegramVisited && session.admin.role === 'super_admin' && <div className="office-settings-detail-content" hidden={selectedTab !== 'telegram-support'}><TelegramSupportSettingsPage active={selectedTab === 'telegram-support'} refreshToken={refreshToken} /></div>}
      </div>
    </div>
  );
}

export function Dashboard({ session, onLogout, onSessionChange }) {
  const [pageNavigationHost, setPageNavigationHost] = useState(null);
  const [pageSearchHost, setPageSearchHost] = useState(null);
  const [pageActionsHost, setPageActionsHost] = useState(null);
  const [navigationState, setNavigation] = useState(() => readOfficeNavigation(session.admin));
  const rawPage = navigationState.entries[navigationState.index];
  const currentPage = { ...normalizeOfficePage(rawPage, session.admin), alertTarget: rawPage.alertTarget };
  const tab = currentPage.tab;
  const selectedBusinessId = currentPage.businessId;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('mkpos-office-sidebar-collapsed') === 'true');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [businessSummary, setBusinessSummary] = useState(null);
  const [businessQuery, setBusinessQuery] = useState(initialBusinessQuery);
  const [businessSearch, setBusinessSearch] = useState(initialBusinessQuery.q);
  const [paymentQuery, setPaymentQuery] = useState(initialPaymentQuery);
  const [paymentSearch, setPaymentSearch] = useState(initialPaymentQuery.q);
  const [reportQuery, setReportQuery] = useState(initialReportQuery);
  const [reportSearch, setReportSearch] = useState('');
  const [requests, setRequests] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [financialReport, setFinancialReport] = useState(null);
  const [editingPlan, setEditingPlan] = useState(undefined);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const activePlans = useMemo(() => plans.filter((plan) => plan.is_active && plan.is_public && !plan.is_system), [plans]);
  const pendingCount = requests.filter((item) => item.status === 'pending').length;
  const businessFilterCount = [businessQuery.access !== 'all', businessQuery.prospect !== 'all', businessQuery.deletion_candidate !== 'all', businessQuery.sort !== 'potential'].filter(Boolean).length;
  const paymentFilterCount = [paymentQuery.view !== 'pending', paymentQuery.view === 'history' && paymentQuery.currency !== '', paymentQuery.view === 'history' && paymentQuery.type !== 'all', Boolean(paymentQuery.from || paymentQuery.to)].filter(Boolean).length;

  useEffect(() => {
    const q = businessSearch.trim();
    if (q === businessQuery.q) return undefined;
    const timer = window.setTimeout(() => setBusinessQuery(current => ({ ...current, q, page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [businessSearch, businessQuery.q]);

  useEffect(() => {
    const q = paymentSearch.trim();
    if (q === paymentQuery.q) return undefined;
    const timer = window.setTimeout(() => setPaymentQuery(current => ({ ...current, q, page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [paymentSearch, paymentQuery.q]);

  useEffect(() => {
    window.localStorage.setItem('mkpos-office-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    writeOfficeNavigation(navigationState, session.admin);
  }, [navigationState, session.admin]);

  useEffect(() => {
    function restorePage() {
      setNavigation((current) => restoreOfficeNavigation(current, session.admin));
      setMobileNavOpen(false);
      setFilterOpen(false);
    }
    window.addEventListener('popstate', restorePage);
    window.addEventListener('hashchange', restorePage);
    return () => { window.removeEventListener('popstate', restorePage); window.removeEventListener('hashchange', restorePage); };
  }, [session.admin]);

  useEffect(() => {
    function closeNavigation(event) {
      if (event.key === 'Escape') setMobileNavOpen(false);
    }
    window.addEventListener('keydown', closeNavigation);
    return () => window.removeEventListener('keydown', closeNavigation);
  }, []);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [planData, paymentMethodData, businessData, requestData, financialData] = await Promise.all([
        api('/office/plans'),
        api('/office/payment-methods'),
        api('/office/businesses?per_page=6&sort=newest'),
        api('/office/subscription-requests'),
        api('/office/financial-report'),
      ]);
      setPlans(planData.items);
      setPaymentMethods(paymentMethodData.items);
      setBusinesses(businessData.items);
      setBusinessSummary(businessData.summary);
      setRequests(requestData.items);
      setFinancialReport(financialData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function action(key, path, options) {
    setBusy(key);
    setError('');
    try {
      await api(path, options);
      await load(false);
      if (/\/subscription-requests\/\d+\/reject$/.test(path)) {
        window.dispatchEvent(new Event('mkpos:office-request-reviewed'));
      } else {
        setRefreshToken((current) => current + 1);
      }
      return true;
    } catch (actionError) {
      setError(actionError.message);
      return false;
    } finally {
      setBusy('');
    }
  }

  async function logout() {
    await api('/office/auth/logout', { method: 'POST' });
    clearOfficeNavigation(session.admin);
    onLogout();
  }

  function openBusiness(businessId) {
    navigate('business-detail', businessId);
  }

  const navigation = [
    { label: 'Workspace', items: [
      ['overview', LayoutDashboard, 'Overview'],
      ['businesses', Building2, 'Businesses'],
      ['platform-users', Users, 'Platform users'],
    ] },
    { label: 'Reviews & reports', items: [
      ['shop-reports', Flag, 'Shop reports'],
      ['error-reports', Flag, 'Error reports'],
      ['product-reviews', MessageSquare, 'Product reviews'],
      ['shop-reviews', MessageSquare, 'Shop reviews'],
    ] },
    { label: 'Marketplace', items: [
      ['marketplace-products', Package, 'Products'],
      ['marketplace-categories', Boxes, 'Marketplace categories'],
    ] },
    { label: 'Subscriptions', items: [
      ['plans', CreditCard, 'Plans'],
      ['payment-methods', Landmark, 'Payment methods'],
      ['requests', ReceiptText, 'Payment'],
      ['sales-ai-topups', Bot, 'Sales AI top-ups'],
    ] },
    { label: 'Finance', items: [
      ['financial', ChartColumnIncreasing, 'Financial report'],
      ['financial-book', WalletCards, 'Financial book'],
      ['bank-books', Landmark, 'Bank books'],
      ['founders', Users, 'Founders'],
    ] },
    ...(session.admin.role === 'super_admin' ? [{ label: 'AI', items: [
      ['ai-usage', ChartColumnIncreasing, 'Usage reports'],
      ['ai-requests', Bot, 'Balance book'],
      ['agent-skills', Bot, 'Skills'],
      ['agent-assignments', Bot, 'Agent assignments'],
    ] }] : []),
    { label: 'System', items: [
      ...(session.admin.role === 'super_admin' ? [['server-health', ShieldCheck, 'Server health']] : []),
      ['tutorials', MonitorDown, 'Tutorials'],
      ['settings', Settings, 'Settings'],
      ['activity-log', ClipboardList, 'Activity log'],
      ...(session.admin.role === 'super_admin' ? [['admins', Users, 'Administrators'], ['branding', Settings, 'Branding']] : []),
    ] },
  ];
  const showAppbarBack = tab === 'founders' || !navigation.some(group => group.items.some(([value]) => value === tab));
  const backPage = navigationState.index > 0 ? normalizeOfficePage(navigationState.entries[navigationState.index - 1], session.admin).tab
    : tab === 'business-detail' ? 'businesses' : 'financial-book';

  function navigate(value, businessId = null, alertTarget = null, settingsTab = null) {
    if (value === 'settings' && !settingsTab) settingsTab = [...navigationState.entries].reverse().find(page => page.tab === 'settings')?.settingsTab || 'account';
    const page = normalizeOfficePage({ tab: value, businessId, settingsTab }, session.admin);
    if (tab === page.tab && selectedBusinessId === page.businessId && currentPage.settingsTab === page.settingsTab && !alertTarget) return;
    const nextIndex = navigationState.index + 1;
    const next = { key: navigationState.key, entries: [...navigationState.entries.slice(0, nextIndex), { ...page, alertTarget }], index: nextIndex };
    writeOfficeNavigation(next, session.admin, 'push');
    setNavigation(next);
    setMobileNavOpen(false);
    setFilterOpen(false);
  }

  function goBack() {
    if (navigationState.index === 0) {
      const next = { key: navigationState.key, entries: [normalizeOfficePage({ tab: backPage }, session.admin)], index: 0 };
      writeOfficeNavigation(next, session.admin);
      setNavigation(next);
      setMobileNavOpen(false); setFilterOpen(false);
      return;
    }
    window.history.back();
    setMobileNavOpen(false);
    setFilterOpen(false);
  }

  async function refreshCurrentPage() {
    if (refreshing || loading) return;
    setRefreshing(true);
    setRefreshToken((current) => current + 1);
    try {
      await load(false);
      if (tab === 'settings') onSessionChange(await api('/office/auth/me'));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <OfficeAppBarContext.Provider value={{ navigation: pageNavigationHost, search: pageSearchHost, actions: pageActionsHost }}><div className={`app-shell office-shell${sidebarCollapsed ? ' office-nav-collapsed' : ''}`}>
      <ActivityAlerts key={session.admin.id} scope={String(session.admin.id)} onActivity={incoming => {
        if (incoming.some(item => item.target === 'subscription-request')) api('/office/subscription-requests').then(data => setRequests(data.items || [])).catch(() => {});
      }} onOpen={notice => navigate(notice.target === 'shop-report' ? 'shop-reports' : notice.target === 'sales-ai-topup' ? 'sales-ai-topups' : 'requests', null, { id: notice.entity_id, key: crypto.randomUUID() })} />
      <button className={`office-nav-overlay${mobileNavOpen ? ' is-visible' : ''}`} type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />
      <aside id="office-navigation" className={`sidebar office-sidebar${mobileNavOpen ? ' is-open' : ''}`} aria-label="Office navigation">
        <div className="office-sidebar-header">
          <div className="brand"><BrandImage className="brand-logo" src={BRAND_LOGO} alt="" /><div><strong>PwarMyar</strong><span>Office console</span></div></div>
        </div>
        <nav>{navigation.map((group) => (
          <section className="office-nav-group" key={group.label} aria-labelledby={`office-nav-${group.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
            <p id={`office-nav-${group.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{group.label}</p>
            {group.items.map(([value, Icon, label]) => {
              const active = tab === value || (value === 'businesses' && tab === 'business-detail');
              return <button key={value} type="button" className={active ? 'active' : ''} onClick={() => navigate(value)} aria-current={active ? 'page' : undefined} title={sidebarCollapsed ? label : undefined}>
                <span className="office-nav-icon">{React.createElement(Icon, { size: 18 })}</span><span className="office-nav-text">{label}</span>
                {value === 'requests' && pendingCount > 0 && <b aria-label={`${pendingCount} payments awaiting approval`}>{pendingCount}</b>}
              </button>;
            })}
          </section>
        ))}</nav>
        <div className="sidebar-account">
          <div className="office-admin-avatar">{session.admin.name?.charAt(0).toUpperCase() || 'O'}</div>
          <div className="office-admin-details" data-no-localize><strong>{session.admin.name}</strong><span>{session.admin.email}</span></div>
          <button type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="office-main">
        <header className="topbar office-topbar">
          <div className="office-topbar-heading">
            <button className="office-mobile-nav-toggle" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" aria-controls="office-navigation" aria-expanded={mobileNavOpen}><Menu size={19} /></button>
            <button className="office-nav-collapse" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
              {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
            {showAppbarBack && <button className="office-appbar-back" type="button" onClick={goBack} aria-label={`Back to ${pageCopy[backPage][0]}`} title={`Back to ${pageCopy[backPage][0]}`}><ArrowLeft size={18} /></button>}
            <div className="office-appbar-slot" ref={setPageNavigationHost} />
          </div>
          <div className="office-appbar-slot" ref={setPageSearchHost} />
          {tab === 'businesses' && <form className={`office-appbar-search${businessSearch ? ' has-value' : ''}`} role="search" onSubmit={event => { event.preventDefault(); setBusinessQuery(current => ({ ...current, q: businessSearch.trim(), page: 1 })); }}>
            <label><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search businesses" placeholder="Search business or owner" value={businessSearch} maxLength={200} onChange={event => setBusinessSearch(event.target.value)} /></label>
            {businessSearch && <button type="button" className="office-appbar-search-clear mkpos-dismiss-icon" aria-label="Clear business search" title="Clear search" onClick={() => { setBusinessSearch(''); setBusinessQuery(current => ({ ...current, q: '', page: 1 })); }}><X size={14} /></button>}
          </form>}
          {tab === 'requests' && <form className={`office-appbar-search${paymentSearch ? ' has-value' : ''}`} role="search" onSubmit={event => { event.preventDefault(); setPaymentQuery(current => ({ ...current, q: paymentSearch.trim(), page: 1 })); }}>
            <label><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search payments" placeholder="Search business or plan" value={paymentSearch} maxLength={200} onChange={event => setPaymentSearch(event.target.value)} /></label>
            {paymentSearch && <button type="button" className="office-appbar-search-clear mkpos-dismiss-icon" aria-label="Clear payment search" title="Clear search" onClick={() => { setPaymentSearch(''); setPaymentQuery(current => ({ ...current, q: '', page: 1 })); }}><X size={14} /></button>}
          </form>}
          {tab === 'shop-reports' && <form className={`office-appbar-search${reportSearch ? ' has-value' : ''}`} role="search" onSubmit={event => { event.preventDefault(); setReportQuery(current => ({ ...current, q: reportSearch.trim(), page: 1 })); }}><label><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search shop reports" placeholder="Search shop, customer or report" maxLength={120} value={reportSearch} onChange={event => setReportSearch(event.target.value)} /></label>{reportSearch && <button type="button" className="office-appbar-search-clear mkpos-dismiss-icon" aria-label="Clear report search" title="Clear search" onClick={() => { setReportSearch(''); setReportQuery(current => ({ ...current, q: '', page: 1 })); }}><X size={14} /></button>}</form>}
          <div className="office-topbar-actions">
            <div className="office-appbar-slot" ref={setPageActionsHost} />
            {tab === 'shop-reports' && <button className="office-filter-trigger" type="button" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}><Filter size={16} />Filters</button>}
            {tab === 'plans' && <button className="office-button-primary" onClick={() => setEditingPlan(null)}><Plus size={16} /> New plan</button>}
            {tab === 'payment-methods' && <button className="office-button-primary" onClick={() => setEditingPaymentMethod(null)}><Plus size={16} /> Add payment method</button>}
            {['businesses', 'requests'].includes(tab) && <button className="office-filter-trigger" type="button" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}><Filter size={16} /> Filters{tab === 'businesses' && businessFilterCount > 0 && <span className="office-filter-count">{businessFilterCount}</span>}{tab === 'requests' && paymentFilterCount > 0 && <span className="office-filter-count">{paymentFilterCount}</span>}</button>}
            <button className="office-appbar-refresh" type="button" onClick={refreshCurrentPage} disabled={refreshing || loading} aria-label="Refresh current page" title="Refresh current page"><RefreshCw className={refreshing ? 'office-spin' : ''} size={17} /></button>
          </div>
        </header>

        <div className="office-content">
          <div className="office-page-heading"><h1>{pageCopy[tab][0]}</h1><p>{pageCopy[tab][1]}</p></div>
          {error && <div className="feedback error office-page-error">{error}</div>}
          {loading ? <div className="office-loading"><RefreshCw size={20} className="office-spin" /><strong>Loading Office data</strong><span>Syncing businesses and subscriptions…</span></div> : (
            <RetainedViews activeKey={`${tab}:${selectedBusinessId || ''}`}>
              {tab === 'overview' && <OverviewPage businesses={businesses} businessSummary={businessSummary} requests={requests} financialReport={financialReport} canManageAI={session.admin.role === 'super_admin'} refreshToken={refreshToken} onManageAI={() => navigate('ai-requests')} onManageBusinesses={() => navigate('businesses')} onReviewPayments={() => { setPaymentSearch(''); setPaymentQuery(current => ({ ...initialPaymentQuery, per_page: current.per_page })); navigate('requests'); }} />}
              {tab === 'businesses' && <BusinessesPage query={businessQuery} onQueryChange={setBusinessQuery} onOpen={openBusiness} onDeleted={() => load(false)} refreshToken={refreshToken} filterOpen={filterOpen} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'shop-reports' && <ShopReportsPage scope={session.admin.id} alertTarget={currentPage.alertTarget} query={reportQuery} onQueryChange={setReportQuery} onOpenBusiness={openBusiness} refreshToken={refreshToken} filterOpen={filterOpen} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'business-detail' && selectedBusinessId && <BusinessDetailPage businessId={selectedBusinessId} activePlans={activePlans} busy={busy} onAction={action} onBack={goBack} refreshToken={refreshToken} />}
              {tab === 'plans' && <PlansPage plans={plans} onEdit={setEditingPlan} />}
              {tab === 'payment-methods' && <PaymentMethodsPage paymentMethods={paymentMethods} busy={busy} onEdit={setEditingPaymentMethod} onDelete={(item) => window.confirm(`Delete ${item.bank} - ${item.account_no}? Existing requests will keep their saved payment details.`) && action(`delete-payment-${item.id}`, `/office/payment-methods/${item.id}`, { method: 'DELETE' })} />}
              {tab === 'requests' && <RequestsPage alertTarget={currentPage.alertTarget} requests={requests} busy={busy} onAction={action} onOpenBusiness={openBusiness} query={paymentQuery} onQueryChange={setPaymentQuery} refreshToken={refreshToken} filterOpen={filterOpen} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'financial' && <FinancialReportPage report={financialReport} busy={busy} onAction={action} />}
              {tab === 'admins' && <AdminsPage refreshToken={refreshToken} currentAdminId={session.admin.id} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'activity-log' && <ActivityLogPage refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'bank-books' && <BankBooksPage refreshToken={refreshToken} />}
              {tab === 'ai-usage' && session.admin.role === 'super_admin' && <AiUsageReportPage refreshToken={refreshToken} />}
              {tab === 'ai-requests' && session.admin.role === 'super_admin' && <AiBalanceBookPage refreshToken={refreshToken} />}
              {tab === 'sales-ai-topups' && <SalesAiTopupsPage alertTarget={currentPage.alertTarget} refreshToken={refreshToken} onOpenBusiness={openBusiness} />}
              {tab === 'branding' && <BrandingPage refreshToken={refreshToken} />}
              {tab === 'founders' && <FounderSettingsPage refreshToken={refreshToken} onBack={goBack} />}
              {tab === 'financial-book' && <FinancialBookPage onOpenFounders={() => navigate('founders')} refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'agent-skills' && session.admin.role === 'super_admin' && <AgentSkillsPage refreshToken={refreshToken} />}
              {tab === 'agent-assignments' && session.admin.role === 'super_admin' && <AgentAssignmentsPage refreshToken={refreshToken} />}
              {tab === 'tutorials' && <TutorialsPage refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'marketplace-categories' && <MarketplaceCategoriesPage scope={session.admin.id} refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'marketplace-products' && <MarketplaceProductsPage scope={session.admin.id} refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'product-reviews' && <ProductReviewsPage refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'error-reports' && <ErrorReportsPage onOpenBusiness={openBusiness} refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'shop-reviews' && <ShopReviewsPage refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'platform-users' && <PlatformUsersPage scope={session.admin.id} refreshToken={refreshToken} filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />}
              {tab === 'settings' && <SettingsPage session={session} onSessionChange={onSessionChange} refreshToken={refreshToken} activeTab={currentPage.settingsTab} onTabChange={value => navigate('settings', null, null, value)} />}
              {tab === 'server-health' && <ServerHealthPage refreshToken={refreshToken} />}
            </RetainedViews>
          )}
        </div>
      </main>

      {editingPlan !== undefined && <PlanModal key={editingPlan?.id || 'new'} plan={editingPlan || null} onClose={() => setEditingPlan(undefined)} onSaved={() => { setEditingPlan(undefined); load(false); }} />}
      {editingPaymentMethod !== undefined && <PaymentMethodModal key={editingPaymentMethod?.id || 'new-payment'} paymentMethod={editingPaymentMethod || null} onClose={() => setEditingPaymentMethod(undefined)} onSaved={() => { setEditingPaymentMethod(undefined); load(false); }} />}
    </div></OfficeAppBarContext.Provider>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/office/auth/me').then(setSession).catch(() => setSession(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading full">Opening PwarMyar Office…</div>;
  return session ? <Dashboard key={session.admin.id} session={session} onLogout={() => setSession(null)} onSessionChange={setSession} /> : <Login onLogin={setSession} />;
}

const root = document.getElementById('root');
if (root) startBranding(officeApiBase);
if (root) createRoot(root).render(<App />);
