const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/landing-office', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto('http://127.0.0.1:8000/');
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('#office article').count(), 6);
    for (const width of [1440, 1100, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const result = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        columns: getComputedStyle(document.querySelector('.office-feature-grid')).gridTemplateColumns.split(' ').length,
        missing: [...document.querySelectorAll('a')].filter(a => a.origin === location.origin && a.pathname === location.pathname && a.hash && !document.getElementById(a.hash.slice(1))).map(a => a.hash),
      }));
      assert.ok(result.scrollWidth <= result.width, JSON.stringify(result));
      assert.equal(result.columns, width > 1050 ? 3 : width > 760 ? 2 : 1);
      assert.deepEqual(result.missing, []);
      await page.locator('#office').scrollIntoViewIfNeeded();
      if (width === 1440 || width === 390) await page.locator('#office').screenshot({ path: `artifacts/landing-office/office-${width}.png` });
    }
    await page.locator('summary[aria-label="Open navigation"]').click();
    await page.locator('.mobile-nav').getByRole('link', { name: 'Office', exact: true }).click();
    assert.equal(await page.locator('.mobile-nav').getAttribute('open'), null);
    assert.equal(new URL(page.url()).hash, '#office');
    await page.getByRole('link', { name: 'Explore the Office guide' }).click();
    await page.getByRole('heading', { name: 'PwarMyar Office administration', exact: true }).waitFor();
    assert.equal(await page.locator('.manual-contents a').count(), 6);
    await page.locator('.manual-contents').getByRole('link', { name: 'Bank books and subscription receipts' }).click();
    assert.equal(new URL(page.url()).hash, '#receiving-books');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.screenshot({ path: 'artifacts/landing-office/office-guide-mobile.png' });
    await page.goto('http://127.0.0.1:8000/');
    const links = await page.locator('.platform-download-button').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent.trim(), href: node.href })));
    assert.ok(links.some(link => link.text.startsWith('Open desktop web')));
    assert.ok(links.some(link => link.text.startsWith('Open mobile web')));
    for (const path of ['/plans', '/tutorials', '/documentation']) {
      const next = await page.goto(`http://127.0.0.1:8000${path}`); assert.equal(next.status(), 200);
    }
    assert.deepEqual(errors, []);
    console.log('Landing Office checks passed: six feature cards; six responsive widths; Office anchors/mobile menu; public guide and contents; existing platform links, pricing, tutorials and documentation. Read-only checks, no financial mutations.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
