const { setDrawerLanguage } = require('./drawer-language.cjs');
// Fixture-only browser verification. Every API request is intercepted; no business data is changed.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve(__dirname, '../artifacts/shop-buyers-reference');
  await fs.mkdir(output, { recursive: true });
  const engine = process.env.BUYERS_BROWSER || 'chromium';
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, ...(engine === 'firefox' ? {} : { isMobile: true }), hasTouch: true });
    const page = await context.newPage();
    const errors = [], calls = [];
    async function captureReference(id) { await page.evaluate(()=>document.fonts.ready); await page.screenshot({path:path.join(output,id+'.png'),animations:'disabled'}); for(const width of [320,768]){await page.setViewportSize({width,height:817});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id}/${width} overflow`);await page.screenshot({path:path.join(output,`${id}-${width}.png`),animations:'disabled'});}await page.setViewportSize({width:393,height:817}); }
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.log('Browser error:', message.text()); });
    const session = { user: { id: 1, name: 'Test Owner', role: 'owner' }, business: { id: 1, name: 'Test Shop', currency: 'Ks', timezone: 'Asia/Rangoon' }, permissions: ['sell', 'products', 'sales', 'customers', 'shop', 'ecommerce_orders', 'ecommerce_process', 'ecommerce_payments', 'ecommerce_refunds', 'ecommerce_catalog', 'ecommerce_settings'], subscription: { is_valid: true } };
    let order = { id: 8, reference: 'SHOP-8', customer_name: 'Alice', phone: '091234', address: 'Test address', status: 'pending', fulfillment: 'pickup', payment_status: 'unpaid', total: 32000, currency: 'Ks', created_at: '2026-10-13 08:00:00', payment_method: { name: 'Cash', provider: 'manual' }, items: [{ product_id: 5, name: 'Rice', quantity: 2, unit_name: 'Bag', unit_price: 16000, line_total: 32000 }], payments: [], events: [], customer_requests: [] };
    const product = { id: 5, name: 'Rice', base_unit: 'Bag', purchase_unit: 'Box', purchase_conversion_factor: 2, base_price: 16000, purchase_price: 32000, currency: 'Ks', price_type: 'Retail', stock: 12, unit: 'base', published: false };
    const uuid = '12345678-1234-1234-1234-123456789abc';
    let failBlock = true, failCredit = true;
    const customer = { id: 'account:3', customer_key: 'account:3', customer_name: 'Alice', account_type: 'account', phone: '091234', email: 'alice@example.com', purchase_count: 2, spending: [{ currency: 'Ks', completed_spend: 32000 }], blocked: false };
    const review = { id: 2, customer_name: 'Alice', rating: 5, comment: 'Great service', reply: '' };
    const promotion = { id: 7, name: 'Summer', code: 'SAVE10', type: 'coupon', discount_type: 'percentage', discount_value: 10, minimum_subtotal: 0, usage_limit: null, enabled: true, status: 'active', used_count: 0 };
    const messages = [{ id: 1, body: 'Hello shop', sender: 'customer', created_at: '2026-10-13T00:00:00Z' }];
    const settings = { slug: 'test-shop', display_name: 'Test Shop', currency: 'Ks', phone: '091234', address: 'Yangon', description: 'Test shop description', price_type: 'Retail', price_types: ['Retail'], storefront_enabled: true, accepting_orders: true, marketplace_enabled: true, delivery_zones: [], opening_hours: [], closed_until: null, pickup_instructions: 'Collect at counter', timezone: 'Asia/Rangoon' };
    await page.route('http://127.0.0.1:5176/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^.*\/api/, '');
      calls.push({ endpoint, method: request.method(), query: url.search });
      let response;
      if (endpoint === '/auth/me') response = session;
      else if (endpoint === '/app-config') response = { enabled_modules: ['sell', 'products', 'sales', 'customers', 'shop'], permissions: session.permissions, language: 'en', business: {} };
      else if (endpoint === '/shop-admin/owner-location') response = { submitted: true };
      else if (endpoint === '/shop-admin/orders') response = { items: [order], total: 1 };
      else if (endpoint === '/shop-admin/orders/8') response = order;
      else if (endpoint === '/shop-admin/orders/8/payments/confirm') {
        const input = request.postDataJSON(); assert.equal(input.amount, 32000); assert.equal(input.verified, true);
        order = { ...order, payment_status: 'paid' }; response = order;
      }
      else if (endpoint === '/shop-admin/orders/8/transition') { order = { ...order, status: request.postDataJSON().status }; response = order; }
      else if (endpoint === '/shop-admin/publications/filters') response = { categories: ['Food'] };
      else if (endpoint === '/shop-admin/publications') response = { items: [product], total: 1, published_count: 0 };
      else if (endpoint === '/shop-admin/publications/5') response = product;
      else if (endpoint === '/shop-admin/payment-methods') response = { items: [{ id: 'cash', name: 'Cash', type: 'cash', instructions: 'Pay on pickup', is_active: true, provider: 'manual' }] };
      else if (endpoint === '/shop-admin/contacts' || endpoint === '/shop-admin/delivery-zones') response = { items: [] };
      else if (endpoint === '/shop-admin/settings') response = settings;
      else if (endpoint === '/shop-admin/promotions') response = { items: [promotion], total: 1, timezone: 'Asia/Rangoon' };
      else if (endpoint === '/shop-admin/promotions/7') response = { promotion, timezone: 'Asia/Rangoon' };
      else if (endpoint === '/shop-admin/reviews') response = { items: [review], total: 1 };
      else if (endpoint === '/shop-admin/reviews/2') response = review;
      else if (endpoint === '/shop-admin/customers') { const rows=[customer,{...customer,id:'guest:4',customer_key:'guest:4',customer_name:'Mya Win',account_type:'guest',blocked:true,email:''},{...customer,id:'account:5',customer_key:'account:5',customer_name:'Daniel Lee',phone:'0998765432',email:'daniel@example.com'}]; const items=rows.filter(row=>(!url.searchParams.get('q')||row.customer_name.toLowerCase().includes(url.searchParams.get('q').toLowerCase()))&&(url.searchParams.get('account')==='all'||row.account_type===url.searchParams.get('account'))); response={items,total:items.length}; }
      else if (endpoint.endsWith('/credit-options')) response = { matches: [{ id: 42, name: 'Alice Morgan', phone: '09 123 456 789', email: 'alice@example.com' }] };
      else if (endpoint === '/customers') response = { items: [{id:42,name:'Alice Morgan',phone:'09 123 456 789'}],total:1 };
      else if (endpoint.endsWith('/history')) response = { items: [order], total: 1 };
      else if (endpoint.endsWith('/chat') && endpoint.startsWith('/shop-admin/customers/')) response = { thread: { uuid } };
      else if (endpoint.endsWith('/block') && request.method()==='PUT') { if(failBlock){failBlock=false;return route.fulfill({status:503,json:{message:'Could not update customer status. Retry.'}});} customer.blocked=request.postDataJSON().blocked;customer.block_reason=request.postDataJSON().reason;response={customer}; }
      else if (endpoint.endsWith('/credit-contact') && request.method()==='POST') { if(failCredit){failCredit=false;return route.fulfill({status:409,json:{message:'Please review the matching credit contact.'}});} customer.credit_customer_id=42;response={customer}; }
      else if (endpoint.startsWith('/shop-admin/customers/')) response = { customer, report: { currencies: [{ currency: 'Ks', completed_spend: 32000, average_purchase: 16000 }], total_orders: 5, completed_orders: 2, active_orders: 1, cancelled_orders: 1, expired_orders: 1, first_purchase_at: '2026-09-10 08:00:00', last_purchase_at: '2026-10-13 08:00:00' } };
      else if (endpoint === '/shop-admin/chat/config') response = { enabled: true, realtime_enabled: false };
      else if (endpoint === '/shop-admin/chat') response = { items: [{ uuid, id: 1, customer_name: 'Alice', unread: 1, last_message: messages[0] }], total: 1 };
      else if (endpoint.endsWith('/messages')) {
        if (request.method() === 'POST') { const input = request.postDataJSON(); const message = { id: messages.length + 1, body: input.body, sender: 'owner', created_at: '2026-10-13T00:00:00Z' }; messages.push(message); response = { message }; }
        else response = { items: url.searchParams.has('after_id') ? [] : messages, thread: { uuid, customer_name: 'Alice', customer_key: 'account:3' }, has_more: false };
      }
      else if (endpoint.endsWith('/products') && endpoint.includes('/chat/')) response = { items: [{ id: 5, name: 'Rice', price: 16000, currency: 'Ks', unit_name: 'Bag', store_slug: 'test-shop' }], next_cursor: null };
      else if (endpoint.includes('/chat/')) response = { enabled: true, unread_count: 0, items: [] };
      else if (endpoint === '/shop-admin/report') response = { date_from: '2026-10-01', date_to: '2026-10-13', previous_from: '2026-09-18', previous_to: '2026-09-30', currency: 'Ks', currencies: ['Ks'], timezone: 'Asia/Rangoon', summary: { orders: 2, sales: 32000, completed_orders: 2, average_order_value: 16000, new_buyers: 1, returning_buyers: 1, cancellation_rate: 0, repeat_purchase_rate: 50, completion_rate: 100 }, previous: {}, trend: [{ date: '2026-10-13', sales: 32000, orders: 2 }], top_products: [{ name: 'Rice', unit_name: 'Bag', sales: 32000, quantity: 2 }], buyers: [{ name: 'New', buyers: 1 }], outcomes: [{ status: 'completed', orders: 2 }], origins: [], segments: [], prepaid: 0, follow_up: [] };
      else response = { items: [], total: 0 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));


    Object.assign(order, {customer_name:'Alice Morgan',status:'packing',payment_status:'paid',fulfillment:'delivery',item_count:3,item_previews:[{product_id:5,name:'Rice'},{product_id:6,name:'Cooking oil'},{product_id:7,name:'Green tea'}]});
    Object.assign(customer, { customer_name: 'Alice Morgan', phone: '09 123 456 789', address: 'Building 12, Bogyoke Road, Yangon' });
    await page.goto('http://127.0.0.1:5176/shop/customers');
    await page.getByRole('button',{name:'View customer Alice Morgan',exact:true}).waitFor(); await captureReference('079'); const download=page.waitForEvent('download'); await page.getByRole('button',{name:'Export customers',exact:true}).click(); assert.ok((await download).suggestedFilename().endsWith('.csv')); await page.getByRole('button',{name:'Dismiss message',exact:true}).click(); await page.getByRole('button',{name:'Filters',exact:true}).click(); await page.getByRole('radio',{name:'Guest',exact:true}).check(); await page.waitForTimeout(300); await captureReference('122'); await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Filters',exact:true}).click(); assert.equal(await page.getByRole('radio',{name:'All',exact:true}).first().isChecked(),true); await page.keyboard.press('Escape');
    const response = page.waitForResponse(response => response.url().includes('/shop-admin/customers?') && response.url().includes('q=Alice'));
    await page.getByRole('searchbox', { name: 'Search shop customers' }).fill('Alice');
    await response;
    await page.getByRole('button', { name: 'View customer Alice Morgan' }).click();
    await page.getByRole('heading', { name: 'Alice Morgan', exact: true }).waitFor();
    assert.equal(await page.locator('.shared-app-bar').getByRole('button', { name: 'More', exact: true }).count(), 0, 'Customer app bar has no duplicate More action');
    assert.equal(await page.locator('.buyer-profile-actions').getByRole('button', { name: 'More', exact: true }).count(), 1, 'More remains in customer profile');
    await page.locator('.buyer-statistics').getByRole('heading', { name: 'Purchase details', exact: true }).waitFor();
    assert.equal(await page.locator('.buyer-statistics').getByText('Total orders', { exact: true }).evaluate(label => label.nextElementSibling.textContent), '5');
    for (const width of [393, 320, 768]) {
      await page.setViewportSize({ width, height: 817 });
      await page.screenshot({animations:'disabled', path: path.join(output, `customer-${width}.png`), fullPage: true }); if(width===393) await page.screenshot({path:path.join(output,'080.png'),animations:'disabled'});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: no page overflow`);
    }
    await page.setViewportSize({ width: 393, height: 817 });
    const beforeOptions = calls.length;
    await page.locator('.buyer-profile-actions').getByRole('button', { name: 'More', exact: true }).click();
    const options = page.getByRole('dialog', { name: 'Customer options', exact: true });
    assert.equal(await options.getByText('Purchase details', { exact: true }).count(), 0, 'Purchase details are outside the action sheet');
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 667 });
      const rows = await options.locator('.mobile-action-menu > button').evaluateAll(buttons => buttons.map(button => ({ icon: button.querySelector('svg').getBoundingClientRect().x, copy: button.querySelector('span').getBoundingClientRect().x, height: button.getBoundingClientRect().height })));
      assert.ok(rows.every(row => row.height >= 44 && Math.abs(row.icon - rows[0].icon) < 1 && Math.abs(row.copy - rows[0].copy) < 1), 'Customer option actions align and have touch targets');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Customer options have no horizontal overflow');
      await page.screenshot({ animations: 'disabled', path: path.join(output, `customer-options-${width}.png`) });
    }
    await page.keyboard.press('Escape');
    assert.equal(calls.length, beforeOptions, 'Opening/dismissing customer options does not refresh history');
    await page.setViewportSize({ width: 393, height: 817 });
    for (const name of ['Block customer', 'Link credit contact']) {
      await page.locator('.buyer-profile-actions').getByRole('button',{name:'More',exact:true}).click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('heading', { name: name==='Block customer'?'Block this customer?':name, exact: true }).waitFor(); if(name==='Link credit contact') { await page.getByRole('button',{name:'Choose another existing credit contact',exact:true}).click(); await page.getByRole('button',{name:/Alice Morgan.*09 123/}).click(); assert.equal(await page.getByRole('radio',{name:/Recommended match/}).isChecked(),true); } await captureReference(name==='Block customer'?'081':'082');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('heading', { name: 'Alice Morgan', exact: true }).waitFor();
    }
    const filtered = page.waitForResponse(response => response.url().includes('/history?') && response.url().includes('q=SHOP'));
    await page.getByRole('searchbox', { name: 'Search customer order history' }).fill('SHOP');
    await filtered;
    const historyCalls = calls.filter(call => call.endpoint.endsWith('/history')).length;
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
    await dialog.getByRole('button', { name: 'Close filters', exact: true }).click(); await page.locator('.shop-customer-history').evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'})); await page.screenshot({path:path.join(output,'history.png'),animations:'disabled'});
    await page.getByRole('button', { name: 'View order SHOP-8', exact: true }).click();
    await page.getByRole('heading', { name: 'SHOP-8', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: 'Alice Morgan', exact: true }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search customer order history' }).inputValue(), 'SHOP');
    assert.equal(calls.filter(call => call.endpoint.endsWith('/history')).length, historyCalls, 'Returning from an order does not refetch customer history');
    await page.locator('.buyer-profile-actions').getByRole('button', { name: 'Chat', exact: true }).click();
    await page.waitForURL(`**/shop/chat/${uuid}`);
    await page.goBack();
    await page.getByRole('heading', { name: 'Alice Morgan', exact: true }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search customer order history' }).inputValue(), 'SHOP');
    await page.getByRole('button', { name: 'Back to shop', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search shop customers' }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search shop customers' }).inputValue(), 'Alice');
    assert.ok(!calls.some(call => ['PUT', 'DELETE'].includes(call.method)), 'Cancel never mutates customer');
    await page.getByRole('button',{name:'View customer Alice Morgan',exact:true}).click();
    await page.locator('.buyer-profile-actions').getByRole('button',{name:'More',exact:true}).click();
    await page.getByRole('button',{name:'Block customer',exact:true}).click();
    await page.getByRole('textbox',{name:'Reason (optional)'}).fill('Repeated fraudulent orders');
    await page.getByRole('button',{name:'Block customer',exact:true}).click();
    await page.getByText('Could not update customer status. Retry.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('textbox',{name:'Reason (optional)'}).inputValue(),'Repeated fraudulent orders');
    await page.getByRole('button',{name:'Block customer',exact:true}).click();
    await page.getByRole('heading',{name:'Alice Morgan',exact:true}).waitFor();
    await page.locator('.buyer-profile-actions').getByRole('button',{name:'More',exact:true}).click();
    await page.getByRole('button',{name:'Unblock customer',exact:true}).waitFor();
    await page.getByRole('button',{name:'Link credit contact',exact:true}).click();
    await page.getByRole('radio',{name:/Recommended match/}).check();
    await page.getByRole('button',{name:'Link contact',exact:true}).click();
    await page.getByText('Please review the matching credit contact.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Link contact',exact:true}).click();
    await page.getByRole('heading',{name:'Alice Morgan',exact:true}).waitFor();
    Object.assign(customer, { account_type: 'guest', customer_name: 'A guest customer with a longer name', blocked: true, credit_customer_id: 7, address: 'Apartment 203, second floor, a long delivery address in downtown Yangon, Myanmar' });
    await page.goto('http://127.0.0.1:5176/shop/customers/account%3A3');
    await page.getByRole('heading', { name: customer.customer_name, exact: true }).waitFor();
    assert.equal(await page.locator('.buyer-profile-actions').getByRole('button',{name:'Chat',exact:true}).isDisabled(),true);
    await page.locator('.buyer-profile-actions').getByRole('button',{name:'More',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Credit contact linked',exact:true}).isDisabled(),true);
    await page.keyboard.press('Escape');
    await page.screenshot({animations:'disabled', path: path.join(output, 'guest-blocked-393.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button',{name:'Open app menu',exact:true}).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape'); await page.waitForFunction(()=>document.documentElement.lang==='my'); await page.screenshot({path:path.join(output,'myanmar.png'),animations:'disabled'});
    await page.locator('.buyer-profile-actions').getByRole('button').last().click();
    await page.setViewportSize({ width: 320, height: 667 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(output, 'customer-options-myanmar-320.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, `verification-${engine}.json`), JSON.stringify({ widths: [320, 393, 768], checks: ['Profile, contacts, order counts and spending', 'Block and credit actions open and cancel without mutation', 'Customer chat opens once', 'Guest, blocked and linked-credit variants', 'History search retained after order and chat', 'Source customer list search retained after Back', 'Filter drawer open and close'], errors }, null, 2));
    console.log(`Shop buyers ${engine}: all 5 reference states, retained history and actions passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
