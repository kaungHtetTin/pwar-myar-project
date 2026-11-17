import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ShopChatConversation } from './ShopChatConversation';
import { connectShopChat } from '../shopChatRealtime';

vi.mock('../shopChatRealtime', () => ({ connectShopChat: vi.fn(() => () => {}) }));
const message = (id) => ({ id, sender: 'customer', body: `Message ${id}`, created_at: '2026-10-06 10:00:00' });
it('reflects AI start/finish socket refreshes without waiting for a new message and retains the draft', async () => {
  let responding = false;
  const api = vi.fn(async path => ({ items: path.includes('?') ? [] : [message(1)], thread: { sales_ai: { enabled: true, name: 'Kaung Kaung', mode: 'ai', version: 1, responding } }, has_more: false }));
  render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  await screen.findByText('Message 1');
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Retain draft' } });
  responding = true;
  await act(async () => connectShopChat.mock.calls.at(-1)[3]());
  expect(screen.getByRole('status', { name: 'AI is preparing a reply' })).toHaveTextContent('Kaung Kaung');
  responding = false;
  await act(async () => connectShopChat.mock.calls.at(-1)[3]());
  expect(screen.queryByRole('status', { name: 'AI is preparing a reply' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('Retain draft');
  expect(screen.getAllByText('Message 1')).toHaveLength(1);
});
it('labels AI replies and lets the owner take over without losing the message draft', async () => {
  const ai = { enabled: true, name: 'Mia', mode: 'ai', version: 1, responding: true };
  const api = vi.fn(async (path) => path.endsWith('/handoff') ? { thread: { sales_ai: { ...ai, mode: 'human', version: 2 } } } : { thread: { sales_ai: ai }, items: [{ ...message(1), sender: 'owner', is_ai: true, ai_name: 'Mia' }], has_more: false });
  render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  await screen.findByText('Mia · AI', { selector: 'small' });
  expect(screen.getByRole('status', { name: 'AI is preparing a reply' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'I can help' } });
  fireEvent.click(screen.getByRole('switch', { name: 'AI replies', checked: true }));
  await screen.findByRole('switch', { name: 'AI replies', checked: false });
  expect(screen.queryByRole('status', { name: 'AI is preparing a reply' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('I can help');
  expect(api).toHaveBeenCalledWith('/chat/thread/handoff', { method: 'POST', body: JSON.stringify({ mode: 'human', version: 1 }) });
});
it('pauses polling for a retained hidden conversation and keeps its history when reopened', async () => {
  vi.useFakeTimers();
  const api = vi.fn(async () => ({ items: [message(1)], has_more: false }));
  let view;
  const conversation = <ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />;
  try {
    await act(async () => { view = render(<div>{conversation}</div>); });
    const row = screen.getByText('Message 1');
    expect(api).toHaveBeenCalledTimes(1);
    view.rerender(<div hidden>{conversation}</div>);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(api).toHaveBeenCalledTimes(1);
    view.rerender(<div>{conversation}</div>);
    expect(row).toBeVisible();
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(api).toHaveBeenCalledTimes(2);
  } finally { view?.unmount(); vi.useRealTimers(); }
});

it('sends an image-only message as multipart data and reuses the message key after an upload failure', async () => {
  const OriginalURL = URL;
  vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = () => 'blob:preview'; static revokeObjectURL = () => {}; });
  const attempts = []; let failed = false;
  const api = vi.fn(async (path, options) => {
    if (options?.method === 'POST') {
      attempts.push(options.body);
      if (!failed) { failed = true; throw new Error('Upload interrupted'); }
      return { message: { ...message(1), sender: 'owner', body: '' } };
    }
    return { items: [], has_more: false };
  });
  try {
    render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
    await screen.findByText('No messages yet. Start the conversation.');
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Image file'), { target: { files: [file] } });
    await screen.findByText('photo.png');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('alert');
    expect(screen.getByText('photo.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.queryByText('photo.png')).not.toBeInTheDocument());
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toBeInstanceOf(FormData);
    expect(attempts[0].get('image')).toBe(file);
    expect(attempts[0].get('client_id')).toBe(attempts[1].get('client_id'));
  } finally { vi.unstubAllGlobals(); }
});

it('uses the customer read pointer for seen status and does not mark a hidden tab as read', async () => {
  const onRead = vi.fn();
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  const api = vi.fn().mockResolvedValue({ thread: { customer_read_id: 2 }, items: [1, 2, 3].map((id) => ({ ...message(id), sender: 'owner' })), has_more: false });
  try {
    render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" onRead={onRead} />);
    await screen.findByText('Message 3');
    expect(screen.getAllByLabelText('Seen')).toHaveLength(2);
    expect(screen.getAllByLabelText('Sent')).toHaveLength(1);
    expect(onRead).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    fireEvent(document, new Event('visibilitychange'));
    expect(onRead).toHaveBeenCalledWith(3);
  } finally { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); }
});

it('loads older history on upward scrolling and preserves the visible position after prepending', async () => {
  let complete;
  const api = vi.fn((path) => path.includes('before_id=51') ? new Promise((resolve) => { complete = resolve; })
    : Promise.resolve({ items: [51, 52, 53, 54].map(message), has_more: true }));
  render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  await screen.findByText('Message 51');
  const viewport = screen.getByLabelText('Conversation messages');
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, get: () => viewport.querySelectorAll('article').length * 80 });
  Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 100 });
  viewport.scrollTop = 20;
  fireEvent.scroll(viewport);
  fireEvent.scroll(viewport);
  await waitFor(() => expect(api).toHaveBeenCalledWith('/chat/thread/messages?before_id=51'));
  expect(screen.getByRole('progressbar', { name: 'Loading older messages' })).toBeInTheDocument();
  expect(api.mock.calls.filter(([path]) => path.includes('before_id')).length).toBe(1);
  expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument();
  complete({ items: [1, 2, 3].map(message), has_more: false });
  await screen.findByText('Message 1');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(viewport.scrollTop).toBe(260);
  expect([...viewport.querySelectorAll('article p')].map((node) => node.textContent)).toEqual([1, 2, 3, 51, 52, 53, 54].map((id) => `Message ${id}`));
});

it('keeps loaded messages after a history failure and retries the same older page', async () => {
  let attempts = 0;
  const api = vi.fn((path) => path.includes('before_id=51') ? attempts++ === 0 ? Promise.reject(new Error('History unavailable'))
    : Promise.resolve({ items: [message(50)], has_more: false })
    : Promise.resolve({ items: [message(51)], has_more: true }));
  render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  await screen.findByText('Message 51');
  fireEvent.scroll(screen.getByLabelText('Conversation messages'));
  await screen.findByRole('alert');
  expect(screen.getByText('Message 51')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Message 50');
  expect(api.mock.calls.filter(([path]) => path.endsWith('before_id=51'))).toHaveLength(2);
});


it('updates Telegram delivery without new messages and never invents a seen receipt', async () => {
  let status = 'pending', stale = false;
  const outgoing = {id:7,sender:'owner',body:'Shared Telegram product',created_at:'2026-10-27T10:00:00Z',telegram_delivery:{status,can_retry:false}};
  const api=vi.fn(async path=>({thread:{sales_ai_channel:'telegram',customer_read_id:999},
    items:path.includes('after_id')?(stale?[{...outgoing,telegram_delivery:{status}}]:[]):[outgoing],delivery_updates:path.includes('delivery_ids')?[{id:7,telegram_delivery:{status,can_retry:false}}]:[],has_more:false}));
  render(<ShopChatConversation uuid="telegram-thread" channel="telegram" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  await screen.findByLabelText('Queued for Telegram');
  fireEvent.change(screen.getByLabelText('Message'),{target:{value:'Retain draft'}});
  status='sending'; await act(async()=>connectShopChat.mock.calls.at(-1)[3]());
  expect(screen.getByLabelText('Sending to Telegram')).toBeVisible();
  status='sent'; await act(async()=>connectShopChat.mock.calls.at(-1)[3]());
  expect(screen.getByLabelText('Sent to Telegram')).toBeVisible();
  status='pending'; stale=true; await act(async()=>connectShopChat.mock.calls.at(-1)[3]());
  expect(screen.getByLabelText('Sent to Telegram')).toBeVisible();
  expect(screen.queryByLabelText('Seen')).not.toBeInTheDocument();
  expect(screen.getAllByText('Shared Telegram product')).toHaveLength(1);
  expect(screen.getByLabelText('Message')).toHaveValue('Retain draft');
  expect(api.mock.calls.some(([path])=>path.includes('delivery_ids=7'))).toBe(true);
});

it('retries only a failed Telegram delivery once and keeps the composer draft', async()=>{
  let finish;
  const row={id:9,sender:'owner',body:'Retry my Telegram message',created_at:'2026-10-27T10:00:00Z',telegram_delivery:{status:'failed',can_retry:true}};
  const api=vi.fn((path,options)=>options?.method==='POST'?new Promise(resolve=>{finish=resolve;}):Promise.resolve({thread:{sales_ai_channel:'telegram'},items:[row],has_more:false}));
  render(<ShopChatConversation uuid="telegram-thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  const retry=await screen.findByRole('button',{name:'Retry Telegram message 9'});
  fireEvent.change(screen.getByLabelText('Message'),{target:{value:'Unsent follow-up'}});
  fireEvent.click(retry); fireEvent.click(retry);
  expect(api.mock.calls.filter(([,options])=>options?.method==='POST')).toHaveLength(1);
  await act(async()=>finish({message:{...row,telegram_delivery:{status:'pending',can_retry:false}}}));
  expect(screen.getByLabelText('Queued for Telegram')).toBeVisible();
  expect(screen.getByLabelText('Message')).toHaveValue('Unsent follow-up');
});
