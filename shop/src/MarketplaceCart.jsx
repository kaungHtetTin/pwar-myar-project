import { useRefreshResource } from './useRefreshResource';
import { LoadingSkeleton } from './LoadingSkeleton';
import React, { useState } from 'react';
import { ArrowRight, ChevronRight, Clock3, Info, Leaf, MapPin, Search, ShoppingBasket, Store, Trash2 } from 'lucide-react';
import { useText } from './i18n';
import { ProductMedia, QuantityControl } from './ShoppingComponents';

const shopPath = slug => `#/store/${encodeURIComponent(slug)}`;
const cartPath = slug => `#/cart/${encodeURIComponent(slug)}`;
function price(amount, currency = 'Ks') {
  return `${['Ks', 'MMK', 'K'].includes(currency) ? 'K' : currency} ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
}
const subtotal = cart => cart.items.reduce((total, item) => total + Number(item.price) * Number(item.quantity), 0);

function CartSearch({ search, setSearch, review = false }) {
  const text = useText();
  return <div className="cart-search-band app-bar-search-band"><form className="cart-search app-bar-search" onSubmit={event => { event.preventDefault(); setSearch(search.trim()); }}><Search size={21} aria-hidden="true" /><input aria-label={text(review ? 'Search items in this cart' : 'Search your carts')} placeholder={text(review ? 'Search items in this cart…' : 'Search products or shops…')} value={search} onChange={event => setSearch(event.target.value)} type="search" /><button type="submit" aria-label={text('Search')}><ArrowRight size={21} aria-hidden="true" /></button></form></div>;
}

function useCartShop(slug) {
  return useRefreshResource(`/stores/${encodeURIComponent(slug)}`);
}

function ShopStatus({ shop }) {
  const text = useText();
  if (shop.busy) return <LoadingSkeleton variant="cart-status" message="Checking shop…" />;
  if (!shop.data) return <button type="button" className="cart-status-retry" onClick={shop.retry}>{text('Check shop status')}</button>;
  const open = shop.data.accepting_orders;
  const Icon = open ? MapPin : Clock3;
  return <span className={`cart-shop-status ${open ? 'is-open' : 'is-closed'}`}><Icon size={14} aria-hidden="true" />{text(open ? 'Open' : 'Closed')}</span>;
}

function CartNotice({ review = false }) {
  const text = useText();
  return <div className="cart-guidance"><span className="cart-guidance-symbol">{review ? <Store size={27} aria-hidden="true" /> : <ShoppingBasket size={27} aria-hidden="true" />}</span><div><strong>{text(review ? 'Your cart contains items from one shop only.' : 'One shop per order')}</strong><p>{text(review ? 'To shop from a different store, please place a separate order.' : 'Items from different shops stay in separate carts. Choose a shop to review and checkout, then select another shop to place a separate order.')}</p></div><CartPlant /></div>;
}

function CartPlant() {
  return <svg className="cart-guidance-leaf" viewBox="0 0 50 64" fill="none" aria-hidden="true"><path d="M36 63C27 45 22 28 37 6M33 48L13 37" stroke="var(--theme-text-muted)" strokeWidth="1" /><path d="M27 30C24 11 36 5 48 2C48 17 40 25 27 30Z" fill="var(--theme-text-muted)" /><path d="M29 50C15 49 9 38 7 29C20 32 29 38 29 50Z" fill="var(--theme-text-muted)" /><path d="M35 57C33 42 39 37 48 33C47 46 44 52 35 57Z" fill="var(--theme-primary-text)" /><path d="M28 27L45 5M26 46L11 33M36 54L46 38" stroke="var(--theme-text-muted)" strokeWidth=".7" /><path d="M6 16L9 20M1 25L6 26M15 13L16 17" stroke="var(--theme-primary-text)" strokeWidth="1" strokeLinecap="round" /></svg>;
}

function EmptyCart({ selected = false }) {
  const text = useText();
  return <div className="cart-empty"><ShoppingBasket size={40} aria-hidden="true" /><h2>{text('Your cart is empty')}</h2><a className="button primary" href={selected ? '#/cart' : '#/marketplace'}>{text(selected ? 'Choose another shop' : 'Explore shops')}<ArrowRight size={17} aria-hidden="true" /></a></div>;
}

function ShopSelectionCard({ cart }) {
  const text = useText(), shop = useCartShop(cart.slug);
  return <article className="cart-selection-card">
    <a className="cart-shop-photo" href={cartPath(cart.slug)} aria-label={text('Review cart for {name}', { name: cart.name })}><ProductMedia src={shop.data?.logo_url} name={cart.name} className="cart-shop-media" /></a>
    <div className="cart-selection-info"><a className="cart-selection-title" href={cartPath(cart.slug)}>{shop.data?.display_name || cart.name}</a><ShopStatus shop={shop} /><span className="cart-item-count">{text('{count} items in cart', { count: cart.items.length })}</span><div className="cart-item-previews">{cart.items.slice(0, 3).map(item => <ProductMedia key={item.id} src={item.photo_url} name={item.name} className="cart-preview-media" />)}{cart.items.length > 3 && <span className="cart-preview-extra">+{cart.items.length - 3}</span>}</div></div>
    <ChevronRight className="cart-selection-chevron" size={21} aria-hidden="true" />
    <div className="cart-selection-summary"><span>{text('Subtotal')}</span><strong>{price(subtotal(cart), cart.items[0]?.currency)}</strong><a className="button primary" href={cartPath(cart.slug)}>{text('Review cart')}<ArrowRight size={18} aria-hidden="true" /></a></div>
  </article>;
}

export function CartSelection({ carts, clear }) {
  const text = useText();
  const [search, setSearch] = useState('');
  const filtered = carts.filter(cart => `${cart.name} ${cart.items.map(item => item.name).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="cart-workspace cart-selection-workspace"><CartSearch search={search} setSearch={setSearch} />
    <div className="cart-content"><div className="cart-title-row"><h1>{text('Your cart')}</h1>{carts.length > 0 && <button type="button" className="cart-clear" onClick={() => { if (window.confirm(text('Remove all items from all shop carts?'))) clear(); }}><Trash2 size={17} aria-hidden="true" />{text('Clear all carts')}</button>}</div><p className="cart-page-subtitle">{text('Choose a shop to review items and place an order.')}</p><CartNotice />
      {!carts.length ? <EmptyCart /> : !filtered.length ? <p className="cart-empty">{text('No results found.')}</p> : <div className="cart-shop-list">{filtered.map(cart => <ShopSelectionCard key={cart.slug} cart={cart} />)}</div>}

    </div></div>;
}

export function ShopCart({ slug, cart, update }) {
  const text = useText(), shop = useCartShop(slug);
  const [search, setSearch] = useState('');
  const filtered = cart?.items.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase())) || [];
  return <div className="cart-workspace cart-review-workspace"><CartSearch search={search} setSearch={setSearch} review /><div className="cart-content cart-review-content"><div className="cart-title-row"><h1>{text('Your cart')}</h1>{cart?.items.length > 0 && <button type="button" className="cart-clear" onClick={() => { if (window.confirm(text('Remove all items from this shop cart?'))) update(null); }}><Trash2 size={17} aria-hidden="true" />{text('Clear cart')}</button>}</div><p className="cart-page-subtitle">{text('Review your items before checkout.')}</p><CartNotice review />
      {!cart?.items.length ? <EmptyCart selected /> : <>
        <section className="cart-review-panel"><div className="cart-review-shop"><a className="cart-shop-photo" href={shopPath(slug)}><ProductMedia src={shop.data?.logo_url} name={cart.name} className="cart-shop-media" /></a><div><a className="cart-selection-title" href={shopPath(slug)}>{shop.data?.display_name || cart.name}<ChevronRight size={20} aria-hidden="true" /></a><ShopStatus shop={shop} />{shop.data?.description && <p>{shop.data.description}</p>}</div></div>
          <div className="cart-review-items">{!filtered.length && <p className="cart-empty">{text('No results found.')}</p>}{filtered.map(item => <article className="cart-review-item" key={item.id}><a href={`${shopPath(slug)}/products/${item.id}`} className="cart-review-photo" aria-label={item.name}><ProductMedia src={item.photo_url} name={item.name} className="cart-review-media" /></a><div className="cart-review-item-info"><a href={`${shopPath(slug)}/products/${item.id}`}>{item.name}</a><small>{price(item.price, item.currency)}{item.unit_name && ` / ${item.unit_name}`}</small><strong>{price(Number(item.price) * Number(item.quantity), item.currency)}</strong></div><button type="button" className="cart-review-remove" aria-label={text('Remove {name}', { name: item.name })} onClick={() => update({ ...cart, items: cart.items.filter(current => current.id !== item.id) })}><Trash2 size={20} aria-hidden="true" /></button><QuantityControl hiddenLabel label={text('{name} quantity', { name: item.name })} name={item.name} value={item.quantity} max={100000} onChange={value => { const quantity = Number(value); if (quantity > 0 && quantity <= 100000) update({ ...cart, items: cart.items.map(current => current.id === item.id ? { ...current, quantity } : current) }); }} /></article>)}</div>
        </section>
        <section className="cart-review-totals"><div><span>{text('Subtotal')} ({text('{count} items', { count: cart.items.length })})</span><strong>{price(subtotal(cart), cart.items[0]?.currency)}</strong></div><div><span>{text('Delivery fee')}</span><span>{text('Calculated at checkout')}</span></div><div className="cart-estimated-total"><strong>{text('Estimated total')}</strong><strong>{price(subtotal(cart), cart.items[0]?.currency)}</strong></div><p>{text('Delivery fees, discounts and availability are confirmed at checkout.')}</p></section>
        {shop.error && <p className="notice error" role="alert">{text('Unable to check this shop. Please try again.')} <button type="button" onClick={shop.retry}>{text('Try again')}</button></p>}
        {shop.data && !shop.data.accepting_orders && <p className="notice" role="status">{text('This shop is not accepting orders right now. Your items are saved.')}</p>}
        {shop.data?.accepting_orders ? <a className="button primary cart-proceed" href={`${shopPath(slug)}/checkout`}>{text('Proceed to checkout')}<ArrowRight size={22} aria-hidden="true" /></a> : <button className="primary cart-proceed" disabled>{text(shop.busy ? 'Checking shop…' : 'Checkout unavailable')}</button>}
      </>}
    </div></div>;
}
