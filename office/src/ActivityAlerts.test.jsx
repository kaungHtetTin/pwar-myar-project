import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ActivityAlerts } from './ActivityAlerts';
import { monitorActivity } from './activityRealtime';
vi.mock('./activityRealtime', () => ({ monitorActivity: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
it('queues private Office events, opens the right review once and dismisses without mutation', () => {
  let receive;const stop=vi.fn();monitorActivity.mockImplementation((api,scope,callback,base)=>{expect(base).toBe('/office/activity-alerts');receive=callback;return stop;});
  const open=vi.fn(),activity=vi.fn();const view=render(<><input aria-label="Office search" /><ActivityAlerts scope="8" onOpen={open} onActivity={activity} /></>);
  const input=screen.getByRole('textbox');input.focus();
  const report={id:1,title:'New shop report',message:'Demo shop',target:'shop-report',entity_id:9};
  act(()=>receive([report,{id:2,title:'New subscription request',message:'Another shop',target:'subscription-request',entity_id:11}]));
  expect(input).toHaveFocus();expect(activity).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Review report'}));expect(open).toHaveBeenCalledExactlyOnceWith(report);
  expect(screen.getByRole('button',{name:'Review request'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Dismiss activity notification'}));expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(open).toHaveBeenCalledOnce();
  view.unmount();expect(stop).toHaveBeenCalledOnce();
});

it('opens new top-ups and refreshes silent review events without showing another toast', () => {
  let receive; monitorActivity.mockImplementation((_api, _scope, callback) => { receive = callback; return vi.fn(); });
  const open = vi.fn(), activity = vi.fn(); render(<ActivityAlerts scope="8" onOpen={open} onActivity={activity} />);
  const topup = { id: 41, title: 'New Sales AI top-up request', message: 'Demo shop · 1000 MMK', target: 'sales-ai-topup', entity_id: 7 };
  act(() => receive([topup]));
  fireEvent.click(screen.getByRole('button', { name: 'Review request' }));
  expect(open).toHaveBeenCalledExactlyOnceWith(topup);
  act(() => receive([{ ...topup, id: 42, silent: true, title: 'Sales AI top-up approved' }]));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(activity).toHaveBeenCalledTimes(2);
});
