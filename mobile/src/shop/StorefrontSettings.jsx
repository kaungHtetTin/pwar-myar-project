import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Switch, Button, Checkbox, IconButton, Input, Select, Textarea } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronRight, Clock3, ExternalLink, Info, Link2, LockKeyhole, Megaphone, Share2, ShoppingCart, Store } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ShopBusy, ShopField, ShopLoadState } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { fieldErrors } from './shopUtils';
import { customerShopLink } from './shopLinks';

const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const FIELDS=['slug','description','price_type','storefront_enabled','accepting_orders','marketplace_enabled','announcement','opening_hours','closed_until'];
function closureInput(value,timezone) {
  if(!value)return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function hoursSummary(hours) {
  if(!hours?.length)return ['No weekly hours',''];
  const open=hours.map((row,index)=>({...row,index})).filter(day=>!day.closed);
  if(!open.length)return ['All days closed',''];
  if(open.every(day=>day.opens===open[0].opens&&day.closes===open[0].closes)&&open.at(-1).index-open[0].index+1===open.length) return [open.length===1?DAYS[open[0].index]:`${DAYS[open[0].index].slice(0,3)} - ${DAYS[open.at(-1).index].slice(0,3)}`,`${open[0].opens} - ${open[0].closes}`];
  return ['Weekly schedule',`${open.length} open days`];
}
export function ShopStorefrontHeader({ onBack, busy=false }) {
  return <PageAppBar className="shop-storefront-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" disabled={busy} onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>Storefront</h1><AppBarMenu /></PageAppBar>;
}
function StorefrontSwitch({ id, label, hint, icon:Icon, checked, onChange }) {
  return <label className="storefront-switch-row" htmlFor={id}>{Icon&&<Icon size={21} aria-hidden="true" />}<span><strong>{label}</strong>{hint&&<small>{hint}</small>}</span><Switch id={id} type="checkbox" role="switch" checked={!!checked} onChange={event=>onChange(event.target.checked)} /></label>;
}
function StorefrontSection({ title, icon:Icon, children, className='' }) {
  return <section className={`storefront-settings-section ${className}`}><header>{Icon&&<Icon size={20} aria-hidden="true" />}<h2>{title}</h2></header>{children}</section>;
}
function StorefrontHours({ hours, onChange, errors }) {
  const previous=useRef(null),disclosure=useRef(null),[label,time]=hoursSummary(hours);
  useEffect(()=>{if(Object.keys(errors).some(key=>key.startsWith('opening_hours.'))&&disclosure.current)disclosure.current.open=true;},[errors]);
  function enabled(value){if(value)onChange(previous.current||DAYS.map(()=>({closed:false,opens:'09:00',closes:'18:00'})));else{previous.current=hours;onChange([]);}}
  function dayChange(index,key,value){onChange(hours.map((day,i)=>i===index?{...day,[key]:value}:day));}
  return <details ref={disclosure} className="storefront-settings-section storefront-hours"><summary><span><Clock3 size={20} aria-hidden="true" /><strong>Opening hours</strong></span><span className="storefront-hours-summary"><span>{label}</span><b>{time}</b><ChevronRight size={17} aria-hidden="true" /></span></summary><div className="storefront-hours-content"><StorefrontSwitch id="storefront-weekly-hours" label="Show weekly opening hours" checked={hours.length===7} onChange={enabled} /><p className="storefront-field-hint">Opening hours describe service availability. Accepting orders controls checkout separately.</p>{hours.map((day,index)=><fieldset className="storefront-day" key={DAYS[index]}><legend>{DAYS[index]}</legend><label className="storefront-day-closed"><Checkbox type="checkbox" checked={day.closed} onChange={event=>dayChange(index,'closed',event.target.checked)} />{DAYS[index]} closed</label><div className="storefront-day-times">{[['opens','Opens'],['closes','Closes']].map(([key,title])=><ShopField id={`storefront-${index}-${key}`} key={key} name={`opening_hours.${index}.${key}`} label={`${DAYS[index]} ${title.toLowerCase()}`} errors={errors}><Input type="time" required={!day.closed} disabled={day.closed} value={day[key]} onChange={event=>dayChange(index,key,event.target.value)} /></ShopField>)}</div></fieldset>)}</div></details>;
}
export function ShopStorefront({ session, onNavigate }) {
  const resource=useShopResource('/shop-admin/settings');
  const [form,setForm]=useState(null),[error,setError]=useState(''),[errors,setErrors]=useState({}),[busy,setBusy]=useState(false),[closure,setClosure]=useState(false);
  const initialized=useRef(false),working=useRef(false),closureDraft=useRef(''),owner=session?.user?.role==='owner';
  useEffect(()=>{if(resource.data&&!initialized.current){const value=closureInput(resource.data.closed_until,resource.data.timezone||'Asia/Rangoon');setForm({...resource.data,closed_until:value});setClosure(!!value);closureDraft.current=value;initialized.current=true;}},[resource.data]);
  const change=(key,value)=>setForm(current=>({...current,[key]:value}));
  const back=()=>{if(!working.current)onNavigate('/shop',{back:true});};
  function toggleClosure(value){setClosure(value);if(value)change('closed_until',closureDraft.current);else{closureDraft.current=form.closed_until;change('closed_until','');}}
  async function submit(event){
    event.preventDefault();if(working.current||!form)return;setErrors({});setError('');
    const invalid=(form.opening_hours||[]).findIndex(day=>!day.closed&&(!day.opens||!day.closes||day.opens>=day.closes));
    if(invalid>=0){setError(`${DAYS[invalid]} closing time must be after opening time.`);setErrors({[`opening_hours.${invalid}.closes`]:'Closing time must be after opening time.'});return;}
    if(closure&&!form.closed_until){setError('Choose when the temporary closure ends.');return;}
    working.current=true;setBusy(true);
    try{
      // Re-read independently managed settings before applying this page's fields.
      const current=await apiRequest('/shop-admin/settings');
      const payload=Object.fromEntries(['slug','description','price_type','storefront_enabled','accepting_orders','marketplace_enabled','pickup_instructions','delivery_zones','announcement','opening_hours','closed_until'].map(key=>[key,current[key]]));
      for(const key of [...FIELDS,...(owner?['display_name','phone','address','currency']:[])])payload[key]=key==='closed_until'?(closure?form.closed_until:null):form[key];
      await apiRequest('/shop-admin/settings',{method:'PUT',body:JSON.stringify(payload)});onNavigate('/shop',{replace:true});
    }catch(e){setError(e.message);setErrors(fieldErrors(e));}finally{working.current=false;setBusy(false);}
  }
  const url=resource.data?.slug?customerShopLink(resource.data.slug):'';
  return <><ShopStorefrontHeader onBack={back} busy={busy} /><ShopLoadState resource={resource}>{form&&<form className="shop-mobile-form storefront-settings-form" onSubmit={submit}>{error&&<p role="alert" className="shop-mobile-error">{error}</p>}<fieldset disabled={busy}>
    <StorefrontSection title="Store identity"><div className="storefront-identity"><Store size={23} aria-hidden="true" /><span><strong>{form.display_name}</strong><small>This name appears on your storefront.</small></span></div><details className="storefront-shared-profile"><summary>Shared business details</summary><p className="storefront-field-hint">Shop name, phone, address, currency and logo are shared with main Settings.</p>{[['display_name','Public shop name'],['phone','Phone'],['address','Address'],['currency','Currency']].map(([name,label])=><ShopField id={`storefront-${name}`} key={name} name={name} label={label} errors={errors}><Input disabled={!owner} required={['display_name','currency'].includes(name)} maxLength={name==='currency'?20:255} value={form[name]||''} onChange={event=>change(name,event.target.value)} /></ShopField>)}{!owner&&<p className="storefront-field-hint">Only the owner can change shared business details.</p>}</details></StorefrontSection>
    <StorefrontSection title="Public URL"><div className="storefront-public-url"><Link2 size={18} aria-hidden="true" />{url?<a href={url} target="_blank" rel="noreferrer" aria-label="Open customer shop"><span>{url}</span><ExternalLink size={17} aria-hidden="true" /></a>:<p>Customer shop link is unavailable.</p>}</div><div className="storefront-slug-field"><ShopField id="storefront-slug" name="slug" label="Store slug" errors={errors}><Input required readOnly={!!resource.data.slug_locked} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} value={form.slug} onChange={event=>change('slug',event.target.value)} /></ShopField>{resource.data.slug_locked&&<LockKeyhole size={16} aria-hidden="true" />}</div><p className="storefront-field-hint">The store slug cannot change after you have orders.</p></StorefrontSection>
    <StorefrontSection title="Online price type"><ShopField id="storefront-price-type" name="price_type" label="Online price type" errors={errors}><Select value={form.price_type} onChange={event=>change('price_type',event.target.value)}>{form.price_types?.map(price=><option value={price.name||price} key={price.name||price}>{price.name||price}</option>)}</Select></ShopField><p className="storefront-field-hint">This price type will be used for online orders.</p></StorefrontSection>
    <StorefrontSection title="Store description"><ShopField id="storefront-description" name="description" label="Store description" errors={errors}><Textarea maxLength={4000} value={form.description||''} onChange={event=>change('description',event.target.value)} /></ShopField><small className="storefront-character-count">{(form.description||'').length}/4000</small></StorefrontSection>
    <section className="storefront-settings-section storefront-availability">{[['storefront_enabled','Storefront','Make your store visible to customers online.',Store],['accepting_orders','Accepting orders','Let customers place orders on your storefront.',ShoppingCart],['marketplace_enabled','Show on marketplace','List your store on the marketplace so more customers can find you.',Share2]].map(([key,label,hint,Icon])=><StorefrontSwitch key={key} id={`storefront-${key}`} label={label} hint={hint} icon={Icon} checked={form[key]} onChange={value=>change(key,value)} />)}{!!form.marketplace_suspended&&<p role="alert" className="storefront-suspension">Marketplace listing suspended: {form.marketplace_suspension_reason}</p>}</section>
    <StorefrontSection title="Announcement" icon={Megaphone} className="storefront-announcement"><ShopField id="storefront-announcement" name="announcement" label="Customer announcement" errors={errors}><Textarea maxLength={1000} value={form.announcement||''} onChange={event=>change('announcement',event.target.value)} /></ShopField><small className="storefront-character-count">{(form.announcement||'').length}/1000</small></StorefrontSection>
    <StorefrontHours hours={form.opening_hours||[]} onChange={value=>change('opening_hours',value)} errors={errors} />
    <section className="storefront-settings-section storefront-closure"><StorefrontSwitch id="storefront-temporary-closure" label="Temporary closure" hint="Pause checkout until the selected time." icon={CalendarDays} checked={closure} onChange={toggleClosure} />{closure&&<><ShopField id="storefront-closed-until" name="closed_until" label={`Temporary closure ends (${form.timezone||'Asia/Rangoon'})`} errors={errors}><Input type="datetime-local" required value={form.closed_until||''} onChange={event=>change('closed_until',event.target.value)} /></ShopField><p className="storefront-field-hint">Temporary closure pauses checkout until this time. Store visibility is managed separately.</p></>}</section>
    <aside className="storefront-behavior-note"><Info size={20} aria-hidden="true" /><p>Store visibility, accepting orders, and marketplace listing are managed separately.</p></aside>
    <div className="storefront-settings-actions"><Button variant="secondary" type="button" className="mobile-secondary" onClick={back}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary">{busy?<ShopBusy label="Saving..." />:'Save changes'}</Button></div>
  </fieldset></form>}</ShopLoadState></>;
}
