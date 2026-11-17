import { shopDate } from './dateTime';
import React, { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { customerToken, post, request, setCustomerToken } from "./api";
import { useText, localizeError, LocaleContext } from "./i18n";
import { useEndless } from "./useEndless";
import { useShopPageActive } from './RetainedViews';
import { Radar, Store, ArrowRight, UserRound, ClipboardList, Mail, LockKeyhole, Eye, EyeOff, Plus, ShoppingBag, CalendarDays, ChevronRight, Check, Clock3, X, Pencil, Camera, Heart, MapPin, Bell, Globe, LogOut, Phone, Bot } from 'lucide-react';
import './account-dashboard.css';
import './edit-profile.css';
import { go, goBack } from './shopNavigation';
import { PriceTag, SectionTitle, StatusBadge, LoadingPanel, ProductMedia } from './ShoppingComponents';
import { BuyAgain } from './BuyAgain';

const CustomerContext = createContext(null);
export const useCustomer = () => useContext(CustomerContext);

export function CustomerProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [accountScope, setAccountScope] = useState(0);
  const [sessionError, setSessionError] = useState('');
  const [sessionRetry, setSessionRetry] = useState(0);
  const [loading, setLoading] = useState(Boolean(customerToken()));
  useEffect(() => {
    let cancelled = false;
    if (customerToken()) request("/customer/me").then((data) => {
      if (!cancelled) setCustomer(data.customer);
    }).catch(error => { if (!cancelled && error.status !== 401) setSessionError(error.message); }).finally(() => { if (!cancelled) setLoading(false); });
    const expire = () => {
      setAccountScope(value => value + 1);
      setCustomer(null);
      if (sessionStorage.getItem("mkpos.shop.tracking.customer") && sessionStorage.getItem("mkpos.shop.tracking.customer") !== "null") {
        sessionStorage.removeItem("mkpos.shop.tracking");
        sessionStorage.removeItem("mkpos.shop.tracking.customer");
      }
    };
    window.addEventListener("mkpos.shop.customer-session-expired", expire);
    return () => { cancelled = true; window.removeEventListener("mkpos.shop.customer-session-expired", expire); };
  }, [sessionRetry]);
  const retrySession = () => { setLoading(true); setSessionError(''); setAccountScope(value => value + 1); setSessionRetry(value => value + 1); };
  const refreshCustomer = async () => {
    const token = customerToken();
    if (!token) return;
    const data = await request('/customer/me');
    if (customerToken() === token) setCustomer(current => current?.id === data.customer?.id ? data.customer : current);
  };
  const acceptSession = (data) => { setAccountScope(value => value + 1); setCustomerToken(data.access_token, data.customer); setCustomer(data.customer); };
  const logout = async () => {
    await post("/customer/logout", {});
    if (sessionStorage.getItem("mkpos.shop.tracking.customer") === String(customer?.id)) {
      sessionStorage.removeItem("mkpos.shop.tracking");
      sessionStorage.removeItem("mkpos.shop.tracking.customer");
    }
    setCustomerToken("");
    setAccountScope(value => value + 1);
    setCustomer(null);
  };
  return <CustomerContext.Provider value={{ customer, loading, accountScope, sessionError, retrySession, refreshCustomer, acceptSession, setCustomer, logout }}>{children}</CustomerContext.Provider>;
}

function ErrorMessage({ message }) {
  const language = useContext(LocaleContext);
  return message ? <p role="alert" className="notice error">{localizeError(language, message)}</p> : null;
}

export function CustomerAuth({ register = false, next = "/account" }) {
  const active = useShopPageActive();
  const language = useContext(LocaleContext);
  const text = useText();
  const formId = useId();
  const { customer, acceptSession, loading } = useCustomer();
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const submitting = useRef(false);
  const destination = next.startsWith("/") && !next.startsWith("//") && !/^\/account\/(?:login|register)(?:[/?]|$)/.test(next) ? next : "/account";
  useEffect(() => { if (active && customer) location.hash = destination; }, [active, customer, destination]);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(""); setBusy(true);
    try { const session = await post(register ? "/customer/register" : "/customer/login", form, { customerAuth: false }); setForm({ name: "", email: "", password: "", password_confirmation: "" }); setVisiblePasswords({}); acceptSession(session); }
    catch (e) { setError(e.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (loading) return <LoadingPanel variant="auth" message="Loading account…" page />;
  const field = (key, label, placeholder, Icon, password = false) => <div className="auth-field" key={key}>
    <label htmlFor={`${formId}-${key}`}>{text(label)}</label>
    <div className="auth-input"><Icon size={20} aria-hidden="true" />
      <input id={`${formId}-${key}`} required type={password ? visiblePasswords[key] ? 'text' : 'password' : key === 'email' ? 'email' : 'text'} minLength={password && register ? 8 : undefined} maxLength={password ? 128 : 255} autoComplete={password ? register ? 'new-password' : 'current-password' : key} placeholder={text(placeholder)} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} />
      {password && <button type="button" className="auth-password-toggle" aria-label={text(`${visiblePasswords[key] ? 'Hide' : 'Show'} ${key === 'password_confirmation' ? 'confirm password' : 'password'}`)} aria-pressed={Boolean(visiblePasswords[key])} onClick={() => setVisiblePasswords(current => ({ ...current, [key]: !current[key] }))}>{visiblePasswords[key] ? <Eye size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" />}</button>}
    </div>
  </div>;
  return <section lang={language} className={`narrow customer-account customer-auth-page ${register ? 'auth-register' : 'auth-login'}`}>
    <div className="auth-illustration" aria-hidden="true"><span className="auth-leaf leaf-one" /><span className="auth-leaf leaf-two" /><span className="auth-leaf leaf-three" /><div className="auth-person"><span /><i /></div><div className="auth-illustration-badge">{register ? <Plus size={28} /> : <ShoppingBag size={26} />}</div></div>
    <div className="auth-intro"><h1>{text(register ? "Create customer account" : "Welcome back")}</h1>
    <p>{text(register ? "Join PwarMyar shops to discover local shops and start shopping today." : "Sign in to continue shopping local with PwarMyar shops.")}</p></div>
    <ErrorMessage message={error} />
    <form onSubmit={submit}><fieldset disabled={busy}>
      {register && field('name', 'Name', 'Enter your name', UserRound)}
      {field('email', 'Email', 'Enter your email', Mail)}
      {field('password', 'Password', 'Enter your password', LockKeyhole, true)}
      {!register && <a href={`#/account/forgot-password?next=${encodeURIComponent(destination)}`}>{text('Forgot password?')}</a>}
      {register && field('password_confirmation', 'Confirm password', 'Confirm your password', LockKeyhole, true)}
      <button type="submit" className="primary auth-submit" disabled={busy}>{text(busy ? "Please wait…" : register ? "Create account" : "Sign in")}<ArrowRight size={23} aria-hidden="true" /></button>
    </fieldset></form>
    <div className="auth-switch"><span>{text(register ? "Already have an account?" : "Don’t have an account?")}</span><a href={`#/account/${register ? "login" : "register"}?next=${encodeURIComponent(destination)}`}>{text(register ? "Sign in" : "Sign up")}<ArrowRight size={18} aria-hidden="true" /></a></div>
    {destination.startsWith("/store/") && <a href={`#${destination}`}>{text("Continue as guest")}</a>}
    <svg className="auth-footer-plant" viewBox="0 0 65 65" fill="none" aria-hidden="true"><path d="M31 65C30 42 20 30 13 20M31 65C31 40 42 21 51 12" stroke="var(--theme-text-muted)" strokeWidth="1.5" /><path d="M28 46C8 43 4 31 3 17C21 21 30 31 28 46Z" fill="var(--theme-primary-text)" /><path d="M33 43C33 24 43 14 56 9C57 26 49 39 33 43Z" fill="var(--theme-primary-text)" /><path d="M33 57C39 43 49 40 59 39C54 53 46 58 33 57Z" fill="var(--theme-primary-text)" /></svg>
  </section>;
}

export function CustomerOrders({ onCart }) {
  const text = useText();
  const { customer } = useCustomer();
  const [filter, setFilter] = useState("all");
  const list = useEndless(`/customer/orders?status=${filter}`);
  useEffect(() => {
    const updated = event => { if (event.detail.customerId !== customer.id) return; const order = event.detail.order; list.reconcile(items => items.map(row => row.reference === order.reference ? { ...row, status: order.status, payment_status: order.payment_status, total: order.total } : row)); };
    window.addEventListener('mkpos:order-updated', updated); return () => window.removeEventListener('mkpos:order-updated', updated);
  }, [customer.id, list.reconcile]);
  function view(reference) {
    sessionStorage.setItem("mkpos.shop.tracking", JSON.stringify({ reference }));
    sessionStorage.setItem("mkpos.shop.tracking.customer", String(customer.id));
    location.hash = "/orders/track";
  }
  return <section className="customer-orders orders-page"><header data-shop-refresh-bar className="orders-intro"><h1>{text("My orders")}</h1><p>{text("Track and manage your orders")}</p></header>
    <div data-shop-refresh-bar className="orders-filters" role="group" aria-label={text("Order status")}>
      {['all', 'processing', 'completed', 'cancelled'].map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{text(value[0].toUpperCase() + value.slice(1))}</button>)}
    </div>
    <ErrorMessage message={list.error} />
    {list.error && <button type="button" onClick={list.retry}>{text("Try again")}</button>}
    <div className="orders-grid">{list.items.map((order) => <article className="customer-order-card" key={order.reference}>
      <div className="order-card-header"><div><strong>{order.reference.startsWith("#") ? order.reference : `#${order.reference}`}</strong><a href={`#/store/${encodeURIComponent(order.store_slug)}`}>{order.store_name}</a></div><span className={`status-badge ${order.status === "completed" ? "is-good" : ["cancelled", "expired"].includes(order.status) ? "is-stopped" : "is-processing"}`} title={text(order.status).replaceAll("_", " ")} aria-label={text(order.status).replaceAll("_", " ")}>{order.status === "completed" ? <Check aria-hidden="true" /> : ["cancelled", "expired"].includes(order.status) ? <X aria-hidden="true" /> : <Clock3 aria-hidden="true" />}{text(order.status === "completed" ? "Completed" : ["cancelled", "expired"].includes(order.status) ? "Cancelled" : "Processing")}</span><button type="button" className="order-open" aria-label={`${text("View order")}: ${order.reference}`} onClick={() => view(order.reference)}><ChevronRight size={18} aria-hidden="true" /></button></div>
      {order.item_previews?.length > 0 && <div className="order-item-previews">{order.item_previews.map((item, index) => <ProductMedia key={index} src={item.photo_url} name={item.name} />)}{order.item_count > order.item_previews.length && <span className="order-extra-items">+{order.item_count - order.item_previews.length}</span>}</div>}
      <div className="order-card-body"><div>{order.created_at && <span className="order-date"><CalendarDays size={16} aria-hidden="true" /><time dateTime={shopDate(order.created_at)?.toISOString()}>{shopDate(order.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></span>}</div><div className="order-total"><small>{text("Total")}</small><strong className="order-price">{['Ks', 'MMK', 'K'].includes(order.currency) ? 'K' : order.currency} {Number(order.total).toLocaleString()}</strong></div></div>
    </article>)}</div>
    <div className="customer-orders-end" ref={list.sentinel}>{list.busy ? <LoadingPanel variant="orders" count={list.items.length ? 1 : 4} /> : !list.items.length && !list.error ? <div className="order-empty"><ClipboardList size={24} aria-hidden="true" /><p>{text("No account orders yet. Guest orders are tracked separately.")}</p></div> : list.more && <button onClick={list.retry}>{text("Load more")}</button>}</div>
  </section>;
}

function TelegramSupportLink() {
  const text = useText();
  return <a className="me-menu-row" href="https://t.me/KaungKaungKK_bot" target="_blank" rel="noopener noreferrer">
    <span className="me-menu-icon blue"><Bot size={23} aria-hidden="true" /></span>
    <span className="me-menu-copy"><strong>{text('AI customer service')}</strong><small>Telegram · @KaungKaungKK_bot</small></span>
    <ChevronRight size={20} aria-hidden="true" />
  </a>;
}

function CustomerProfile({ customer, editPage = false }) {
  const text = useText();
  const language = useContext(LocaleContext);
  const { setCustomer, logout } = useCustomer();
  const [form, setForm] = useState({ name: customer.name, phone: customer.phone || "", address: customer.address || "" });
  const previousAddress = useRef(customer.address || '');
  useEffect(() => { const address = customer.address || '', previous = previousAddress.current; setForm(current => current.address === previous ? { ...current, address } : current); previousAddress.current = address; }, [customer.address]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const pictureInput = useRef(null);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [failedPicture, setFailedPicture] = useState(null);
  async function updatePicture(file, remove = false) {
    if (pictureBusy || busy || (!file && !remove)) return;
    setError(''); setSuccess('');
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) {
      setError('Choose a JPG, PNG or WebP image up to 2 MB.');
      if (pictureInput.current) pictureInput.current.value = '';
      return;
    }
    const body = new FormData();
    if (file) body.append('image', file);
    setPictureBusy(true);
    try {
      const data = await request('/customer/profile/avatar', { method: remove ? 'DELETE' : 'POST', ...(remove ? {} : { body }) });
      setCustomer(data.customer);
      setSuccess(remove ? 'Profile picture removed.' : 'Profile picture updated.');
    } catch (error) { setError(error.message); }
    finally { setPictureBusy(false); if (pictureInput.current) pictureInput.current.value = ''; }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try { const data = await request("/customer/profile", { method: "PUT", body: JSON.stringify(form) }); setCustomer(data.customer); setSuccess("Profile saved."); goBack('/account'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError("");
    try { await logout(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (editPage) return <section className="edit-profile-page"><header className="edit-profile-intro"><h1>{text('Edit profile')}</h1><p>{text('Update your personal information.')}</p></header><form onSubmit={save}><fieldset disabled={busy || pictureBusy}>
    <div className="edit-profile-panel"><div className="edit-profile-photo"><div className="me-avatar-wrap"><span className="me-avatar" aria-label={text('Profile picture')}>{customer.avatar_url && failedPicture !== customer.avatar_url ? <img src={customer.avatar_url} alt="Your profile" onError={() => setFailedPicture(customer.avatar_url)} /> : <UserRound size={40} aria-hidden="true" />}</span><button type="button" className="edit-photo-camera" aria-label={text('Choose profile photo')} onClick={() => pictureInput.current?.click()}><Camera size={20} /></button></div><button type="button" className="edit-photo-link" onClick={() => pictureInput.current?.click()}>{text('Change profile photo')}</button>{customer.avatar_url && <button type="button" className="edit-photo-remove" onClick={() => updatePicture(null, true)}>{text('Remove picture')}</button>}<input ref={pictureInput} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile picture" onChange={event => updatePicture(event.target.files?.[0])} />{pictureBusy && <small role="status">{text('Updating picture…')}</small>}</div>
    <ErrorMessage message={error} />{success && <p role="status">{text(success)}</p>}
    <label>{text('Full name')}<span className="edit-profile-input"><UserRound size={20} aria-hidden="true" /><input required autoComplete="name" maxLength={255} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></span></label>
    <label>{text('Email address')}<span className="edit-profile-input"><Mail size={20} aria-hidden="true" /><input type="email" autoComplete="email" readOnly value={customer.email || ''} /></span></label>
    <label>{text('Phone number')}<span className="edit-profile-input"><Phone size={20} aria-hidden="true" /><input type="tel" autoComplete="tel" maxLength={80} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></span></label>
    <label>{text('Preferred language')}<span className="edit-profile-input"><Globe size={20} aria-hidden="true" /><select aria-label={text("Preferred language")} value={language || 'en'} onChange={() => document.querySelector('.shopping-header .language')?.click()}><option value="en">English</option><option value="my">မြန်မာ</option></select></span></label></div>
    <section className="edit-profile-panel edit-profile-address"><header><h2>{text('Default delivery address')}</h2><a href="#/account/addresses">{text('Change')}</a></header><div className="edit-address-field"><span><MapPin size={25} aria-hidden="true" /></span><textarea aria-label={text('Default delivery address')} maxLength={2000} autoComplete="street-address" placeholder={text('Enter your delivery address')} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></div></section>
    <div className="edit-profile-actions"><button type="submit" className="primary">{text(busy ? 'Please wait…' : 'Save changes')}</button></div>
  </fieldset></form></section>;
  return <section className="customer-profile me-dashboard"><header className="me-intro"><h1>{text('Me')}</h1><p>{text('Manage your profile and shopping tools.')}</p></header><div className="me-profile-card"><div className="me-avatar-wrap"><span className="me-avatar">{customer.avatar_url && failedPicture !== customer.avatar_url ? <img src={customer.avatar_url} alt="Your profile" onError={() => setFailedPicture(customer.avatar_url)} /> : <UserRound size={38} aria-hidden="true" />}</span><button type="button" className="me-camera" aria-label={text('Change profile picture')} disabled={busy || pictureBusy} onClick={() => go('/account/profile')}><Camera size={17} /></button></div><div className="me-profile-summary"><h2>{customer.name}</h2><p>{customer.email || customer.phone}</p></div><button type="button" className="me-edit" onClick={() => go('/account/profile')}><Pencil size={17} /><span>{text('Edit Profile')}</span></button></div>
    <ErrorMessage message={error} />{success && <p role="status">{text(success)}</p>}
    <h2 className="me-group-title">{text('My Account')}</h2><div className="me-menu">{[
      ['/orders', ClipboardList, 'My orders', 'View and track your orders', 'blue'],
      ['/account/favorites', Heart, 'Favorites', 'Products and shops you love', 'pink'],
      ['/account/radar', Radar, 'Shop Radar', 'Find shops around your current location', 'mint'],
      ['/account/addresses', MapPin, 'Addresses', 'Manage your delivery addresses', 'mint'],
      ['/account/notifications', Bell, 'Notifications', 'Updates from shops and your orders', 'purple'],
      ['/account/recent', Clock3, 'Recently viewed', 'Products you recently viewed', 'blue'],
    ].map(([path, Icon, title, caption, color]) => <a className="me-menu-row" href={`#${path}`} key={path}><span className={`me-menu-icon ${color}`}><Icon size={23} aria-hidden="true" /></span><span className="me-menu-copy"><strong>{text(title)}</strong><small>{text(caption)}</small></span><ChevronRight size={20} aria-hidden="true" /></a>)}<TelegramSupportLink /><button type="button" className="me-menu-row" onClick={() => document.querySelector('.shopping-header .language')?.click()}><span className="me-menu-icon pink"><Globe size={23} /></span><span className="me-menu-copy"><strong>{text('Language')}</strong><small>{text('Choose your app language')}</small></span><span className="me-language-value">{language === 'my' ? 'မြန်မာ' : 'English'}</span><ChevronRight size={20} /></button></div>
    <h2 className="me-group-title">{text('Account Settings')}</h2><div className="me-menu"><button type="button" className="me-menu-row" disabled={busy || pictureBusy} onClick={signOut}><span className="me-menu-icon pink"><LogOut size={23} /></span><span className="me-menu-copy"><strong>{text('Sign out')}</strong><small>{text('Sign out from your account')}</small></span><ChevronRight size={20} /></button></div>
  </section>;
}

export function CustomerAccount({ onCart }) {
  const text = useText();
  const { customer, loading } = useCustomer();
  if (loading) return <LoadingPanel variant="account" message="Loading account…" page />;
  if (!customer) return <section className="me-dashboard me-guest"><header className="me-intro"><h1>{text('Me')}</h1><p>{text('Manage your profile and shopping tools.')}</p></header><div className="me-profile-card"><span className="me-avatar"><UserRound size={38} /></span><div><h2>{text('Welcome to PwarMyar shops')}</h2><p>{text('One customer account for shopping across PwarMyar shops.')}</p><a className="button primary" href="#/account/login?next=%2Faccount">{text('Sign in')}</a><a className="auth-switch" href="#/account/register?next=%2Faccount">{text('Create a customer account')}<ArrowRight size={16} aria-hidden="true" /></a></div></div><div className="me-menu"><a className="me-menu-row" href="#/account/radar"><span className="me-menu-icon mint"><Radar size={23} aria-hidden="true" /></span><span className="me-menu-copy"><strong>{text('Shop Radar')}</strong><small>{text('Find shops around your current location')}</small></span><ChevronRight size={20} aria-hidden="true" /></a><TelegramSupportLink /></div></section>;
  return <CustomerProfile key={customer.id} customer={customer} />;
}

export function CustomerEditProfile() {
  const { customer, loading } = useCustomer();
  if (loading) return <LoadingPanel variant="profile" message="Loading account…" page />;
  if (!customer) return <CustomerAuth next="/account/profile" />;
  return <CustomerProfile key={customer.id} customer={customer} editPage />;
}
