import { AdminAuthorizationDialog } from './components/AdminAuthorizationDialog';
import { io } from 'socket.io-client';
import { startResourceRealtime } from '../../shared/network/resourceRealtime.js';
import aiPages from './ai/app-pages.json';
import { AiAssistant, AiAssistantButton } from './ai/AiAssistant';
import { BrandImage } from './platformBranding';
import { startBranding } from './platformBranding';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TutorialLink } from './components/TutorialLink';
import { AppVariantRecommendation } from './components/AppVariantRecommendation';
import { WorkspaceHeader, WorkspacePageHeading } from './components/WorkspaceHeader';
import { OrderAlerts } from './components/OrderAlerts';
import { OwnerActivityAlerts } from './components/OwnerActivityAlerts';
import { ShopChatButton } from './components/ShopChatButton';
import { SidebarNavigation } from './components/SidebarNavigation';
import {
  BarChart3,
  Bot,
  CreditCard,
  History,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { request } from './api';
import { BRAND_LOGO } from './assets';
import {
  appHomeLocation,
  authLocationFor,
  authPageFromPath,
  isAuthPath,
  routePathFromLocation,
} from './authRouting';
import { NotificationProvider, NotificationRegion, useNotifications } from './components/notifications';
import { ConfirmationProvider } from './components/confirmations';
import { KeepAliveModules } from './components/KeepAliveModules';
import { useModuleNavigation } from './useModuleNavigation';
import { LanguageProvider } from './components/LanguageProvider';
import { AuthScreen } from './components/AuthScreen';
import { TrialBanner } from './components/TrialBanner';
import { shouldShowTrialBanner } from './components/trialBannerVisibility';
import { DesktopEntry, DesktopOnlineGate, DesktopOnlineModeControl } from './components/DesktopExperience';
import { desktopBridge } from './desktop';
import { emitDataChange, useDataRefresh } from './dataEvents';
import { registerSubscriptionRefresh } from './subscriptionRefresh';
import { CustomersScreen } from './screens/CustomersScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { PurchasesScreen } from './screens/PurchasesScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { BillingScreen } from './screens/BillingScreen';
import { SaleScreen } from './screens/SaleScreen';
import { SalesHistoryScreen } from './screens/SalesHistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShopScreen } from './screens/ShopScreen';
import { AccessManagementScreen } from './screens/AccessManagementScreen';
import { resolveActivePage, resolveEnabledModules } from './moduleRouting';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { TransactionsScreen } from './screens/TransactionsScreen';
import '@fontsource/noto-sans-myanmar/400.css';
import '@fontsource/noto-sans-myanmar/500.css';
import '@fontsource/noto-sans-myanmar/600.css';
import '@fontsource/noto-sans-myanmar/700.css';
import './styles.css';
import './styles/responsive.css';
import './styles/sale.css';
import './styles/products.css';
import './styles/purchases.css';
import './styles/suppliers.css';
import './styles/expenses.css';
import './styles/customers.css';
import './styles/transactions.css';
import './styles/reports.css';
import './styles/billing.css';
import './styles/settings.css';
import './styles/myanmar.css';
import './styles/receipt.css';
import './styles/auth.css';
import './styles/subscription.css';
import './styles/access.css';
import './styles/desktop.css';
import './styles/tables.css';
import './styles/desktop-design.css';
import './styles/workspace-viewport.css';

const modules = [
  { id: 'sell', icon: ReceiptText, label: 'Sell' },
  { id: 'products', icon: Package, label: 'Products' },
  { id: 'purchases', icon: Truck, label: 'Purchases' },
  { id: 'sales', icon: ReceiptText, label: 'Sales' },
  { id: 'suppliers', icon: Users, label: 'Suppliers' },
  { id: 'customers', icon: Users, label: 'Customers' },
  { id: 'expenses', icon: Wallet, label: 'Expenses' },
  { id: 'transactions', icon: History, label: 'Transactions' },
  { id: 'reports', icon: BarChart3, label: 'Reports' },
  { id: 'shop', icon: Store, label: 'My Shop' },
  { id: 'billing', icon: CreditCard, label: 'Billing' },
  { id: 'access', icon: ShieldCheck, label: 'Access' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'assistant', icon: Bot, label: 'PwarMyar AI assistant' },
];

const SAFE_MODULE_IDS = modules.filter((module) => module.id !== 'assistant').map((module) => module.id);
const ACTIVE_MODULE_KEY = 'mkpos.activeModule';
const APP_BASE_PATH = import.meta.env.BASE_URL || '/';
const APP_HOME_LOCATION = appHomeLocation(APP_BASE_PATH);

function currentRoutePath() {
  return routePathFromLocation(window.location, APP_BASE_PATH);
}

const moduleScreens = {
  sell: SaleScreen,
  products: ProductsScreen,
  purchases: PurchasesScreen,
  sales: SalesHistoryScreen,
  suppliers: SuppliersScreen,
  customers: CustomersScreen,
  expenses: ExpensesScreen,
  transactions: TransactionsScreen,
  reports: ReportsScreen,
  billing: BillingScreen,
  settings: SettingsScreen,
  access: AccessManagementScreen,
  shop: ShopScreen,
};

function renderModule(id) {
  const Screen = moduleScreens[id];
  return Screen ? <Screen /> : null;
}

function refreshStaleModule(id) {
  emitDataChange(['*'], 'navigation', id);
}

function App({ session, onLoggedOut }) {
  const { clear: clearNotifications } = useNotifications();
  const permittedIds = useMemo(() => resolveEnabledModules(
    SAFE_MODULE_IDS,
    SAFE_MODULE_IDS,
    Array.isArray(session.permissions)
      ? session.permissions.filter((id) => SAFE_MODULE_IDS.includes(id))
      : session.user.role === 'owner' ? SAFE_MODULE_IDS : [],
  ), [session.permissions, session.user.role]);
  const [enabledIds, setEnabledIds] = useState(permittedIds);
  const [active, setActive] = useState(() => resolveActivePage(
    [...permittedIds, 'assistant'],
    new URLSearchParams(window.location.search).get('page') === 'assistant' ? 'assistant' : window.localStorage.getItem(ACTIVE_MODULE_KEY),
  ));
  const [supplierBackAction, setSupplierBackAction] = useState(null);
  const [customerBackAction, setCustomerBackAction] = useState(null);
  const [shopBackAction, setShopBackAction] = useState(null);
  const [shopStart, setShopStart] = useState(0);
  const [assistantHost, setAssistantHost] = useState(null);
  const [orderAttention, setOrderAttention] = useState({ scope: '', count: 0 });
  const orderScope = `${session.user.id}:${session.business?.id}`;
  const [configLoading, setConfigLoading] = useState(true);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('mkpos.sidebarCollapsed') === 'true');
  const enabledModules = useMemo(
    () => modules.filter((module) => module.id === 'assistant' || enabledIds.includes(module.id) || (!session.subscription?.is_valid && module.id === 'billing')),
    [enabledIds, session.subscription?.is_valid],
  );
  const activeModule = enabledModules.find((module) => module.id === active) ?? enabledModules[0] ?? modules[0];
  const visitModule = useModuleNavigation({ identity: `${session.user.id}:${session.business?.id || ''}`, active: activeModule.id, ready: !configLoading, enabled: enabledModules.map((module) => module.id), onRestore: (id) => { clearNotifications(); setActive(id); } });
  const detailBackAction = activeModule.id === 'suppliers' ? supplierBackAction : activeModule.id === 'customers' ? customerBackAction : activeModule.id === 'shop' ? shopBackAction : null;
  const sourceModule = enabledModules.find((module) => module.id === window.history.state?.mkposDesktopNavigation?.sourceModule && module.id !== activeModule.id);
  const backAction = activeModule.id === 'assistant'
    ? { label: sourceModule ? `Back to ${sourceModule.label}` : 'Back to workspace', onClick: () => { if (sourceModule) window.history.back(); else selectModule(enabledModules.find(module => module.id !== 'assistant')?.id || 'settings'); } }
    : sourceModule?.id === 'assistant' ? { label: 'Back to PwarMyar AI', onClick: () => window.history.back() } : detailBackAction && sourceModule ? { label: `Back to ${sourceModule.label}`, onClick: () => window.history.back() } : detailBackAction;

  useEffect(() => {
    if (!['sell', 'shop'].includes(activeModule.id)) return;
    setSidebarCollapsed(true);
    window.localStorage.setItem('mkpos.sidebarCollapsed', 'true');
  }, [activeModule.id]);

  useEffect(() => {
    document.body.classList.toggle('pos-sell-active', activeModule.id === 'sell');
    return () => document.body.classList.remove('pos-sell-active');
  }, [activeModule.id]);

  useEffect(() => {
    let cancelled = false;
    request('/app-config').then((config) => {
      if (cancelled) return;
      const configured = Array.isArray(config.enabled_modules)
        ? config.enabled_modules.filter((id) => SAFE_MODULE_IDS.includes(id))
        : [];
      const nextEnabled = resolveEnabledModules(SAFE_MODULE_IDS, configured, permittedIds);
      setEnabledIds(nextEnabled);
      setActive(resolveActivePage([...nextEnabled, 'assistant'], new URLSearchParams(window.location.search).get('page') === 'assistant' ? 'assistant' : window.localStorage.getItem(ACTIVE_MODULE_KEY)));
    }).catch(() => {
      if (cancelled) return;
      setEnabledIds(permittedIds);
      setActive(resolveActivePage([...permittedIds, 'assistant'], new URLSearchParams(window.location.search).get('page') === 'assistant' ? 'assistant' : window.localStorage.getItem(ACTIVE_MODULE_KEY)));
    }).finally(() => {
      if (!cancelled) setConfigLoading(false);
    });
    return () => { cancelled = true; };
  }, [permittedIds]);

  useEffect(() => {
    const canOpenActive = active === 'assistant' || enabledIds.includes(active);
    if (!configLoading && canOpenActive) {
      window.localStorage.setItem(ACTIVE_MODULE_KEY, active);
    }
  }, [active, configLoading, enabledIds]);

  useEffect(() => {
    const openBilling = () => {
      clearNotifications();
      visitModule('billing');
      setActive('billing');
      window.localStorage.setItem(ACTIVE_MODULE_KEY, 'billing');
    };
    window.addEventListener('mkpos:navigate-billing', openBilling);
    return () => window.removeEventListener('mkpos:navigate-billing', openBilling);
  }, [clearNotifications, visitModule]);

  useEffect(() => {
    const openAssistant = () => {
      clearNotifications();
      visitModule('assistant');
      setActive('assistant');
      window.localStorage.setItem(ACTIVE_MODULE_KEY, 'assistant');
    };
    window.addEventListener('mkpos:maximize-ai-assistant', openAssistant);
    return () => window.removeEventListener('mkpos:maximize-ai-assistant', openAssistant);
  }, [clearNotifications, visitModule]);

  function selectModule(id) {
    clearNotifications();
    if (id === 'shop') {
      visitModule(id, null, { reset: true });
      setShopBackAction(null);
      setShopStart(value => value + 1);
    } else visitModule(id);
    if (['sell', 'shop'].includes(id)) {
      setSidebarCollapsed(true);
      window.localStorage.setItem('mkpos.sidebarCollapsed', 'true');
    }
    setActive(id);
    window.localStorage.setItem(ACTIVE_MODULE_KEY, id);
  }

  async function logout() {
    setLogoutBusy(true);
    try {
      await request('/auth/logout', { method: 'POST' });
      await desktopBridge()?.clearOfflineSession();
      window.localStorage.removeItem(ACTIVE_MODULE_KEY);
      onLoggedOut();
    } finally {
      setLogoutBusy(false);
    }
  }

  if (configLoading) {
    return (
      <div className="app-startup" role="status">
        <div className="app-startup-brand">
          <BrandImage src={BRAND_LOGO} alt="" />
          <span>Opening PwarMyar...</span>
        </div>
      </div>
    );
  }

  if (!enabledModules.length) {
    return (
      <div className="app-shell" data-density="compact">
        <aside className="sidebar"><div className="brand"><BrandImage className="brand-logo" src={BRAND_LOGO} alt="PwarMyar" /><div><strong>PwarMyar</strong><span>{session.business.name}</span></div></div><SidebarNavigation modules={[]} /><div className="sidebar-account"><div><strong>{session.user.name}</strong><span>{session.role_name || 'Staff'}</span></div><button type="button" onClick={logout} disabled={logoutBusy}><LogOut size={18} /><span>Sign out</span></button></div></aside>
        <AiAssistant key={`ai:${session.user.id}:${session.business?.id}`} scope={`${session.user.id}:${session.business?.id}`} />
        <main><div className="access-denied-page"><ShieldCheck size={30} /><h1>No page access assigned</h1><p>Ask your business owner to assign a role with at least one page.</p></div></main>
      </div>
    );
  }

  return (
    <div className={`app-shell desktop-workspace${sidebarCollapsed ? ' sidebar-collapsed' : ''}${activeModule.id === 'sell' ? ' pos-mode' : ''}${activeModule.id === 'assistant' ? ' ai-page-active' : ''}`} data-density="compact">
      <aside className="sidebar">
        <div className="brand">
          <BrandImage className="brand-logo" src={BRAND_LOGO} alt="PwarMyar" />
          <div>
            <strong>PwarMyar</strong>
            <span>{session.business.name}</span>
          </div>
        </div>
        <SidebarNavigation modules={enabledModules} active={active} onSelect={selectModule}>
          <DesktopOnlineModeControl />
          <TutorialLink />
        </SidebarNavigation>
        <div className="sidebar-account">
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.role_name || session.user.role}</span>
          </div>
          <button type="button" onClick={logout} disabled={logoutBusy} aria-label="Sign out">
            <LogOut size={18} />
            <span>{logoutBusy ? 'Signing out...' : 'Sign out'}</span>
          </button>
        </div>
      </aside>

      <main>
        {session.user.role === 'owner' && <OwnerActivityAlerts key={`activity:${session.user.id}:${session.business?.id}`} scope={`${session.user.id}:${session.business?.id}`} apiRequest={request} onOpen={notice => {
          clearNotifications();
          if (notice.target === 'order' || notice.target === 'sales-ai-topup' || notice.target === 'sales-ai-wallet') {
            visitModule('shop', { scope: 'shop', view: { tab: notice.target === 'order' ? 'orders' : notice.target === 'sales-ai-topup' ? 'sales-ai-topups' : 'sales-ai-wallet', id: notice.target === 'order' ? notice.order_id : null, topupId: notice.target === 'sales-ai-topup' ? notice.entity_id : null, customerKey: null } });
            setActive('shop');
          } else { visitModule('billing'); setActive('billing'); }
        }} />}
        {!configLoading && enabledIds.includes('shop') && (session.user.role === 'owner' || session.permissions?.includes('ecommerce_orders')) && <OrderAlerts key={`orders:${orderScope}`} apiRequest={request} onActivity={count => setOrderAttention({ scope: orderScope, count })} onOpen={notice => {
          clearNotifications();
          visitModule('shop', { scope: 'shop', view: { tab: 'orders', id: notice.id, customerKey: null } });
          setActive('shop');
        }} />}
        <WorkspaceHeader
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((current) => { window.localStorage.setItem('mkpos.sidebarCollapsed', String(!current)); return !current; })}
          onRefresh={() => activeModule.id === 'assistant' ? window.dispatchEvent(new Event('mkpos:refresh-ai-assistant')) : refreshStaleModule(activeModule.id)}
          backAction={backAction}
          shopAction={!configLoading && enabledIds.includes('shop') && (session.user.role === 'owner' || session.permissions?.includes('ecommerce_orders')) ? { count: orderAttention.scope === orderScope ? orderAttention.count : 0, onClick: () => {
            clearNotifications();
            visitModule('shop', { scope: 'shop', view: { tab: 'orders', id: null, customerKey: null } });
            setActive('shop');
          } } : null}
          chatAction={<>{activeModule.id !== 'assistant' && <AiAssistantButton />}{!configLoading && enabledIds.includes('shop') && (session.user.role === 'owner' || session.permissions?.includes('ecommerce_orders')) ? <ShopChatButton key={`${session.user.id}:${session.business?.id}`} scope={`${session.user.id}:${session.business?.id}`} onOpen={() => {
            clearNotifications();
            visitModule('shop', { scope: 'shop', view: { tab: 'chat', id: null, customerKey: null } });
            setActive('shop');
          }} /> : null}</>}
        />
        {!['sell', 'assistant'].includes(activeModule.id) && (
          <WorkspacePageHeading module={activeModule}>
            {shouldShowTrialBanner(activeModule.id) && <TrialBanner session={session} onBilling={() => selectModule('billing')} />}
          </WorkspacePageHeading>
        )}
        <header className={`topbar${activeModule.id === 'sell' ? ' pos-notification-host' : ''}`}>
          <NotificationRegion />
        </header>

        <KeepAliveModules
          active={activeModule.id}
          modules={enabledModules}
          renderModule={(id) => (
            id === 'assistant' ? <div className="ai-assistant-page-slot" ref={setAssistantHost} />
              : id === 'sell' ? <SaleScreen />
              : id === 'purchases' ? <PurchasesScreen />
                : id === 'suppliers' ? <SuppliersScreen onDetailChange={setSupplierBackAction} />
                  : id === 'customers' ? <CustomersScreen onDetailChange={setCustomerBackAction} />
                    : id === 'shop' ? <ShopScreen key={shopStart} onDetailChange={setShopBackAction} actionRequiredCount={orderAttention.scope === orderScope ? orderAttention.count : 0} />
                    : renderModule(id)
          )}
          onStale={refreshStaleModule}
        />
        <AiAssistant key={`ai:${session.user.id}:${session.business?.id}`} scope={`${session.user.id}:${session.business?.id}`} screens={enabledIds} role={session.user.role} onNavigate={(id,options={})=>{const target=aiPages[id];if(target&&(!target.owner_only||session.user.role==='owner')&&enabledIds.includes(target.module)){clearNotifications();visitModule(target.module,null,{source:'assistant',pageLink:id,purchaseDraftId:id==='purchases_new'?options.purchaseDraftId:null});setActive(target.module);window.localStorage.setItem(ACTIVE_MODULE_KEY,target.module);}}} page={activeModule.id === 'assistant'} pageHost={assistantHost} />
      </main>
    </div>
  );
}

function RootApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authPage, setAuthPage] = useState(() => authPageFromPath(currentRoutePath()));

  const refreshSession = useCallback(async () => {
    const currentSession = await request('/auth/me');
    setSession(currentSession);
    return currentSession;
  }, []);
  useDataRefresh(['settings'], 'session', refreshSession);
  const resourceScope = session ? `${session.user.id}:${session.business?.id}` : '';
  useEffect(() => {
    if (!resourceScope) return undefined;
    return startResourceRealtime({ io, request, receive: resources => {
      emitDataChange(resources.filter(name => name !== 'assistant'), 'realtime');
      if (resources.includes('assistant')) window.dispatchEvent(new Event('mkpos:assistant-delivery-changed'));
    } });
  }, [resourceScope]);

  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((currentSession) => { if (!cancelled) setSession(currentSession); })
      .catch(() => { if (!cancelled) setSession(null); })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSession]);

  useEffect(() => {
    const requireSubscription = (event) => setSession((current) => current ? { ...current, subscription: event.detail } : current);
    window.addEventListener('mkpos:subscription-required', requireSubscription);
    window.addEventListener('mkpos:subscription-entitlement', requireSubscription);
    return () => {
      window.removeEventListener('mkpos:subscription-required', requireSubscription);
      window.removeEventListener('mkpos:subscription-entitlement', requireSubscription);
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    return registerSubscriptionRefresh(refreshSession);
  }, [refreshSession, session]);

  useEffect(() => {
    const updateSession = (event) => setSession(event.detail);
    window.addEventListener('mkpos:session-updated', updateSession);
    return () => window.removeEventListener('mkpos:session-updated', updateSession);
  }, []);

  useEffect(() => {
    const followBrowserHistory = () => {
      if (session) {
        if (isAuthPath(currentRoutePath())) window.history.replaceState(null, '', APP_HOME_LOCATION);
        return;
      }
      if (!isAuthPath(currentRoutePath())) {
        window.history.replaceState(null, '', authLocationFor('login', APP_BASE_PATH));
      }
      setAuthPage(authPageFromPath(currentRoutePath()));
    };
    window.addEventListener('popstate', followBrowserHistory);
    window.addEventListener('hashchange', followBrowserHistory);
    return () => {
      window.removeEventListener('popstate', followBrowserHistory);
      window.removeEventListener('hashchange', followBrowserHistory);
    };
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    if (session && isAuthPath(currentRoutePath())) {
      window.history.replaceState(null, '', APP_HOME_LOCATION);
    } else if (!session && !isAuthPath(currentRoutePath())) {
      window.history.replaceState(null, '', authLocationFor('login', APP_BASE_PATH));
      setAuthPage('login');
    }
  }, [authLoading, session]);

  function navigateAuth(page) {
    window.history.pushState(null, '', authLocationFor(page, APP_BASE_PATH));
    setAuthPage(page);
  }

  function authenticated(nextSession) {
    window.history.replaceState(null, '', APP_HOME_LOCATION);
    setSession(nextSession);
  }

  function loggedOut() {
    window.history.replaceState(null, '', authLocationFor('login', APP_BASE_PATH));
    setAuthPage('login');
    setSession(null);
  }

  if (authLoading) {
    return (
      <div className="app-startup" role="status">
        <div className="app-startup-brand">
          <BrandImage src={BRAND_LOGO} alt="" />
          <span>Opening PwarMyar...</span>
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen page={authPage} onNavigate={navigateAuth} onAuthenticated={authenticated} />;

  return (
    <DesktopOnlineGate session={session} onLoggedOut={loggedOut}>
      <App key={`${session.user.id}:${session.business?.id || ''}`} session={session} onLoggedOut={loggedOut} />
    </DesktopOnlineGate>
  );
}

startBranding((import.meta.env.VITE_API_URL || '/api'));

createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <NotificationProvider>
      <ConfirmationProvider>
        <DesktopEntry><RootApp /></DesktopEntry>
        <AppVariantRecommendation />
        <AdminAuthorizationDialog />
      </ConfirmationProvider>
    </NotificationProvider>
  </LanguageProvider>,
);
