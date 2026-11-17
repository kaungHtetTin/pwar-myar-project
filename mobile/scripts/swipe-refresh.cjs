async function beginPull(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => window.scrollY <= 0);
  const prevented = await page.locator('.swipe-refresh-shell').evaluate(root => {
    function send(type, y) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: [{ clientX: 120, clientY: y }] });
      root.dispatchEvent(event);
      return event.defaultPrevented;
    }
    send('touchstart', 10);
    return send('touchmove', 190);
  });
  if (!prevented) throw new Error('Pull must prevent the native document refresh gesture');
  await page.locator('.swipe-refresh-indicator.is-ready').waitFor();
}

async function releasePull(page) {
  await page.locator('.swipe-refresh-shell').dispatchEvent('touchend');
}

async function pullToRefresh(page) {
  await beginPull(page);
  await releasePull(page);
  await page.waitForLoadState('networkidle');
  await page.locator('.swipe-refresh-shell').evaluate(root => new Promise(resolve => {
    if (root.getAttribute('aria-busy') === 'false') return resolve();
    const observer = new MutationObserver(() => {
      if (root.getAttribute('aria-busy') === 'false') { observer.disconnect(); resolve(); }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['aria-busy'] });
  }));
}

module.exports = { beginPull, releasePull, pullToRefresh };
