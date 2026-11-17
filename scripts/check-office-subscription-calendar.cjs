// Real calendar UI, isolated/intercepted APIs only. No live business mutations.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.OFFICE_ORIGIN || 'http://127.0.0.1:5175';
const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit' }).format(new Date()).replace('/', '-');
const initialMonth = /^\d{4}-\d{2}$/.test(month) ? month : `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;

(async () => {
  await fs.mkdir('artifacts/office-subscription-calendar', { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      let calendarReads = 0, dayReads = 0, failCalendar = false, failDay = false;
      await page.route('**/api/**', route => {
        const url = new URL(route.request().url()), endpoint = url.pathname.slice(4), params = url.searchParams;
        let data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1 };
        if (endpoint === '/branding') data = { primary_color: '#006bdc' };
        if (endpoint === '/office/auth/me') data = { admin: { id: 1, name: 'Calendar admin', role: 'admin' }, timezone: 'Asia/Yangon' };
        if (endpoint === '/office/financial-report') data = {};
        if (endpoint === '/office/subscription-calendar') {
          calendarReads++;
          if (failCalendar) return route.fulfill({ status: 503, json: { message: 'Calendar fixture unavailable' } });
          const selected = params.get('month'), kind = params.get('kind'), empty = (params.get('q') || '').includes('NoSuch');
          const trial = kind === 'paid' ? 0 : 14, paid = kind === 'trial' ? 0 : 13;
          data = { month: selected, today: `${initialMonth}-10`, timezone: 'Asia/Yangon', server_now: `${initialMonth}-10T03:30:00Z`,
            summary: empty ? { trial: 0, paid: 0, expired: 0 } : { trial: 14, paid: 15, expired: 1 },
            days: empty ? [] : [{ day: `${selected}-13`, trial, paid, total: trial + paid }, { day: `${selected}-17`, trial: 0, paid: kind === 'trial' ? 0 : 2, total: kind === 'trial' ? 0 : 2 }, { day: `${selected}-09`, trial: 0, paid: kind === 'trial' ? 0 : 1, total: kind === 'trial' ? 0 : 1 }] };
        }
        if (endpoint === '/office/subscription-calendar/day') {
          dayReads++;
          if (failDay) return route.fulfill({ status: 503, json: { message: 'Day fixture unavailable' } });
          const kind = params.get('kind'), offset = Number(params.get('offset')), limit = Number(params.get('limit'));
          const all = Array.from({ length: 27 }, (_, index) => ({ id: index + 1, name: `Calendar Shop ${String(index + 1).padStart(2, '0')}`, owner_name: 'Fixture owner', owner_email: `owner${index + 1}@example.test`, plan_name: index % 2 ? 'Monthly plan' : 'Free trial', access_type: index % 2 ? 'paid' : 'trial', access_state: index % 2 ? 'paid' : 'trial', ends_at: `${params.get('day')}T08:00:00Z` }));
          const rows = params.get('day').endsWith('-13') ? all.filter(row => kind === 'all' || row.access_type === kind) : [];
          data = { items: rows.slice(offset, offset + limit), total: rows.length, offset, limit, has_more: offset + limit < rows.length };
        }
        if (/^\/office\/businesses\/\d+$/.test(endpoint)) {
          const id = Number(endpoint.split('/').pop());
          data = { business: { id, name: `Calendar Shop ${String(id).padStart(2, '0')}`, status: 'active', currency: 'Ks' }, billing: { is_valid: false, subscription: null }, billing_history: [], business_summary: {} };
        }
        return route.fulfill({ json: data });
      });
      await page.goto(`${origin}/#/subscription-calendar`);
      const grid = page.getByRole('grid');
      await grid.waitFor();
      await page.waitForFunction(() => !!document.querySelector('.office-subscription-day[data-day$="-13"]:not(:disabled)'));
      await page.evaluate(() => document.fonts.ready);
      const day = page.locator(`.office-subscription-day[data-day="${initialMonth}-13"]`);
      assert.ok((await day.textContent()).includes('Total 27'));
      assert.ok(await day.evaluate(node => node.classList.contains('is-danger')));
      assert.equal(await page.getByRole('table').count(), 0, 'Main view is a calendar');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/office-subscription-calendar/${width}-calendar.png`, fullPage: true });
      await page.getByRole('button', { name: 'Next month', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('[aria-label="Subscription expiry calendar"]').getAttribute('aria-busy').includes('true'));
      await page.getByRole('button', { name: 'Previous month', exact: true }).click();
      await page.waitForFunction(() => !!document.querySelector('.office-subscription-day[data-day$="-13"]:not(:disabled)'));
      await day.click();
      const dialog = page.getByRole('dialog'); await dialog.getByText('Calendar Shop 25', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Load more', exact: true }).click(); await dialog.getByText('Calendar Shop 27', { exact: true }).waitFor();
      await page.screenshot({ path: `artifacts/office-subscription-calendar/${width}-day-panel.png` });
      const view = dialog.getByRole('button', { name: 'View business', exact: true }).nth(3);
      await view.scrollIntoViewIfNeeded();
      const before = { calendarReads, dayReads };
      const scroll = await page.evaluate(() => {
        window.calendarGridNode = document.querySelector('.office-calendar-grid');
        window.calendarDialogNode = document.querySelector('.office-calendar-day-modal');
        return document.querySelector('.office-calendar-day-modal .office-modal-body').scrollTop;
      });
      await view.click(); await page.waitForURL('**/#/businesses/4');
      await page.getByRole('heading', { name: 'Business overview', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back to Subscription calendar', exact: true }).click();
      await page.waitForURL('**/#/subscription-calendar'); await dialog.waitFor();
      assert.deepEqual({ calendarReads, dayReads }, before, 'Back causes no refetch');
      assert.equal(await dialog.locator('li').count(), 27, 'Loaded day businesses retained');
      assert.ok(await page.evaluate(() => document.querySelector('.office-calendar-grid') === window.calendarGridNode && document.querySelector('.office-calendar-day-modal') === window.calendarDialogNode));
      assert.equal(await dialog.locator('.office-modal-body').evaluate(node => node.scrollTop), scroll);
      await page.goForward(); await page.waitForURL('**/#/businesses/4'); await page.goBack(); await dialog.waitFor();
      assert.deepEqual({ calendarReads, dayReads }, before, 'Browser Back retains calendar and panel');
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await day.focus(); await day.press('ArrowRight');
      assert.ok(await page.locator(':focus').getAttribute('data-day').then(value => value.endsWith('-14')));
      await page.locator(':focus').press('Enter'); await page.getByText('No plans end on this date.', { exact: true }).waitFor(); await page.keyboard.press('Escape');
      await page.getByRole('searchbox', { name: 'Search calendar businesses' }).fill('Fixture'); await page.getByRole('searchbox').press('Enter');
      await page.getByRole('button', { name: 'Filters', exact: true }).click(); await page.getByLabel('Plan type').selectOption('paid');
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.office-subscription-day[data-day$="-13"]').textContent.includes('Total 13'));
      await page.screenshot({ path: `artifacts/office-subscription-calendar/${width}-paid-filter.png`, fullPage: true });
      failCalendar = true; await page.getByRole('button', { name: 'Refresh current page', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Calendar fixture unavailable' }).waitFor();
      failCalendar = false; await page.getByRole('button', { name: 'Retry calendar', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.office-calendar-error'));
      failDay = true; await day.click(); await dialog.getByRole('alert').waitFor();
      failDay = false; await dialog.getByRole('button', { name: 'Retry businesses', exact: true }).click(); await dialog.getByText('Calendar Shop 02', { exact: true }).waitFor();
      const filteredReads = { calendarReads, dayReads };
      await dialog.getByRole('button', { name: 'View business', exact: true }).first().click();
      await page.waitForURL('**/#/businesses/2'); await page.getByRole('heading', { name: 'Business overview', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back to Subscription calendar', exact: true }).click(); await dialog.waitFor();
      assert.deepEqual({ calendarReads, dayReads }, filteredReads, 'Filtered return does not refetch');
      assert.equal(await page.getByRole('searchbox').inputValue(), 'Fixture');
      assert.equal(await page.locator('.office-filter-count').textContent(), '1');
      await dialog.getByRole('button', { name: 'Close expirations', exact: true }).click();
      await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await page.getByRole('searchbox').fill('NoSuch'); await page.getByRole('searchbox').press('Enter');
      await page.getByText('No trial or paid plans expire in this month.', { exact: true }).waitFor();
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`Calendar ${width}px: month navigation, counts, day/load-more, nested details/Back, keyboard, filters and error/retry passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
