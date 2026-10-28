import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { monitorCustomerOrders } from './customerOrderRealtime';
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
afterEach(() => { localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('drains each status event once and resumes the persisted customer cursor after reconnect/remount', async () => {
  vi.useFakeTimers(); localStorage.clear();
  const handlers = {};
  const socket = { on: vi.fn((event,handler) => { handlers[event]=handler; }), connect: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() };
  io.mockReturnValue(socket);
  let responses = [{ cursor: 10, items: [] }, { cursor: 11, items: [{ id: 11, event: 'accepted' }], has_more: true }, { cursor: 12, items: [{ id: 12, event: 'packing' }] }];
  const api = vi.fn(async (path, options) => path.endsWith('/config') ? { realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080, channel: 'private-shop.orders.customer.1' } : path.endsWith('/auth') ? { token: 'ticket' } : responses.shift() || { cursor: 12, items: [{ id: 12, event: 'packing' }] });
  const receive = vi.fn(); let stop = monitorCustomerOrders(api, { customerId: 1 }, receive);
  await vi.advanceTimersByTimeAsync(0); expect(receive).not.toHaveBeenCalled();
  const auth = vi.fn(); await io.mock.calls.at(-1)[1].auth(auth); await vi.advanceTimersByTimeAsync(0);
  expect(auth).toHaveBeenCalledWith({ token: 'ticket' });
  await handlers['order.updated']({ event_id: 11 }); await vi.advanceTimersByTimeAsync(150);
  expect(receive.mock.calls).toEqual([[[{ id: 11, event: 'accepted' }], { catchUp: false, recoveryId: expect.any(String) }], [[{ id: 12, event: 'packing' }], { catchUp: false, recoveryId: expect.any(String) }]]);
  expect(JSON.parse(api.mock.calls.filter(([path]) => path.endsWith('/feed')).at(-1)[1].body)).toEqual({ after_id: 11 });
  await handlers.connect(); await vi.advanceTimersByTimeAsync(150); expect(receive).toHaveBeenCalledTimes(2);
  handlers.disconnect('io server disconnect'); expect(socket.connect).toHaveBeenCalledOnce();
  stop(); expect(socket.disconnect).toHaveBeenCalled();
  stop = monitorCustomerOrders(api, { customerId: 1 }, receive);
  await vi.advanceTimersByTimeAsync(0); expect(receive).toHaveBeenCalledTimes(2);
  expect(JSON.parse(api.mock.calls.filter(([path]) => path.endsWith('/feed')).at(-1)[1].body)).toEqual({ after_id: 12 });
  stop();
});
it('uses private guest credentials only in POST bodies, recovers by polling and stops after access is revoked', async () => {
  vi.useFakeTimers(); localStorage.clear();
  let revoked=false, cursor=0;
  const api=vi.fn(async(path,options)=>{
    expect(path).not.toContain('secret'); expect(options.customerAuth).toBe(false);
    expect(JSON.parse(options.body)).toMatchObject({reference:'O-PRIVATE',credential:'secret'});
    if(revoked) throw {status:404};
    return path.endsWith('/config') ? {realtime_enabled:false} : {cursor:cursor,items:cursor ? [{id:cursor,event:'completed'}] : []};
  });
  const receive=vi.fn();const stop=monitorCustomerOrders(api,{reference:'O-PRIVATE',credential:'secret'},receive);
  await vi.advanceTimersByTimeAsync(0);cursor=1;await vi.advanceTimersByTimeAsync(15000);
  expect(receive).toHaveBeenCalledWith([{id:1,event:'completed'}], expect.objectContaining({catchUp:false}));
  revoked=true;await vi.advanceTimersByTimeAsync(15000);expect(receive).toHaveBeenLastCalledWith([]);
  const count=api.mock.calls.length;await vi.advanceTimersByTimeAsync(30000);expect(api).toHaveBeenCalledTimes(count);stop();
});

it('labels every offline recovery page as catch-up before returning to live delivery', async () => {
  vi.useFakeTimers(); localStorage.clear();
  let queue = [{ cursor: 0, items: [] }], cursor = 0;
  const api = vi.fn(async path => {
    if (path.endsWith('/config')) return { realtime_enabled: false };
    const data = queue.shift() || { cursor, items: [] };
    cursor = data.cursor; return data;
  });
  const receive = vi.fn();
  const stop = monitorCustomerOrders(api, { customerId: 6 }, receive);
  await vi.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new Event('offline'));
  queue = [1, 2, 3, 4].map(id => ({ cursor: id, items: [{ id }], has_more: id < 4 }));
  window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(15000);
  expect(receive).toHaveBeenCalledTimes(4);
  const recoveryId = receive.mock.calls[0][1].recoveryId;
  for (const [, delivery] of receive.mock.calls) expect(delivery).toEqual({ catchUp: true, recoveryId });
  queue = [{ cursor: 5, items: [{ id: 5 }] }];
  await vi.advanceTimersByTimeAsync(15000);
  expect(receive.mock.calls.at(-1)[1].catchUp).toBe(false);
  stop();
});
