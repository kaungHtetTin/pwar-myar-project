import { Button, Input, Radio } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Info, Search, UserRound, UserRoundPlus } from 'lucide-react';
import { apiRequest } from '../api/client';
import { MobileSheet } from '../components/MobilePrimitives';
import { ShopBusy, ShopLoadState } from './ShopPrimitives';
import { useShopResource } from './useShopResource';

export function ShopCustomerCredit({ customer, customerKey, onNavigate, onCancel, onBusyChange }) {
  const options = useShopResource(`/shop-admin/customers/${encodeURIComponent(customerKey)}/credit-options`);
  const [choice, setChoice] = useState(null), [picker, setPicker] = useState(false), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), working = useRef(false);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const contacts = useShopResource(picker ? `/customers?q=${encodeURIComponent(query)}&limit=50&offset=0` : null);
  const recommended = options.data?.matches || [];
  async function submit(event) {
    event.preventDefault(); if (working.current || !choice) return; working.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try { await apiRequest(`/shop-admin/customers/${encodeURIComponent(customerKey)}/credit-contact`, { method: 'POST', body: JSON.stringify(choice === 'new' ? { create_new: true } : { contact_id: choice.id }) }); setChoice(null); setPicker(false); setSearch(''); setQuery(''); onNavigate(`/shop/customers/${encodeURIComponent(customerKey)}`, { replace: true }); }
    catch (e) { setError(e.message); } finally { working.current = false; setBusy(false); onBusyChange?.(false); }
  }
  function contactCard(contact, matching = false) {
    return <label key={contact.id} className={`buyer-credit-option${choice?.id === contact.id ? ' is-selected' : ''}`}><Radio type="radio" name="credit-contact" checked={choice?.id === contact.id} onChange={() => setChoice(contact)} /><span><strong>{contact.name}</strong><small>Contact #{contact.id}{matching ? ' · Recommended match' : ''}</small>{contact.phone && <small>{contact.phone}</small>}{contact.email && <small>{contact.email}</small>}</span></label>;
  }
  return <form className="shop-buyer-action buyer-credit-form" onSubmit={submit}>
    <section className="shop-buyer-action-identity"><span className="shop-buyer-action-avatar"><UserRound size={24} /></span><div><small>Buyer</small><strong>{customer.customer_name || 'Guest customer'}</strong>{customer.phone && <small>{customer.phone}</small>}{customer.email && <small>{customer.email}</small>}<small>No credit contact linked</small></div></section>
    <section className="shop-customer-panel"><h2>Link to an existing credit contact</h2><p>Choose a credit contact to use for this customer's credit account.</p><ShopLoadState resource={options}>{recommended.map(contact => contactCard(contact, true))}</ShopLoadState>{choice && choice !== 'new' && !recommended.some(contact => contact.id === choice.id) && contactCard(choice)}<Button variant="plain" type="button" className="buyer-contact-picker" onClick={() => setPicker(true)}><Search size={17} /><span>Choose another existing credit contact</span><ChevronRight size={17} /></Button></section>
    <section className="shop-customer-panel"><h2>Or create a new credit contact</h2><p>Create a separate credit contact using this customer's details.</p><label className={`buyer-credit-option${choice === 'new' ? ' is-selected' : ''}`}><Radio type="radio" name="credit-contact" checked={choice === 'new'} onChange={() => setChoice('new')} /><UserRoundPlus size={20} /><span><strong>Create new credit contact</strong><small>{customer.customer_name || 'Guest customer'}</small></span></label></section>
    <aside className="buyer-credit-note"><Info size={19} /><div><strong>Linking keeps identities separate</strong><p>Linking does not merge records or create a credit balance. Shop order history remains unchanged.</p></div></aside>
    {error && <p role="alert">{error}</p>}<div className="shop-mobile-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={onCancel}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary" disabled={busy || !choice}>{busy ? <ShopBusy label="Linking..." /> : 'Link contact'}</Button></div>
    <MobileSheet open={picker} title="Choose credit contact" onClose={() => setPicker(false)} className="buyer-credit-picker"><label className="buyer-picker-search"><Search size={18} /><Input type="search" aria-label="Search credit contacts" placeholder="Search name, phone or email" value={search} onChange={event => setSearch(event.target.value)} /></label><ShopLoadState resource={contacts}>{contacts.data?.items?.map(contact => <Button variant="plain" type="button" key={contact.id} className="buyer-picker-row" onClick={() => { setChoice(contact); setPicker(false); }}><strong>{contact.name}</strong><small>{contact.phone || contact.email || `Contact #${contact.id}`}</small></Button>)}{contacts.data && !contacts.data.items?.length && <p>No matching credit contacts.</p>}{contacts.data?.items?.length === 50 && <p>Search to narrow these results.</p>}</ShopLoadState></MobileSheet>
  </form>;
}
