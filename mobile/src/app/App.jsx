import { io } from 'socket.io-client';
import { startResourceRealtime } from '../../../shared/network/resourceRealtime.js';
import { publishResourceChanges } from '../navigation/dataChanges';
import { ErrorReportContactPage } from '../ai/ErrorReportContact';
import aiPages from '../ai/app-pages.json';
import { AiAssistantPage } from '../ai/AiAssistantPage';
import { configureTimezone } from '../timezone';
import { Button, IconButton } from '../components/Controls';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, RefreshCw, WifiOff } from 'lucide-react';
import { sellText } from '../sell/sellLocale';
import { apiRequest } from "../api/client";
import { OwnerActivityAlerts } from '../shop/OwnerActivityAlerts';
import { RetainedViews } from '../navigation/RetainedViews';
import { clearAccessToken } from '../api/authStorage';
import { PageRouteContext } from '../navigation/pageRefresh';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { AppShell } from "../navigation/AppShell";
import {
  ensureHistoryEntry,
  clearNavigationRoot,
  isParentReturn,
  hasInAppBackEntry,
  nextHistoryState,
  replacementHistoryState,
} from "../navigation/historyNavigation";
import { ModulePlaceholder } from "../navigation/ModulePlaceholder";
import {
  defaultModule,
  moduleFromPath,
  resolveEnabledModules,
} from "../navigation/modules";
import { routeLocation, routePathFromLocation } from "../navigation/routeBase";
import { ProductsScreen } from "../products/ProductsScreen";
import { PurchasesScreen } from "../purchases/PurchasesScreen";
import { SuppliersScreen } from "../suppliers/SuppliersScreen";
import { CustomersScreen } from "../customers/CustomersScreen";
import { ExpensesScreen } from "../expenses/ExpensesScreen";
import { SaleScreen } from "../sell/SaleScreen";
import { TransactionsScreen } from "../transactions/TransactionsScreen";
import { SalesHistoryScreen } from "../transactions/SalesHistoryScreen";
import { ReportsScreen } from "../reports/ReportsScreen";
import { BillingScreen } from "../billing/BillingScreen";
import { SettingsScreen } from "../settings/SettingsScreen";
import { AccessScreen } from "../access/AccessScreen";
import { ShopScreen } from "../shop/ShopScreen";
import { AUTH_MESSAGES } from "./authLocale";
import { AuthSessionLoading } from "./AuthReferenceParts";
import { AuthScreen } from "./AuthScreen";
import { useLocale } from "../localization/LocaleContext";
import { ModuleLocalizationBoundary } from "../localization/ModuleLocalizationBoundary";
import {
  REMAINING_PAGE_PATTERNS,
} from "../localization/remainingPagesLocale";
import {
  clearOfflineSession,
  getOfflineData,
  recoverInterruptedOfflineSales,
} from "../offline/offlineStore";
import {
  OFFLINE_DETECTED_EVENT,
  isConnectionFailure,
  refreshMobileOfflineCache,
  syncMobileOfflineSales,
} from "../offline/offlineSales";

const BILLING_GATE_MODULE = {
  id: "billing",
  path: "/billing",
  label: "Billing",
  description: "Plans and payment requests",
};

function currentRoutePath() {
  return routePathFromLocation(window.location.pathname);
}

function replaceRoute(path) {
  window.history.replaceState(
    replacementHistoryState(),
    "",
    routeLocation(path),
  );
}

function pageFromPath(pathname) {
  return pathname === "/forgot-password" ? "forgot-password" : pathname === "/signup" ? "signup" : "login";
}

function AuthLoading() {
  return (
    <ModuleLocalizationBoundary
      messages={AUTH_MESSAGES}
      patterns={REMAINING_PAGE_PATTERNS}
    >
      <AuthSessionLoading />
    </ModuleLocalizationBoundary>
  );
}

function OfflineUnavailable({ onBack }) {
  const { language } = useLocale();
  const t = (key,fallback) => sellText(key,language,{},fallback);
  return <main className="offline-unavailable sell-offline-unavailable" role="alert"><header className="retail-sale-header"><IconButton variant="ghost" type="button" aria-label={t('backToLogin','Back to login')} onClick={onBack}><ChevronLeft size={25} /></IconButton><h1>{t('offlineTitle','Offline')}</h1><WifiOff size={20} aria-hidden="true" /></header><section><span className="retail-offline-illustration" aria-hidden="true"><WifiOff size={72} /></span><h2>{t('offlineUnavailableTitle','You are offline.')}</h2><p>{t('offlineUnavailableDescription','This device is not prepared for offline sales. Connect to the internet to load your business data.')}</p><Button variant="primary" className="mobile-primary" type="button" onClick={()=>window.location.reload()}><RefreshCw size={18} />{t('retryConnection','Retry connection')}</Button><Button variant="secondary" className="mobile-secondary" type="button" onClick={onBack}><ChevronLeft size={18} />{t('backToLogin','Back to login')}</Button></section></main>;
}

export default function App() {
  const { setLanguage } = useLocale();
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [appConfig, setAppConfig] = useState(null);
  const [configReady, setConfigReady] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const [authPage, setAuthPage] = useState(() =>
    pageFromPath(currentRoutePath()),
  );
  const [pathname, setPathname] = useState(() => currentRoutePath());
  const sessionIdentity = session
    ? `${session.user?.id || ""}:${session.business?.id || ""}`
    : null;

  useEffect(() => {
    if (!sessionIdentity) return undefined;
    return () => {
      window.sessionStorage.removeItem(`mkpos-mobile-sale-draft-v1:${sessionIdentity}`);
      window.sessionStorage.removeItem('mkpos-mobile-sale-draft-v1');
    };
  }, [sessionIdentity]);

  useEffect(() => {
    ensureHistoryEntry();
  }, []);

  const refreshAppConfig = useCallback(async (signal) => {
    const nextConfig = await apiRequest(
      "/app-config",
      signal ? { signal } : undefined,
    );
    if (!signal?.aborted) setAppConfig(nextConfig);
  }, []);

  useEffect(() => {
    if (!sessionIdentity || offlineMode) return undefined;
    let active = true;
    const stop = startResourceRealtime({ io, request: apiRequest, receive: resources => {
      publishResourceChanges(resources.map(name => ({ priceTypes: 'price-types', customerPayments: 'customer-payments', supplierPayments: 'supplier-payments' })[name] || name));
      if (resources.includes('assistant')) window.dispatchEvent(new Event('mkpos:assistant-delivery-changed'));
      if (resources.includes('settings')) {
        Promise.all([apiRequest('/auth/me'), apiRequest('/app-config')]).then(([nextSession, config]) => {
          if (active) { setSession(nextSession); setAppConfig(config); }
        }).catch(() => {});
      }
    } });
    return () => { active = false; stop(); };
  }, [sessionIdentity, offlineMode]);

  const restoreOnlineSession = useCallback(async () => {
    const currentSession = await apiRequest("/auth/me", { timeoutMs: 8000 });
    const nextConfig = await apiRequest("/app-config", {
      timeoutMs: 8000,
    }).catch(() => ({}));
    setSession(currentSession);
    setAppConfig(nextConfig);
    setConfigReady(true);
    setOfflineMode(false);
    setOfflineUnavailable(false);
    return nextConfig;
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void recoverInterruptedOfflineSales().catch(() => undefined);

    apiRequest("/auth/me", { signal: controller.signal })
      .then((currentSession) => {
        setSession(currentSession);
        setOfflineMode(false);
        setOfflineUnavailable(false);
        if (
          currentRoutePath() === "/login" ||
          (currentRoutePath() === "/signup" || currentRoutePath() === "/forgot-password")
        ) {
          replaceRoute("/sell");
        }
      })
      .catch(async (error) => {
        if (controller.signal.aborted) return;
        if (isConnectionFailure(error)) {
          try {
            const offline = await getOfflineData();
            if (controller.signal.aborted) return;
            configureTimezone(offline.session);
            setSession(offline.session);
            setAppConfig(offline.app_config || {});
            setConfigReady(true);
            setOfflineMode(true);
            replaceRoute("/sell");
            setPathname("/sell");
            return;
          } catch {
            setOfflineUnavailable(true);
          }
        }
        if (
          currentRoutePath() !== "/login" &&
          (currentRoutePath() !== "/signup" && currentRoutePath() !== "/forgot-password")
        ) {
          replaceRoute("/login");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingSession(false);
      });

    return () => { controller.abort(); };
  }, []);

  useEffect(() => {
    function enterOfflineMode() {
      void getOfflineData()
        .then((offline) => {
          configureTimezone(offline.session);
          setSession(offline.session);
          setAppConfig(offline.app_config || {});
          setConfigReady(true);
          setOfflineMode(true);
          if (!currentRoutePath().startsWith("/sell")) {
            replaceRoute("/sell");
            setPathname("/sell");
          }
        })
        .catch(() => undefined);
    }
    window.addEventListener(OFFLINE_DETECTED_EVENT, enterOfflineMode);
    window.addEventListener("offline", enterOfflineMode);
    return () => {
      window.removeEventListener(OFFLINE_DETECTED_EVENT, enterOfflineMode);
      window.removeEventListener("offline", enterOfflineMode);
    };
  }, []);

  useEffect(() => {
    if (!offlineMode) return undefined;
    let restoring = false;
    const restore = () => {
      if (restoring) return;
      restoring = true;
      void restoreOnlineSession()
        .catch(() => undefined)
        .finally(() => {
          restoring = false;
        });
    };
    window.addEventListener("online", restore);
    const timer = window.setInterval(restore, 15000);
    return () => {
      window.removeEventListener("online", restore);
      window.clearInterval(timer);
    };
  }, [offlineMode, restoreOnlineSession]);

  useEffect(() => {
    function updateSession(event) {
      if (event.detail) setSession(event.detail);
    }
    window.addEventListener("mkpos:session-updated", updateSession);
    return () =>
      window.removeEventListener("mkpos:session-updated", updateSession);
  }, []);

  useEffect(() => {
    function updateShopLogo(event) {
      setAppConfig((current) => ({
        ...(current || {}),
        business: {
          ...(current?.business || {}),
          logo_data_url: typeof event.detail === "string" ? event.detail : "",
        },
      }));
    }
    window.addEventListener("mkpos:shop-logo-updated", updateShopLogo);
    return () =>
      window.removeEventListener("mkpos:shop-logo-updated", updateShopLogo);
  }, []);

  useEffect(() => {
    function updateEntitlement(event) {
      if (event.detail)
        setSession((current) =>
          current ? { ...current, subscription: event.detail } : current,
        );
    }
    window.addEventListener(
      "mkpos:subscription-entitlement",
      updateEntitlement,
    );
    return () =>
      window.removeEventListener(
        "mkpos:subscription-entitlement",
        updateEntitlement,
      );
  }, []);

  useEffect(() => {
    if (!session || offlineMode) return undefined;
    let refreshing = false;
    const refreshEntitlement = () => {
      if (refreshing) return;
      refreshing = true;
      void restoreOnlineSession()
        .catch(() => undefined)
        .finally(() => {
          refreshing = false;
        });
    };
    const resume = () => {
      if (document.visibilityState === "visible") refreshEntitlement();
    };
    window.addEventListener("online", refreshEntitlement);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", refreshEntitlement);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [offlineMode, restoreOnlineSession, session]);

  useEffect(() => {
    if (!sessionIdentity || offlineMode) return undefined;
    const controller = new AbortController();
    setConfigReady(false);

    refreshAppConfig(controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) setAppConfig({});
      })
      .finally(() => {
        if (!controller.signal.aborted) setConfigReady(true);
      });

    return () => controller.abort();
  }, [offlineMode, refreshAppConfig, sessionIdentity]);

  useEffect(() => {
    if (!session || !configReady || offlineMode || !appConfig) return;
    void syncMobileOfflineSales({ businessId: session.business?.id })
      .then(() => refreshMobileOfflineCache(session, appConfig))
      .catch(() => undefined);
  }, [appConfig, configReady, offlineMode, session]);

  const modules = useMemo(() => {
    if (!session) return [];
    const resolved = resolveEnabledModules(
      appConfig?.enabled_modules,
      appConfig?.permissions || session.permissions,
      session.user?.role,
    )
      .filter(
        (module) =>
          !offlineMode || ["sell", "settings"].includes(module.id),
      )
      .map((module) =>
        offlineMode && module.id === "settings"
          ? {
              ...module,
              label: "Printer",
              path: "/settings/printer",
              description: "This device’s printer",
            }
          : module,
      );
    if (
      session.subscription &&
      !session.subscription.is_valid &&
      !resolved.some(({ id }) => id === "billing")
    ) {
      return [...resolved, BILLING_GATE_MODULE];
    }
    return resolved;
  }, [appConfig?.enabled_modules, appConfig?.permissions, offlineMode, session]);
  const activeModule = useMemo(() => /^\/assistant(?:\/error-reports\/[1-9]\d*)?$/.test(pathname) && !offlineMode ? { id: 'assistant', path: '/assistant', label: 'PwarMyar AI', description: 'PwarMyar support assistant' } : moduleFromPath(pathname, modules), [pathname, offlineMode, modules]);
  const accessDenied = /^\/access(?:\/|$)/.test(pathname) && Boolean(session) && (session.user?.role !== "owner" || !activeModule);

  useEffect(() => {
    if (appConfig?.language) setLanguage(appConfig.language);
  }, [appConfig?.language, setLanguage]);

  useEffect(() => {
    if (!session || !configReady || activeModule || accessDenied || !modules.length) return;
    const fallback = defaultModule(modules);
    replaceRoute(fallback.path);
    setPathname(fallback.path);
  }, [activeModule, accessDenied, configReady, modules, session]);

  const syncRoute = useCallback(path => { setPathname(path); setAuthPage(pageFromPath(path)); }, []);
  const rootNavigation = useRootNavigation({
    rootPath: session && configReady ? defaultModule(modules)?.path : null,
    identity: sessionIdentity,
    pathname,
    onPathChange: syncRoute,
  });

  function navigateAuth(page, options = {}) {
    const path = page === "forgot-password" ? "/forgot-password" : page === "signup" ? "/signup" : "/login";
    if (options.back && hasInAppBackEntry() && window.history.state?.mkposHistorySourcePath === path) {
      window.history.back();
      return;
    }
    if (options.back) replaceRoute(path);
    else window.history.pushState(nextHistoryState(), "", routeLocation(path));
    setPathname(path);
    setAuthPage(pageFromPath(path));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function authenticated(nextSession) {
    clearNavigationRoot();
    replaceRoute("/products");
    setPathname("/sell");
    setAppConfig(null);
    setConfigReady(false);
    setOfflineMode(false);
    setOfflineUnavailable(false);
    setSession(nextSession);
  }

  function navigateModule(module) {
    navigatePath(module.path);
  }

  function navigatePath(path, options = {}) {
    if (!options.reset && (options.back || isParentReturn(currentRoutePath(), path))) {
      rootNavigation.back(path);
      return;
    }
    rootNavigation.navigate(path, options);
  }

  useEffect(() => {
    function navigateToBilling() {
      window.history.pushState(
        nextHistoryState(),
        "",
        routeLocation("/billing"),
      );
      setPathname("/billing");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.addEventListener("mkpos:navigate-billing", navigateToBilling);
    return () =>
      window.removeEventListener("mkpos:navigate-billing", navigateToBilling);
  }, []);

  function navigateBack(fallbackPath) { rootNavigation.back(fallbackPath); }

  function loggedOut() {
    clearAccessToken();
    clearNavigationRoot();
    void clearOfflineSession().catch(() => undefined);
    replaceRoute("/login");
    setPathname("/login");
    setAuthPage("login");
    setAppConfig(null);
    setConfigReady(false);
    setOfflineMode(false);
    setOfflineUnavailable(false);
    setSession(null);
  }

  if (checkingSession) return <AuthLoading />;
  if (offlineUnavailable && !session) return <OfflineUnavailable onBack={() => { setOfflineUnavailable(false); navigateAuth('login', { back: true }); }} />;
  if (session && !configReady) return <AuthLoading />;
  if (session) {
    const refreshWorkspace = restoreOnlineSession;
    return (
      <AppShell
        session={session}
        shopLogo={appConfig?.business?.logo_data_url || ""}
        modules={modules}
        activeModule={activeModule}
        pathname={pathname}
        onNavigate={navigateModule}
        onNavigatePath={navigatePath}
        onNavigateBack={navigateBack}
        onLoggedOut={loggedOut}
        onRefresh={refreshWorkspace}
        offlineMode={offlineMode}
      >
        {!offlineMode && session.user.role === 'owner' && <OwnerActivityAlerts key={sessionIdentity} scope={sessionIdentity} apiRequest={apiRequest} onOpen={notice => navigatePath(notice.target === 'order' ? `/shop/orders/${notice.order_id}` : notice.target === 'sales-ai-topup' ? `/shop/sales-ai/topups/${notice.entity_id}` : notice.target === 'sales-ai-wallet' ? '/shop/sales-ai/wallet' : '/billing')} />}
        <RetainedViews key={`${sessionIdentity}:${offlineMode}`} activeKey={activeModule?.id === "sell" ? "sell" : pathname}>
        <PageRouteContext.Provider value={pathname}>
        {activeModule?.id === 'assistant' && pathname !== '/assistant' && <ErrorReportContactPage requestId={pathname.split('/').at(-1)} onBack={() => navigateBack('/assistant')} />}
        {activeModule?.id === 'assistant' && pathname === '/assistant' && <AiAssistantPage onOpenReport={id => navigatePath(`/assistant/error-reports/${id}`)} session={session} screens={modules.map(module=>module.id)} onNavigate={(id,options={})=>{const target=aiPages[id];if(target&&(!target.owner_only||session.user.role==='owner')&&modules.some(module=>module.id===target.module)){navigatePath(target.mobile_path);if(id==='purchases_new'&&/^[a-f0-9-]{36}$/i.test(options.purchaseDraftId||''))window.history.replaceState({...window.history.state,aiPurchaseDraftId:options.purchaseDraftId,aiPurchaseDraftIndex:window.history.state?.mkposHistoryIndex},'',window.location.href);}}} onBack={() => navigateBack(defaultModule(modules)?.path || '/sell')} />}
        {activeModule?.id === "shop" && <ShopScreen pathname={pathname} onNavigate={navigatePath} session={session} />}
        {activeModule?.id === "sell" && (
          <SaleScreen
            pathname={pathname}
            onNavigate={navigatePath}
            offlineMode={offlineMode}
            session={session}
          />
        )}
        {activeModule?.id === "products" && (
          <ProductsScreen pathname={pathname} onNavigate={navigatePath} session={session} />
        )}
        {activeModule?.id === "purchases" && (
          <PurchasesScreen pathname={pathname} onNavigate={navigatePath} session={session} />
        )}
        {activeModule?.id === "sales" && (
          <SalesHistoryScreen pathname={pathname} onNavigate={navigatePath} session={session} />
        )}
        {activeModule?.id === "suppliers" && (
          <SuppliersScreen pathname={pathname} onNavigate={navigatePath} session={session} />
        )}
        {activeModule?.id === "customers" && (
          <CustomersScreen pathname={pathname} onNavigate={navigatePath} session={session} />
        )}
        {activeModule?.id === "expenses" && (
          <ExpensesScreen pathname={pathname} onNavigate={navigatePath} />
        )}
        {activeModule?.id === "transactions" && (
          <TransactionsScreen pathname={pathname} onNavigate={navigatePath} session={session} />
        )}
        {activeModule?.id === "reports" && <ReportsScreen session={session} />}
        {activeModule?.id === "billing" && (
          <BillingScreen pathname={pathname} onNavigate={navigatePath} />
        )}
        {activeModule?.id === "settings" && (
          <SettingsScreen
            onAssistantBack={hasInAppBackEntry() && window.history.state?.mkposHistorySourcePath === '/assistant' ? () => navigateBack('/assistant') : undefined}
            pathname={pathname}
            onNavigate={(path, options) =>
              navigatePath(
                offlineMode && path === "/settings" ? "/sell" : path,
                options,
              )
            }
          />
        )}
        {(activeModule?.id === "access" || accessDenied) && (
          <AccessScreen pathname={pathname} onNavigate={navigatePath} session={session} denied={accessDenied} fallbackPath={defaultModule(modules)?.path || "/settings"} />
        )}
        {activeModule &&
          ![
            "assistant",
            "shop",
            "sell",
            "products",
            "purchases",
            "sales",
            "suppliers",
            "customers",
            "expenses",
            "transactions",
            "reports",
            "billing",
            "settings",
            "access",
          ].includes(activeModule.id) && (
            <ModulePlaceholder module={activeModule} />
          )}
        {!activeModule && !accessDenied && <ModulePlaceholder module={null} />}
        </PageRouteContext.Provider>
        </RetainedViews>
      </AppShell>
    );
  }

  return (
    <AuthScreen
      page={authPage}
      onBack={authPage === "login" && hasInAppBackEntry() && window.history.state?.mkposHistorySourcePath === "/signup" ? () => navigateAuth("signup", { back: true }) : undefined}
      onNavigate={navigateAuth}
      onAuthenticated={authenticated}
    />
  );
}
