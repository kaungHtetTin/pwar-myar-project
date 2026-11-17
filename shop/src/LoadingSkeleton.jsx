import React from 'react';
import { useText } from './i18n';
import './loading-skeleton.css';
import { useInitialPageLoading } from './pageLoading';

const repeat = (count, render) => Array.from({ length: count }, (_, index) => render(index));
function Block({ shape = 'line', size = '', className = '' }) {
  return <span className={`shop-skeleton-block sk-${shape} ${size ? `sk-${size}` : ''} ${className}`} />;
}
function Copy() {
  return <div className="sk-copy"><Block size="long" /><Block size="medium" /><Block size="short" /></div>;
}
function Heading() {
  return <div className="sk-heading"><Block shape="title" /><Block size="long" /></div>;
}
function Products({ count }) {
  return <div className="sk-products">{repeat(count, index => <div className="sk-product" key={index}><Block shape="image" /><div className="sk-copy"><Block size="short" /><Block size="long" /><Block size="medium" /><div className="sk-between"><Block shape="price" /><Block shape="circle" /></div></div></div>)}</div>;
}
function ShopProducts({ count }) {
  return <div className="sk-shop-products">{repeat(count, index => <div className="sk-card sk-row" key={index}><Block shape="avatar" /><div className="sk-copy"><Block size="long" /><Block size="medium" /><Block shape="price" /></div><Block shape="circle" /></div>)}</div>;
}
function Shops({ count }) {
  return <div className="sk-shops">{repeat(count, index => <div className="sk-card" key={index}><div className="sk-row"><Block shape="avatar" /><Copy /></div><Block size="medium" /><Block shape="chip" /></div>)}</div>;
}
function Form({ count = 4 }) {
  return <div className="sk-card sk-form">{repeat(count, index => <div className="sk-field" key={index}><Block size="short" /><Block shape="input" /></div>)}<Block shape="button" /></div>;
}
function Rows({ variant, count }) {
  return <div className={`sk-rows sk-rows-${variant}`}>{repeat(count, index => <div className="sk-card" key={index}>
    {variant === 'orders' ? <><div className="sk-between"><Block size="medium" /><Block shape="chip" /></div><div className="sk-row"><Block shape="avatar" /><Copy /></div><div className="sk-between"><Block shape="price" /><Block shape="button" /></div></>
      : variant === 'addresses' ? <><div className="sk-row"><Block shape="circle" /><Block size="medium" /></div><Copy /><div className="sk-between"><Block shape="chip" /><Block shape="chip" /></div></>
        : variant === 'reviews' ? <><div className="sk-row"><Block shape="circle" /><Copy /></div><Block shape="chip" /><Block size="long" /><Block size="medium" /></>
          : variant === 'alerts' ? <><div className="sk-row"><Block shape="avatar" /><Copy /></div><Block shape="button" /></>
            : <div className="sk-row"><Block shape={variant === 'chats' ? 'avatar' : 'circle'} /><Copy /><Block size="short" /></div>}
  </div>)}</div>;
}

/** Decorative placeholders follow the content; a single live status supplies the accessible label. */
export function LoadingSkeleton({ variant = 'section', count, message = 'Loading…', page = false, className = '' }) {
  useInitialPageLoading(true);
  const text = useText();
  const amount = count ?? (['products', 'shops'].includes(variant) ? 4 : 3);
  let content;
  switch (variant) {
    case 'home': content = <><Block shape="cover" /><Heading /><Products count={4} /><Heading /><Shops count={4} /></>; break;
    case 'carts': case 'cart': content = <><Heading />{repeat(amount, index => <div className="sk-card" key={index}><div className="sk-row"><Block shape="avatar" /><Copy /></div><div className="sk-between"><Block shape="price" /><Block shape="button" /></div></div>)}</>; break;
    case 'products': content = <Products count={amount} />; break;
    case 'shop-products': content = <ShopProducts count={amount} />; break;
    case 'shops': content = <Shops count={amount} />; break;
    case 'shop': content = <><Block shape="cover" /><div className="sk-row"><Block shape="avatar" /><Copy /></div><div className="sk-actions">{repeat(3, index => <Block shape="button" key={index} />)}</div><ShopProducts count={4} /></>; break;
    case 'product': content = <div className="sk-product-detail"><Block shape="hero" /><div className="sk-card"><Heading /><Block shape="price" /><Copy /><div className="sk-actions"><Block shape="input" /><Block shape="button" /></div><Form count={2} /></div></div>; break;
    case 'checkout': content = <><Heading /><div className="sk-checkout"><div className="sk-stack"><Form count={3} /><Form count={2} /></div><div className="sk-card"><Heading /><Rows variant="alerts" count={2} /><Block shape="price" /><Block shape="button" /></div></div></>; break;
    case 'order': content = <><Heading /><div className="sk-card"><div className="sk-between"><Block shape="chip" /><Block shape="price" /></div><Copy /><div className="sk-timeline">{repeat(4, index => <div className="sk-row" key={index}><Block shape="circle" /><Block size="long" /></div>)}</div></div><Rows variant="orders" count={2} /></>; break;
    case 'account': content = <><div className="sk-card sk-profile"><Block shape="avatar" /><Copy /><Block shape="button" /></div><Rows variant="account" count={4} /></>; break;
    case 'profile': content = <><Heading /><div className="sk-profile"><Block shape="avatar" /><Block shape="button" /></div><Form count={5} /></>; break;
    case 'auth': content = <div className="sk-auth"><Block shape="avatar" /><Heading /><Form count={3} /></div>; break;
    case 'report': content = <><Heading /><Block shape="input" /><Form count={3} /><Rows variant="reviews" count={1} /></>; break;
    case 'conversation': content = <div className="sk-conversation">{repeat(amount + 2, index => <div key={index} className={`sk-row sk-bubble-row ${index % 2 ? 'sk-outgoing' : ''}`}><Block shape="circle" /><Block shape="bubble" /></div>)}</div>; break;
    case 'cart-status': content = <Block shape="chip" />; break;
    case 'image': content = <Block shape="image" />; break;
    case 'orders': case 'addresses': case 'notifications': case 'alerts': case 'chats': case 'reviews':
      content = <Rows variant={variant} count={amount} />; break;
    default: content = <div className="sk-card"><Copy /></div>;
  }
  return <div className={`shop-skeleton shop-skeleton-${variant}${page ? ' shop-skeleton-page' : ''} ${className}`} role="status" aria-live="polite" aria-busy="true" aria-label={text(message)}>
    <span className="sr-only">{text(message)}</span>
    <div className="sk-layout" aria-hidden="true">{content}</div>
  </div>;
}
