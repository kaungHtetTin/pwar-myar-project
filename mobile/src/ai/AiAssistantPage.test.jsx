import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AiAssistantPage } from './AiAssistantPage';
import { apiRequest } from '../api/client';
vi.mock('../api/client',()=>({apiRequest:vi.fn()}));
const localeState=vi.hoisted(()=>({language:'en'}));
vi.mock('../localization/LocaleContext',()=>({useLocale:()=>({language:localeState.language})}));
vi.mock('../utils/csvExport',()=>({saveCsvFile:vi.fn()}));
const session={user:{id:1,role:'owner'},business:{id:1}};
beforeEach(()=>{localeState.language='en';localStorage.clear();apiRequest.mockReset();apiRequest.mockImplementation((path,options)=>{
 if(path==='/ai-assistant/config')return Promise.resolve({enabled:true,configured:true,storage_ready:true});
 if(path==='/ai-assistant/conversations')return Promise.resolve({conversation:{id:JSON.parse(options.body).id}});
 if(path.startsWith('/ai-assistant/conversations?'))return Promise.resolve({items:[{id:'old',title:'Previous chat',updated_at:'2026-10-25 01:00:00'}],has_more:false});
 if(options?.method==='POST')return Promise.resolve({items:[{id:1,role:'user',body:'Help',status:'completed',created_at:'2026-10-25T00:00:00Z'},{id:2,role:'assistant',body:'Use the Products screen.',status:'completed',created_at:'2026-10-25T00:00:01Z'}]});
 return Promise.resolve({items:[],has_more:false});
});});
async function mount(){const back=vi.fn();render(<AiAssistantPage session={session} onBack={back}/>);await waitFor(()=>expect(screen.getByLabelText('AI message')).toBeEnabled());return back;}
it('uses the full-page conversation UI, sends a message and returns via its Back handler',async()=>{
 const back=await mount();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Help'}});fireEvent.click(screen.getByRole('button',{name:'Send AI message'}));
 await screen.findByText('Use the Products screen.');fireEvent.click(screen.getByRole('button',{name:'Back',exact:true}));expect(back).toHaveBeenCalledTimes(1);
 const call=apiRequest.mock.calls.find(([path,o])=>path.endsWith('/messages')&&o?.method==='POST');expect(JSON.parse(call[1].body).app).toBe('business_mobile');
});
it('loads saved history without numbered pagination and starts a fresh draft',async()=>{
 await mount();fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Draft'}});fireEvent.click(screen.getByRole('button',{name:'History',exact:true}));fireEvent.click(screen.getByRole('button',{name:'New chat'}));expect(screen.getByLabelText('AI message')).toHaveValue('');
 fireEvent.click(screen.getByRole('button',{name:'History',exact:true}));await screen.findByRole('button',{name:'Previous chat'});fireEvent.click(screen.getByRole('button',{name:'Previous chat'}));
 await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/ai-assistant/conversations/old/messages?limit=30'));
});
it('opens history from the app bar and preserves the mounted conversation when dismissed', async()=>{
 await mount();
 const trigger=screen.getByRole('button',{name:'History',exact:true});
 expect(trigger.closest('header')).not.toBeNull();
 expect(trigger).toHaveClass('ui-icon-button','ui-button--ghost');
 expect(screen.queryByRole('button',{name:'New chat'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Download CSV template'})).not.toBeInTheDocument();
 const editor=screen.getByLabelText('AI message');
 fireEvent.change(editor,{target:{value:'Retained draft'}});
 const before=apiRequest.mock.calls.filter(([path])=>path.includes('/messages')).length;
 trigger.focus();fireEvent.click(trigger);
 expect(screen.getByRole('dialog',{name:'Conversations'})).toBeInTheDocument();
 expect(trigger).toHaveAttribute('aria-expanded','true');
 const row=await screen.findByRole('button',{name:'Previous chat'});
 expect(row.closest('ul')).toHaveAccessibleName('Saved AI conversations');
 expect(row.querySelector('time')).toHaveTextContent('2026');
 expect(screen.getByRole('button',{name:'New chat'}).closest('dialog')).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Close Conversations'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.getByLabelText('AI message')).toBe(editor);
 expect(editor).toHaveValue('Retained draft');
 expect(trigger).toHaveFocus();
 expect(apiRequest.mock.calls.filter(([path])=>path.includes('/messages'))).toHaveLength(before);
 fireEvent.click(trigger);fireEvent.keyDown(window,{key:'Escape'});
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(trigger);fireEvent.click(screen.getByRole('button',{name:'Dismiss Conversations'}));
 expect(editor).toHaveValue('Retained draft');
});
it('rejects unsupported attachments and allows removing a chosen CSV',async()=>{
 await mount();const picker=screen.getByLabelText('Attach image or product CSV');fireEvent.change(picker,{target:{files:[new File(['bad'],'bad.xlsx')]}});expect(await screen.findByRole('alert')).toHaveTextContent('UTF-8 CSV');
 fireEvent.change(picker,{target:{files:[new File(['Name\nSoap'],'products.csv',{type:'text/csv'})]}});expect(screen.getByText('products.csv')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Remove attachment'}));expect(screen.queryByText('products.csv')).not.toBeInTheDocument();
});

it('shows the outgoing bubble while awaiting the direct HTTP reply without duplicate messages', async()=>{
 await mount();
 let finish, payload;
 apiRequest.mockImplementation((path,options)=>{
  if(path==='/ai-assistant/conversations')return Promise.resolve({conversation:{id:'new'}});
  if(path.endsWith('/delivery'))return Promise.resolve({sent:true,seen:true,message:{id:10,client_id:payload.client_id,body:payload.body,role:'user',status:'pending',created_at:'2026-10-25T01:00:00Z'}});
  if(options?.method==='POST'){payload=JSON.parse(options.body);return new Promise(resolve=>{finish=resolve;});}
  return Promise.resolve({items:[],has_more:false});
 });
 fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Show usage'}});
 fireEvent.click(screen.getByRole('button',{name:'Send AI message'}));
 expect(screen.getByText('Show usage')).toBeVisible();
 expect(screen.getByText('Sending...')).toBeInTheDocument();
 expect(screen.getByLabelText('AI message')).toHaveValue('');
 await waitFor(()=>expect(finish).toBeTypeOf('function'));
 expect(apiRequest.mock.calls.some(([path])=>path.endsWith('/delivery'))).toBe(false);
 expect(screen.queryByText('Your usage report')).not.toBeInTheDocument();
 await act(async()=>finish({items:[{id:10,client_id:payload.client_id,body:'Show usage',role:'user',status:'completed',created_at:'2026-10-25T01:00:00Z'},{id:11,body:'Your usage report',role:'assistant',status:'completed',created_at:'2026-10-25T01:00:01Z'}]}));
 expect(screen.getAllByText('Show usage')).toHaveLength(1);
 expect(screen.getByText('Your usage report')).toBeVisible();
 expect(screen.getByLabelText('Seen')).toBeVisible();
 expect(screen.queryByText('Sending...')).not.toBeInTheDocument();
});

it('restores an unsaved message on failure and retries with its original client ID', async()=>{
 await mount();
 let firstClient, retryClient;
 apiRequest.mockImplementation((path,options)=>{
  if(path==='/ai-assistant/conversations')return Promise.resolve({conversation:{id:'new'}});
  if(options?.method==='POST'){
   const payload=JSON.parse(options.body);
   if(!firstClient){firstClient=payload.client_id;return Promise.reject(new Error('Connection failed'));}
   retryClient=payload.client_id;
   return Promise.resolve({items:[{id:1,client_id:retryClient,body:payload.body,role:'user',status:'completed',created_at:'2026-10-25T01:00:00Z'},{id:2,body:'Reply after retry',role:'assistant',status:'completed',created_at:'2026-10-25T01:00:01Z'}]});
  }
  return Promise.resolve({items:[],has_more:false});
 });
 fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Keep this message'}});
 fireEvent.click(screen.getByRole('button',{name:'Send AI message'}));
 await screen.findByRole('alert');
 await waitFor(()=>expect(screen.getByLabelText('AI message')).toBeEnabled());
 expect(screen.getByLabelText('AI message')).toHaveValue('Keep this message');
 fireEvent.click(screen.getByRole('button',{name:'Send AI message'}));
 await screen.findByText('Reply after retry');
 expect(retryClient).toBe(firstClient);
 expect(screen.getAllByText('Keep this message')).toHaveLength(1);
});

it('keeps saved failures in the message with a compact retry and preserves a separate draft', async()=>{
 await mount();
 let saved, sends=0;
 apiRequest.mockImplementation((path,options)=>{
  if(path==='/ai-assistant/conversations')return Promise.resolve({conversation:{id:'new'}});
  if(options?.method==='POST'){
   const payload=JSON.parse(options.body);sends++;
   if(!saved){saved={id:10,client_id:payload.client_id,body:payload.body,role:'user',status:'failed',created_at:'2026-10-25T01:00:00Z'};return Promise.reject(new Error('AI could not reply. Your message is saved; retry it shortly.'));}
   expect(payload.client_id).toBe(saved.client_id);
   return Promise.resolve({items:[{...saved,status:'completed'},{id:11,body:'Retry completed',role:'assistant',status:'completed',created_at:'2026-10-25T01:00:01Z'}]});
  }
  return Promise.resolve({items:[saved],has_more:false});
 });
 fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Price settings help'}});
 fireEvent.click(screen.getByRole('button',{name:'Send AI message'}));
 await screen.findByText('Reply unavailable');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Retry message'})).toBeEnabled());
 expect(screen.getByLabelText('AI message')).toHaveValue('');
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Refresh chat'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Retry message'})).toHaveTextContent('');
 expect(screen.getByText('Your message is saved.')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Unsent follow-up'}});
 fireEvent.click(screen.getByRole('button',{name:'Retry message'}));
 await screen.findByText('Retry completed');
 expect(screen.getByLabelText('AI message')).toHaveValue('Unsent follow-up');
 expect(screen.getAllByText('Price settings help')).toHaveLength(1);
 expect(sends).toBe(2);
});

it('accepts an image-only message and sends the image multipart field once', async () => {
  await mount();
  const previous = apiRequest.getMockImplementation();
  apiRequest.mockImplementation((path, options) => {
    if (path.endsWith('/messages') && options?.method === 'POST') return Promise.resolve({ items: [{ id: 10, role: 'user', body: '', attachment: { type: 'image', name: 'screen.png' }, status: 'completed', created_at: '2026-10-25T00:00:00Z' }, { id: 11, role: 'assistant', body: 'Image read successfully.', status: 'completed', created_at: '2026-10-25T00:00:01Z' }] });
    return previous(path, options);
  });
  const image = new File(['fixture image'], 'screen.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Attach image or product CSV'), { target: { files: [image] } });
  expect(screen.getByText('screen.png')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Send AI message', exact: true }));
  await screen.findByText('Image read successfully.');
  const calls = apiRequest.mock.calls.filter(([path, options]) => path.endsWith('/messages') && options?.method === 'POST');
  expect(calls).toHaveLength(1);
  expect(calls[0][1].body).toBeInstanceOf(FormData);
  expect(calls[0][1].body.get('image')).toBe(image);
  expect(calls[0][1].body.get('csv')).toBeNull();
});

it('removes an image attachment without clearing the message draft', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI message'), { target: { value: 'Keep my question' } });
  fireEvent.change(screen.getByLabelText('Attach image or product CSV'), { target: { files: [new File(['image'], 'photo.jpg', { type: 'image/jpeg' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
  expect(screen.queryByText('photo.jpg')).not.toBeInTheDocument();
  expect(screen.getByLabelText('AI message')).toHaveValue('Keep my question');
});

it('shows Assistant AI in the header and keeps the existing message prompt', async () => {
  await mount();
  expect(screen.getByRole('heading', { name: 'Assistant AI' })).toBeVisible();
  expect(screen.getByLabelText('AI message')).toHaveAttribute('placeholder', 'Ask Wyne Wyne');
});

it('blocks expired chat, offers owner Billing and restores access after renewal', async () => {
 let allowed=false;const navigate=vi.fn();
 apiRequest.mockImplementation(path=>Promise.resolve(path==='/ai-assistant/config'?{enabled:true,configured:true,storage_ready:true,subscription_access:{allowed,access_type:'trial',reason:allowed?null:'expired'}}:{items:[],has_more:false}));
 render(<AiAssistantPage session={session} screens={['billing']} onNavigate={navigate} onBack={vi.fn()}/>);
 await screen.findByText('Wyne Wyne is available with an active free trial or valid subscription.');
 expect(screen.getByLabelText('AI message')).toBeDisabled();expect(screen.getByLabelText('Attach image or product CSV')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Open Billing to renew'}));expect(navigate).toHaveBeenCalledWith('billing');
 allowed=true;act(()=>window.dispatchEvent(new Event('mkpos:subscription-entitlement')));
 await waitFor(()=>expect(screen.getByLabelText('AI message')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Keep my draft'}});
 allowed=false;act(()=>window.dispatchEvent(new Event('mkpos:subscription-entitlement')));
 await waitFor(()=>expect(screen.getByLabelText('AI message')).toBeDisabled());expect(screen.getByLabelText('AI message')).toHaveValue('Keep my draft');
 expect(apiRequest.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
});

it('switches new AI labels without losing the draft or reloading configuration', async()=>{
 localeState.language='my';
 const view=render(<AiAssistantPage session={session} onBack={()=>{}}/>);
 await waitFor(()=>expect(screen.getByLabelText('AI စာ')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('AI စာ'),{target:{value:'Draft kept across language change'}});
 const configCalls=apiRequest.mock.calls.filter(([path])=>path==='/ai-assistant/config').length;
 localeState.language='en';view.rerender(<AiAssistantPage session={session} onBack={()=>{}}/>);
 await waitFor(()=>expect(screen.getByLabelText('AI message')).toHaveValue('Draft kept across language change'));
 expect(apiRequest.mock.calls.filter(([path])=>path==='/ai-assistant/config')).toHaveLength(configCalls);
});
