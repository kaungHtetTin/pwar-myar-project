import { BrandImage } from '../platformBranding';
import { AppBarMenu } from './AppBarMenu';
import { useKeyboardViewport } from './useKeyboardViewport';
import { Button, IconButton } from '../components/Controls';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, Bot, CreditCard, Globe2, Clock3, History, LogOut, Package, ReceiptText, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Store, Truck, UserRound, Users, Wallet, Video, X } from 'lucide-react';
import { apiRequest } from "../api/client";
import { clearAccessToken } from '../api/authStorage';
import { BRAND_LOGO } from "../assets";
import { useLocale } from "../localization/LocaleContext";
import {
  localizeNavigationModule,
  localizeRole,
  navigationText,
} from "../localization/navigationLocale";
import { SwipeRefreshShell } from "./SwipeRefreshShell";
import { appBarRoute } from "./appBarRoute";
import { backSourcePath } from './historyNavigation';
import { TrialBanner } from "../subscription/TrialBanner";
import { PrintStatusNotice } from "../components/PrintStatusNotice";
import { Capacitor } from "@capacitor/core";
import { tutorialUrl } from "./tutorialUrl";
import { MOBILE_MODULES, MOBILE_NAVIGATION_SECTIONS } from "./modules";
import { AppNavigationContext } from './AppNavigationContext';
import { PageAppBarContext } from './PageAppBarContext';
import { LanguageToggle } from '../localization/LanguageToggle';
import { ChatAlerts } from '../chat/ChatAlerts';
import { OrderAlerts } from '../shop/OrderAlerts';
import { OrderAttentionContext } from '../shop/OrderAttentionContext';
import { OrderCountBadge } from '../shop/OrderCountBadge';

const MODULE_ICONS = {
  shop: Store,
  sell: ShoppingCart,
  products: Package,
  purchases: Truck,
  sales: ReceiptText,
  suppliers: Users,
  customers: UserRound,
  expenses: Wallet,
  transactions: History,
  reports: BarChart3,
  billing: CreditCard,
  settings: Settings,
  access: ShieldCheck,
};

function DrawerLanguage({language,onChange}){
  return <div className="drawer-language-row"><Globe2 size={20} aria-hidden="true"/><span>{language==='my'?'ဘာသာစကား':'Language'}</span><LanguageToggle language={language} onChange={onChange}/></div>;
}

export function AppShell({
  session,
  shopLogo = "",
  modules,
  activeModule,
  pathname = "",
  onNavigate,
  onNavigatePath,
  onNavigateBack,
  onLoggedOut,
  onRefresh,
  offlineMode = false,
  children,
}) {
  useKeyboardViewport();
  const { language, setLanguage } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const chatScope = `${session?.user?.id || ''}:${session?.business?.id || ''}`;
  const chatAllowed = !offlineMode && modules.some(module => module.id === 'shop') && (session?.user?.role === 'owner' || session?.permissions?.includes('ecommerce_orders'));
  const [chatActivity, setChatActivity] = useState(null);
  const [orderActivity, setOrderActivity] = useState(null);
  const orderScope = `${chatScope}:${session?.user?.role}:${[...(session?.permissions || [])].sort().join(',')}`;
  const orderCount = chatAllowed && orderActivity?.scope === orderScope ? orderActivity.count : 0;
  const updateChatActivity = useCallback(data => {
    const unreadCount = Math.max(0, Math.floor(Number(data.unread_count) || 0));
    const enabled = !!data.enabled;
    setChatActivity(previous => previous?.scope === chatScope && previous.enabled === enabled && previous.unreadCount === unreadCount ? previous : { scope: chatScope, enabled, unreadCount });
  }, [chatScope]);
  const shopChat = chatAllowed && (chatActivity?.scope !== chatScope || chatActivity.enabled) ? {
    unreadCount: chatActivity?.scope === chatScope ? chatActivity.unreadCount : 0,
    current: pathname === '/shop/chat',
    open: () => { if (pathname !== '/shop/chat') onNavigatePath?.('/shop/chat'); },
  } : null;
  const [appBarHost, setAppBarHost] = useState(null);
  const [pageAppBars, setPageAppBars] = useState(0);
  const registerAppBar = useCallback(() => {
    setPageAppBars(count => count + 1);
    return () => setPageAppBars(count => count - 1);
  }, []);
  const appBarContext = useMemo(() => ({ host: appBarHost, register: registerAppBar }), [appBarHost, registerAppBar]);
  const closeButtonRef = useRef(null);
  const drawerRef=useRef(null);
  const taskMenuTriggerRef = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const menuButton = taskMenuTriggerRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") setDrawerOpen(false);
      if(event.key==='Tab'){
        const controls=drawerRef.current?.querySelectorAll('a[href],button:not([disabled]),select:not([disabled])');
        if(!controls?.length)return;
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    }

    function onHardwareBack(event) {
      if (event.defaultPrevented) return;
      event.preventDefault();
      setDrawerOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mkpos:hardware-back", onHardwareBack);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mkpos:hardware-back", onHardwareBack);
      menuButton?.focus();
      taskMenuTriggerRef.current = null;
    };
  }, [drawerOpen]);

  function navigate(event, module) {
    event.preventDefault();
    setDrawerOpen(false);
    if (module.id !== activeModule?.id) onNavigate(module);
  }

  function logout() {
    setLoggingOut(true);
    if (offlineMode) {
      clearAccessToken();
      onLoggedOut();
      return;
    }
    void apiRequest("/auth/logout", { method: "POST" })
      .catch(() => undefined)
      .then(onLoggedOut);
  }

  const translatedActiveModule = useMemo(
    () =>
      activeModule ? localizeNavigationModule(activeModule, language) : null,
    [activeModule, language],
  );
  const businessName = session?.business?.name || "PwarMyar workspace";
  const userName =
    session?.user?.name || navigationText("account", language, "Account");
  const roleName = localizeRole(
    session?.role_name || session?.user?.role || "Team member",
    language,
  );
  const closeNavigation = navigationText(
    "closeNavigation",
    language,
    "Close navigation",
  );
  const appBar = appBarRoute(
    pathname,
    translatedActiveModule?.label ||
      navigationText("workspace", language, "Workspace"),
  );
  const fullPageChat = pathname === '/assistant' || /^\/shop\/chat\/[a-f0-9-]{36}$/.test(pathname);
  const retailCheckout = pathname === '/assistant' || /^\/transactions(?:\/|$)/.test(pathname) || /^\/suppliers(?:\/|$)/.test(pathname) || pathname === '/shop/storefront' || /^\/shop\/reviews(?:\/|$)/.test(pathname) || pathname === '/shop/report' || /^\/shop\/promotions(?:\/|$)/.test(pathname) || /^\/shop\/orders(?:\/|$)/.test(pathname) || /^\/shop\/methods(?:\/|$)/.test(pathname) || pathname === '/shop/logo' || pathname === '/shop/location' || pathname === '/shop/fulfillment' || /^\/shop\/delivery(?:\/|$)/.test(pathname) || /^\/shop\/customers(?:\/|$)/.test(pathname) || pathname === '/shop/cover' || /^\/shop\/contacts(?:\/|$)/.test(pathname) || pathname === '/shop/chat' || /^\/shop\/catalog(?:\/|$)/.test(pathname) || pathname === '/shop' || pathname.startsWith('/settings') || pathname === '/reports' || /^\/expenses(?:\/(?:new|\d+\/edit))?$/.test(pathname) || /^\/billing(?:\/request\/\d+)?$/.test(pathname) || pathname === '/sell' || pathname === '/sell/cart' || pathname === '/sell/checkout' || pathname === '/sell/customer/new' || pathname === '/sell/offline-sales' || /^\/products(?:\/(?:new|\d+\/(?:edit|stock)))?$/.test(pathname) || /^\/access(?:\/(?:roles|staff)\/(?:new|\d+\/(?:edit|password)))?$/.test(pathname) || /^\/sales(?:\/\d+(?:\/edit)?)?$/.test(pathname) || /^\/customers(?:\/(?:new|\d+(?:\/edit|\/payments\/(?:new|\d+\/edit))?))?$/.test(pathname) || /^\/purchases(?:\/(?:new|\d+(?:\/edit)?))?$/.test(pathname);

  return (
    <PageAppBarContext.Provider value={appBarContext}><OrderAttentionContext.Provider value={orderCount}><AppNavigationContext.Provider value={{ aiAssistant: !offlineMode ? { current: pathname === '/assistant', open: () => { if (pathname !== '/assistant') onNavigatePath?.('/assistant'); } } : null, shopChat, navigationOpen: drawerOpen, openNavigation: event => { taskMenuTriggerRef.current = event?.currentTarget || null; setDrawerOpen(true); }, backToWorkspace: () => { const target = (activeModule?.id !== 'products' ? modules.find(module => module.id === 'products') : modules.find(module => module.id === 'sell')) || modules.find(module => module.id !== activeModule?.id); if (!target) { setDrawerOpen(true); return; } if (onNavigateBack) onNavigateBack(target.path); else onNavigatePath?.(target.path); } }}><div className={`mobile-app-shell common-navigation-shell${fullPageChat ? ' conversation-navigation-shell' : ''}${retailCheckout ? ' retail-checkout-shell' : ''}${pathname.startsWith('/products') ? ' product-reference-shell' : ''}`}>
      {chatAllowed && <OrderAlerts key={'orders:'+orderScope} apiRequest={apiRequest} onActivity={count => setOrderActivity(previous => previous?.scope === orderScope && previous.count === count ? previous : {scope:orderScope,count})} onOpen={notice => onNavigatePath?.(`/shop/orders/${notice.id}`)} />}
      {chatAllowed && <ChatAlerts key={chatScope} scope={chatScope} apiRequest={apiRequest} basePath="/shop-admin/chat" suppressed={/^\/shop\/chat(?:\/|$)/.test(pathname) || drawerOpen} onActivity={updateChatActivity} onOpen={notice => onNavigatePath?.(notice.uuid ? `/shop/chat/${notice.uuid}` : '/shop/chat')} />}
      <header className="shared-app-bar">
      {pageAppBars === 0 && <div className="mobile-app-header app-bar-fallback">
        {appBar.backPath ? (
          <IconButton variant="ghost"
            className="icon-button app-back-button"
            type="button"
            aria-label={`Back to ${backSourcePath(appBar.backPath).slice(1).split("/")[0]}`}
            onClick={() =>
              onNavigateBack
                ? onNavigateBack(appBar.backPath)
                : onNavigatePath?.(appBar.backPath)
            }
          >
            <ArrowLeft size={22} />
          </IconButton>
        ) : null}
        <div className="mobile-app-title">
          <strong>{appBar.title}</strong>
          <small>
            {businessName}
            {offlineMode
              ? ` · ${language === "my" ? "အော့ဖ်လိုင်း" : "Offline"}`
              : ""}
          </small>
        </div>
        {activeModule?.id === "sell" && pathname !== "/sell/offline-sales" && (
          <IconButton variant="ghost" className="icon-button mobile-header-offline-button" type="button" aria-label="Offline invoices" onClick={() => onNavigatePath?.("/sell/offline-sales")}><Clock3 size={20} /></IconButton>
        )}
        <AppBarMenu />
      </div>}
      <div ref={setAppBarHost} className="app-bar-host" />
      </header>

      {activeModule?.id !== "sell" && !fullPageChat && (
        <TrialBanner
          session={session}
          onBilling={() => onNavigatePath?.("/billing")}
        />
      )}

      {drawerOpen && (
        <div className="app-drawer-layer">
          <button
            className="app-drawer-backdrop"
            type="button"
            aria-label={closeNavigation}
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            ref={drawerRef}
            id="mobile-app-drawer"
            className="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={navigationText(
              "mainNavigation",
              language,
              "Main navigation",
            )}
          >
            <div className="app-drawer-brand">
              <span className="brand-logo drawer-brand-logo">
                <BrandImage asset="icon" src={BRAND_LOGO} alt="" />
              </span>
              <span>
                <strong>PwarMyar</strong>
                <small>{businessName}</small>
              </span>
              <IconButton variant="ghost"
                ref={closeButtonRef}
                className="icon-button drawer-close-button mkpos-dismiss-icon"
                type="button"
                aria-label={closeNavigation}
                onClick={() => setDrawerOpen(false)}
              >
                <X size={20} />
              </IconButton>
            </div>

            <nav
              className="app-drawer-nav"
              aria-label={navigationText(
                "workspaceModules",
                language,
                "Workspace modules",
              )}
            >
              {MOBILE_NAVIGATION_SECTIONS.map((section) => {
                const visibleModules = section.modules
                  .map((id) => modules.find((module) => module.id === id))
                  .filter(Boolean);
                if (!visibleModules.length) return null;
                const headingId = `drawer-section-${section.id}`;
                return (
                  <section
                    key={section.id}
                    className="drawer-nav-group"
                    aria-labelledby={headingId}
                  >
                    <h2 className="drawer-nav-heading" id={headingId}>
                      {navigationText(section.id, language, section.label)}
                    </h2>
                    {visibleModules.map((module) => {
                      const Icon = MODULE_ICONS[module.id] || ShoppingBag;
                      const active = module.id === activeModule?.id;
                      const localizedModule = localizeNavigationModule(
                        module,
                        language,
                      );
                      return (
                        <a
                          key={module.id}
                          href={module.path}
                          className={active ? "is-active" : ""}
                          aria-current={active ? "page" : undefined}
                          onClick={(event) => navigate(event, module)}
                        >
                          <span className="drawer-nav-icon">
                            <Icon size={19} />
                          </span>
                          <span>
                            <strong>{localizedModule.label}</strong>

                          </span>
                        </a>
                      );
                    })}
                  </section>
                );
              })}
              {!modules.length && (
                <div className="drawer-no-modules">
                  {navigationText(
                    "noModules",
                    language,
                    "No modules are assigned to this account.",
                  )}
                </div>
              )}
              {modules.some(module => module.id === 'sell') && <a href="/sell/offline-sales" onClick={event => { event.preventDefault(); setDrawerOpen(false); onNavigatePath?.('/sell/offline-sales'); }}><span className="drawer-nav-icon"><Clock3 size={19} aria-hidden="true" /></span><span><strong>{language === 'my' ? 'အော့ဖ်လိုင်းပြေစာများ' : 'Offline invoices'}</strong><small>{language === 'my' ? 'သိမ်းထားသောပြေစာများနှင့် စင့်ခ်အခြေအနေ' : 'Saved invoices and sync status'}</small></span></a>}
              <a
                href={tutorialUrl({
                  apiUrl: import.meta.env.VITE_API_URL || "/api",
                  devOrigin: import.meta.env.DEV
                    ? import.meta.env.VITE_DEV_API_ORIGIN ||
                      "http://127.0.0.1:8000"
                    : "",
                  publicUrl: import.meta.env.VITE_PUBLIC_SITE_URL || "",
                })}
                target={Capacitor.isNativePlatform() ? "_self" : "_blank"}
                rel="noopener noreferrer"
                onClick={() => setDrawerOpen(false)}
              >
                <span className="drawer-nav-icon">
                  <Video size={19} />
                </span>
                <span>
                  <strong>
                    {language === "my" ? "သင်ခန်းစာများ" : "Tutorials"}
                  </strong>
                  <small>
                    {language === "my"
                      ? "ဗီဒီယိုသင်ခန်းစာများ · အင်တာနက်လိုအပ်သည်"
                      : "Video guides · opens in browser · internet required"}
                  </small>
                </span>
              </a>
              <a href="/assistant" aria-disabled={offlineMode} onClick={event => { event.preventDefault(); setDrawerOpen(false); if (!offlineMode) onNavigatePath?.('/assistant'); }}>
                <span className="drawer-nav-icon"><Bot size={19} aria-hidden="true" /></span><span><strong>PwarMyar AI assistant</strong><small>{offlineMode ? 'Available online' : 'PwarMyar support'}</small></span>
              </a>
            </nav>

            <footer className="app-drawer-footer">
              <DrawerLanguage language={language} onChange={setLanguage} />
              <div className="drawer-account-row"><div className="drawer-account">
                <span
                  className={`drawer-account-avatar${shopLogo ? " has-logo" : ""}`}
                >
                  {shopLogo ? (
                    <img src={shopLogo} alt={`${businessName} logo`} />
                  ) : (
                    <span aria-hidden="true">{userName.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}</span>
                  )}
                </span>
                <div>
                  <strong>{userName}</strong>
                  <small>{roleName}</small>
                </div>
              </div>
              <Button variant="plain"
                type="button"
                className="drawer-logout"
                onClick={logout}
                disabled={loggingOut}
              >
                <LogOut size={19} />
                <span>
                  {loggingOut
                    ? navigationText("signingOut", language, "Signing out…")
                    : navigationText("signOut", language, "Sign out")}
                </span>
              </Button></div>
            </footer>
          </aside>
        </div>
      )}

      <div className="mobile-app-content">
        <PrintStatusNotice />
        
          <SwipeRefreshShell onRefresh={onRefresh}>{children}</SwipeRefreshShell>
        
      </div>
      <nav className="sale-bottom-navigation" aria-label={navigationText('workspaceModules', language, 'Workspace modules')}>
        {[['sell', ShoppingCart], ['products', Package], ['sales', BarChart3], ['shop', Store], ['reports', BarChart3]].map(([id, Icon]) => {
          const enabledModule = modules.find(item => item.id === id);
          const module = enabledModule || (offlineMode && session?.permissions?.includes(id) ? MOBILE_MODULES.find(item => item.id === id) : null);
          return module && <Button variant="plain" key={id} type="button" disabled={!enabledModule} title={!enabledModule ? (language === 'my' ? 'အွန်လိုင်းရမှ သုံးနိုင်သည်' : 'Available online') : undefined} aria-current={activeModule?.id === id ? 'page' : undefined} onClick={() => { if (enabledModule && pathname !== module.path) onNavigatePath?.(module.path); }}><span className="bottom-nav-icon"><Icon size={24} aria-hidden="true" />{id === 'shop' && <OrderCountBadge className="bottom-nav-order-badge" />}</span><small>{localizeNavigationModule(module, language).label}</small></Button>;
        })}
      </nav>
    </div></AppNavigationContext.Provider></OrderAttentionContext.Provider></PageAppBarContext.Provider>
  );
}
