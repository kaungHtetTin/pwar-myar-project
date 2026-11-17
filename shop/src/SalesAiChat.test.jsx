import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShopChatConversation } from './ShopChatConversation';
import { LocaleContext } from './i18n';
afterEach(cleanup);
const realtime = vi.hoisted(() => ({ refresh: null }));
vi.mock('./chatRealtime', () => ({ connectShopChat: (_config, _channel, _auth, refresh) => { realtime.refresh = refresh; return () => {}; } }));
it('uses the shop timezone for message labels and keeps an unambiguous UTC datetime', async () => {
  const api = vi.fn(async () => ({ items: [{id: 1, sender: 'owner', body: 'Midnight reply', created_at: '2026-10-28 17:45:00'}],
    has_more: false, thread: {timezone: 'Asia/Tokyo'} }));
  render(<ShopChatConversation uuid="time-fixture" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="customer" />);
  const message = await screen.findByText('Midnight reply');
  const time = message.closest('article').querySelector('time');
  expect(time).toHaveAttribute('datetime', '2026-10-28T17:45:00.000Z');
  expect(time.textContent).toMatch(/(?:02|2):45/);
  expect(time).toHaveAttribute('title', expect.stringContaining('29'));
});
function TelegramMenuFixture({ api }) {
  const [host, setHost] = React.useState(null);
  return <section className="customer-chat-page"><header><details><summary aria-label="Conversation actions">Actions</summary><div ref={setHost} /></details></header><ShopChatConversation uuid="linked" headerActionsHost={host} apiRequest={api} basePath="/ecommerce/chat" authPath="/auth" selfSender="customer" /></section>;
}
it('issues an optional Telegram link without losing a draft or reloading chat history', async () => {
  const url = `https://t.me/fixture_bot?start=link_${'a'.repeat(40)}`;
  const api = vi.fn(async path => path.endsWith('/telegram-link') ? { url } : { items: [], has_more: false, thread: { sales_ai: { telegram_bot: 'fixture_bot' } } });
  render(<TelegramMenuFixture api={api} />);
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Keep my message' } });
  expect(screen.queryByText('Linking is optional. Guest checkout also works without an account.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Conversation actions'));
  const action = await screen.findByRole('button', { name: 'Link my Telegram account' });
  expect(action.closest('header')).not.toBeNull();
  fireEvent.click(action);
  const link = await screen.findByRole('link', { name: 'Open Telegram to link · expires in 10 minutes' });
  expect(link).toHaveAttribute('href', url);
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  fireEvent.click(link);
  expect(link.closest('details')).not.toHaveAttribute('open');
  expect(screen.getByLabelText('Message')).toHaveValue('Keep my message');
  expect(api).toHaveBeenCalledTimes(2);
  expect(api).toHaveBeenCalledWith('/ecommerce/chat/linked/telegram-link', { method: 'POST', body: '{}' });
});
it('localizes AI typing and human handover controls while leaving message text and agent names unchanged', async () => {
  const api = vi.fn(async () => ({ items: [{ id: 1, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'Products', created_at: '2026-10-27T10:00:00Z' }], has_more: false, thread: { sales_ai: { enabled: true, name: 'Mia', mode: 'ai', responding: true } } }));
  render(<LocaleContext.Provider value="my"><ShopChatConversation uuid="typing-locale" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="customer" /></LocaleContext.Provider>);
  await screen.findByText('Products');
  expect(screen.getByRole('button', { name: 'ဝန်ထမ်းနှင့် ပြောမည်' })).toBeVisible();
  expect(screen.getByRole('status', { name: 'AI က ပြန်စာ ပြင်ဆင်နေသည်' })).toBeVisible();
  expect(screen.getAllByText('Mia · AI', { selector: 'small' })).toHaveLength(2);
  expect(screen.getByText('Products')).toBeVisible();
});

it('sends the interface locale with text and image-only messages without resetting the conversation', async () => {
  const api = vi.fn(async (_path, options) => options?.method === 'POST'
    ? { message: { id: 2, sender: 'customer', body: 'Saved', created_at: '2026-10-27T10:00:00Z' }, thread: {} }
    : { items: [], has_more: false, thread: {} });
  const view = render(<LocaleContext.Provider value="en"><ShopChatConversation uuid="locale" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="customer" /></LocaleContext.Provider>);
  await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep my draft' } });
  view.rerender(<LocaleContext.Provider value="my"><ShopChatConversation uuid="locale" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="customer" /></LocaleContext.Provider>);
  expect(screen.getByRole('textbox')).toHaveValue('Keep my draft');
  expect(api.mock.calls.filter(([, options]) => !options)).toHaveLength(1);
  fireEvent.submit(screen.getByRole('textbox').closest('form'));
  await waitFor(() => expect(api.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true));
  expect(JSON.parse(api.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)).toMatchObject({ language: 'my', body: 'Keep my draft' });
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['fixture'], 'receipt.png', { type: 'image/png' })] } });
  fireEvent.submit(screen.getByRole('textbox').closest('form'));
  await waitFor(() => expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2));
  const image = api.mock.calls.filter(([, options]) => options?.method === 'POST')[1][1].body;
  expect(image).toBeInstanceOf(FormData);
  expect(image.get('language')).toBe('my');
  expect(image.get('image').name).toBe('receipt.png');
});
it('identifies an AI response and requests a person without losing the customer draft or conversation', async () => {
  const ai = { enabled: true, name: 'Mia', mode: 'ai', version: 1, responding: false };
  const api = vi.fn(async path => path.endsWith('/handoff') ? { thread: { sales_ai: { ...ai, mode: 'waiting_owner', version: 2 } } } : { items: [{ id: 1, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'How can I help?', created_at: '2026-10-25T10:00:00Z' }], has_more: false, thread: { sales_ai: ai } });
  render(<ShopChatConversation uuid="fixture" apiRequest={api} basePath="/ecommerce/chat" authPath="/auth" selfSender="customer" />);
  await screen.findByText('Mia · AI', { selector: 'small' });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Keep this draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Talk to a person' }));
  await waitFor(() => expect(screen.getByText('Waiting for a person')).toBeInTheDocument());
  expect(screen.getByLabelText('Message')).toHaveValue('Keep this draft');
  expect(screen.getByText('How can I help?')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Talk to a person' })).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/ecommerce/chat/fixture/handoff', { method: 'POST', body: '{}' });
});

it('animates each new send and reply, shows AI typing, and keeps existing history still', async () => {
  const ai = { enabled: true, name: 'Mia', mode: 'ai', version: 1, responding: false };
  const message = (id, sender, body) => ({ id, sender, body, is_ai: sender === 'owner', ai_name: 'Mia', created_at: '2026-10-25T10:00:00Z' });
  let latest = 1, responding = false;
  const api = vi.fn(async (_path, options) => {
    if (options?.method === 'POST') { latest += 1; responding = true; return { message: message(latest, 'customer', JSON.parse(options.body).body), thread: { sales_ai: { ...ai, responding } } }; }
    return { items: [message(latest, 'owner', latest === 1 ? 'Welcome' : `Reply ${latest}`)], thread: { sales_ai: { ...ai, responding } }, has_more: false };
  });
  render(<ShopChatConversation uuid="cycle" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="customer" />);
  expect((await screen.findByText('Welcome')).closest('article')).not.toHaveClass('is-entering');
  for (const input of ['First question', 'Second question']) {
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: input } });
    fireEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
    expect((await screen.findByText(input, { selector: 'p' })).closest('article')).toHaveClass('is-entering');
    expect(screen.getByRole('status', { name: 'AI is preparing a reply' })).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toHaveValue('');
    latest += 1; responding = false;
    await act(async () => { await realtime.refresh(); });
    expect((await screen.findByText(`Reply ${latest}`)).closest('article')).toHaveClass('is-entering');
    expect(screen.queryByRole('status', { name: 'AI is preparing a reply' })).not.toBeInTheDocument();
  }
  expect(screen.getByText('Welcome').closest('article')).not.toHaveClass('is-entering');
  expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2);
});

it('loads verified form activity immediately, shows AI preparing and receives the follow-up without losing drafts', async () => {
  let submitted = false, replied = false;
  const ai = { enabled: true, name: 'Mia', mode: 'ai', version: 1 };
  const action = { id: 'cart-action', kind: 'cart', status: 'pending', revision: 1, preview_hash: 'a'.repeat(64), expires_at: '2099-01-01T00:00:00Z', values: { items: [{ product_id: 1, quantity: 2 }] }, preview: { ready: true, items: [{ product_id: 1, name: 'Soap', quantity: 2, unit_price: 100, unit_name: 'Unit' }], subtotal: 200, currency: 'MMK' } };
  const api = vi.fn(async (path) => {
    if (path.includes('/sales-actions/')) {
      if (path.endsWith('/confirm')) { submitted = true; return { ...action, status: 'completed', result: { cart_saved: true } }; }
      return action;
    }
    const items = [{ id: 1, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'Review your cart.', created_at: '2026-10-26T10:00:00Z', sales_actions: [{ id: action.id, kind: 'cart', status: submitted ? 'completed' : 'pending' }] }];
    if (submitted) items.push({ id: 2, sender: 'customer', body: 'Form activity: cart submitted successfully.', action_event: { outcome: 'completed' }, created_at: '2026-10-26T10:01:00Z' });
    if (replied) items.push({ id: 3, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'Your cart is saved. When ready, ask me to prepare checkout.', created_at: '2026-10-26T10:02:00Z' });
    return { items, has_more: false, thread: { sales_ai: { ...ai, responding: submitted && !replied } } };
  });
  render(<ShopChatConversation uuid="form-result" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="customer" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Review', exact: true }));
  await screen.findByRole('table', { name: 'Review products' });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Keep my next question' } });
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Apply cart' }));
  await screen.findByText('Form activity: cart submitted successfully.');
  expect(screen.getByText('Form activity', { selector: 'small' })).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'AI is preparing a reply' })).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/chat/form-result/messages?after_id=1');
  replied = true; await act(async () => { await realtime.refresh(); });
  await screen.findByText('Your cart is saved. When ready, ask me to prepare checkout.');
  expect(screen.getByLabelText('Message')).toHaveValue('Keep my next question');
  expect(screen.queryByRole('status', { name: 'AI is preparing a reply' })).not.toBeInTheDocument();
  expect(api.mock.calls.filter(([path]) => path.endsWith('/confirm'))).toHaveLength(1);
});

it('keeps Telegram link failures inside the menu and permits a deliberate retry without losing the draft', async () => {
  let attempts = 0;
  const api = vi.fn(async path => {
    if (path.endsWith('/telegram-link')) {
      if (++attempts === 1) throw Object.assign(new Error('Please wait before trying again.'), {status:429});
      return {url:`https://t.me/fixture_bot?start=link_${'b'.repeat(40)}`};
    }
    return {items:[],has_more:false,thread:{sales_ai:{telegram_bot:'fixture_bot'}}};
  });
  render(<TelegramMenuFixture api={api} />);
  fireEvent.change(screen.getByLabelText('Message'), {target:{value:'Keep this draft'}});
  fireEvent.click(screen.getByLabelText('Conversation actions'));
  fireEvent.click(await screen.findByRole('button', {name:'Link my Telegram account'}));
  const error = await screen.findByRole('alert');
  expect(error.closest('header')).not.toBeNull();
  expect(screen.getByLabelText('Message')).toHaveValue('Keep this draft');
  expect(attempts).toBe(1);
  fireEvent.click(screen.getByRole('button', {name:'Link my Telegram account'}));
  await screen.findByRole('link', {name:'Open Telegram to link · expires in 10 minutes'});
  expect(attempts).toBe(2);
  expect(api.mock.calls.filter(([path])=>path.endsWith('/messages'))).toHaveLength(1);
});
