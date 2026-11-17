import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { ChoiceGroup, Button, IconButton, Input, Radio, SearchInput, Textarea } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock3, CornerUpLeft, Filter, MessageSquare, Package, Star, Store, TriangleAlert, UserRound } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EndlessListFooter, MobileFilterToggle, MobileFilterPanel, MobileFilterActions, MobileNotice } from '../components/MobilePrimitives';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../utils/csvExport';
import { SHOP_REVIEW_COLUMNS, loadShopReviewExport } from './shopReviewCsv';
import { useEndlessList } from '../hooks/useEndlessList';
import { usePageRefresh } from '../navigation/pageRefresh';
import { ShopBusy, ShopField, ShopLoadState, ShopLoading } from './ShopPrimitives';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { useShopResource } from './useShopResource';
import { canShop, shopDate, fieldErrors } from './shopUtils';
import { reportPreset as businessDateRange } from './shopReportUtils';

const BLANK={type:'',rating:'',reply_status:'',content:'',date_from:'',date_to:'',sort:'newest'};
const nameOf=review=>review.customer_name?.trim()||'Guest customer';
export function ShopReviewHeader({ title='Reviews', onBack, busy=false, children }) {
  return <PageAppBar className="shop-review-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" disabled={busy} onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>{title}</h1>{children}<AppBarMenu /></PageAppBar>;
}
function ReviewStars({ rating, numeric=false }) {
  const value=Math.min(5,Math.max(0,Number(rating)||0));
  return <span className="review-reference-stars" role="img" aria-label={`${value} out of 5 stars`}>{[1,2,3,4,5].map(n=><Star key={n} size={13} className={n<=value?'is-filled':''} fill={n<=value?'currentColor':'none'} aria-hidden="true" />)}{numeric&&<span aria-hidden="true">{value.toFixed(1)}</span>}</span>;
}
function ReviewContext({ review, session }) {
  const name=nameOf(review),initials=review.customer_name?.trim().split(/\s+/u).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase();
  return <><header className="review-reference-identity"><span className="shop-review-avatar" aria-hidden="true">{initials||<UserRound size={19} />}</span><div><h3>{name}</h3><small>{shopDate(review.created_at,session?.business?.timezone)}<span aria-hidden="true"> / </span>{Number(review.target_id)?'Product review':'Shop review'}</small></div><ReviewStars rating={review.rating} numeric /></header>{Number(review.target_id)>0&&<div className="review-reference-product"><span className="review-product-photo"><Package size={25} aria-hidden="true" /><ProductPhoto path={review.photo_url} alt={review.product_name||'Product review'} /></span><span><strong>{review.product_name||'Product review'}</strong>{review.product_unit&&<small>{review.product_unit}</small>}</span></div>}<p className={`shop-review-comment${review.comment?'':' is-rating-only'}`}>{review.comment||'Rating only'}</p></>;
}
function ReviewReplySnapshot({ review, session, editor=false, action }) {
  return <section className={`review-reply-snapshot${editor?' is-editor':''}`}><header><span className="review-reply-icon"><Store size={20} aria-hidden="true" /></span><span><strong>{editor?'Your existing reply':'Your reply'}</strong>{review.replied_at&&<small>{shopDate(review.replied_at,session?.business?.timezone)}</small>}</span>{action}</header><p>{review.reply}</p></section>;
}
function ReviewCard({ review, session, onNavigate }) {
  const allowed=canShop(session,'ecommerce_process'), name=nameOf(review);
  const action=<Button variant="plain" type="button" className={`review-reference-reply-button${review.reply?' is-edit':''}`} aria-label={`${review.reply?'Edit reply':'Reply'} to ${name}`} onClick={()=>onNavigate(`/shop/reviews/${review.id}/edit`)}>{review.reply?'Edit reply':'Reply'}</Button>;
  return <article className="shop-review-card review-reference-card"><ReviewContext review={review} session={session} />{review.reply?<ReviewReplySnapshot review={review} session={session} action={allowed?action:null} />:<div className="review-reference-card-footer"><span className="review-reference-awaiting"><Clock3 size={14} aria-hidden="true" />Awaiting reply</span>{allowed&&action}</div>}</article>;
}
function ReviewFilterGroup({ title, name, options, value, onChange, stars=false }) {
  return <ChoiceGroup className="review-filter-group"><legend>{title}</legend>{options.map(([key,label])=><label key={key}><Radio type="radio" name={`review-filter-${name}`} aria-label={stars&&key?label:undefined} checked={value===key} onChange={()=>onChange(key)} /><span>{stars&&key?<ReviewStars rating={key} />:label}</span>{stars&&key&&<span className="sr-only">{label}</span>}</label>)}</ChoiceGroup>;
}
export function ShopReviews({ session, onNavigate }) {
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[filters,setFilters]=useState(BLANK),[draft,setDraft]=useState(BLANK),[open,setOpen]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(null),[period,setPeriod]=useState('all'),[draftPeriod,setDraftPeriod]=useState('all');
  useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),300);return()=>clearTimeout(timer);},[search]);
  const queryKey=new URLSearchParams({q:query,...filters}).toString();
  const list=useEndlessList({queryKey,loadPage:({limit,offset,signal})=>apiRequest(`/shop-admin/reviews?${queryKey}&limit=${limit}&offset=${offset}`,{signal})});
  usePageRefresh(list.reload,{reconcilePage:list.reconcile});
  const count=Object.entries(filters).filter(([key,value])=>value&&value!==BLANK[key]).length;
  const openFilters=()=>{setDraft({...filters});setDraftPeriod(period);setError('');setOpen(true);};
  async function exportReviews(){return exportFilteredCsv({loadRows:()=>loadShopReviewExport(`/shop-admin/reviews?${queryKey}`),columns:SHOP_REVIEW_COLUMNS,filename:csvFilename('shop-reviews'),emptyMessage:'No matching reviews to export.'});}
  function apply(event){event.preventDefault();if(draft.date_from&&draft.date_to&&draft.date_from>draft.date_to){setError('End date must be on or after start date.');return;}setError('');setFilters({...draft});setPeriod(draftPeriod);setOpen(false);}
  function choosePeriod(value){setDraftPeriod(value);if(value==='all')setDraft({...draft,date_from:'',date_to:''});else if(value!=='custom')setDraft({...draft,...businessDateRange(value==='last7'?7:30,session?.business?.timezone)});}
  return <section className="shop-reviews-screen">
    <ShopReviewHeader onBack={()=>onNavigate('/shop',{back:true})}><CsvExportButton compact label="Export reviews" onExport={exportReviews} onNotice={setNotice} /><IconButton variant="ghost" type="button" className="icon-button" aria-label="Review filters" onClick={openFilters}><Filter size={20} aria-hidden="true" /></IconButton></ShopReviewHeader>
    <MobileNotice notice={notice} onClose={()=>setNotice(null)} />
    <div className="shop-review-controls"><SearchInput className="mobile-search product-search" type="search" maxLength={120} aria-label="Search reviews" placeholder="Search reviews" value={search} onChange={event=>setSearch(event.target.value)} onClear={()=>{setSearch('');setQuery('');}} clearLabel="Clear review search" /><MobileFilterToggle open={open} onToggle={openFilters} controls="shop-review-filters" count={count} /></div>
    <MobileFilterPanel open={open} onClose={()=>setOpen(false)} id="shop-review-filters" className="review-reference-filter" onSubmit={apply}>
      <ReviewFilterGroup title="Shop / Product type" name="type" options={ [['','All'],['shop','Shop reviews'],['product','Product reviews']] } value={draft.type} onChange={value=>setDraft({...draft,type:value})} />
      <ReviewFilterGroup title="Rating" name="rating" stars options={ [['','All'],...[5,4,3,2,1].map(value=>[String(value),`${value} stars`])] } value={draft.rating} onChange={value=>setDraft({...draft,rating:value})} />
      <ReviewFilterGroup title="Reply status" name="reply" options={ [['','All'],['unreplied','Awaiting reply'],['replied','Replied']] } value={draft.reply_status} onChange={value=>setDraft({...draft,reply_status:value})} />
      <ReviewFilterGroup title="Has comment" name="content" options={ [['','All'],['written','With comment'],['rating_only','Without comment']] } value={draft.content} onChange={value=>setDraft({...draft,content:value})} />
      <ReviewFilterGroup title="Date" name="period" options={ [['all','All'],['last7','Last 7 days'],['last30','Last 30 days'],['custom','Custom range']] } value={draftPeriod} onChange={choosePeriod} />
      {draftPeriod==='custom'&&<div className="review-filter-dates">{['date_from','date_to'].map(name=><ShopField id={`review-filter-${name}`} name={name} key={name} label={name==='date_from'?'From date':'To date'}><Input type="date" value={draft[name]} onChange={event=>setDraft({...draft,[name]:event.target.value})} /></ShopField>)}</div>}
      <ReviewFilterGroup title="Sort by" name="sort" options={ [['newest','Newest'],['oldest','Oldest'],['rating_high','Highest rating first'],['rating_low','Lowest rating first']] } value={draft.sort} onChange={value=>setDraft({...draft,sort:value})} />
      {error&&<p role="alert">{error}</p>}<p className="shop-mobile-meta">Dates use shop time: {session?.business?.timezone||'Asia/Rangoon'}.</p><MobileFilterActions onClear={()=>{setDraft({...BLANK});setFilters({...BLANK});setPeriod('all');setDraftPeriod('all');setError('');}} />
    </MobileFilterPanel>
    <section className="review-reference-summary" aria-label="Review statistics"><article><span><MessageSquare size={21} aria-hidden="true" /></span><div><small>Matching reviews</small><strong>{list.initialLoading||list.total===null?'—':list.total.toLocaleString()}</strong></div></article><article><span><CornerUpLeft size={21} aria-hidden="true" /></span><div><small>Awaiting reply shown</small><strong>{list.initialLoading||(list.error&&!list.items.length)?'—':list.items.filter(review=>!review.reply).length.toLocaleString()}</strong></div></article></section>
    <div className="shop-mobile-list">{list.initialLoading&&<ShopLoading label="Loading reviews..." variant="list" />}{list.error&&!list.items.length&&<div className="shop-review-empty" role="alert"><p>{list.error}</p><Button variant="secondary" className="mobile-secondary" type="button" onClick={list.retry}>Retry reviews</Button></div>}{!list.initialLoading&&!list.error&&!list.items.length&&<div className="shop-review-empty"><Star size={27} aria-hidden="true" /><h2>No reviews found</h2><p>No reviews match these filters.</p></div>}{list.items.map(review=><ReviewCard key={review.id} review={review} session={session} onNavigate={onNavigate} />)}<EndlessListFooter list={list} count={list.items.length} noun="reviews" /></div>
  </section>;
}
export function ShopReviewReply({ id, onNavigate, session }) {
  const allowed=canShop(session,'ecommerce_process'),resource=useShopResource(allowed?`/shop-admin/reviews/${id}`:null);
  const [reply,setReply]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errors,setErrors]=useState({});
  const initialized=useRef(false),working=useRef(false);
  useEffect(()=>{if(resource.data&&!initialized.current){setReply(resource.data.reply||'');initialized.current=true;}},[resource.data]);
  const back=()=>{if(!working.current)onNavigate('/shop/reviews',{back:true});};
  async function submit(event){event.preventDefault();if(working.current||!allowed)return;working.current=true;setBusy(true);setError('');setErrors({});try{const result=await apiRequest(`/shop-admin/reviews/${id}/reply`,{method:'PUT',body:JSON.stringify({reply:reply.trim()})});const savedReply=Object.hasOwn(result,'reply')?result.reply:reply.trim()||null;resource.setData({...resource.data,reply:savedReply,replied_at:result.replied_at??(savedReply?resource.data.replied_at:null)});setReply(savedReply||'');onNavigate('/shop/reviews',{replace:true});}catch(e){setError(e.message);setErrors(fieldErrors(e));}finally{working.current=false;setBusy(false);}}
  return <><ShopReviewHeader title="Reply to review" onBack={back} busy={busy} />{!allowed?<p role="alert" className="shop-mobile-card">You do not have permission to reply to reviews.</p>:<ShopLoadState resource={resource}>{resource.data&&<div className="review-reference-editor"><section className="review-editor-context"><ReviewContext review={resource.data} session={session} /></section>{resource.data.reply&&<ReviewReplySnapshot review={resource.data} session={session} editor />}<form className="shop-mobile-form review-editor-form" onSubmit={submit}><h2>Public reply</h2><p>This will be visible to the customer on your shop.</p>{error&&<p role="alert" className="shop-mobile-error">{error}</p>}<ShopField id={`shop-review-${id}-reply`} name="reply" label="Public reply" errors={errors}><Textarea disabled={busy} maxLength={2000} value={reply} onChange={event=>setReply(event.target.value)} /></ShopField><small className="review-reply-counter">{reply.length}/2000</small>{resource.data.reply?<aside className="review-reply-removal"><TriangleAlert size={19} aria-hidden="true" /><span><strong>Leaving this empty will remove your existing reply.</strong><small>If you want to remove your reply, clear the text and then save.</small></span></aside>:<p className="review-reply-hint">Leave blank to keep this review without a reply.</p>}<div className="review-editor-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={back}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary" disabled={busy}>{busy?<ShopBusy label="Saving..." />:'Save reply'}</Button></div></form></div>}</ShopLoadState>}</>;
}
