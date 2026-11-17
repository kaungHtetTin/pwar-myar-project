const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../shop/node_modules/playwright');

// Local fixtures only: exercise real BroadcastChannel and Web Locks across pages.
const source = fs.readFileSync(path.join(__dirname, '../shared/network/backgroundTabs.js'));
const deliverySource = fs.readFileSync(path.join(__dirname, '../shared/network/assistantDelivery.js'));
const fixture = `<script type="module">
import { shareBackgroundFeed, createCooldownChannel, invalidateBackgroundSession } from '/backgroundTabs.js';
import { monitorAssistantDelivery } from '/assistantDelivery.js';
window.starts = 0; window.received = []; window.cooldowns = [];
window.setup = key => {
  window.stop = shareBackgroundFeed(key, emit => {
    window.starts++; window.emit = emit; window.leader = true;
    emit({ ready: true });
    return () => { window.leader = false; };
  }, value => window.received.push(value));
};
window.cooldown = createCooldownChannel((key, until) => window.cooldowns.push({ key, until }));
window.invalidate = invalidateBackgroundSession;
window.deliveryCalls = 0; window.deliveryReceipts = [];
window.setupDelivery = () => {
  window.stopDelivery = monitorAssistantDelivery(async () => {
    window.deliveryCalls++;
    return {status: window.completed ? 'completed' : 'pending', items: []};
  }, '/ai-assistant/conversations/1/messages/saved/delivery', '7:3', data => window.deliveryReceipts.push(data));
};
window.ready = true;
</script>`;

(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(req.url === '/backgroundTabs.js' ? source : req.url === '/assistantDelivery.js' ? deliverySource : fixture);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const url = `http://127.0.0.1:${server.address().port}`;
    const open = async () => { const page = await context.newPage(); await page.goto(url); await page.waitForFunction(() => window.ready); return page; };
    const first = await open(), second = await open();
    await Promise.all([first, second].map(page => page.evaluate(() => window.setup('chat:/shop-admin/chat:business:7:3'))));
    await first.waitForFunction(() => window.received.length);
    await second.waitForFunction(() => window.received.length);
    assert.equal(await first.evaluate(() => window.starts) + await second.evaluate(() => window.starts), 1, 'One feed per account');
    const leader = await first.evaluate(() => window.leader) ? first : second;
    const follower = leader === first ? second : first;
    await leader.evaluate(() => window.emit({ cursor: 14, unread_count: 2 }));
    await follower.waitForFunction(() => window.received.some(value => value.cursor === 14));
    await Promise.all([leader, follower].map(page => page.evaluate(() => window.cooldown.identity('business:7:3'))));
    await leader.evaluate(() => window.cooldown.send('chat-background', Date.now() + 45000));
    await follower.waitForFunction(() => window.cooldowns.length > 0);
    const other = await open();
    await other.evaluate(() => { window.setup('chat:/shop-admin/chat:business:8:3'); window.cooldown.identity('business:8:3'); });
    await other.waitForFunction(() => window.leader);
    assert.equal(await other.evaluate(() => window.received.some(value => value.cursor === 14)), false, 'Account isolation');
    assert.equal(await other.evaluate(() => window.cooldowns.length), 0, 'Account cooldown isolation');
    const newcomer = await open();
    const previousCount = await follower.evaluate(() => window.received.length);
    await newcomer.evaluate(() => window.setup('chat:/shop-admin/chat:business:7:3'));
    await newcomer.waitForFunction(() => window.received.some(value => value.cursor === 14));
    assert.equal(await follower.evaluate(() => window.received.length), previousCount, 'Joining tab does not replay notices to existing tabs');
    await newcomer.evaluate(() => window.stop());
    await newcomer.evaluate(() => window.cooldown.identity('business:7:3'));
    await newcomer.waitForFunction(() => window.cooldowns.length > 0);
    await leader.close();
    await follower.waitForFunction(() => window.leader, null, { timeout: 6000 });
    await follower.evaluate(() => window.invalidate('business'));
    assert.equal(await follower.evaluate(() => window.leader), false, 'Logout stops local feed');
    await other.waitForFunction(() => !window.leader);
    // No browser coordination support must still deliver normal background updates.
    await newcomer.evaluate(() => { Object.defineProperty(navigator, 'locks', { value: undefined }); window.setup('chat:fallback'); });
    assert.equal(await newcomer.evaluate(() => window.received.length), 2);
    await context.close();
    const deliveryContext = await browser.newContext();
    const deliveryPages = await Promise.all([deliveryContext.newPage(), deliveryContext.newPage()]);
    for (const page of deliveryPages) { await page.goto(url); await page.waitForFunction(() => window.ready); }
    await Promise.all(deliveryPages.map(page => page.evaluate(() => window.setupDelivery())));
    for (const page of deliveryPages) await page.waitForFunction(() => window.deliveryReceipts.length);
    assert.equal((await Promise.all(deliveryPages.map(page => page.evaluate(() => window.deliveryCalls)))).reduce((a, b) => a + b), 1, 'One delivery GET across tabs');
    for (const page of deliveryPages) await page.evaluate(() => { window.completed = true; });
    for (const page of deliveryPages) await page.waitForFunction(() => window.deliveryReceipts.some(data => data.receipt.status === 'completed'));
    assert.equal((await Promise.all(deliveryPages.map(page => page.evaluate(() => window.deliveryCalls)))).reduce((a, b) => a + b), 2, 'One completion GET shared by both tabs');
    await deliveryContext.close();
    console.log('PASS: single leader, snapshot fanout, account isolation, cooldown handoff, crash recovery, auth cleanup, fallback, shared AI delivery');
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
