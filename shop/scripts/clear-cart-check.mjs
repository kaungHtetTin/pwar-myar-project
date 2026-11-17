import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
await mkdir('test-artifacts/clear-cart', { recursive: true });
try { for (const width of [393, 1366]) {
 const page = await browser.newPage({ viewport: { width, height: 956 } });
 await page.addInitScript(() => {
  if (sessionStorage.getItem('fixture-seeded')) return;
  const carts = ['demo', 'sunrise'].map((slug, index) => ({ slug, name: index ? 'Sunrise Store' : 'Demo Shop', origin: 'marketplace', items: [{ id: index + 1, name: index ? 'Tea' : 'Rice', price: 1000, currency: 'K', quantity: 2, unit_name: 'Bag' }] }));
  localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify(carts)); localStorage.setItem('mkpos.shop.cart.v1', JSON.stringify(carts[0])); sessionStorage.setItem('fixture-seeded', '1');
 });
 await page.route('**/ecommerce/**', route => { const path = new URL(route.request().url()).pathname.split('/ecommerce')[1]; return route.fulfill({ json: path.startsWith('/stores/') && path.split('/').length === 3 ? { slug: path.split('/').at(-1), display_name: 'Demo Shop', accepting_orders: true, categories: [], payment_methods: [], delivery_zones: [] } : { items: [], has_more: false, unread_count: 0 } }); });
 await page.goto('http://127.0.0.1:5177/#/cart');
 await page.getByRole('button', { name: 'Clear all carts', exact: true }).waitFor();
 page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Clear all carts', exact: true }).click(); assert.equal(await page.locator('.cart-selection-card').count(), 2);
 await page.getByRole('link', { name: 'Review cart for Demo Shop', exact: true }).click();
 const clear = page.getByRole('button', { name: 'Clear cart', exact: true }); await clear.waitFor();
 page.once('dialog', dialog => dialog.dismiss()); await clear.click(); assert.equal(await page.locator('.cart-review-item').count(), 1);
 await page.screenshot({ path: `test-artifacts/clear-cart/shop-${width}.png` });
 page.once('dialog', dialog => dialog.accept()); await clear.click(); await page.getByRole('heading', { name: 'Your cart is empty', exact: true }).waitFor();
 assert.equal(await page.locator('.cart-review-totals').count(), 0); assert.equal(await page.getByRole('link', { name: 'Proceed to checkout', exact: true }).count(), 0);
 assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mkpos.shop.carts.v2')).map(cart => cart.slug)), ['sunrise']);
 const nav = page.locator(width > 760 ? '.desktop-navigation' : '.mobile-navigation'); assert.equal(await nav.getByRole('link', { name: 'Cart', exact: false }).locator('b').innerText(), '1');
 await page.getByRole('link', { name: 'Choose another shop', exact: true }).click(); await page.getByRole('button', { name: 'Clear all carts', exact: true }).waitFor();
 await page.getByRole('searchbox', { name: 'Search your carts', exact: true }).fill('No match');
 page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Clear all carts', exact: true }).click(); await page.getByRole('heading', { name: 'Your cart is empty', exact: true }).waitFor();
 assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mkpos.shop.carts.v2'))), []); assert.equal(await page.evaluate(() => localStorage.getItem('mkpos.shop.cart.v1')), null); assert.equal(await nav.getByRole('link', { name: 'Cart', exact: true }).locator('b').count(), 0);
 await page.reload(); await page.getByRole('heading', { name: 'Your cart is empty', exact: true }).waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 await page.screenshot({ path: `test-artifacts/clear-cart/empty-${width}.png` }); console.log(`PASS ${width}: cancel/confirm, clear one shop, preserve other cart, clear all with search, totals/checkout/badge updates, persisted empty after reload`); await page.close();
}} finally { await browser.close(); }