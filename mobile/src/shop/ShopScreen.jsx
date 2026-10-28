import { OrderCountBadge } from './OrderCountBadge';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button } from '../components/Controls';
import React from 'react';

import { BarChart3, ChevronRight, CreditCard, Image, ImagePlus, MapPin, MessageCircle, Package, Phone, ShoppingBag, Star, Store, Tag, Truck, Users } from 'lucide-react';
import { ShopLocation, ShopLocationGate } from './ShopLocation';
import { ShopOrders, ShopOrderDetail, ShopOrderAction, ShopRequestReview } from './ShopOrders';
import { SHOP_SECTIONS, canShop } from './shopUtils';
import { ShopConfigurationList, ShopConfigurationForm, ShopContactsHeader, ShopDeliveryHeader } from './ShopConfiguration';
import { ShopCatalog, ShopPublicationForm, CatalogSubscriptionGate } from './ShopCatalog';
import { ShopCover, ShopCoverHeader } from './ShopCover';
import { ShopMethodsHeader } from './ShopMethods';
import { ShopLogo, ShopLogoHeader } from './ShopLogo';
import { ShopStorefront, ShopStorefrontHeader } from './ShopStorefront';
import { ShopFulfillment } from './ShopFulfillment';
import { ShopCustomers, ShopCustomerDetail, ShopCustomerAction } from './ShopCustomers';
import { ShopChatInbox, ShopConversation } from './ShopChat';
import { ShopSalesAi } from './ShopSalesAi';
import { ShopReviews, ShopReviewReply, ShopReviewHeader } from './ShopReviews';
import { ShopReport, ShopReportHeader } from './ShopReport';
import { ShopPromotions, ShopPromotionForm, PromotionHeader } from './ShopPromotions';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { REMAINING_PAGE_MESSAGES } from '../localization/remainingPagesLocale';
import { SHOP_MESSAGES, SHOP_CATALOG_PATTERNS } from './shopLocale';
import { SHOP_ADDITIONAL_MESSAGES } from './shopAdditionalLocale';
import { SHOP_PROMOTION_MESSAGES, SHOP_PROMOTION_PATTERNS } from './shopPromotionsLocale';
import { SHOP_REPORT_MESSAGES } from './shopReportLocale';
import { SHOP_REVIEW_MESSAGES } from './shopReviewLocale';
import { SHOP_STOREFRONT_MESSAGES } from './shopStorefrontLocale';

const messages = { ...REMAINING_PAGE_MESSAGES, ...SHOP_MESSAGES, ...SHOP_ADDITIONAL_MESSAGES, ...SHOP_PROMOTION_MESSAGES, ...SHOP_REPORT_MESSAGES, ...SHOP_REVIEW_MESSAGES, ...SHOP_STOREFRONT_MESSAGES };
const patterns = [...SHOP_CATALOG_PATTERNS, ...SHOP_PROMOTION_PATTERNS];

const SECTION_ICONS = {
  orders: ShoppingBag,
  customers: Users,
  chat: MessageCircle,
  reviews: Star,
  report: BarChart3,
  catalog: Package,
  promotions: Tag,
  contacts: Phone,
  delivery: Truck,
  methods: CreditCard,
  storefront: Store,
  fulfillment: MapPin,
  cover: Image,
};

function ShopMenuItem({ title, description, icon: Icon, onClick, orderBadge = false }) {
  return (
    <Button variant="plain" type="button" onClick={onClick}>
      <span><Icon size={20} aria-hidden="true" /></span>
      <span><strong>{title}</strong><small>{description}</small></span>
      {orderBadge && <OrderCountBadge />}<ChevronRight className="settings-section-arrow" size={19} aria-hidden="true" />
    </Button>
  );
}


export function ShopScreen({ pathname, onNavigate, session }) {
  
  const action = pathname.match(/^\/shop\/orders\/(\d+)\/action\/([^/]+)$/);
  const request = pathname.match(/^\/shop\/orders\/(\d+)\/requests\/(\d+)\/review$/);
  const detail = pathname.match(/^\/shop\/orders\/(\d+)$/);
  const configForm = pathname.match(/^\/shop\/(contacts|delivery|methods)\/(?:new|([^/]+)\/edit)$/);
  const configList = pathname.match(/^\/shop\/(contacts|delivery|methods)$/);
  const publication = pathname.match(/^\/shop\/catalog\/(\d+)\/edit$/);
  const customerAction = pathname.match(/^\/shop\/customers\/([^/]+)\/action\/(block|credit)$/);
  const customer = pathname.match(/^\/shop\/customers\/([^/]+)$/);
  const conversation = pathname.match(/^\/shop\/chat\/([a-f0-9-]{36})$/);
  const review = pathname.match(/^\/shop\/reviews\/(\d+)\/edit$/);
  const promotion = pathname.match(/^\/shop\/promotions\/(\d+)\/edit$/);
  const newPromotion = pathname.match(/^\/shop\/promotions\/new\/(coupon|flash_sale)$/);
  const subscribed = session?.subscription?.is_valid !== false;
  const restricted = /^\/shop\/(catalog|promotions|contacts|delivery|methods|storefront|fulfillment|cover|logo)(\/|$)/.test(pathname);
  let content;
  if (pathname === '/shop/location') content = <ShopLocation session={session} onNavigate={onNavigate} />;
  else if (/^\/shop\/sales-ai(?:\/|$)/.test(pathname) && session?.user?.role === 'owner') content = <ShopSalesAi pathname={pathname} onNavigate={onNavigate} />;
  else if (!subscribed && /^\/shop\/catalog(?:\/|$)/.test(pathname)) content = <CatalogSubscriptionGate onNavigate={onNavigate} />;
  else if (!subscribed && /^\/shop\/contacts(?:\/|$)/.test(pathname)) content = <><ShopContactsHeader title="Shop contacts" onBack={() => onNavigate('/shop')} /><section className="shop-mobile-card"><h2>Subscription required</h2><p>Renew your subscription to manage catalog and shop settings.</p><Button variant="primary" type="button" className="mobile-primary" onClick={() => onNavigate('/billing')}>View subscription</Button></section></>;
  else if (!subscribed && restricted) content = <div className="shop-mobile-card"><h1>Subscription required</h1><p>Renew your subscription to manage catalog and shop settings.</p><Button variant="primary" type="button" className="mobile-primary" onClick={() => onNavigate('/billing')}>View subscription</Button></div>;
  else if (canShop(session, 'ecommerce_catalog') && promotion) content = <ShopPromotionForm session={session} id={promotion[1]} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_catalog') && newPromotion) content = <ShopPromotionForm session={session} type={newPromotion[1]} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_catalog') && pathname === '/shop/promotions') content = <ShopPromotions session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && review) content = <ShopReviewReply id={review[1]} session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && pathname === '/shop/reviews') content = <ShopReviews session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && pathname === '/shop/report') content = <ShopReport onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && conversation) content = <ShopConversation uuid={conversation[1]} session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && pathname === '/shop/chat') content = <ShopChatInbox session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && customerAction) content = <ShopCustomerAction customerKey={decodeURIComponent(customerAction[1])} action={customerAction[2]} session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && customer) content = <ShopCustomerDetail customerKey={decodeURIComponent(customer[1])} session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && pathname === '/shop/customers') content = <ShopCustomers session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_settings') && pathname === '/shop/fulfillment') content = <ShopFulfillment onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_settings') && pathname === '/shop/storefront') content = <ShopStorefront section="storefront" session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_settings') && pathname === '/shop/cover') content = <ShopCover onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_settings') && pathname === '/shop/logo') content = <ShopLogo session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_settings') && configForm) content = <ShopConfigurationForm section={configForm[1]} id={configForm[2] ? decodeURIComponent(configForm[2]) : null} onNavigate={onNavigate} session={session} />;
  else if (canShop(session, 'ecommerce_settings') && configList) content = <ShopConfigurationList section={configList[1]} onNavigate={onNavigate} session={session} />;
  else if (canShop(session, 'ecommerce_catalog') && publication) content = <ShopPublicationForm id={publication[1]} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_catalog') && pathname === '/shop/catalog') content = <ShopCatalog onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && action) content = <ShopOrderAction id={action[1]} action={action[2]} session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && request) content = <ShopRequestReview id={request[1]} requestId={request[2]} session={session} onNavigate={onNavigate} />;
  else if (canShop(session, 'ecommerce_orders') && detail) content = <ShopOrderDetail id={detail[1]} session={session} onNavigate={onNavigate} />;
  else if (pathname === '/shop/orders' && canShop(session, 'ecommerce_orders')) content = <ShopOrders session={session} onNavigate={onNavigate} />;
  else if (pathname === '/shop') {
    const sections = SHOP_SECTIONS.filter(s => canShop(session, s.permission) && (subscribed || s.permission === 'ecommerce_orders'));
    const owner = session?.user?.role === 'owner';
    const groups = [
      ['Operations', ['orders', 'customers', 'chat', 'reviews', 'report']],
      ['Catalog', ['catalog', 'promotions', 'contacts']],
      ['Configuration', ['delivery', 'methods', 'storefront', 'fulfillment', 'cover']],
    ];
    const canConfigure = subscribed && canShop(session, 'ecommerce_settings');
    const identity = <><span className="shop-overview-identity-icon"><Store size={27} aria-hidden="true" /></span><span><strong>{session?.business?.name || 'My Shop'}</strong><small>Manage your online shop</small></span>{canConfigure && <ChevronRight size={20} aria-hidden="true" />}</>;
    content = <>
      <PageAppBar className="shop-overview-header"><h1>My Shop</h1><AppBarMenu /></PageAppBar>
      {canConfigure ? <Button variant="plain" type="button" className="shop-overview-identity" aria-label="Manage storefront" onClick={() => onNavigate('/shop/storefront')}>{identity}</Button> : <div className="shop-overview-identity">{identity}</div>}
      {groups.map(([title, ids]) => {
        const rows = sections.filter(s => ids.includes(s.id));
        if (!rows.length && !(title === 'Configuration' && owner)) return null;
        return <section className="shop-overview-group" key={title}><h2>{title}</h2><div className="settings-section-grid">{rows.map(s => <ShopMenuItem key={s.id} orderBadge={s.id === 'orders'} title={s.label} description={s.description} icon={SECTION_ICONS[s.id]} onClick={() => onNavigate(`/shop/${s.id}`)} />)}{title === 'Configuration' && owner && <><ShopMenuItem title="Sales AI" description="Representative and MMK credit" icon={MessageCircle} onClick={() => onNavigate('/shop/sales-ai')} /><ShopMenuItem title="Business logo" description="Shared business logo image" icon={ImagePlus} onClick={() => onNavigate('/shop/logo')} /><ShopMenuItem title="Shop location" description="Update the public location" icon={MapPin} onClick={() => onNavigate('/shop/location')} /></>}</div></section>;
      })}
      {!sections.length && !owner && <section className="shop-mobile-card"><p role="status">This shop page is unavailable for your account.</p></section>}
    </>;
  }
  else content = <p role="alert">This shop page is unavailable for your account.</p>;
  if (/^\/shop\/delivery(?:\/|$)/.test(pathname) && (!subscribed || !canShop(session, 'ecommerce_settings'))) content = <><ShopDeliveryHeader title="Delivery" onBack={() => onNavigate('/shop')} />{content}</>;
  if (pathname === '/shop/storefront' && (!subscribed || !canShop(session, 'ecommerce_settings'))) content = <><ShopStorefrontHeader onBack={() => onNavigate('/shop', { back: true })} />{content}</>;
  if (pathname === '/shop/cover' && (!subscribed || !canShop(session, 'ecommerce_settings'))) content = <><ShopCoverHeader onNavigate={onNavigate} />{content}</>;
  if (/^\/shop\/methods(?:\/|$)/.test(pathname) && (!subscribed || !canShop(session, 'ecommerce_settings'))) content = <><ShopMethodsHeader title="Shop payment methods" onBack={() => onNavigate('/shop', { back: true })} />{content}</>;
  if (pathname === '/shop/logo' && (!subscribed || !canShop(session, 'ecommerce_settings'))) content = <><ShopLogoHeader onNavigate={onNavigate} />{content}</>;
  if (/^\/shop\/reviews(?:\/|$)/.test(pathname) && !canShop(session, 'ecommerce_orders')) content = <><ShopReviewHeader onBack={() => onNavigate('/shop', { back: true })} /><section className="shop-mobile-card"><h2>Reviews unavailable</h2><p>This shop page is unavailable for your account.</p></section></>;
  if (pathname === '/shop/report' && !canShop(session, 'ecommerce_orders')) content = <><ShopReportHeader onBack={() => onNavigate('/shop', { back: true })} /><section className="shop-mobile-card"><h2>Shop report unavailable</h2><p>This shop page is unavailable for your account.</p></section></>;
  if (/^\/shop\/promotions(?:\/|$)/.test(pathname) && (!subscribed || !canShop(session, 'ecommerce_catalog'))) content = <><PromotionHeader title="Promotions" onBack={() => onNavigate('/shop', { back: true })} /><section className="shop-mobile-card"><h2>{!subscribed ? 'Subscription required' : 'Promotions unavailable'}</h2><p>{!subscribed ? 'Renew your subscription to manage catalog and shop settings.' : 'This shop page is unavailable for your account.'}</p>{!subscribed && <Button variant="primary" type="button" className="mobile-primary" onClick={() => onNavigate('/billing')}>View subscription</Button>}</section></>;
  return <ModuleLocalizationBoundary messages={messages} patterns={patterns}><main className={pathname === '/shop' ? 'shop-overview-page' : `shop-mobile-page${['/shop/contacts', '/shop/delivery', '/shop/methods', '/shop/promotions'].includes(pathname) ? ' has-create-fab' : ''}${pathname === '/shop/storefront' ? ' shop-storefront-reference-page' : ''}${pathname === '/shop/storefront' ? ' shop-storefront-reference-page' : ''}${/^\/shop\/reviews(?:\/|$)/.test(pathname) ? ' shop-reviews-reference-page' : ''}${pathname === '/shop/report' ? ' shop-report-reference-page' : ''}${/^\/shop\/promotions(?:\/|$)/.test(pathname) ? ' shop-promotions-reference-page' : ''}${/^\/shop\/orders(?:\/|$)/.test(pathname) ? ' shop-orders-reference-page' : ''}${/^\/shop\/methods(?:\/|$)/.test(pathname) ? ' shop-methods-reference-page' : ''}${pathname === '/shop/logo' ? ' shop-logo-reference-page' : ''}${pathname === '/shop/location' ? ' shop-location-reference-page' : ''}${pathname === '/shop/fulfillment' ? ' shop-fulfillment-reference-page' : ''}${/^\/shop\/delivery(?:\/|$)/.test(pathname) ? ' shop-delivery-reference-page' : ''}${/^\/shop\/customers(?:\/|$)/.test(pathname) ? ' shop-buyers-reference-page' : ''}${pathname === '/shop/cover' ? ' shop-cover-reference-page' : ''}${/^\/shop\/contacts(?:\/|$)/.test(pathname) ? ' shop-contacts-reference-page' : ''}${pathname === '/shop/chat' ? ' shop-chat-reference-inbox' : ''}${/^\/shop\/catalog(?:\/|$)/.test(pathname) ? ' shop-catalog-page' : ''}${conversation ? ' shop-conversation-page' : ''}`} >{pathname === '/shop/location' ? content : <ShopLocationGate session={session} onNavigate={onNavigate}>{content}</ShopLocationGate>}</main></ModuleLocalizationBoundary>;
}
