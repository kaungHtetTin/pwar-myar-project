import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAssistantChat } from './useAssistantChat';

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });
const ready = {enabled:true,configured:true,storage_ready:true};
function fixture(initial = []) {
  let rows = initial, complete = false, failure = false, networkFailure = false;
  const api = vi.fn(async (path, options) => {
    if (path === '/ai-assistant/config') return ready;
    if (path === '/ai-assistant/conversations') return {};
    if (options?.method === 'POST') {
      const payload = JSON.parse(options.body);
      rows = [{id:1,client_id:payload.client_id,role:'user',body:payload.body,status:'pending'}];
      return {pending:true,status:'pending',items:rows};
    }
    if (path.endsWith('/delivery')) {
      if (networkFailure) throw Object.assign(new Error('Temporarily offline'), {status:0});
      if (failure) return {status:'failed',pending:false,items:rows.map(row=>({...row,status:'failed'}))};
      if (complete) return {status:'completed',pending:false,items:[{...rows[0],status:'completed'},
        {id:2,role:'assistant',status:'completed',body:'Completed background reply'}],
        actions:{items:[{id:'proposal',status:'pending'}],has_more:false},billing_requests:[{id:'billing-form'}],
        weekly_usage:{remaining:9}};
      return {status:'pending',pending:true,items:rows};
    }
    if (path.includes('/other-chat/')) return {items:[{id:9,role:'assistant',body:'Other conversation',status:'completed'}]};
    return {items:rows,has_more:false};
  });
  return {api,finish:()=>{complete=true;},fail:()=>{failure=true;},offline:value=>{networkFailure=value;}};
}
async function mount(state, saved = false) {
  if (saved) localStorage.setItem('mkpos.ai.conversation:queued-fixture','queued-chat');
  const view = renderHook(()=>useAssistantChat({api:state.api,scope:'queued-fixture',app:'business_mobile'}));
  await act(async()=>{});
  return view;
}
it('accepts queued work immediately, blocks duplicate sends and receives the worker result', async()=>{
  const state = fixture();
  const view = await mount(state);
  act(()=>view.result.current.setDraft('Prepare my report'));
  await act(async()=>{expect(await view.result.current.send()).toBe(true);});
  expect(view.result.current.replyBusy).toBe(true);
  expect(view.result.current.items).toHaveLength(1);
  expect(view.result.current.items[0].status).toBe('pending');
  await act(async()=>{expect(await view.result.current.send()).toBe(false);});
  const posts=state.api.mock.calls.filter(([path,options])=>path.endsWith('/messages') && options?.method==='POST');
  expect(posts).toHaveLength(1);
  expect(posts[0][1].timeoutMs).toBe(30000);
  state.finish();
  await act(async()=>window.dispatchEvent(new Event('mkpos:assistant-delivery-changed')));
  expect(view.result.current.items.at(-1).body).toBe('Completed background reply');
  expect(view.result.current.replyBusy).toBe(false);
  expect(view.result.current.actions.items[0].id).toBe('proposal');
  expect(view.result.current.billingRequests[0].id).toBe('billing-form');
  expect(view.result.current.config.weekly_usage.remaining).toBe(9);
  expect(state.api.mock.calls.filter(([path,options])=>path.endsWith('/messages') && options?.method==='POST')).toHaveLength(1);
  view.unmount();
});
it('resumes a saved pending reply after reload without posting it again and stops polling on unmount', async()=>{
  const state = fixture([{id:1,client_id:'saved-client',role:'user',body:'Saved question',status:'pending'}]);
  const view = await mount(state, true);
  expect(view.result.current.replyBusy).toBe(true);
  state.finish();
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(view.result.current.items).toHaveLength(2);
  expect(state.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  view.unmount();
  const calls = state.api.mock.calls.length;
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
  expect(state.api).toHaveBeenCalledTimes(calls);
});
it('keeps pending work after connectivity errors and wakes when the connection returns', async()=>{
  const state = fixture([{id:1,client_id:'saved-client',role:'user',body:'Saved question',status:'pending'}]);
  state.offline(true);
  const view = await mount(state, true);
  expect(view.result.current.replyBusy).toBe(true);
  expect(view.result.current.error).toBe('');
  state.offline(false); state.finish();
  await act(async()=>{window.dispatchEvent(new Event('online'));});
  expect(view.result.current.items.at(-1).body).toBe('Completed background reply');
  expect(state.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  view.unmount();
});
it('shows a failed saved message without an automatic retry or additional post', async()=>{
  const state = fixture([{id:1,client_id:'saved-client',role:'user',body:'Saved question',status:'pending'}]);
  const view = await mount(state, true);
  state.fail();
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(view.result.current.items[0].status).toBe('failed');
  expect(view.result.current.replyBusy).toBe(false);
  expect(view.result.current.error).toContain('Retry the saved message');
  expect(state.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  view.unmount();
});
it('ignores a delayed receipt after switching conversation and preserves the selected conversation', async()=>{
  const state = fixture([{id:1,client_id:'saved-client',role:'user',body:'Saved question',status:'pending'}]);
  const original = state.api.getMockImplementation();
  let resolve;
  state.api.mockImplementation((path,options)=>path.endsWith('/delivery') ? new Promise(done=>{resolve=done;}) : original(path,options));
  const view = await mount(state, true);
  await act(async()=>{await view.result.current.choose('other-chat');});
  await act(async()=>{resolve({status:'completed',items:[{id:99,role:'assistant',body:'Stale private reply'}]});});
  expect(view.result.current.conversation).toBe('other-chat');
  expect(view.result.current.items.map(row=>row.body)).toEqual(['Other conversation']);
  expect(localStorage.getItem('mkpos.ai.conversation:queued-fixture')).toBe('other-chat');
  view.unmount();
});

it('honors Retry-After across online and visibility events without replaying the saved message', async () => {
  const state = fixture([{id:1,client_id:'saved-client',role:'user',body:'Saved question',status:'pending'}]);
  const original = state.api.getMockImplementation();
  let limited = true;
  state.api.mockImplementation((path, options) => {
    if (limited && path.endsWith('/delivery')) throw Object.assign(new Error('Too Many Attempts.'), {status:429,retryAfterMs:45000});
    return original(path, options);
  });
  const view = await mount(state, true);
  act(() => { view.result.current.setDraft('Next question'); view.result.current.setFile(new File(['receipt'], 'receipt.png', {type:'image/png'})); });
  const calls = () => state.api.mock.calls.filter(([path]) => path.endsWith('/delivery')).length;
  expect(calls()).toBe(1);
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(44999);
  });
  expect(calls()).toBe(1);
  expect(view.result.current.draft).toBe('Next question');
  expect(view.result.current.file.name).toBe('receipt.png');
  limited = false; state.finish();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(calls()).toBe(2);
  expect(view.result.current.items.at(-1).body).toBe('Completed background reply');
  expect(state.api.mock.calls.some(([,options]) => options?.method === 'POST')).toBe(false);
  view.unmount();
});
