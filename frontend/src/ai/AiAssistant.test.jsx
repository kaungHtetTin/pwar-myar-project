import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AiAssistant, AiAssistantButton } from './AiAssistant';
import { request } from '../api';
vi.mock('../api',()=>({request:vi.fn()}));
vi.mock('../components/LanguageProvider',()=>({useLanguage:()=>({language:'en'})}));
const ready={enabled:true,configured:true,storage_ready:true};
let messages;
beforeEach(()=>{localStorage.clear();messages=[];request.mockReset();request.mockImplementation((path,options)=>{
 if(path==='/ai-assistant/config')return Promise.resolve(ready);
 if(path==='/ai-assistant/conversations')return Promise.resolve({conversation:{id:JSON.parse(options.body).id}});
 if(path.startsWith('/ai-assistant/conversations?'))return Promise.resolve({items:[{id:'old-chat',title:'Previous question'}],has_more:false});
 if(options?.method==='POST'){const payload=JSON.parse(options.body);messages=[{id:1,role:'user',body:payload.body,status:'completed',created_at:'2026-10-25T01:00:00Z'},{id:2,role:'assistant',body:'Open Products to import CSV.',status:'completed',created_at:'2026-10-25T01:00:01Z'}];return Promise.resolve({items:messages});}
 return Promise.resolve({items:messages,has_more:false});
});});
async function mount(){render(<><AiAssistantButton/><AiAssistant scope="1:1"/></>);fireEvent.click(screen.getByRole('button',{name:'PwarMyar AI assistant'}));await waitFor(()=>expect(screen.getByLabelText('AI message')).toBeEnabled());}
it('maximizes the dialog without recreating the chat or losing its draft and attachment', async () => {
 function BothViews() {
  const [page, setPage] = React.useState(false);
  React.useEffect(() => {
   const maximize = () => setPage(true);
   window.addEventListener('mkpos:maximize-ai-assistant', maximize);
   return () => window.removeEventListener('mkpos:maximize-ai-assistant', maximize);
  }, []);
  return <><AiAssistantButton /><AiAssistant scope="1:1" page={page} /></>;
 }
 render(<BothViews />);
 fireEvent.click(screen.getByRole('button', { name: 'PwarMyar AI assistant' }));
 expect(screen.getByRole('dialog', { name: 'PwarMyar AI assistant' })).toBeVisible();
 await waitFor(() => expect(screen.getByLabelText('AI message')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('AI message'), { target: { value: 'Keep my draft' } });
 fireEvent.change(screen.getByLabelText('Attach image or product CSV'), { target: { files: [new File(['Name\nMug'], 'products.csv', { type: 'text/csv' })] } });
 const count = request.mock.calls.length;
 fireEvent.click(screen.getByRole('button', { name: 'Maximize AI chat' }));
 expect(screen.getByRole('region', { name: 'PwarMyar AI assistant' })).toBeVisible();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.getByLabelText('AI message')).toHaveValue('Keep my draft');
 expect(screen.getByText('products.csv')).toBeVisible();
  await screen.findByRole('button', { name: 'Previous question' });
  expect(request).toHaveBeenCalledTimes(count + 1);
  expect(request.mock.calls.filter(([path]) => path === '/ai-assistant/config')).toHaveLength(1);
});
it('keeps conversations beside the chat, selects threads and appends history without duplicates', async () => {
 request.mockImplementation((path) => {
  if (path === '/ai-assistant/config') return Promise.resolve(ready);
  if (path.includes('/conversations?')) return Promise.resolve(path.includes('offset=0')
   ? { items: [{ id: 'first', title: 'First question' }], has_more: true }
   : { items: [{ id: 'first', title: 'First question' }, { id: 'second', title: 'Second question' }], has_more: false });
  return Promise.resolve({ items: [], has_more: false });
 });
 render(<AiAssistant scope="1:1" page />);
 expect(screen.getByRole('region', { name: 'AI conversations' })).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'CSV template' })).not.toBeInTheDocument();
 fireEvent.click(await screen.findByRole('button', { name: 'First question' }));
 await waitFor(() => expect(screen.getByRole('button', { name: 'First question' })).toHaveAttribute('aria-pressed', 'true'));
 expect(screen.getByLabelText('AI message')).toBeVisible();
 fireEvent.click(screen.getByRole('button', { name: 'Load more conversations' }));
 await screen.findByRole('button', { name: 'Second question' });
 expect(screen.getAllByRole('button', { name: 'First question' })).toHaveLength(1);
 expect(screen.queryByRole('button', { name: 'Load more conversations' })).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
 expect(screen.getByRole('button', { name: 'First question' })).toHaveAttribute('aria-pressed', 'false');
});
it('opens a dedicated page immediately and retains its draft while the module is hidden', async () => {
 const view = render(<div hidden={false}><AiAssistant scope="1:1" page /></div>);
 expect(screen.getByRole('region', { name: 'PwarMyar AI assistant' })).toBeInTheDocument();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'Minimize chat' })).not.toBeInTheDocument();
 await waitFor(() => expect(screen.getByLabelText('AI message')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('AI message'), { target: { value: 'Retained page draft' } });
 const count = request.mock.calls.length;
 view.rerender(<div hidden><AiAssistant scope="1:1" page /></div>);
 view.rerender(<div hidden={false}><AiAssistant scope="1:1" page /></div>);
 expect(screen.getByLabelText('AI message')).toHaveValue('Retained page draft');
 expect(request).toHaveBeenCalledTimes(count);
 fireEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
 await screen.findByText('Open Products to import CSV.');
});
it('sends once and retains messages and draft across minimize and close without a reload',async()=>{
 await mount();fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'How do I import?'}});fireEvent.click(screen.getByRole('button',{name:'Send',exact:true}));
 await screen.findByText('Open Products to import CSV.');expect(request.mock.calls.filter(([,o])=>o?.method==='POST'&&String(o.body).includes('client_id'))).toHaveLength(1);
 fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Unsent draft'}});const count=request.mock.calls.length;
 fireEvent.click(screen.getByRole('button',{name:'Minimize chat',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Expand AI chat'}));
 expect(screen.getByLabelText('AI message')).toHaveValue('Unsent draft');fireEvent.click(screen.getByRole('button',{name:'Close AI chat'}));
 fireEvent.click(screen.getByRole('button',{name:'PwarMyar AI assistant'}));expect(screen.getByText('Open Products to import CSV.')).toBeVisible();expect(request).toHaveBeenCalledTimes(count + 1);expect(request).toHaveBeenLastCalledWith('/ai-assistant/config');
});
it('starts a new conversation and opens saved history using the same floating chat',async()=>{
 await mount();fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Draft'}});fireEvent.click(screen.getByRole('button',{name:'New chat'}));expect(screen.getByLabelText('AI message')).toHaveValue('');
 fireEvent.click(screen.getByRole('button',{name:'History',exact:true}));await screen.findByRole('button',{name:'Previous question'});fireEvent.click(screen.getByRole('button',{name:'Previous question'}));
 await waitFor(()=>expect(request).toHaveBeenCalledWith('/ai-assistant/conversations/old-chat/messages?limit=30'));
});
it('shows unavailable configuration and rejects oversized or non-CSV attachments',async()=>{
 request.mockResolvedValueOnce({...ready,configured:false});render(<><AiAssistantButton/><AiAssistant scope="1:1"/></>);fireEvent.click(screen.getByRole('button',{name:'PwarMyar AI assistant'}));
 await screen.findByText('AI assistant is not available yet. Please contact platform support.');expect(screen.getByRole('button',{name:'Send',exact:true})).toBeDisabled();
});

it('shows outgoing and waiting states immediately, guards duplicate sends and animates only new replies', async () => {
 await mount();
 let finishCreate, finishReply;
 request.mockImplementationOnce(() => new Promise(resolve => { finishCreate = resolve; }));
 request.mockImplementationOnce(() => new Promise(resolve => { finishReply = resolve; }));
 fireEvent.change(screen.getByLabelText('AI message'), { target: { value: 'Show my usage' } });
 const form = screen.getByLabelText('AI message').closest('form');
 fireEvent.submit(form); fireEvent.submit(form);
 expect(screen.getByLabelText('Outgoing message')).toHaveTextContent('Show my usage');
 expect(screen.getByText('Starting chat...')).toBeVisible();
 expect(screen.getByLabelText('AI message')).toHaveValue('');
 expect(screen.queryByText('Sending...')).not.toBeInTheDocument();
 expect(screen.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
 await act(async () => finishCreate({ conversation: { id: 'new' } }));
 expect(screen.getByText('Wyne Wyne is preparing a reply...')).toBeVisible();
 fireEvent.click(screen.getByRole('button', { name: 'Minimize chat', exact: true }));
 fireEvent.click(screen.getByRole('button', { name: 'Expand AI chat' }));
 expect(screen.getByLabelText('Outgoing message')).toBeVisible();
 await act(async () => finishReply({ items: [
   { id: 1, role: 'user', body: 'Show my usage', status: 'completed', created_at: '2026-10-25T01:00:00Z' },
   { id: 2, role: 'assistant', body: 'Usage is ready.', status: 'completed', created_at: '2026-10-25T01:00:01Z' },
 ] }));
 expect(screen.queryByLabelText('Outgoing message')).not.toBeInTheDocument();
 expect(screen.queryByText('Wyne Wyne is preparing a reply...')).not.toBeInTheDocument();
 const reply = screen.getByText('Usage is ready.').closest('article');
 expect(reply).toHaveClass('is-arriving');
 fireEvent.animationEnd(reply);
 await waitFor(() => expect(reply).not.toHaveClass('is-arriving'));
 expect(screen.getByText('Show my usage').closest('article')).not.toHaveClass('is-arriving');
 expect(screen.getByLabelText('AI message')).toHaveValue('');
 expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2);
});

it('clears waiting on failure and keeps the original request ID for retry', async () => {
 await mount();
 let rejectReply;
 request.mockResolvedValueOnce({ conversation: { id: 'new' } });
 request.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectReply = reject; }));
 fireEvent.change(screen.getByLabelText('AI message'), { target: { value: 'Retry me' } });
 fireEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
 await screen.findByText('Wyne Wyne is preparing a reply...');
 await act(async () => rejectReply(new Error('Temporary provider error')));
 expect(screen.getByRole('alert')).toHaveTextContent('Temporary provider error');
 expect(screen.queryByLabelText('Outgoing message')).not.toBeInTheDocument();
 expect(screen.getByLabelText('AI message')).toHaveValue('Retry me');
 fireEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
 await screen.findByText('Open Products to import CSV.');
 const sends = request.mock.calls.filter(([path, options]) => path.endsWith('/messages') && options?.method === 'POST');
 expect(sends).toHaveLength(2);
 expect(JSON.parse(sends[0][1].body).client_id).toBe(JSON.parse(sends[1][1].body).client_id);
});

it('waits for the direct HTTP reply without duplicate messages or receipt polling', async()=>{
 await mount();
 let finish;
 request.mockImplementation((path,options)=>{
  if(path==='/ai-assistant/conversations')return Promise.resolve({conversation:{id:'new'}});
  if(path.endsWith('/delivery'))return Promise.resolve({sent:true,seen:true});
  if(options?.method==='POST')return new Promise(resolve=>{finish=resolve;});
  return Promise.resolve({items:[],has_more:false});
 });
 fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Today report'}});
 fireEvent.click(screen.getByRole('button',{name:'Send',exact:true}));
 expect(screen.getByLabelText('AI message')).toHaveValue('');
 expect(screen.getByLabelText('Outgoing message')).toHaveTextContent('Today report');
 await waitFor(()=>expect(finish).toBeTypeOf('function'));
 expect(request.mock.calls.some(([path])=>path.endsWith('/delivery'))).toBe(false);
 expect(screen.getByText('Wyne Wyne is preparing a reply...')).toBeVisible();
 await act(async()=>finish({items:[{id:1,role:'user',body:'Today report',status:'completed',created_at:'2026-10-25T01:00:00Z'},{id:2,role:'assistant',body:'Report ready',status:'completed',created_at:'2026-10-25T01:00:01Z'}]}));
 expect(screen.getAllByText('Today report')).toHaveLength(1);
 expect(screen.getByText('Report ready')).toBeVisible();
});

it('accepts an image-only message and sends the image multipart field once', async () => {
  await mount();
  const previous = request.getMockImplementation();
  request.mockImplementation((path, options) => {
    if (path.endsWith('/messages') && options?.method === 'POST') return Promise.resolve({ items: [{ id: 10, role: 'user', body: '', attachment: { type: 'image', name: 'screen.png' }, status: 'completed', created_at: '2026-10-25T00:00:00Z' }, { id: 11, role: 'assistant', body: 'Image read successfully.', status: 'completed', created_at: '2026-10-25T00:00:01Z' }] });
    return previous(path, options);
  });
  const image = new File(['fixture image'], 'screen.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Attach image or product CSV'), { target: { files: [image] } });
  expect(screen.getByText('screen.png')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
  await screen.findByText('Image read successfully.');
  const calls = request.mock.calls.filter(([path, options]) => path.endsWith('/messages') && options?.method === 'POST');
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
  expect(screen.getByText('Assistant AI', { exact: true })).toBeVisible();
  expect(screen.getByLabelText('AI message')).toHaveAttribute('placeholder', 'Ask Wyne Wyne');
});

it('blocks expired chat, links owner Billing and restores access without losing a draft', async () => {
 let allowed=false;
 request.mockImplementation(path=>Promise.resolve(path==='/ai-assistant/config'?{...ready,subscription_access:{allowed,access_type:'trial',reason:allowed?null:'expired'}}:{items:[],has_more:false}));
 const navigate=vi.fn();render(<AiAssistant page scope="entitlement" role="owner" screens={['billing']} onNavigate={navigate}/>);
 await screen.findByText('Wyne Wyne is available with an active free trial or valid subscription.');
 expect(screen.getByLabelText('AI message')).toBeDisabled();expect(screen.getByLabelText('Attach image or product CSV')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Open Billing to renew'}));expect(navigate).toHaveBeenCalledWith('billing');
 allowed=true;act(()=>window.dispatchEvent(new Event('mkpos:subscription-entitlement')));
 await waitFor(()=>expect(screen.getByLabelText('AI message')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('AI message'),{target:{value:'Retained after expiry'}});
 allowed=false;act(()=>window.dispatchEvent(new Event('mkpos:subscription-entitlement')));
 await waitFor(()=>expect(screen.getByLabelText('AI message')).toBeDisabled());expect(screen.getByLabelText('AI message')).toHaveValue('Retained after expiry');
 expect(request.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
});
