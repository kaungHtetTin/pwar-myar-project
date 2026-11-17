import { AuthLocaleToggle } from './AuthLocaleToggle';
import '../../shared/theme/auth-locale.css';
import { ShopAlertProvider } from './ShopAlertProvider';
import { startBranding, BrandImage } from './platformBranding';
import { KeyboardViewport } from './KeyboardViewport';
import { useRefreshResource as useResource } from './useRefreshResource';
import { SwipeRefreshShell } from './SwipeRefreshShell';
import { ShopRadar } from './ShopRadar';
import { PasswordResetForm } from './PasswordResetForm';
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ShoppingBag,
  ShoppingCart,
  Store,
  ArrowRight,
  Search,
  Package,
  ArrowLeft,
  Home,
  ClipboardList,
  UserRound,
  MessageCircle,
  MessageCircleMore,
  Zap,
  Check,
  CheckCheck,
  Plus,
  Clock3,
  Trash2,
  Truck,
  CreditCard,
  ReceiptText,
  LockKeyhole,
  MapPin,
  Phone,
  AlertCircle,
  Heart,
  Bell,
  Mail,
  UserPlus,
  ChevronRight,
  X,
} from "lucide-react";
import "@fontsource/noto-sans-myanmar/400.css";
import { request, post } from "./api";
import { addToCarts, readCarts, saveCarts, updateShopCart } from "./cart";
import { CartSelection, ShopCart } from "./MarketplaceCart";
import { useEndless } from "./useEndless";
import "./styles.css";
import "./shopping-layout.css";
import "./shopping-components.css";
import './customer-features.css';
import './compact-ui.css';
import './customer-auth.css';
import './marketplace-home.css';
import './marketplace-cart.css';
import './shop-detail.css';
import './orders.css';
import './order-detail.css';
import './product-detail.css';
import './app-bar-search.css';
import './checkout.css';
import './chat-conversation.css';
import { BuyAgain } from './BuyAgain';
import { MarketplaceHome } from './MarketplaceHome';
import { CustomerChats } from './CustomerChats';
import { ReportShopLink, ShopReportPage } from './ShopReports';
import { ShoppingFeaturesProvider, FavoriteButton, FavoritesPage, AddressesPage, SavedAddressPicker } from './CustomerFeatures';
import { UpdatesLink, UpdatesPage, StockAlertButton, StockAlertsPage } from './ShopUpdates';
import { CatalogFilters, defaultCatalogFilters, catalogFilterQuery, RecentProducts, RememberProduct, RelatedProducts } from './ProductDiscovery';
import { ShopHours } from './ShopHours';
import { OrderDetailContent } from './OrderDetailContent';
import { OrderRequests } from './OrderRequests';
import { ProductMedia, PriceTag, QuantityControl, StatusBadge, SectionTitle, LoadingPanel } from './ShoppingComponents';
import { LocaleContext, useText, localizeError, translate } from "./i18n";
import { CustomerAccount, CustomerEditProfile, CustomerAuth, CustomerOrders, CustomerProvider, useCustomer } from "./CustomerAccount";
import { PaymentScreenshot } from "./PaymentScreenshot";
import { ShopLocation } from "./ShopLocation";
import { ShopChat } from "./ShopChat";
import { ChatAlerts } from './ChatAlerts';
import { CustomerOrderAlerts } from './CustomerOrderAlerts';
import { ShopContacts } from "./ShopContacts";
import { Reviews, RatingSummary } from './Reviews';
import { RetainedViews, useShopPageActive } from "./RetainedViews";
import './account-app-bar.css';
import './app-bar-density.css';
import { go, goBack, useShopRoute } from "./shopNavigation";

const words = {
  en: {
    shops: "Shops",
    products: "Products",
    cart: "Cart",
    tracking: "Track order",
    search: "Search",
    checkout: "Checkout",
    add: "Add to cart",
    pickup: "Pickup",
    delivery: "Delivery",
    retry: "Try again",
    name: "Your name",
    phone: "Phone number",
    address: "Delivery address",
    payment: "Payment method",
    quote: "Review order",
    place: "Place order",
    quantity: "Quantity",
  },
  my: {
    shops: "ဆိုင်များ",
    products: "ကုန်ပစ္စည်းများ",
    cart: "ဈေးခြင်း",
    tracking: "အော်ဒါကြည့်ရန်",
    search: "ရှာရန်",
    checkout: "အော်ဒါတင်ရန်",
    add: "ဈေးခြင်းထဲထည့်ရန်",
    pickup: "ဆိုင်တွင်ယူရန်",
    delivery: "ပို့ဆောင်ရန်",
    retry: "ပြန်ကြိုးစားရန်",
    name: "အမည်",
    phone: "ဖုန်းနံပါတ်",
    address: "ပို့ဆောင်ရန်လိပ်စာ",
    payment: "ငွေပေးချေနည်း",
    quote: "အော်ဒါစစ်ဆေးရန်",
    place: "အော်ဒါတင်မည်",
    quantity: "အရေအတွက်",
  },
};
const money = (amount, currency) =>
  `${Number(amount).toLocaleString()} ${currency}`;
const storePath = (slug) => `/store/${encodeURIComponent(slug)}`;
const chatAccountRequest = (path, options = {}) => request(path, { ...options, customerAuth: true });
function ErrorBox({ message, retry }) {
  const text = useText();
  const locale = useContext(LocaleContext);
  return message ? (
    <div className="error" role="alert">
      <AlertCircle size={18} aria-hidden="true" /><span>{localizeError(locale, message)}</span>
      {retry && <button type="button" onClick={retry}>{text("Try again")}</button>}
    </div>
  ) : null;
}
function ListEnd({ list, skeleton = 'products', hideLoading = false }) {
  const text = useText();
  return (
    <div ref={list.sentinel} className="list-end">
      <ErrorBox message={list.error} retry={list.retry} />
      {list.busy ? (
        !hideLoading && <LoadingPanel variant={skeleton} count={list.items.length ? 2 : 4} />
      ) : !list.items.length && !list.error ? (
        <div className="catalog-empty"><Search size={25} aria-hidden="true" /><p>{text("No results found.")}</p></div>
      ) : list.more && !list.error ? (
        <button onClick={list.retry}>{text("Load more")}</button>
      ) : null}
    </div>
  );
}
function ProductCard({ product, origin, homeCard = false, cartAction, showDescription = false }) {
  const text = useText();
  const discounted = Number(product.original_price) > Number(product.price);
  const discount = discounted ? Math.round((1 - Number(product.price) / Number(product.original_price)) * 100) : 0;
  const currency = ['Ks', 'MMK', 'K'].includes(product.currency) ? 'K' : product.currency;
  return (
    <div className="product-card-wrap">
    <a
      className="product-card"
      href={`#${storePath(product.store_slug)}/products/${product.id}${origin === "marketplace" ? "?origin=marketplace" : ""}`}
    >
      <ProductMedia src={product.photo_url}>
        {homeCard && discounted ? <span className="home-discount-badge">−{discount}%</span> : product.flash_sale && <span className="product-sale-ribbon"><Zap size={12} aria-hidden="true" />{text("Flash sale")}</span>}
        {product.available_quantity <= 0 && <span className="product-sold-out">{text("Sold out")}</span>}
      </ProductMedia>
      <div className="product-info">
        <small className="product-category">{product.category || product.store_name}</small>
        <h3>{product.name}</h3>
        {showDescription && product.description?.trim() && <p className="shop-product-description">{product.description}</p>}
        {!homeCard && <PriceTag amount={product.price} currency={product.currency} original={product.flash_sale ? product.original_price : null} unit={product.unit_name} />}
        <RatingSummary rating={product.rating} slug={product.store_slug} productId={product.id} />
        <span className={`product-availability ${product.available_quantity > 0 ? '' : 'is-unavailable'}`}><span className="availability-dot" />{text(product.available_quantity > 0 ? "Available" : "Sold out")}</span>
        {origin === "marketplace" && (
          <span className="product-card-shop">
            <Store size={13} aria-hidden="true" /><span>{product.store_name}</span><ArrowRight size={13} aria-hidden="true" />
          </span>
        )}
      </div>
    </a>
    {homeCard && <div className="home-card-footer"><span className="price-tag home-card-price">{discounted && <del className="original-price">{currency} {Number(product.original_price).toLocaleString()}</del>}<strong className="price-current">{currency} {Number(product.price).toLocaleString()}</strong></span>{cartAction}</div>}
    <span className="product-card-save"><FavoriteButton slug={product.store_slug} productId={product.id} compact /></span>
    </div>
  );
}
function StoreLogo({ store }) {
  return <ProductMedia src={store.logo_url} className="store-symbol" fallback={<Store size={30} />} />;
}
function MarketplaceShopCard({ store, compact = false }) {
  const text = useText();
  return <a className={`shop-card ${compact ? 'home-shop-card' : ''}`} href={`#${storePath(store.slug)}?origin=marketplace`}>
    <div className="shop-card-identity"><StoreLogo store={store} /><div><h2>{store.display_name}</h2></div></div>
    <RatingSummary rating={store.rating} slug={store.slug} />
    {!compact && <p>{store.description || text('Browse this shop’s collection.')}</p>}
    <span className={`home-shop-status ${store.accepting_orders ? 'is-open' : ''}`}>{text(store.accepting_orders ? 'Accepting orders' : 'Orders paused')}</span>
    {!compact && <span className="shop-card-visit">{text('Visit shop')}<ArrowRight size={16} aria-hidden="true" /></span>}
  </a>;
}
function Marketplace({ t, add, carts }) {
  return <MarketplaceHome t={t} ProductCard={ProductCard} ShopCard={MarketplaceShopCard} ListEnd={ListEnd} add={add} carts={carts} />;
}
function Shop({ slug, origin, t, add, cart }) {
  const text = useText();
  const paneId = React.useId();
  const [filters, setFilters] = useState(defaultCatalogFilters);
  const store = useResource(`/stores/${encodeURIComponent(slug)}`);
  const [tab, setTab] = useState("products"), [added, setAdded] = useState("");
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("");
  const list = useEndless(
    `/stores/${encodeURIComponent(slug)}/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&${catalogFilterQuery(filters)}`,
  );
  if (store.busy) return <LoadingPanel variant="shop" message="Loading shop…" />;
  if (store.error)
    return <ErrorBox message={store.error} retry={store.retry} />;
  return (
    <>
      <div className="shop-detail-cover"><div className="shop-cover-report"><ReportShopLink slug={slug} /></div><ProductMedia src={store.data.cover_url || store.data.logo_url} name={store.data.display_name} className="shop-cover-media" lazy={false} /><button type="button" className="shop-cover-search" aria-label={text('Search products')} onClick={event => { const page = event.currentTarget.closest('.shop-detail-page'); setTab('products'); requestAnimationFrame(() => page?.querySelector('.search input')?.focus({ preventScroll: true })); }}><Search size={21} /></button><div className="shop-cover-favorite"><FavoriteButton slug={slug} compact /></div></div>
      <div className="store-heading">
        <StoreLogo store={store.data} />
        <div className="store-heading-info"><h1>{store.data.display_name}</h1><span className={`shop-detail-status ${store.data.accepting_orders ? 'is-open' : ''}`}><span />{text(store.data.accepting_orders ? 'Accepting orders' : 'Orders paused')}</span><RatingSummary rating={store.data.rating} slug={slug} />{store.data.description && <p>{store.data.description}</p>}</div>
      </div>
      <div className="shop-detail-actions">{store.data.phone ? <a href={`tel:${store.data.phone}`}><Phone size={19} />{text('Call')}</a> : <button type="button" disabled><Phone size={19} />{text('Call')}</button>}<ShopChat slug={slug} storeName={store.data.display_name} /><button type="button" onClick={() => { setTab('about'); requestAnimationFrame(() => document.getElementById(`shop-about-${paneId}`)?.scrollIntoView({block:'start', behavior:'smooth'})); }}><MapPin size={19} />{text('Location')}</button></div>
      <div className="shop-detail-tabs" role="tablist" aria-label={text('Shop details')}>{[['products',t.products],['about',text('About')],['reviews',text('Reviews')]].map(([value,label])=><button key={value} type="button" role="tab" id={`shop-tab-${paneId}-${value}`} aria-controls={`shop-panel-${paneId}-${value}`} aria-selected={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div>
      <div hidden={tab !== 'products'} role="tabpanel" id={`shop-panel-${paneId}-products`} aria-labelledby={`shop-tab-${paneId}-products`}>
      {!store.data.accepting_orders && (
        <p className="notice">
          {text("This shop has paused new orders. You can still browse.")}
        </p>
      )}

      <div className="catalog-toolbar">
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search);
          }}
        >
          <Search size={18} />
          <input
            aria-label={t.search}
            placeholder={text("Search products or categories")}
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button>{t.search}</button>
        </form>
      </div>
      <CatalogFilters value={filters} onChange={setFilters} category={category} onCategoryChange={value => setCategory(value || '')} renderCategoryFilter={({ value, onChange }) => <label>{text('Category')}<select value={value || ''} onChange={event => onChange(event.target.value)}><option value="">{text('All categories')}</option>{(store.data.categories || []).filter(Boolean).map(name => <option key={name} value={name}>{name}</option>)}</select></label>} />
      <div className="shop-detail-products">{list.items.map(p => <div className="shop-detail-product" key={p.id}><ProductCard product={p} origin={origin} homeCard showDescription cartAction={<button type="button" className="shop-detail-add" aria-label={`${text('Add to cart')}: ${p.name}`} disabled={Number(p.available_quantity)<=Number(cart?.items.find(item=>item.id===p.id)?.quantity || 0)} onClick={()=>{const quantity=Math.min(1,Number(p.available_quantity)-Number(cart?.items.find(item=>item.id===p.id)?.quantity || 0));if(quantity>0 && add(p,quantity,origin))setAdded(text('Added to cart: {name}',{name:p.name}));}}><ShoppingCart size={21} aria-hidden="true" /></button>} /></div>)}</div>
      {added && <p role="status" className="shop-detail-feedback">{added}<button type="button" aria-label={text('Dismiss notification')} onClick={()=>setAdded('')}>×</button></p>}
      <ListEnd list={list} skeleton="shop-products" />
      </div><div hidden={tab !== 'about'} role="tabpanel" id={`shop-panel-${paneId}-about`} aria-labelledby={`shop-tab-${paneId}-about`}><div className="shop-contact" id={`shop-about-${paneId}`}><ShopHours store={store.data} />
        <SectionTitle icon={Store} title={text("Shopping with {name}", { name: store.data.display_name })} />
        {store.data.pickup_address && store.data.pickup_address !== store.data.address && <p className="shop-detail-line"><MapPin size={17} aria-hidden="true" /><span>{store.data.pickup_address}</span></p>}
        {store.data.pickup_hours && <p className="shop-detail-line"><Clock3 size={17} aria-hidden="true" /><span>{store.data.pickup_hours}</span></p>}
        {store.data.pickup_instructions && <p className="shop-detail-line"><Package size={17} aria-hidden="true" /><span>{store.data.pickup_instructions}</span></p>}
        {store.data.address && <p className="shop-detail-line"><MapPin size={17} aria-hidden="true" /><span>{store.data.address}</span></p>}
        {store.data.phone && <p className="shop-detail-line"><UserRound size={17} aria-hidden="true" /><span>{store.data.phone}</span></p>}
        <ShopLocation location={store.data.location} />
        <ShopContacts contacts={store.data.contacts} />
      </div>
      </div><div hidden={tab !== 'reviews'} role="tabpanel" id={`shop-panel-${paneId}-reviews`} aria-labelledby={`shop-tab-${paneId}-reviews`}><Reviews slug={slug} /></div>
    </>
  );
}
function Product({ slug, id, origin, add, t, cart }) {
  const text = useText();
  const product = useResource(
    `/stores/${encodeURIComponent(slug)}/products/${id}`,
  );
  const [qty, setQty] = useState("1"),
    [message, setMessage] = useState("");
  if (product.busy) return <LoadingPanel variant="product" message="Loading product…" page />;
  if (product.error)
    return <ErrorBox message={product.error} retry={product.retry} />;
  const p = product.data;
  const inCart = cart?.slug === slug ? Number(cart.items.find(item => item.id === p.id)?.quantity || 0) : 0;
  const addLimit = Math.max(0, Math.min(p.available_quantity, p.flash_sale?.remaining_quantity ?? p.available_quantity) - inCart);
  return (
    <>
      <div className="product-detail">
        <RememberProduct product={p} />
        <ProductMedia src={p.photo_url} name={p.name} lazy={false}>
          {p.flash_sale && <span className="product-sale-ribbon"><Zap size={14} aria-hidden="true" />{text("Flash sale")}</span>}
          <span className="product-detail-save"><FavoriteButton slug={slug} productId={p.id} compact /></span>
        </ProductMedia>
        <div className="product-detail-info">
          <div className="product-price-panel"><PriceTag className="price-detail" amount={p.price} currency={p.currency} original={p.flash_sale ? p.original_price : null} unit={p.unit_name} /></div>
          {p.category && <span className="product-category">{p.category}</span>}
          <h1>{p.name}</h1>
          <RatingSummary rating={p.rating} slug={slug} productId={p.id} />
          {p.flash_sale && <div className="flash-sale-detail"><div className="sale-title"><Zap size={16} aria-hidden="true" /><strong>{text("Flash sale")} · {p.flash_sale.name}</strong></div>{p.flash_sale.ends_at && <small><Clock3 size={13} aria-hidden="true" />{text("Ends")} {new Date(p.flash_sale.ends_at).toLocaleString()}</small>}{p.flash_sale.remaining_quantity !== null && <small>{p.flash_sale.remaining_quantity} {p.unit_name} {text("remaining at the sale price")}</small>}</div>}
          <section className="product-description"><h2>{text("Product details")}</h2><p>
            {p.description ||
              text("Contact the shop for more information about this product.")}
          </p></section>
          <div className="product-stock-line"><span className={`product-availability ${p.available_quantity > 0 ? '' : 'is-unavailable'}`}><span className="availability-dot" />
            {p.available_quantity > 0
              ? text("{quantity} {unit} available", { quantity: p.available_quantity, unit: p.unit_name })
              : text("Sold out")}
          </span></div>
          {p.available_quantity <= 0 && <StockAlertButton product={p} />}
          <div className="product-purchase"><form
            onSubmit={(e) => {
              e.preventDefault();
              if (add(p, Number(qty), origin))
                setMessage("Added to your cart.");
            }}
          >
            <QuantityControl label={t.quantity} name={p.name} value={qty} onChange={setQty} max={addLimit} required />
            <button className="primary" disabled={addLimit <= 0}>
              <ShoppingBag size={18} />
              {t.add}
            </button>
          </form>
          {message && <p role="status"><Check size={15} aria-hidden="true" />{text(message)}</p>}</div>
          <div className="product-shop-links">
            <a className="button" href={`#${storePath(slug)}`}><Store size={18} />{p.store_name}</a>
            <a className="button" href={`#/chats?shop=${encodeURIComponent(slug)}`}><MessageCircle size={18} />{text("Chat with shop")}</a>
          </div>
        </div>
      </div>
      <Reviews slug={slug} productId={Number(id)} />
      <RelatedProducts slug={slug} id={id} ProductCard={ProductCard} origin={origin} />
    </>
  );
}
function Cart({ cart }) { return <CartSelection carts={cart?.items.length ? [cart] : []} />; }
export function Totals({ quote }) {
  const text = useText();
  return (
    <div className="totals">
      {quote.items.map((i) => (
        <div className="total-item" key={i.product_id}>
          <span><strong>{i.name}</strong><small>× {i.quantity} {i.unit_name}</small></span>
          <span className="total-item-price">{money(i.line_total, quote.currency)}</span>
        </div>
      ))}
      {quote.promotions?.filter(promotion => promotion.type === "flash_sale").map(promotion => <p className="promotion-summary" key={promotion.id}>{text("Flash sale")} · {promotion.name} · {text("Saved")} {money(promotion.discount, quote.currency)}</p>)}
      {Number(quote.discount) > 0 && <div className="coupon-summary"><span>{text("Coupon")} {quote.promotions?.find(promotion => promotion.type === "coupon")?.code}</span><span>−{money(quote.discount, quote.currency)}</span></div>}
      <div>
        <span>{text(quote.delivery_fee_recipient === "delivery_service" ? "Delivery fee charged by shop" : "Delivery")}</span>
        <span>{money(quote.delivery_fee, quote.currency)}</span>
      </div>
      {quote.delivery_fee_recipient === "delivery_service" && <p>{text("Delivery fee is paid separately to the delivery service and is excluded from the shop total.")}</p>}
      <div className="grand-total">
        <strong>{text(quote.delivery_fee_recipient === "delivery_service" ? "Total payable to shop" : "Total")}</strong>
        <strong>{money(quote.total, quote.currency)}</strong>
      </div>
    </div>
  );
}
function Checkout({ slug, cart, onSubmitted, t }) {
  const text = useText();
  const checkoutForm = useRef(null);
  const actionDialog = useRef(null);
  const submitting = useRef(false);
  const active = useShopPageActive();
  const [action, setAction] = useState(null);
  const [addressDraft, setAddressDraft] = useState('');
  const { customer, loading: accountLoading } = useCustomer();
  const [step, setStep] = useState(1);
  const [checkoutMode, setCheckoutMode] = useState(customer ? "account" : "guest");
  const store = useResource(`/stores/${encodeURIComponent(slug)}`);
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
    fulfillment: "pickup",
    address: "",
    delivery_zone_id: "",
    payment_method_id: "",
    notes: "",
    coupon_code: "",
  });
  const [quote, setQuote] = useState(null),
    [screenshot, setScreenshot] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!active) { setAction(null); return; }
    const open = event => { setAddressDraft(form.address); setAction(event.detail); };
    window.addEventListener('mkpos:checkout-action', open);
    return () => window.removeEventListener('mkpos:checkout-action', open);
  }, [active, form.address]);
  useEffect(() => {
    const dialog = actionDialog.current;
    if (!dialog) return;
    if (action && active) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [action, active]);
  const key = `mkpos.shop.pending.${slug}`;
  useEffect(() => { if (step === 4 && !quote) setStep(3); }, [step, quote]);
  const identityKey = `${key}.customer`;
  useEffect(() => {
    if (!customer) return;
    setCheckoutMode("account");
    setForm((current) => ({ ...current, customer_name: current.customer_name || customer.name,
      phone: current.phone || customer.phone || "", email: current.email || customer.email,
      address: current.address || customer.address || "" }));
  }, [customer?.id]);
  const [pending, setPending] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  });
  const [showRecovery, setShowRecovery] = useState(Boolean(pending));
  const [submissionDone, setSubmissionDone] = useState(false);
  useEffect(() => {
    if (!active && submissionDone) {
      setPending(null);
      setBusy(false);
      setForm({ customer_name: customer?.name || '', phone: customer?.phone || '', email: customer?.email || '', fulfillment: 'pickup', address: customer?.address || '', delivery_zone_id: '', payment_method_id: '', notes: '', coupon_code: '' });
      checkoutForm.current?.querySelectorAll('input[type="file"]').forEach(input => { input.value = ''; });
      setQuote(null); setScreenshot(null); setAddressDraft(''); setAction(null); setStep(1); setShowRecovery(false); setSubmissionDone(false);
    }
  }, [active, submissionDone, customer]);
  const change = (name, value) => {
    if (name === "payment_method_id") setScreenshot(null);
    setForm((s) => ({ ...s, [name]: value }));
    setQuote(null);
    setError("");
  };
  async function review(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setQuote(
        await post(`/stores/${encodeURIComponent(slug)}/quote`, {
          ...form,
          payment_method_id:
            form.payment_method_id || store.data.payment_methods[0].id,
          origin: cart.origin,
          items: cart.items.map((i) => ({
            product_id: i.id,
            quantity: i.quantity,
          })),
        }),
      );
      setStep(4);
    } catch (e) {
      setError(e.message);
      setQuote(null);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (submitting.current || busy || accountLoading) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    let accountId = checkoutMode === "account" ? customer?.id : null;
    if (pending) {
      try { accountId = JSON.parse(sessionStorage.getItem(identityKey) || "null"); } catch { accountId = null; }
    }
    if (accountId && customer?.id !== accountId) {
      setError("Sign in to the account used for this order before retrying.");
      submitting.current = false;
      setBusy(false);
      return;
    }
    const payload = pending || {
      ...form,
      payment_method_id:
        form.payment_method_id || store.data.payment_methods[0].id,
      origin: cart.origin,
      items: cart.items.map((i) => ({
        product_id: i.id,
        quantity: i.quantity,
      })),
      quote_hash: quote.quote_hash,
      idempotency_key: crypto.randomUUID(),
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
    sessionStorage.setItem(identityKey, JSON.stringify(accountId || null));
    setPending(payload);
    try {
      const result = await post(
        `/stores/${encodeURIComponent(slug)}/checkout`,
        payload,
        { customerAuth: Boolean(accountId) },
      );
      sessionStorage.setItem(
        "mkpos.shop.tracking",
        JSON.stringify({
          reference: result.reference,
          ...(!accountId ? { credential: result.tracking_credential } : {}),
        }),
      );
      sessionStorage.setItem("mkpos.shop.tracking.customer", JSON.stringify(accountId || null));
      if (screenshot) {
        // Order placement has its own retry key. Proof failure must never place
        // another order or discard the customer's private tracking credential.
        sessionStorage.setItem("mkpos.shop.proof-upload-warning", result.reference);
        const data = new FormData();
        data.append("reference", result.reference);
        data.append("credential", result.tracking_credential);
        data.append("proof", screenshot);
        try {
          await request("/proofs", { method: "POST", body: data });
          sessionStorage.removeItem("mkpos.shop.proof-upload-warning");
        } catch {
          // Tracking shows the authoritative proof status and a safe retry form.
        }
      }
      // Finish loading the confirmed order while Review retains its single
      // submitting state, then hand it to Tracking without another skeleton.
      let order = null;
      try {
        order = accountId
          ? await request(`/customer/orders/${encodeURIComponent(result.reference)}`)
          : await post('/tracking', { reference: result.reference, credential: result.tracking_credential });
      } catch {
        // Checkout already succeeded. Tracking can retry this read safely.
      }
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(identityKey);
      setSubmissionDone(true);
      onSubmitted({ slug, reference: result.reference, order });
    } catch (e) {
      setError(e.message);
      setShowRecovery(true);
      submitting.current = false;
      setBusy(false);
    }
  }
  if (pending && showRecovery)
    return (
      <div className="narrow">
        <h1>{text("Finish your order")}</h1>
        <p>
          {text("Your last submission may have reached the shop. Retry it safely using the same checkout details.")}
        </p>
        <ErrorBox message={error} />
        {screenshot && <p>{text("Selected payment screenshot")}: {screenshot.name}</p>}
        {!customer && <a className="button" href={`#/account/login?next=${encodeURIComponent(`/store/${encodeURIComponent(slug)}/checkout`)}`}>{text("Sign in")}</a>}
        <button className="primary" onClick={submit} disabled={busy || accountLoading}>
          {busy ? text("Checking…") : text("Retry submission")}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                text("Check your order with the shop before starting over to avoid placing a second order. Start over?"),
              )
            ) {
              sessionStorage.removeItem(key);
              sessionStorage.removeItem(identityKey);
              setPending(null);
              setShowRecovery(false);
              setQuote(null);
            }
          }}
        >
          {text("Start over")}
        </button>
      </div>
    );
  if (!cart?.items.length || cart.slug !== slug)
    return <Cart cart={null} t={t} />;
  if (store.busy) return <LoadingPanel variant="checkout" message="Loading checkout…" page />;
  if (store.error)
    return <ErrorBox message={store.error} retry={store.retry} />;
  if (!store.data.accepting_orders)
    return (
      <p className="notice">{text("This shop is not accepting orders right now.")}</p>
    );
  const method = store.data.payment_methods.find(
    (m) =>
      m.id === (form.payment_method_id || store.data.payment_methods[0].id),
  );
  return (
    <div className="checkout-layout checkout-page">
      <div>
        <a className="back" href={`#/cart/${encodeURIComponent(slug)}`} onClick={(event) => { event.preventDefault(); goBack(`/cart/${encodeURIComponent(slug)}`); }}>
          <ArrowLeft size={16} />
          {t.cart}
        </a>
        <nav data-shop-refresh-bar className="checkout-steps" aria-label={text("Checkout progress")}>{["Details", "Delivery", "Payment", "Review"].map((label,index) => <button type="button" key={label} disabled={busy || (index === 3 ? !quote : index + 1 > step)} aria-current={step === index + 1 ? "step" : undefined} onClick={() => setStep(index + 1)}><span>{index + 1}</span>{text(label)}</button>)}</nav>
        <h1>{t.checkout}</h1>
        <dialog ref={actionDialog} className={`checkout-action-dialog ${action === 'account' ? 'checkout-account-modal' : 'checkout-address-modal'}`} aria-label={text(action === 'address' ? 'Delivery address' : 'Checkout account')} onCancel={() => setAction(null)}>
        <header><h2>{text(action === 'address' ? 'Delivery address' : 'Checkout account')}</h2><button type="button" aria-label={text('Close')} onClick={() => setAction(null)}><X size={22} aria-hidden="true" /></button></header>
        {action === 'account' && <div className="checkout-account-choice">
          {accountLoading ? <LoadingPanel variant="profile" message="Loading account…" /> : customer ? <>
            <p>{text('Signed in as')} <strong>{customer.name}</strong>.</p>
            <div className="customer-account-actions">
              <button type="button" aria-pressed={checkoutMode === "account"} onClick={() => { setCheckoutMode("account"); setAction(null); }}><span className="account-option-icon"><UserRound aria-hidden="true" /></span><span><strong>{text("Use my account")}</strong><small>{text('This order will appear in My orders.')}</small></span><ChevronRight aria-hidden="true" /></button>
              <button type="button" aria-pressed={checkoutMode === "guest"} onClick={() => { setCheckoutMode("guest"); setAction(null); }}><span className="account-option-icon"><UserPlus aria-hidden="true" /></span><span><strong>{text("Continue as guest")}</strong><small>{text('Place your order without signing in.')}</small></span><ChevronRight aria-hidden="true" /></button>
            </div>
          </> : <>
            <p>{text("Guest checkout. No account required.")}</p>
            <a className="button" href={`#/account/login?next=${encodeURIComponent(`/store/${encodeURIComponent(slug)}/checkout`)}`}>{text("Sign in for saved details and order history")}</a>
          </>}
        </div>}
        {action === 'address' && <form onSubmit={event => { event.preventDefault(); change('address', addressDraft.trim()); setAction(null); }}>
          {customer && checkoutMode === 'account' && <SavedAddressPicker onSelect={address => { setAddressDraft(address.address); setForm(current => ({ ...current, customer_name: address.recipient, phone: address.phone })); setQuote(null); }} />}
          <label>{t.address}<textarea required placeholder={text('Enter your full delivery address here...')} maxLength={2000} autoComplete="street-address" value={addressDraft} onChange={event => setAddressDraft(event.target.value)} /></label>
          <p>{text('This address will be used if you choose delivery.')}</p>
          <div className="checkout-modal-actions"><button type="button" onClick={() => setAction(null)}>{text('Cancel')}</button><button type="submit" className="primary">{text('Save address')}</button></div>
        </form>}
        </dialog>
        {step === 1 && <section className="checkout-store"><h2>{text('Select Store')}</h2><div><StoreLogo store={store.data} /><div><strong>{store.data.display_name}</strong><p>{store.data.address || store.data.pickup_instructions}</p><span>{text(store.data.accepting_orders ? 'Open' : 'Closed')}</span></div><a href="#/cart">{text('Change')}<ArrowRight size={16} aria-hidden="true" /></a></div></section>}
        <form ref={checkoutForm} id="shop-checkout-form" className="checkout-form" hidden={step === 4} onSubmit={review}>
          <fieldset disabled={busy || accountLoading}>
            <section className="checkout-section" hidden={step !== 1}>
            <SectionTitle icon={UserRound} title={text("Contact details")} />
            <p className="checkout-help">{text('We’ll use this information for your order updates.')}</p>
            <div className="field-pair">
              <label>
                {t.name}
                <span className="checkout-input"><UserRound size={20} aria-hidden="true" />
                <input
                  required
                  placeholder={text('Full name')}
                  maxLength={255}
                  autoComplete="name"
                  value={form.customer_name}
                  onChange={(e) => change("customer_name", e.target.value)}
                />
                </span>
              </label>
              <label>
                {t.phone}
                <span className="checkout-input"><Phone size={20} aria-hidden="true" />
                <input
                  required
                  placeholder={text('Phone number')}
                  maxLength={80}
                  autoComplete="tel"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => change("phone", e.target.value)}
                />
                </span>
              </label>
            </div>

            <label>
              {text("Email (optional)")}
              <span className="checkout-input"><Mail size={20} aria-hidden="true" />
              <input
                type="email"
                placeholder={text('Email address')}
                autoComplete="email"
                value={form.email}
                onChange={(e) => change("email", e.target.value)}
              />
              </span>
            </label>
            {step === 1 && <div className="checkout-fulfillment"><h2>{text('Fulfillment Method')}</h2><p>{text('Choose how you want to receive your order.')}</p><div>{['pickup','delivery'].map(value => <button type="button" key={value} aria-pressed={form.fulfillment === value} onClick={() => change('fulfillment',value)}>{value === 'pickup' ? <Store size={26} aria-hidden="true" /> : <Truck size={26} aria-hidden="true" />}<strong>{text(value === 'pickup' ? 'Pickup' : 'Delivery')}</strong><span>{text(value === 'pickup' ? 'Collect from a local shop' : 'Get it delivered to your address')}</span></button>)}</div></div>}
            </section>
            <section className="checkout-section" hidden={step !== 2}>
            <SectionTitle icon={Truck} title={text("Receive your order")} />
            <label>
              {text("Receive your order")}
              <select
                value={form.fulfillment}
                onChange={(e) => change("fulfillment", e.target.value)}
              >
                <option value="pickup">{t.pickup}</option>
                <option
                  value="delivery"
                >
                  {t.delivery}
                </option>
              </select>
            </label>
            {form.fulfillment === "delivery" ? (
              <>
                <label>
                  {text("Delivery zone")}
                  <select
                    required
                    aria-label={text('Delivery zone')}
                    value={form.delivery_zone_id}
                    onChange={(e) => change("delivery_zone_id", e.target.value)}
                  >
                    <option value="">{text("Choose your zone")}</option>
                    <option value="__delivery_service__">{text("Pay delivery service directly")}</option>
                    {store.data.delivery_zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} — {money(z.fee, store.data.currency)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="checkout-address-summary">{form.address || text('Use the address icon in the app bar to add your delivery address.')}</p>
              </>
            ) : (
              <p className="notice">
                {store.data.pickup_address && <><span>{store.data.pickup_address}</span><br /></>}
                {store.data.pickup_hours && <><span>{store.data.pickup_hours}</span><br /></>}
                {store.data.pickup_instructions ||
                  text("Collect your order at the shop.")}
              </p>
            )}
            </section>
            <section className="checkout-section" hidden={step !== 3}>
            <SectionTitle icon={CreditCard} title={t.payment} />
            <label>
              {t.payment}
              <select
                value={
                  form.payment_method_id || store.data.payment_methods[0].id
                }
                onChange={(e) => change("payment_method_id", e.target.value)}
              >
                {store.data.payment_methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {method?.instructions && <p className="notice">{method.instructions}</p>}
            {method?.type === "transfer" && <p>{[method.bank, method.account_name, method.account_no].filter(Boolean).join(" · ")}</p>}
            {(method?.type === "transfer" || !store.data.payment_methods.some(m => m.type === "transfer")) && (method?.provider || "manual") === "manual" && <PaymentScreenshot file={screenshot} onChange={setScreenshot} />}
            </section>
            <section className="checkout-section" hidden={step !== 3}>
            <SectionTitle icon={ReceiptText} title={text("Order details")} />
            <label>
              {text("Coupon code (optional)")}
              <input maxLength={40} pattern="[A-Za-z0-9_-]+" value={form.coupon_code} onChange={event => change("coupon_code", event.target.value.toUpperCase().trim())} placeholder={text("Enter coupon code")} />
            </label>
            <small>{text("Coupon discounts are checked when you review the order and exclude delivery fees.")}</small>
            <label>
              {text("Order notes (optional)")}
              <textarea
                maxLength={2000}
                value={form.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
            </section>
            <ErrorBox message={error} />
            <button className={quote ? "" : "primary"} disabled={busy} hidden={step !== 3}>
              {busy ? text("Checking…") : t.quote}
            </button>
          </fieldset>
        </form>
      </div>
      <aside className="order-summary" hidden={step === 3}>
        <SectionTitle icon={ShoppingBag} title={text("Order summary")} />
        {step === 4 && quote ? (
          <>
            <Totals quote={quote} />
            {error && <p role="alert" className="notice error">{error}</p>}
            <button type="button" disabled={busy} onClick={() => setStep(3)}>{text("Edit payment and order details")}</button>
            <p>{text("Review these confirmed prices before placing your order.")}</p>
            <button className="primary" onClick={submit} disabled={busy}>
              {busy ? text("Placing order…") : t.place}
              <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="checkout-estimate"><div><span>{text('Items')} ({cart.items.length})</span><strong>{money(cart.items.reduce((sum,item) => sum + item.price * item.quantity,0),cart.items[0]?.currency)}</strong></div><div><span>{text('Delivery fee')}</span><span>{text(form.fulfillment === 'pickup' ? 'Not applicable' : 'Calculated at checkout')}</span></div><div><strong>{text('Estimated total')}</strong><strong>{money(cart.items.reduce((sum,item) => sum + item.price * item.quantity,0),cart.items[0]?.currency)}</strong></div></div>
            <p>{text('Prices and availability are confirmed when you review your order.')}</p>
          </>
        )}
        {step < 3 && <button type="button" className="primary checkout-continue" onClick={() => { const fields = checkoutForm.current.querySelectorAll('.checkout-section:not([hidden]) :is(input,select,textarea)'); for (const field of fields) { if (!field.reportValidity()) return; } if (step === 2 && form.fulfillment === 'delivery' && !form.address.trim()) { setAddressDraft(form.address); setAction('address'); return; } setStep(step + 1); setError(''); }}>{text('Continue')}<ArrowRight size={22} aria-hidden="true" /></button>}
      </aside>
    </div>
  );
}
function Tracking({ t, onCart, initialOrder = null, reference: requestedReference }) {
  const text = useText();
  const { customer } = useCustomer();
  const pageActive = useShopPageActive();
  const accountOrder = Boolean(customer && (requestedReference || sessionStorage.getItem('mkpos.shop.tracking.customer') === String(customer.id)));
  const reconcileOrder = useCallback(order => {
    setOrder(order);
    if (customer) window.dispatchEvent(new CustomEvent('mkpos:order-updated', { detail: { customerId: customer.id, order } }));
  }, [customer?.id]);
  const [credentials, setCredentials] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("mkpos.shop.tracking")) || { reference: '', credential: '' };
      return requestedReference && requestedReference !== saved.reference ? { reference: requestedReference, credential: '' } : saved;
    } catch {
      return { reference: "", credential: "" };
    }
  });
  const [order, setOrder] = useState(initialOrder),
    [proofWarning, setProofWarning] = useState(() => sessionStorage.getItem("mkpos.shop.proof-upload-warning")),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(() => !initialOrder && Boolean(credentials.reference && (accountOrder || credentials.credential))),
    [file, setFile] = useState(null);
  const load = useCallback(async ({ background = false } = {}) => {
    if (!background) { setBusy(true); setError(""); setOrder(null); }
    try {
      const result = accountOrder
        ? await request(`/customer/orders/${encodeURIComponent(credentials.reference)}`)
        : await post("/tracking", credentials);
      if (accountOrder) setCredentials(current => ({ ...current, credential: result.tracking_credential }));
      reconcileOrder(result);
      if (sessionStorage.getItem("mkpos.shop.proof-upload-warning") === result.reference
        && result.payment_reviews?.some((proof) => ["pending", "approved"].includes(proof.status))) {
        sessionStorage.removeItem("mkpos.shop.proof-upload-warning");
        setProofWarning(null);
      }
      sessionStorage.setItem(
        "mkpos.shop.tracking",
        JSON.stringify(accountOrder ? { reference: credentials.reference } : credentials),
      );
      window.dispatchEvent(new Event('mkpos:tracking-changed'));
    } catch (e) {
      setError(e.message);
    } finally {
      if (!background) setBusy(false);
    }
  }, [credentials, reconcileOrder, accountOrder]);
  useEffect(() => {
    const changed = event => {
      if (pageActive && event.detail?.reference === credentials.reference) void load({ background: true });
    };
    window.addEventListener('mkpos:customer-order-changed', changed);
    return () => window.removeEventListener('mkpos:customer-order-changed', changed);
  }, [pageActive, credentials.reference, load]);
  useEffect(() => {
    if (initialOrder) {
      reconcileOrder(initialOrder);
      if (accountOrder) setCredentials(current => ({ ...current, credential: initialOrder.tracking_credential }));
      if (sessionStorage.getItem('mkpos.shop.proof-upload-warning') === initialOrder.reference
        && initialOrder.payment_reviews?.some(proof => ['pending', 'approved'].includes(proof.status))) {
        sessionStorage.removeItem('mkpos.shop.proof-upload-warning');
        setProofWarning(null);
      }
    } else if (credentials.reference && (accountOrder || credentials.credential)) load();
  }, []); // Initial saved order only.
  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    const data = new FormData();
    data.append("reference", credentials.reference);
    data.append("credential", credentials.credential);
    data.append("proof", file);
    try {
      await request("/proofs", { method: "POST", body: data });
      sessionStorage.removeItem("mkpos.shop.proof-upload-warning");
      setProofWarning(null);
      setFile(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tracking-page order-detail-page">
      {!accountOrder && <details className="order-lookup" open={!order}>
      <summary><Search size={18} aria-hidden="true" />{t.tracking}</summary>
      <form
        className="tracking-form"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <div className="tracking-form-intro"><span className="section-symbol" aria-hidden="true"><LockKeyhole size={20} /></span><p>{text("Keep it private. You need it to view this order again.")}</p></div>
        <label>
          {text("Order reference")}
          <input
            required
            value={credentials.reference}
            onChange={(e) => {
              setOrder(null);
              setCredentials((s) => ({ ...s, reference: e.target.value }));
            }}
          />
        </label>
        <label>
          {text("Private tracking credential")}
          <input
            type="password"
            required
            value={credentials.credential}
            onChange={(e) => {
              setOrder(null);
              setCredentials((s) => ({ ...s, credential: e.target.value }));
            }}
          />
        </label>
        <button className="primary" disabled={busy}><Search size={17} aria-hidden="true" />{busy ? text("Checking…") : text("View order")}</button>
      </form>
      </details>}
      <ErrorBox message={error} />
      {busy && !order && <LoadingPanel variant="order" />}
      {accountOrder && error && <button type="button" disabled={busy} onClick={load}>{text('Try again')}</button>}
      {proofWarning === credentials.reference && <p className="notice" role="status">{text("Your order was placed, but the screenshot upload could not be confirmed. Check the payment status below. If no proof is awaiting review, upload your screenshot here.")}</p>}
      {order && (
        <section className="tracking-result">
          <OrderDetailContent order={order} />
          <section className="order-detail-panel order-help"><h2>{text('Need help?')}</h2>
          <OrderRequests key={order.reference} order={order} credentials={credentials} onChange={reconcileOrder} />
          {customer && onCart && <BuyAgain reference={order.reference} onCart={onCart} />}
          </section>
          {!accountOrder && <details className="tracking-credential">
            <summary>{text("Save your private tracking credential")}</summary>
            <p>{text("Keep it private. You need it to view this order again.")}</p>
            <code className="credential">{credentials.credential}</code>
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(credentials.credential)
                  .catch(() => setError("Copy the credential shown above."))
              }
            >
              <LockKeyhole size={15} aria-hidden="true" />{text("Copy credential")}
            </button>
          </details>}
          {(order.can_submit_payment_proof ?? order.payment_method.type === "transfer") &&
            (order.payment_method.provider || "manual") === "manual" &&
            order.payment_status === "unpaid" &&
            !["completed", "cancelled", "expired"].includes(order.status) && (
              <form className="order-detail-proof" onSubmit={upload}>
                <label>
                  {text("Payment proof (JPG, PNG or WebP, up to 2 MB)")}
                  <input
                    required
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </label>
                <button disabled={busy || !file}>{text("Submit for review")}</button>
                <p>
                  {text("Uploading a proof does not confirm payment. The shop will review it.")}
                </p>
              </form>
            )}
        </section>
      )}
    </div>
  );
}
function ShopApp() {
  const [, refreshTracking] = useState(0);
  useEffect(() => {
    const changed = () => refreshTracking(value => value + 1);
    window.addEventListener('mkpos:tracking-changed', changed);
    return () => window.removeEventListener('mkpos:tracking-changed', changed);
  }, []);
  const [chatFilter, setChatFilter] = useState('all');
  const [chatUnread, setChatUnread] = useState(0);
  const { customer, loading: accountLoading, accountScope, sessionError, retrySession, refreshCustomer } = useCustomer();
  const [submittedCheckout, setSubmittedCheckout] = useState(null);
  const clearedCheckout = useRef(null);
  const { route, key: routeKey } = useShopRoute(import.meta.env.VITE_DEFAULT_STORE ? storePath(import.meta.env.VITE_DEFAULT_STORE) : "/marketplace");
  const [carts, setCarts] = useState(readCarts),
    [language, setLanguage] = useState(
      () => localStorage.getItem("mkpos.shop.language") || "en",
    );
  const t = words[language] || words.en;
  const text = (message, values) => translate(language, message, values);
  const update = useCallback((shopSlug, next) => {
    setCarts(current => {
      const updated = updateShopCart(current, shopSlug, next);
      saveCarts(updated);
      return updated;
    });
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("mkpos.shop.language", language);
  }, [language]);
  function add(p, qty, origin) {
    setCarts(current => {
      const next = addToCarts(current, p, qty, origin);
      saveCarts(next);
      return next;
    });
    return true;
  }
  function repeatOrder(preview) {
    const existing = carts.find(cart => cart.slug === preview.slug);
    if (existing?.items.length && !window.confirm(text('Replace the items in this shop’s cart with this repeat order?'))) return false;
    update(preview.slug, { slug: preview.slug, name: preview.name, origin: preview.origin, items: preview.items });
    go(`/cart/${encodeURIComponent(preview.slug)}`);
    return true;
  }
  const [path, query = ""] = route.split("?"),
    parts = path.split("/").filter(Boolean),
    origin =
      new URLSearchParams(query).get("origin") === "marketplace"
        ? "marketplace"
        : "storefront";
  const slug = parts[0] === "store" ? decodeURIComponent(parts[1] || "") : "";
  const cartSlug = parts[0] === "cart" ? decodeURIComponent(parts[1] || "") : slug;
  const cart = carts.find(current => current.slug === cartSlug) || null;
  const cartCount = carts.reduce((count, current) => count + current.items.length, 0);
  const isAuthPage = parts[0] === 'account' && (['login', 'register', 'forgot-password'].includes(parts[1]) || (!customer && !accountLoading && ['profile', 'favorites', 'addresses', 'notifications', 'alerts'].includes(parts[1])));
  let trackingReference = '';
  if (parts[0] === 'orders' && parts[1] === 'track') {
    try { trackingReference = new URLSearchParams(query).get('reference') || JSON.parse(sessionStorage.getItem('mkpos.shop.tracking') || '{}').reference || ''; } catch {}
  }
  const completedCheckout = submittedCheckout?.accountScope === accountScope ? submittedCheckout : null;
  let guestTracking = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem('mkpos.shop.tracking') || 'null');
    if (!customer && saved?.reference && saved?.credential) guestTracking = saved;
  } catch { /* No private order has been saved in this tab. */ }
  useEffect(() => {
    // Clear the cart only after the tracking route is active, avoiding an empty
    // cart render between Review and the confirmed order.
    if (path === '/orders/track' && completedCheckout?.reference === trackingReference && clearedCheckout.current !== completedCheckout) {
      clearedCheckout.current = completedCheckout;
      update(completedCheckout.slug, null);
    }
  }, [path, trackingReference, completedCheckout, update]);
  let page;
  if (parts[0] === "account")
    page = parts[1] === 'radar' ? <ShopRadar ListEnd={ListEnd} /> : parts[1] === 'forgot-password' ? <section className="narrow customer-account customer-auth-page"><PasswordResetForm onBack={() => go(`/account/login?next=${encodeURIComponent(new URLSearchParams(query).get("next") || "/account")}`)} /></section> : parts[1] === 'profile' ? <CustomerEditProfile /> : parts[1] === 'alerts' ? <StockAlertsPage /> : parts[1] === 'recent' ? <RecentProducts ProductCard={ProductCard} /> : parts[1] === 'notifications' ? <UpdatesPage /> : parts[1] === 'favorites' ? <FavoritesPage ProductCard={ProductCard} ShopCard={MarketplaceShopCard} add={add} carts={carts} /> : parts[1] === 'addresses' ? <AddressesPage /> : parts[1] === "login" || parts[1] === "register"
      ? <CustomerAuth key={parts[1]} register={parts[1] === "register"} next={new URLSearchParams(query).get("next") || "/account"} />
      : <CustomerAccount onCart={repeatOrder} />;
  else if (parts[0] === "chats") page = <CustomerChats filter={chatFilter} uuid={parts[1] ? decodeURIComponent(parts[1]) : undefined} slug={new URLSearchParams(query).get('shop') || undefined} />;
  else if (parts[0] === "store" && parts[2] === "report")
    page = <ShopReportPage slug={slug} />;
  else if (parts[0] === "store" && parts[2] === "products")
    page = (
      <Product
        key={path}
        slug={slug}
        id={parts[3]}
        origin={origin}
        add={add}
        cart={cart}
        t={t}
      />
    );
  else if (parts[0] === "store" && parts[2] === "checkout")
    page = (
      <Checkout key={slug} slug={slug} cart={cart} onSubmitted={result => { setSubmittedCheckout({ ...result, accountScope }); go('/orders/track'); }} t={t} />
    );
  else if (parts[0] === "store")
    page = <div className="shop-detail-page"><Shop key={slug} slug={slug} origin={origin} t={t} add={add} cart={cart} /></div>;
  else if (parts[0] === "cart")
    page = cartSlug ? <ShopCart key={cartSlug} slug={cartSlug} cart={cart} update={next => update(cartSlug, next)} /> : <CartSelection carts={carts} clear={() => { setCarts([]); saveCarts([]); }} />;
  else if (parts[0] === "orders") page = accountLoading
    ? <LoadingPanel variant={parts[1] === "track" ? "order" : "orders"} message="Loading account…" page />
    : parts[1] !== "track" && customer
      ? <div className="orders-route"><CustomerOrders onCart={repeatOrder} /></div>
      : <Tracking key={`${customer?.id || 'guest'}:${trackingReference}`} reference={new URLSearchParams(query).get('reference')} t={t} onCart={repeatOrder} initialOrder={completedCheckout?.reference === trackingReference ? completedCheckout.order : null} />;
  else page = <Marketplace t={t} add={add} carts={carts} />;
  if (sessionError) page = <section className="narrow feature-panel" role="alert"><p>{localizeError(language, sessionError)}</p><button type="button" onClick={retrySession}>{text('Try again')}</button></section>;
  const homePath = import.meta.env.VITE_DEFAULT_STORE ? storePath(import.meta.env.VITE_DEFAULT_STORE) : "/marketplace";
  const isHomePage = parts[0] === 'marketplace' || !['account', 'orders', 'cart', 'chats', 'store'].includes(parts[0]);
  const retainedKey = parts[0] === 'chats' && (parts[1] || new URLSearchParams(query).get('shop')) ? `chat:${routeKey}` : parts[0] === 'orders' && parts[1] === 'track' ? `order:${trackingReference}` : ['/account/profile', '/account/favorites', '/account/addresses', '/account/notifications', '/account/radar'].includes(path) ? `account:${parts[1]}` : [homePath, '/marketplace', '/cart', '/orders', '/orders/track', '/chats', '/account'].includes(path) ? `tab:${path}` : parts[0] === "cart" ? `cart:${path}` : routeKey;
  const loadingVariant = parts[0] === 'chats' ? (parts[1] || new URLSearchParams(query).get('shop') ? 'conversation' : 'chats')
    : parts[0] === 'orders' ? (parts[1] === 'track' ? 'order' : 'orders')
    : parts[0] === 'cart' ? (cartSlug ? 'cart' : 'carts')
    : parts[0] === 'account' ? ({ radar: 'shops', profile: 'profile', favorites: 'products', addresses: 'addresses', notifications: 'notifications', alerts: 'alerts', recent: 'products', login: 'auth', register: 'auth' }[parts[1]] || 'account')
    : parts[0] === 'store' ? ({ products: 'product', checkout: 'checkout', report: 'report' }[parts[2]] || 'shop') : 'home';
  const isInnerPage = !isAuthPage && ![homePath, '/marketplace', '/cart', '/orders', '/chats', '/account'].includes(path);
  const backFallback = parts[0] === 'orders' && parts[1] === 'track' ? (customer ? '/orders' : homePath) : parts[0] === 'cart' ? '/cart' : parts[2] === 'checkout' ? `/cart/${encodeURIComponent(slug)}` : parts[0] === 'chats' ? '/chats' : parts[0] === 'account' ? '/account' : slug && parts.length > 2 ? storePath(slug) : homePath;
  const destinations = [
    { path: homePath, label: text("Home"), icon: Home, active: !["account", "orders", "cart", "chats"].includes(parts[0]) },
    { path: "/cart", label: t.cart, icon: ShoppingBag, mobileIcon: ShoppingCart, active: parts[0] === "cart", count: cartCount },
    { path: customer ? "/orders" : "/orders/track", label: text("Orders"), icon: ClipboardList, active: parts[0] === "orders" },
    { path: "/chats", label: text("Chats"), mobileLabel: language === 'my' ? 'စကားပြော' : text('Chats'), icon: MessageCircle, mobileIcon: MessageCircleMore, active: parts[0] === "chats", count: customer ? chatUnread : 0 },
    { path: "/account", label: text("Me"), icon: UserRound, active: parts[0] === "account" },
  ];
  const accountPageBar = !isAuthPage && parts[0] === 'account' ? ({ '': ['Me', 'Manage your profile and shopping tools.'], radar: ['Shop Radar', 'Discover shops around your current location.'], favorites: ['Favorites', 'Products you love and saved for later.'], recent: ['Recently viewed', 'Products you recently viewed'], addresses: ['Saved addresses', 'Manage your delivery addresses.'], notifications: ['Notifications', 'Updates from shops and your orders.'], profile: ['Edit profile', 'Update your personal information.'] }[parts[1] || '']) : null;
  const accountBar = accountPageBar || (parts[0] === 'orders' && parts[1] === 'track' ? ['Order details', 'Track and manage your orders'] : null);
  return (
    <LocaleContext.Provider value={language}>
      <ShopAlertProvider key={`alerts:${accountScope}:${customer?.id || guestTracking?.reference || 'public'}`} scope={`${accountScope}:${customer?.id || guestTracking?.reference || 'public'}`} customerId={customer?.id}>
      {(customer || guestTracking) && <CustomerOrderAlerts key={`order-alert:${accountScope}:${customer?.id || guestTracking.reference}`} customerId={customer?.id} reference={guestTracking?.reference} credential={guestTracking?.credential} />}
      {customer && <ChatAlerts key={customer.id} scope={`customer:${customer.id}`} apiRequest={chatAccountRequest} basePath="/chat" onUnread={setChatUnread} suppressed={isAuthPage || parts[0] === 'chats'} onOpen={(notice) => {
        go(notice.uuid ? `/chats/${encodeURIComponent(notice.uuid)}` : '/chats');
      }} />}
      </ShopAlertProvider>
      <header className={`site-header ${isAuthPage ? 'auth-header' : 'shopping-header'} ${isHomePage ? 'home-header' : ''} ${accountBar ? 'account-app-bar' : ''} ${accountBar && !parts[1] ? 'me-app-bar' : ''} ${parts[2] === 'checkout' ? 'checkout-header' : ''} ${parts[0] === 'orders' && !parts[1] ? 'orders-header' : ''} ${parts[0] === 'cart' && !parts[1] ? 'cart-selection-header' : ''}`}>
        {isAuthPage && <button type="button" className="auth-back" aria-label={text('Back')} onClick={() => goBack(homePath)}><ArrowLeft size={21} aria-hidden="true" /></button>}
        {isInnerPage && <button type="button" className="shopping-header-back" aria-label={text('Back')} onClick={() => goBack(backFallback)}><ArrowLeft size={21} aria-hidden="true" /></button>}
        <a
          className="brand"
          href={
            import.meta.env.VITE_DEFAULT_STORE
              ? `#${storePath(import.meta.env.VITE_DEFAULT_STORE)}`
              : "#/marketplace"
          }
        >
          {(!accountBar || !parts[1]) && <BrandImage asset="icon" className="shop-platform-icon" src={`${import.meta.env.BASE_URL}branding/pwarmyar-icon.png`} alt="" width="32" height="32" />}
          <span>
            {accountBar && !parts[1] ? <><span className="brand-name">PwarMyar <strong>{text("shops")}</strong></span><small>{text("Shop Local. All in One Place.")}</small></> : accountBar ? <><h1 className="brand-name account-app-bar-title">{text(accountBar[0])}</h1><small>{text(accountBar[1])}</small></> : parts[0] === 'chats' && !parts[1] ? <><h1 className="brand-name chats-app-bar-title">{text('Chats')}</h1><small>{text('Talk to your favorite shops.')}</small></> : <><span className="brand-name">PwarMyar <strong>{text("shops")}</strong></span><small>{text('Shop Local. All in One Place.')}</small></>}
          </span>
        </a>
        {!isAuthPage && (!accountBar || !parts[1]) && <nav className="desktop-navigation" aria-label={text("Shop navigation")}>
          {destinations.map(({ path: destination, label, icon: Icon, active, count }) => <a key={destination} href={`#${destination}`} aria-current={active ? 'page' : undefined}><span className="desktop-nav-icon"><Icon size={19} aria-hidden="true" />{count > 0 && <b>{count > 99 ? '99+' : count}</b>}</span>{label}</a>)}
        </nav>}
        {parts[2] === 'checkout' && <div className="checkout-header-actions"><button type="button" aria-label={text('Checkout account')} onClick={() => window.dispatchEvent(new CustomEvent('mkpos:checkout-action', { detail: 'account' }))}><UserRound size={21} aria-hidden="true" /></button><button type="button" aria-label={text('Edit delivery address')} onClick={() => window.dispatchEvent(new CustomEvent('mkpos:checkout-action', { detail: 'address' }))}><MapPin size={21} aria-hidden="true" /></button></div>}
        {parts[0] === 'chats' && !parts[1] && customer && <div className="chats-app-bar-toggle" aria-label={text('Filter conversations')}>{['all','unread'].map(value => <button type="button" key={value} aria-pressed={chatFilter === value} onClick={() => setChatFilter(value)}>{text(value === 'all' ? 'All' : 'Unread')}</button>)}</div>}
        {accountBar && ['addresses', 'notifications'].includes(parts[1]) && <button type="button" className="account-app-bar-action" aria-label={text(parts[1] === 'addresses' ? 'Add address' : 'Mark all read')} onClick={() => window.dispatchEvent(new CustomEvent('mkpos:account-action', { detail: parts[1] === 'addresses' ? 'add-address' : 'mark-all-read' }))}>{parts[1] === 'addresses' ? <Plus size={22} /> : <CheckCheck size={22} />}</button>}
        {!isAuthPage && <button type="button" className="language mobile-language" aria-label={text("Change language")} onClick={() => setLanguage(language === "en" ? "my" : "en")}>
          {language === "en" ? "မြန်မာ" : "English"}
        </button>}
        {!isAuthPage && parts[0] === 'orders' && !parts[1] && customer && <a className="app-bar-track-order" href="#/orders/track" aria-label={t.tracking} title={t.tracking}><Package size={21} aria-hidden="true" /><span>{t.tracking}</span></a>}
        {!isAuthPage && !(accountBar && ['addresses', 'notifications', 'profile'].includes(parts[1])) && (customer ? <UpdatesLink /> : <a className="updates-link" href="#/account/login?next=%2Faccount%2Fnotifications" aria-label={text('Updates')}><Bell size={21} aria-hidden="true" /></a>)}
      </header>
      <main data-loading-page={loadingVariant} className={`shopping-main ${isAuthPage ? 'is-auth-page' : ''} ${isHomePage ? 'is-home-page' : ''} ${parts[0] === 'orders' && !parts[1] ? 'is-orders-page' : ''} ${parts[0] === 'cart' ? 'is-cart-page' : ''} ${parts[0] === 'store' && !parts[2] ? 'is-shop-page' : ''} ${parts[0] === 'store' && parts[2] === 'report' ? 'is-report-page' : ''} ${parts[0] === "store" && parts[2] === "products" ? "is-product-page has-purchase-bar" : ""} `}><SwipeRefreshShell routeKey={routeKey} onRefresh={refreshCustomer}>{isAuthPage && <AuthLocaleToggle language={language} onChange={setLanguage} />}<RetainedViews key={accountScope || 0} activeKey={retainedKey} loadingVariant={loadingVariant} waiting={accountLoading}>{page}</RetainedViews></SwipeRefreshShell></main>
      {!isAuthPage && !(parts[0] === 'account' && parts[1] === 'recent') && !(parts[0] === 'orders' && parts[1] === 'track') && <nav className="mobile-navigation" aria-label={text("Shop navigation")}>
        {destinations.map(({ path: destination, label, mobileLabel = label, icon: Icon, mobileIcon: MobileIcon = Icon, active, count }) => <a key={destination} href={`#${destination}`} aria-label={label} aria-current={active ? "page" : undefined}>
          <span className="mobile-nav-icon"><MobileIcon size={22} aria-hidden="true" />{count > 0 && <b>{count > 99 ? '99+' : count}</b>}</span><span className="mobile-nav-label">{mobileLabel}</span>
        </a>)}
      </nav>}
      {!isAuthPage && <footer>
        <span>{text("Independent shops. One simple checkout.")}</span>
        <span>{text("Powered by PwarMyar")}</span>
      </footer>}
    </LocaleContext.Provider>
  );
}

export function App() {
  return <><KeyboardViewport /><CustomerProvider><ShoppingFeaturesProvider><ShopApp /></ShoppingFeaturesProvider></CustomerProvider></>;
}

if (document.getElementById("root")) {
  startBranding(import.meta.env.VITE_API_URL || '/api');
  createRoot(document.getElementById("root")).render(<App />);
}
