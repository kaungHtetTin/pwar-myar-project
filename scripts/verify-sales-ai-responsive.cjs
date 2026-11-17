// Real shop UI, isolated API fixtures. Never sends an order, payment or paid AI call.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const uuid = '12345678-1234-1234-1234-123456789abc';
const widths = [320, 360, 393, 768, 1024, 1440];
const kinds = { cart: 'Chat cart', checkout: 'Checkout', proof: 'Order payment proof', change: 'Order change request', cancellation: 'Cancellation request', return: 'Return request' };
const name = 'အရည်အသွေးကောင်းမွန်သော ဆပ်ပြာနှင့် အိမ်သုံးပစ္စည်း အထူးထုပ်ပိုးမှု / Large household pack';
const items = [1, 2].map(id => ({ product_id: id, name: `${name} ${id}`, quantity: 12.125, unit_name: 'ထုပ် / Large box', unit_price: 123456789, line_total: 1496913567 }));
const products = items.map(p => ({ id: p.product_id, name: p.name, price: p.unit_price, available_quantity: 12345.125, currency: 'MMK', unit_name: p.unit_name, store_slug: 'demo', description: name }));
const quote = { items, subtotal: 2993827134, discount: 123456, delivery_fee: 5000, total: 2993708678, currency: 'MMK' };
const address = 'အမှတ် ၁၂၃၊ လမ်းမကြီး၊ ရန်ကုန်မြို့။ '.repeat(4);
const thread = { uuid, shop_name: 'Demo shop', slug: 'demo', sales_ai: { enabled: true, name: 'Mia', mode: 'ai', version: 1 } };
function makeAction(kind) {
  return { id: `responsive-${kind}`, kind, status: 'pending', revision: 1, preview_hash: 'a'.repeat(64), expires_at: '2099-01-01T00:00:00Z',
    values: { items: items.map(({ product_id, quantity }) => ({ product_id, quantity })), customer_name: 'မဝိုင်းဝိုင်း / Long customer name', phone: '09123456789', email: 'long.customer@example.test', fulfillment: 'delivery', delivery_zone_id: 'town', payment_method_id: 'bank', address, notes: address, reason: address, changes: { address, notes: 'ORDER-NOTE-'.repeat(20), items: items.map(({ product_id, quantity }) => ({ product_id, quantity })) } },
    preview: { ...(['cart', 'checkout'].includes(kind) ? quote : {}), ready: kind !== 'proof', reference: 'ORDER-2026-01234567890123456789', currency: 'MMK', notice: 'အချက်အလက်များကို သေချာစစ်ဆေးပြီး အတည်ပြုပေးပါ။ '.repeat(2), ...(kind === 'change' ? { requested_items: items } : {}), ...(kind === 'proof' ? { total: quote.total, payment_method: { name: 'KBZPay', account_name: 'Shop receiving account with a long name', account_no: '09123456789', instructions: address } } : {}) },
    options: { delivery_zones: [{ id: 'town', name: address, fee: 5000 }], payment_methods: [{ id: 'bank', name: 'Bank transfer / ဘဏ်ငွေလွှဲဖြင့် ပေးချေခြင်း' }] } };
}
(async () => {
 const browser = await chromium.launch(); const report = [];
 await fs.mkdir('artifacts/sales-ai-responsive', { recursive: true });
 try {
  const receiptPage = await browser.newPage({ viewport: { width: 1000, height: 650 } });
  await receiptPage.setContent('<body style="font:28px sans-serif;background:#eef6f2;padding:50px"><h1>TEST PAYMENT RECEIPT</h1><p>Shop receiving account</p><hr><h2>2,993,708,678 MMK</h2><p>Fixture only — not a real payment</p></body>');
  const receipt = await receiptPage.screenshot(); await receiptPage.close();
  for (const width of widths) {
   const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
   const errors = []; let action;
   page.on('pageerror', e => errors.push(e.message));
   await page.addInitScript(() => { localStorage.setItem('mkpos.shop.customerToken', 'fixture'); localStorage.setItem('mkpos.shop.language', 'en'); });
   await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let json = { items: [], has_more: false, enabled: false, realtime_enabled: false };
    if (path.endsWith('/customer/me')) json = { customer: { id: 1, name: 'Buyer', email: 'buyer@example.test' } };
    else if (path.includes('/sales-actions/')) {
     if (path.endsWith('/image')) return route.fulfill({ contentType: 'image/png', body: receipt });
     if (path.endsWith('/review')) action = { ...action, revision: 2, has_image: ['proof', 'return'].includes(action.kind), preview: { ...action.preview, ready: true } };
     if (path.endsWith('/cancel')) action = { ...action, status: 'cancelled' };
     if (path.endsWith('/confirm')) throw new Error('Layout audit must not submit confirmations');
     json = action;
    } else if (path.includes(`/chat/${uuid}`)) json = { thread, items: [{ id: 1, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'Check the product information and review your request.', created_at: '2026-10-26 00:00:00', sales_content: { products, quote }, sales_actions: [{ id: action.id, kind: action.kind, status: action.status }] }], has_more: false };
    else if (path.endsWith('/chat/config')) json = { enabled: true, realtime_enabled: false };
    else if (path.endsWith('/stores/demo')) json = { name: 'Demo shop', slug: 'demo' };
    await route.fulfill({ json });
   });
   for (const [kind, title] of Object.entries(kinds)) {
    action = makeAction(kind);
    if (page.url() === 'about:blank') await page.goto(`http://127.0.0.1:5177/#/chats/${uuid}`); else await page.reload();
    const card = page.locator(`section.sales-action-card[aria-label="${title}"]`);
    await card.getByRole('button', { name: 'Review', exact: true }).click();
    await card.getByRole('button', { name: 'Check action status', exact: true }).waitFor();
    if (['proof', 'return'].includes(kind)) {
     await card.getByLabel('Review image file').setInputFiles({ name: 'receipt-with-a-long-filename-for-responsive-review.png', mimeType: 'image/png', buffer: receipt });
     await card.getByRole('button', { name: kind === 'proof' ? 'Review image' : 'Refresh review', exact: true }).click();
     await card.getByRole('img', { name: 'Payment or request image for review' }).waitFor();
    }
    const layout = await page.evaluate(() => {
     const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
     return { pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth,
      scrollers: [...document.querySelectorAll('.sales-action-table')].map(el => ({ client: el.clientWidth, scroll: el.scrollWidth, columns: [...el.querySelectorAll('thead th')].map(th => ({ text: th.textContent, ...rect(th) })), tabIndex: el.tabIndex })),
      ancestors: [...document.querySelectorAll('.sales-action-card,.conversation-bubble,.shop-chat-message,.shop-chat-messages')].map(el => ({ name: el.className, ...rect(el), client: el.clientWidth, scroll: el.scrollWidth })),
      controls: [...document.querySelectorAll('.sales-action-review input:not([type=checkbox]),.sales-action-review select,.sales-action-review textarea')].filter(el => !el.closest('.sales-action-table')).map(rect),
      fieldColumns: document.querySelector('.sales-action-fields') ? { width: document.querySelector('.sales-action-fields').clientWidth, columns: getComputedStyle(document.querySelector('.sales-action-fields')).gridTemplateColumns.split(' ').length } : null,
      numerics: [...document.querySelectorAll('.sales-action-table td:not(:first-child)')].map(el => ({ wrap: getComputedStyle(el).whiteSpace, overflow: el.scrollWidth > el.clientWidth + 1 })) };
    });
    assert.ok(layout.pageScroll <= width + 1, `${kind}/${width}: page overflow`);
    for (const el of layout.ancestors) { assert.ok(el.left >= -1 && el.right <= width + 1, `${kind}/${width}: ${el.name} outside screen`); assert.ok(el.scroll <= el.client + 2, `${kind}/${width}: ${el.name} overflow`); }
    for (const el of layout.controls) assert.ok(el.left >= 0 && el.right <= width + 1, `${kind}/${width}: form field outside screen`);
    if (layout.fieldColumns) assert.equal(layout.fieldColumns.columns, layout.fieldColumns.width >= 480 ? 2 : 1, `${kind}/${width}: responsive field columns`);
    for (const el of layout.numerics) { assert.equal(el.wrap, 'nowrap'); assert.equal(el.overflow, false, `${kind}/${width}: clipped numeric cell`); }
    const tables = page.locator('.sales-action-table'); const count = await tables.count();
    for (let i = 0; i < count; i++) {
     const table = tables.nth(i);
     if (layout.scrollers[i].scroll > layout.scrollers[i].client + 1) {
      assert.equal(layout.scrollers[i].tabIndex, 0);
      await table.focus(); await table.press('ArrowRight');
      await page.waitForFunction(index => document.querySelectorAll('.sales-action-table')[index].scrollLeft > 0, i);
      const end = await table.evaluate(el => { el.scrollLeft = el.scrollWidth; const last = el.querySelector('thead th:last-child').getBoundingClientRect(), box = el.getBoundingClientRect(); return { last: last.right, box: box.right, scroll: el.scrollLeft }; });
      assert.ok(end.scroll > 0 && end.last <= end.box + 1, `${kind}/${width}: final column unreachable`);
      if (i === count - 1 && ['cart', 'checkout', 'change'].includes(kind)) {
       await table.scrollIntoViewIfNeeded(); await page.screenshot({ path: `artifacts/sales-ai-responsive/${kind}-columns-${width}.png` });
      }
      await table.evaluate(el => { el.scrollLeft = 0; });
     }
    }
    await card.getByRole('button', { name: 'Close review' }).click(); await card.getByRole('button', { name: 'Review', exact: true }).click();
    if (kind === 'checkout') assert.equal(await card.getByLabel('Address', { exact: true }).inputValue(), address);
    // Viewport screenshots show actual clipping/scrolling, rather than an oversized element capture.
    await card.evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: `artifacts/sales-ai-responsive/${kind}-${width}.png` });
    if (kind === 'checkout') {
     const input = card.getByLabel('Customer name', { exact: true }); await input.focus();
     await page.screenshot({ path: `artifacts/sales-ai-responsive/checkout-fields-${width}.png` });
    }
    if (kind === 'change') {
     const compare = page.getByRole('table', { name: 'Product comparison', exact: true }); await compare.scrollIntoViewIfNeeded();
     await page.screenshot({ path: `artifacts/sales-ai-responsive/comparison-${width}.png` });
    }
    if (kind === 'checkout' && width === 393) {
     await page.setViewportSize({ width, height: 480 });
     const confirm = card.getByRole('button', { name: 'Confirm order', exact: true });
     await confirm.scrollIntoViewIfNeeded();
     const visible = await confirm.evaluate(el => { const r = el.getBoundingClientRect(), top = document.querySelector('.customer-chat-page-header').getBoundingClientRect().bottom, bottom = document.querySelector('.shop-chat-composer').getBoundingClientRect().top; return { top: r.top, bottom: r.bottom, height: r.height, header: top, composer: bottom }; });
     assert.ok(visible.top >= visible.header && visible.bottom <= visible.composer && visible.height >= 44, 'Short viewport must keep confirmation reachable above composer');
     await page.screenshot({ path: 'artifacts/sales-ai-responsive/checkout-short-393.png' });
     await page.setViewportSize({ width, height: 900 });
    }
    report.push({ kind, width, tables: layout.scrollers.length, horizontalTables: layout.scrollers.filter(t => t.scroll > t.client + 1).length });
   }
   assert.deepEqual(errors, []); console.log(`${width}px: all six forms, comparison/quote columns, keyboard/table scrolling passed`); await page.close();
  }
  await fs.writeFile('artifacts/sales-ai-responsive/report.json', JSON.stringify(report, null, 2));
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
