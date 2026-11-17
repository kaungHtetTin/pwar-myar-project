const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

const session = { admin: { id: 1, name: 'Office Admin', email: 'admin@example.test', role: 'super_admin' } };
function series(count, period) {
  return Array.from({ length: count }, (_, index) => {
    // Fixture wall-clock values already grouped in Asia/Yangon by the API.
    const date = new Date('2026-10-25T10:00:00Z');
    if (period === 'hourly') date.setUTCHours(date.getUTCHours() - count + 1 + index);
    if (period === 'daily') date.setUTCDate(date.getUTCDate() - count + 1 + index);
    if (period === 'monthly') { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - count + 1 + index); }
    if (period === 'yearly') date.setUTCFullYear(date.getUTCFullYear() - count + 1 + index);
    const populated = index === count - 1 || index === count - 2;
    return { key: date.toISOString().slice(0, 19).replace('T', ' '),
      label: date.toLocaleString('en-US', { timeZone: 'UTC', ...(period === 'yearly' ? { year: 'numeric' } : period === 'monthly' ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric', ...(period === 'hourly' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}) }) }),
      requests: populated ? index + 1 : 0, failures: 0, input_tokens: populated ? (index === count - 1 ? 1000 : 12000) : 0, output_tokens: populated ? 2100 : 0, cached_input_tokens: populated ? (index === count - 1 ? 800 : 9600) : 0,
      cost_usage: populated ? [{ status: 'completed', model: 'deepseek-flash', input_tokens: index === count - 1 ? 1000 : 12000, output_tokens: 2100, cached_input_tokens: index === count - 1 ? 800 : 9600 }] : [] };
  });
}
const report = { usage: { today_requests: 9, today_failures: 0, input_tokens: 12000, output_tokens: 2100 },
  pricing: { fetched_at: '2026-10-25T04:00:00Z', stale: false, rates: { 'deepseek-flash': { input: 0.3, output: 1.2, cached_input: 0.006 } } },
  usage_charts: { timezone: 'Asia/Yangon', series: Object.fromEntries([['hourly', 24], ['daily', 30], ['monthly', 12], ['yearly', 5]].map(([key, count]) => [key, series(count, key)])) }, recent_runs: [] };

(async () => {
  await fs.mkdir('artifacts/ai-usage-charts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    async function checkYearLabels() {
      const offsets = await page.getByRole('region', { name: 'Yearly usage' }).evaluate(chart => {
        const bars = [...chart.querySelectorAll('.office-ai-chart-track')];
        return [...chart.querySelectorAll('.office-ai-chart-tick-label')].map((label, index) => {
          const tick = label.getBoundingClientRect(), bar = bars[index].getBoundingClientRect();
          return Math.abs(tick.x + tick.width / 2 - bar.x - bar.width / 2);
        });
      });
      assert.ok(offsets.every(value => value < 1), `Year label offsets: ${offsets}`);
    }
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      let data = { items: [], total: 0, page: 1, last_page: 1, summary: { total: 0, access_counts: {} } };
      if (path.endsWith('/office/auth/me')) data = session;
      if (path.endsWith('/office/financial-report')) data = {};
      if (path.endsWith('/office/ai-assistant')) data = report;
      if (path.endsWith('/office/ai-balance-book')) data = { balance: '0.000000000', total_top_ups: '0.000000000', total_usage: '0.000000000', can_use_ai: false, items: [], total: 0, page: 1, per_page: 25, last_page: 1 };
      if (path.endsWith('/branding')) data = { primary_color: '#0e684e' };
      return route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:5175');
    await page.getByRole('button', { name: 'Usage Report', exact: true }).click();
    const metric = page.getByLabel('Chart metric');
    await metric.selectOption('total_cost');
    await checkYearLabels();
    assert.ok((await page.getByRole('region', { name: 'AI usage' }).innerText()).includes('Requests today (Asia/Yangon)'));
    assert.equal(await page.locator('.office-ai-chart-heading').filter({ hasText: 'Asia/Yangon' }).count(), 4);
    assert.equal((await page.locator('.office-ai-charts').innerText()).includes('UTC'), false);
    await page.locator('.office-ai-charts').scrollIntoViewIfNeeded();
    await page.locator('.office-ai-charts').screenshot({ path: 'artifacts/ai-usage-charts/desktop-cost.png' });
    const geometry = await page.locator('.office-ai-chart').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      const plot = node.querySelector('.office-ai-chart-plot-area').getBoundingClientRect();
      const header = node.querySelector('.office-ai-chart-heading').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, plotY: plot.y, plotHeight: plot.height, headerY: header.y };
    }));
    assert.equal(geometry.length, 4);
    assert.equal(geometry[0].y, geometry[1].y);
    assert.equal(geometry[0].plotY, geometry[1].plotY);
    assert.equal(geometry[2].plotY, geometry[3].plotY);
    assert.ok(geometry.every(chart => chart.height < 300 && chart.plotHeight === 132));
    await metric.selectOption('total_tokens');
    await page.locator('.office-ai-charts').screenshot({ path: 'artifacts/ai-usage-charts/desktop-tokens.png' });
    await page.getByRole('button', { name: 'Balance book', exact: true }).click();
    await page.goBack();
    await metric.waitFor();
    assert.equal(await metric.inputValue(), 'total_tokens');
    await page.setViewportSize({ width: 1024, height: 900 });
    await checkYearLabels();
    await page.locator('.office-ai-charts').screenshot({ path: 'artifacts/ai-usage-charts/tablet.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await checkYearLabels();
    await page.locator('.office-ai-charts').screenshot({ path: 'artifacts/ai-usage-charts/narrow.png' });
    const overflow = await page.locator('.office-ai-charts').evaluate(node => node.scrollWidth > node.clientWidth);
    assert.equal(overflow, false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ geometry, metricRetention: true, narrowOverflow: false, errors }, null, 2));
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
