const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-attachments', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const dataUrl = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 300;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f4f8f6'; ctx.fillRect(0, 0, 240, 300);
        ctx.fillStyle = '#0e684e'; ctx.fillRect(12, 12, 216, 48); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('DEMO RECEIPT', 28, 42);
        ctx.fillStyle = '#24332b'; ctx.font = '22px sans-serif'; ctx.fillText('30,000 Ks', 56, 105); ctx.font = '14px sans-serif'; ctx.fillText('Preview fixture only', 45, 150); return canvas.toDataURL('image/png');
      });
      const png = Buffer.from(dataUrl.split(',')[1], 'base64');
      const id = '12345678-abcd-4123-9123-123456789012';
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'Ks' }, permissions: ['products', 'settings'], subscription: { is_valid: true, can_mutate: true } };
      await page.addInitScript(id => { localStorage.setItem('mkpos.activeModule', 'products'); localStorage.setItem('mkpos.language', 'en'); localStorage.setItem('mkpos.ai.conversation:1:1', id); }, id);
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.startsWith('/src/')) return route.continue();
        const path = pathname.split('/api')[1];
        if (path.endsWith('/image')) return route.fulfill({ body: png, contentType: 'image/png' });
        let data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 };
        if (path === '/auth/me') data = session;
        if (path === '/app-config') data = { enabled_modules: session.permissions, permissions: session.permissions, business: session.business, language: 'en' };
        if (path === '/subscription') data = session.subscription;
        if (path === '/categories' || path === '/price-types') data = [];
        if (path === '/branding') data = { primary_color: '#0e684e' };
        if (path === '/ai-assistant/config') data = { enabled: true, configured: true, storage_ready: true };
        if (path === '/ai-assistant/conversations') data = { items: [{ id, title: 'Image question' }], has_more: false };
        if (path.endsWith('/messages')) data = { items: [{ id: 1, role: 'user', body: 'Can you read this?', status: 'completed', created_at: new Date().toISOString(), attachment: { type: 'image', name: 'saved-receipt.png', size: png.length, preview_path: `/ai-assistant/conversations/${id}/messages/1/image` } }, { id: 2, role: 'assistant', body: 'I can help you read the attached image.', status: 'completed', created_at: new Date().toISOString() }], has_more: false };
        await route.fulfill({ json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/assistant' : 'http://127.0.0.1:5173/');
      if (!mobile) await page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }).last().click();
      const saved = page.getByRole('img', { name: 'Preview of saved-receipt.png' });
      await saved.waitFor(); assert.ok(await saved.evaluate(node => node.complete && node.naturalWidth > 0));
      const picker = page.getByLabel('Attach image or product CSV');
      await picker.setInputFiles({ name: 'selected-receipt.png', mimeType: 'image/png', buffer: png });
      const selected = page.getByRole('img', { name: 'Preview of selected-receipt.png' }); await selected.waitFor();
      await page.screenshot({ path: `artifacts/ai-attachments/${mobile ? 'mobile' : 'dialog'}-image.png` });
      if (!mobile) {
        await page.getByRole('button', { name: 'Maximize AI chat' }).click(); await selected.waitFor();
        await page.screenshot({ path: 'artifacts/ai-attachments/page-image.png' });
      }
      await page.getByRole('button', { name: 'Remove attachment' }).click();
      assert.equal(await selected.count(), 0);
      await picker.setInputFiles({ name: 'products.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,SKU\nMug,MUG-1\n') });
      await page.getByText('CSV document · 19 B', { exact: true }).waitFor();
      for (const width of mobile ? [393, 320] : [1440]) {
        await page.setViewportSize({ width, height: mobile ? 852 : 1000 });
        assert.ok(await page.locator('.ai-attachment-preview').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth)));
        await page.screenshot({ path: `artifacts/ai-attachments/${mobile ? `mobile-${width}` : 'page'}-csv.png` });
      }
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('Attachment thumbnails, private saved-image previews, CSV cards, maximize retention and remove controls passed on desktop and mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
