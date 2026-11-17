import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopReviewReply, ShopReviews } from './ShopReviews';
import { loadShopReviewExport } from './shopReviewCsv';

vi.mock('../api/client',()=>({apiRequest:vi.fn(),apiDownload:vi.fn()}));
const session={user:{role:'owner'},business:{timezone:'Asia/Rangoon'}};
const review={id:1,target_id:0,customer_name:'Emma',rating:5,comment:'Great service.',reply:null};
beforeEach(()=>{vi.clearAllMocks();apiRequest.mockImplementation(async path=>path.includes('/reviews?')?{items:[review],total:24}:review);});

it('stages filters, discards closed edits and leaves search untouched when Reset closes the drawer',async()=>{
  render(<ShopReviews session={session} onNavigate={vi.fn()} />);await screen.findByRole('button',{name:'Reply to Emma'});
  fireEvent.change(screen.getByRole('searchbox',{name:'Search reviews'}),{target:{value:'Emma'}});
  await waitFor(()=>expect(apiRequest.mock.calls.at(-1)[0]).toContain('q=Emma'));
  const reads=apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  fireEvent.click(screen.getByRole('radio',{name:'Product reviews'}));
  fireEvent.click(screen.getByRole('button',{name:'Reset',exact:true}));
  expect(screen.getByRole('searchbox',{name:'Search reviews',hidden:true})).toHaveValue('Emma');
  expect(apiRequest).toHaveBeenCalledTimes(reads);
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  fireEvent.click(screen.getByRole('radio',{name:'Product reviews'}));fireEvent.keyDown(window,{key:'Escape'});
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  expect(within(screen.getByRole('group',{name:'Shop / Product type'})).getByRole('radio',{name:'All'})).toBeChecked();
  fireEvent.click(screen.getByRole('radio',{name:'5 stars'}));fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));
  await waitFor(()=>expect(apiRequest.mock.calls.at(-1)[0]).toContain('rating=5'));
});

it('keeps matching total distinct from the number of loaded replies awaiting action',async()=>{
  render(<ShopReviews session={session} onNavigate={vi.fn()} />);await screen.findByRole('button',{name:'Reply to Emma'});
  expect(screen.getByText('Matching reviews').parentElement).toHaveTextContent('24');
  expect(screen.getByText('Awaiting reply shown').parentElement).toHaveTextContent('1');
});

it('validates custom date order without requesting',async()=>{
  render(<ShopReviews session={session} onNavigate={vi.fn()} />);await screen.findByRole('button',{name:'Reply to Emma'});
  const reads=apiRequest.mock.calls.length;fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));fireEvent.click(screen.getByRole('radio',{name:'Custom range'}));
  fireEvent.change(screen.getByLabelText('From date'),{target:{value:'2026-10-20'}});fireEvent.change(screen.getByLabelText('To date'),{target:{value:'2026-10-01'}});fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));
  expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after start date.');expect(apiRequest).toHaveBeenCalledTimes(reads);
});

it('blocks duplicate saves, retains failed drafts and resumes the source on Cancel',async()=>{
  let reject;apiRequest.mockImplementation(async (_path,options)=>options?.method?new Promise((_resolve,rejectPromise)=>{reject=rejectPromise;}):review);
  const navigate=vi.fn();render(<ShopReviewReply id="1" session={session} onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Public reply'),{target:{value:'Thank you Emma.'}});
  const form=screen.getByRole('button',{name:'Save reply'}).closest('form');fireEvent.submit(form);fireEvent.submit(form);
  expect(apiRequest.mock.calls.filter(([,options])=>options?.method)).toHaveLength(1);expect(screen.getByRole('button',{name:'Back',exact:true})).toBeDisabled();
  reject(new Error('Please try again.'));await screen.findByText('Please try again.');expect(screen.getByLabelText('Public reply')).toHaveValue('Thank you Emma.');
  fireEvent.click(screen.getByRole('button',{name:'Cancel',exact:true}));expect(navigate).toHaveBeenCalledWith('/shop/reviews',{back:true});
});

it('updates the retained existing-reply snapshot after Save and removes it after clearing',async()=>{
  apiRequest.mockImplementation(async (_path,options)=>options?.method?{ok:true,reply:JSON.parse(options.body).reply||null,replied_at:'2026-10-16 06:00:00'}:review);
  const navigate=vi.fn();render(<ShopReviewReply id="1" session={session} onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Public reply'),{target:{value:' Thank you! '}});fireEvent.click(screen.getByRole('button',{name:'Save reply'}));
  await screen.findByText('Your existing reply');expect(screen.getByLabelText('Public reply')).toHaveValue('Thank you!');
  fireEvent.change(screen.getByLabelText('Public reply'),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Save reply'}));
  await waitFor(()=>expect(screen.queryByText('Your existing reply')).not.toBeInTheDocument());expect(navigate).toHaveBeenLastCalledWith('/shop/reviews',{replace:true});
});

it('preserves Back and blocks editor data requests without processing permission',()=>{
  const navigate=vi.fn();render(<ShopReviewReply id="1" session={{user:{role:'staff'},permissions:['ecommerce_orders']}} onNavigate={navigate} />);
  expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission');expect(apiRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Back',exact:true}));expect(navigate).toHaveBeenCalledWith('/shop/reviews',{back:true});
});

it('exports every filtered page using the reviews API maximum of 50',async()=>{
  apiRequest.mockImplementation(async path=>({items:[{...review,id:path.includes('offset=0')?1:2}],total:2}));
  const rows=await loadShopReviewExport('/shop-admin/reviews?q=Emma&rating=5');expect(rows).toHaveLength(2);
  expect(apiRequest.mock.calls[0][0]).toContain('limit=50');expect(apiRequest.mock.calls[1][0]).toContain('offset=1');expect(apiRequest.mock.calls[1][0]).toContain('rating=5');
});
