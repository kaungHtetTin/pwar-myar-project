import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopReport } from './ShopReport';
import { reportComparison, reportPreset, shopReportExportRows } from './shopReportUtils';
import { csvDocument } from '../utils/csvExport';
import { SHOP_REPORT_COLUMNS } from './shopReportUtils';

vi.mock('../api/client',()=>({apiRequest:vi.fn()}));
const report={date_from:'2026-10-01',date_to:'2026-10-15',previous_from:'2026-09-16',previous_to:'2026-09-30',currency:'MMK',currencies:['MMK','USD'],timezone:'Asia/Rangoon',summary:{orders:2,sales:49000,completed_orders:1,refunded:1000,completion_rate:50},previous:{sales:40000,completion_rate:40},trend:[{date:'2026-10-01',sales:49000,orders:1}],top_products:[],buyers:[],outcomes:[],origins:[],fulfillment:[{name:'delivery',orders:2}],segments:[],follow_up:[]};
beforeEach(()=>{vi.clearAllMocks();apiRequest.mockResolvedValue(report);});

it('discards unapplied edits and applies Reset while closing the drawer',async()=>{
  render(<ShopReport onNavigate={vi.fn()} />);await screen.findByRole('heading',{name:'Overview'});
  const reads=apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  fireEvent.change(screen.getByLabelText('From date'),{target:{value:'2026-10-05'}});
  fireEvent.keyDown(window,{key:'Escape'});
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  expect(screen.getByLabelText('From date')).toHaveValue('2026-10-01');
  fireEvent.click(screen.getByRole('button',{name:'Reset',exact:true}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(apiRequest.mock.calls.length).toBeGreaterThan(reads);
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  fireEvent.change(screen.getByLabelText('From date'),{target:{value:'2026-10-05'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply filters',exact:true}));
  await waitFor(()=>expect(apiRequest.mock.calls.at(-1)[0]).toContain('date_from=2026-10-05'));
});

it('rejects reversed and excessive date ranges without requesting',async()=>{
  render(<ShopReport onNavigate={vi.fn()} />);await screen.findByRole('heading',{name:'Overview'});
  const reads=apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  fireEvent.change(screen.getByLabelText('From date'),{target:{value:'2026-10-20'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply filters',exact:true}));
  expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after start date.');
  fireEvent.change(screen.getByLabelText('From date'),{target:{value:'2024-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply filters',exact:true}));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a range of 1 to 366 days.');
  expect(apiRequest).toHaveBeenCalledTimes(reads);
});

it('retains the loaded currency on a failed request and retries the intended scope',async()=>{
  let fail=true;
  apiRequest.mockImplementation(async path=>{if(path.includes('currency=USD')){if(fail)throw new Error('Report temporarily unavailable.');return {...report,currency:'USD'};}return report;});
  render(<ShopReport onNavigate={vi.fn()} />);await screen.findByRole('heading',{name:'Overview'});
  fireEvent.change(screen.getByRole('combobox',{name:'Report currency'}),{target:{value:'USD'}});
  await screen.findByText('Report temporarily unavailable.');
  expect(screen.getByRole('combobox',{name:'Report currency'})).toHaveValue('MMK');
  expect(screen.getAllByText('49,000 MMK').length).toBeGreaterThan(0);
  fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry report'}));
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'Report currency'})).toHaveValue('USD'));
});

it('retains Back and Retry on first-load failure',async()=>{
  apiRequest.mockRejectedValueOnce(new Error('Connection failed.')).mockResolvedValue(report);
  const navigate=vi.fn();render(<ShopReport onNavigate={navigate} />);
  await screen.findByText('Connection failed.');
  fireEvent.click(screen.getByRole('button',{name:'Back',exact:true}));
  expect(navigate).toHaveBeenCalledWith('/shop',{back:true});
  fireEvent.click(screen.getByRole('button',{name:'Retry',exact:true}));
  await screen.findByRole('heading',{name:'Overview'});
});

it('compares percentage points separately from percentage changes without inventing zero baselines',()=>{
  expect(reportComparison(50,40,true)).toMatchObject({change:10,text:'+10 percentage points vs previous period'});
  expect(reportComparison(120,100)).toMatchObject({change:20,text:'+20% vs previous period'});
  expect(reportComparison(10,0).text).toBe('No previous baseline');
  expect(reportComparison(0,0).text).toBe('No change');
  expect(reportPreset(7,'Asia/Rangoon',new Date('2026-10-12T20:00:00Z'))).toEqual({date_from:'2026-10-07',date_to:'2026-10-13'});
});

it('exports the displayed report with currency, count and historical-period context using shared CSV escaping',()=>{
  const rows=shopReportExportRows({...report,top_products:[{name:'=SUM(1)',sales:49000,quantity:2,unit_name:'bag'}]});
  expect(rows.find(r=>r.metric==='sales'&&r.section==='Summary')).toMatchObject({value:49000,unit:'MMK',date_from:'2026-10-01'});
  expect(rows.find(r=>r.metric==='sales'&&r.section==='Previous period')).toMatchObject({value:40000,date_from:'2026-09-16'});
  expect(rows.find(r=>r.section==='Fulfillment')).toMatchObject({item:'delivery',value:2,unit:'count'});
  expect(csvDocument(SHOP_REPORT_COLUMNS,rows)).toContain("'=SUM(1)");
});
