import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const thread = { uuid: 'fixture-thread', shop_name: 'Demo Shop', slug: 'demo' };
const product = { id: 1, store_slug: 'demo', store_name: 'Demo Shop', name: 'Rice', price: 1000, currency: 'K', unit_name: 'Bag', available_quantity: 20, rating: { count: 0 } };
const store = { slug: 'demo', display_name: 'Demo Shop', accepting_orders: true, categories: [], contacts: [], payment_methods: [], delivery_zones: [], rating: { count: 0 } };
const order = { reference: 'ORDER-1', store_slug: 'demo', store_name: 'Demo Shop', status: 'pending', payment_status: 'unpaid', tracking_credential: 'fixture-secret', currency: 'K', items: [{ product_id: 1, name: 'Rice', quantity: 1, unit_name: 'Bag', line_total: 1000 }], total: 1000, subtotal: 1000, discount: 0, delivery_fee: 0, payment_method: { type: 'cash', instructions: 'Pay on collection' }, payment_reviews: [], customer_requests: [] };
await mkdir('test-artifacts/shop-chat-page', { recursive: true });
try {
 for (const source of ['shop', 'product', 'order']) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const calls = [];
  await page.addInitScript(() => { localStorage.setItem('mkpos.shop.customerToken', 'fixture-token'); sessionStorage.setItem('mkpos.shop.tracking', JSON.stringify({ reference: 'ORDER-1' })); sessionStorage.setItem('mkpos.shop.tracking.customer', '42'); });
  await page.route('**/ecommerce/**', route => {
   const path = new URL(route.request().url()).pathname.split('/ecommerce')[1]; calls.push(path);
   let data = { items: [], has_more: false, unread_count: 0 };
   if (path === '/customer/me') data = { customer: { id: 42, name: 'Buyer' } };
   if (path === '/stores/demo') data = store;
   if (path === '/stores/demo/products/1') data = product;
   if (path === '/stores/demo/products') data = { items: [product], has_more: false };
   if (path === '/customer/orders/ORDER-1') data = order;
   if (path === '/stores/demo/chat') { assert.equal(route.request().headers().authorization, 'Bearer fixture-token'); data = { thread }; }
   if (path === '/chat/fixture-thread') data = { thread };
   if (path === '/chat/config') data = { enabled: true, realtime_enabled: false };
   if (path === '/chat/fixture-thread/messages') data = { items: [], has_more: false, thread: { owner_read_id: 0, owner_active: false } };
   route.fulfill({ json: data });
  });
  const route = source === 'shop' ? '/store/demo' : source === 'product' ? '/store/demo/products/1' : '/orders/track';
  await page.goto(`http://127.0.0.1:5177/#${route}`);
  const surface = page.locator(source === 'shop' ? '.shop-detail-page:visible' : source === 'product' ? '.product-detail:visible' : '.order-detail-page:visible');
  const link = page.getByRole('link', { name: 'Chat with shop', exact: true });
  await link.waitFor();
  if (source === 'shop') await page.getByRole('textbox', { name: 'Search', exact: true }).fill('Retain this search');
  const sourceNode = await surface.elementHandle();
  const loads = () => calls.filter(path => source === 'order' ? path === '/customer/orders/ORDER-1' : source === 'product' ? path === '/stores/demo/products/1' : path === '/stores/demo/products').length;
  const before = loads();
  await link.click();
  try { await page.waitForURL('**/#/chats/fixture-thread', { timeout: 8000 }); } catch (error) { console.log('Chat debug:', calls, await page.locator('main').innerText()); throw error; }
  const message = page.getByRole('textbox', { name: 'Message', exact: true }); await message.fill('Keep my draft');
  assert.equal(await page.locator('.customer-chat-dialog').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `test-artifacts/shop-chat-page/from-${source}.png` });
  await page.getByRole('button', { name: 'Back to chats', exact: true }).click();
  await page.waitForURL(`**/#${route}`); await link.waitFor();
  assert.equal(await sourceNode.evaluate(node => node.isConnected), true);
  assert.equal(loads(), before);
  if (source === 'shop') assert.equal(await page.getByRole('textbox', { name: 'Search', exact: true }).inputValue(), 'Retain this search');
  await page.goForward(); await message.waitFor(); assert.equal(await message.inputValue(), 'Keep my draft');
  await page.goBack(); await link.waitFor(); assert.equal(loads(), before);
  console.log(`PASS ${source}: direct chat page, authenticated lookup, app-bar/browser Back, retained source and draft, no modal`);
  await page.close();
 }
 const guest = await browser.newPage();
 await guest.route('**/ecommerce/**', route => { const path = new URL(route.request().url()).pathname; assert.ok(!path.endsWith('/chat')); return route.fulfill({ json: path.endsWith('/stores/demo') ? store : { items: [], has_more: false } }); });
 await guest.goto('http://127.0.0.1:5177/#/store/demo'); await guest.getByRole('link', { name: 'Sign in to chat with shop', exact: true }).click();
 await guest.getByRole('link', { name: 'Sign in', exact: true }).waitFor();
 assert.equal(await guest.getByRole('link', { name: 'Sign in', exact: true }).getAttribute('href'), '#/account/login?next=%2Fchats%3Fshop%3Ddemo');
 console.log('PASS guest: sign-in destination preserves shop, no unauthenticated chat creation');
} finally { await browser.close(); }