import React from 'react';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {beforeEach,it,expect,vi} from 'vitest';
import {apiRequest} from '../api/client';
import {PaymentTransactions} from './PaymentTransactions';
import {paymentDateRange} from './paymentReferenceUtils';
vi.mock('../api/client',()=>({apiRequest:vi.fn()}));
const payment={id:6,customer_id:2,customer_name:'Emma',balance:19000,direction:'customer_to_shop',payment_method:'Cash',amount:10000,note:'Keep this draft',created_at:'2026-10-15 10:00:00'};
function api(path,options){if(path==='/settings')return Promise.resolve({payment_methods:'Cash,KPay'});if(path==='/customer-payments/6')return Promise.resolve(options?.method==='PUT'?{...payment,...JSON.parse(options.body)}:payment);if(path.startsWith('/customer-payments?'))return Promise.resolve({items:[payment],total:3,summary:{incoming:40000,outgoing:5000,incoming_count:2,outgoing_count:1}});if(path.startsWith('/supplier-payments?'))return Promise.resolve({items:[{...payment,id:7,supplier_id:3,supplier_name:'Golden River',direction:'shop_to_supplier'}],total:1});return Promise.resolve({items:[],total:0});}
beforeEach(()=>{vi.clearAllMocks();apiRequest.mockImplementation(api);});
it('stages sorting inside the drawer and Reset immediately restores it and closes',async()=>{
 render(<PaymentTransactions/>);await screen.findByText('Emma');
 expect(screen.queryByRole('combobox',{name:'Sort transactions'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/^Filters/}));
 const reads=apiRequest.mock.calls.length;
 fireEvent.change(screen.getByRole('combobox',{name:'Sort transactions'}),{target:{value:'amount_desc'}});
 expect(apiRequest.mock.calls.length).toBe(reads);
 fireEvent.click(screen.getByRole('button',{name:'Close filters',exact:true}));
 fireEvent.click(screen.getByRole('button',{name:/^Filters/}));
 expect(screen.getByRole('combobox',{name:'Sort transactions'})).toHaveValue('newest');
 fireEvent.change(screen.getByRole('combobox',{name:'Sort transactions'}),{target:{value:'oldest'}});
 fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));
 await waitFor(()=>expect(apiRequest.mock.calls.some(c=>c[0].includes('sort=oldest'))).toBe(true));
 fireEvent.click(screen.getByRole('button',{name:/^Filters/}));
 expect(screen.getByRole('combobox',{name:'Sort transactions'})).toHaveValue('oldest');
 const appliedReads=apiRequest.mock.calls.length;
 fireEvent.click(screen.getByRole('button',{name:'Reset',exact:true}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 await waitFor(()=>expect(apiRequest.mock.calls.length).toBeGreaterThan(appliedReads));
 fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
 expect(screen.getByRole('combobox',{name:'Sort transactions'})).toHaveValue('newest');
});
it('shows matching server totals and retains visited tab data without initial refetch',async()=>{
 render(<PaymentTransactions/>);await screen.findByText('Emma');expect(screen.getByText('40,000 Ks')).toBeVisible();expect(screen.getByText('3 transactions')).toBeVisible();
 const reads=apiRequest.mock.calls.filter(c=>c[0].startsWith('/customer-payments?')).length;
 fireEvent.click(screen.getByRole('button',{name:'Suppliers',exact:true}));await screen.findByText('Golden River');
 fireEvent.click(screen.getByRole('button',{name:'Customers',exact:true}));expect(screen.getByText('Emma')).toBeVisible();expect(apiRequest.mock.calls.filter(c=>c[0].startsWith('/customer-payments?'))).toHaveLength(reads);
});
it('closes on Reset, stages direction changes and rejects reversed dates',async()=>{
 render(<PaymentTransactions/>);await screen.findByText('Emma');fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
 const reads=apiRequest.mock.calls.length;fireEvent.click(screen.getByRole('radio',{name:'Shop pays customer',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Reset',exact:true}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));expect(apiRequest.mock.calls.length).toBe(reads);
 fireEvent.change(screen.getByLabelText('From'),{target:{value:'2026-10-20'}});fireEvent.change(screen.getByLabelText('To'),{target:{value:'2026-10-01'}});fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));expect(screen.getByRole('alert')).toHaveTextContent('From date cannot be later than To date.');expect(apiRequest.mock.calls.length).toBe(reads);
 fireEvent.click(screen.getByRole('button',{name:'Close filters',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));expect(screen.getByLabelText('From')).toHaveValue('');
 fireEvent.click(within(screen.getByRole('group',{name:'Payment direction'})).getByRole('radio',{name:'Shop pays customer'}));fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));await waitFor(()=>expect(apiRequest.mock.calls.some(c=>c[0].includes('direction=shop_to_customer'))).toBe(true));
});
it('blocks duplicate saves, retains a failed draft and resumes the source on Cancel',async()=>{
 let reject;apiRequest.mockImplementation((path,options)=>options?.method==='PUT'?new Promise((_r,r)=>{reject=r;}):api(path,options));const navigate=vi.fn();render(<PaymentTransactions pathname="/transactions/payments/6/edit" onNavigate={navigate}/>);
 await screen.findByLabelText('Amount');fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'12000'}});const form=document.querySelector('form');fireEvent.submit(form);fireEvent.submit(form);expect(apiRequest.mock.calls.filter(c=>c[1]?.method==='PUT')).toHaveLength(1);expect(screen.getByRole('button',{name:'Cancel'})).toBeDisabled();expect(screen.getByRole('button',{name:'Back to transactions'})).toBeDisabled();reject(new Error('Save failed'));await screen.findByText('Save failed');expect(screen.getByLabelText('Amount')).toHaveValue(12000);fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(navigate).toHaveBeenCalledWith('/transactions',{back:true});
});
it('saves the real linked account and rejects fractional payments',async()=>{
 const navigate=vi.fn();render(<PaymentTransactions pathname="/transactions/payments/6/edit" onNavigate={navigate}/>);await screen.findByLabelText('Amount');fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'0.5'}});fireEvent.submit(document.querySelector('form'));expect(screen.getByText('Enter a whole amount greater than zero.')).toBeVisible();expect(apiRequest.mock.calls.some(c=>c[1]?.method==='PUT')).toBe(false);
 fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'12000'}});fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/transactions',{replace:true}));const body=JSON.parse(apiRequest.mock.calls.find(c=>c[1]?.method==='PUT')[1].body);expect(body).toMatchObject({customer_id:2,amount:12000,direction:'customer_to_shop'});expect(body).not.toHaveProperty('created_at');
});
it('keeps delete failures inside the confirmation and allows retry',async()=>{
 let fail=true;apiRequest.mockImplementation((path,options)=>{if(options?.method==='DELETE'){if(fail){fail=false;return Promise.reject(new Error('Delete failed'));}return Promise.resolve({deleted:true});}return api(path,options);});const navigate=vi.fn();render(<PaymentTransactions pathname="/transactions/payments/6/edit" onNavigate={navigate}/>);await screen.findByLabelText('Amount');fireEvent.click(screen.getByRole('button',{name:'Delete payment'}));fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete payment',exact:true}));await screen.findByText('Delete failed');expect(screen.getByRole('dialog')).toHaveTextContent('Delete failed');fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete payment',exact:true}));await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/transactions',{replace:true}));
});
it('calculates real rolling days and the previous calendar month',()=>{
 const now=new Date(2026,9,16,12);expect(paymentDateRange('last7',now)).toEqual({start:'2026-10-10',end:'2026-10-16'});expect(paymentDateRange('lastmonth',now)).toEqual({start:'2026-09-01',end:'2026-09-30'});expect(paymentDateRange('all',now)).toEqual({start:'',end:''});
});
it('reassigns a payment through a named account picker while preserving its amount',async()=>{
 apiRequest.mockImplementation((path,options)=>path.startsWith('/customers?')?Promise.resolve({items:[{id:8,name:'Daniel',phone:'09',balance:5000}],total:1}):api(path,options));
 render(<PaymentTransactions pathname="/transactions/payments/6/edit" onNavigate={vi.fn()}/>);await screen.findByLabelText('Amount');fireEvent.click(screen.getByRole('button',{name:'Change account'}));fireEvent.click(await screen.findByRole('button',{name:/Daniel/}));expect(screen.getByLabelText('Amount')).toHaveValue(10000);expect(screen.getByText('Daniel')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(apiRequest.mock.calls.some(c=>c[1]?.method==='PUT')).toBe(true));expect(JSON.parse(apiRequest.mock.calls.find(c=>c[1]?.method==='PUT')[1].body).customer_id).toBe(8);
});
it('keeps Back and Retry usable when an edit record fails to load',async()=>{
 let fail=true;apiRequest.mockImplementation((path,options)=>{if(path==='/customer-payments/6'&&fail)return Promise.reject(new Error('Payment unavailable'));return api(path,options);});render(<PaymentTransactions pathname="/transactions/payments/6/edit" onNavigate={vi.fn()}/>);expect(await screen.findByRole('alert')).toHaveTextContent('Payment unavailable');expect(screen.getByRole('button',{name:'Back to transactions'})).toBeEnabled();fail=false;fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(await screen.findByLabelText('Amount')).toHaveValue(10000);
});
