async function setDrawerLanguage(scope, language) {
  const toggle = await scope.locator('.language-toggle').elementHandle();
  const checked = String(language === 'my');
  if (await toggle.getAttribute('aria-checked') !== checked) await toggle.click();
  await toggle.evaluate((button, wanted) => new Promise(resolve => {
    if (button.getAttribute('aria-checked') === wanted) return resolve();
    const observer = new MutationObserver(() => {
      if (button.getAttribute('aria-checked') === wanted) { observer.disconnect(); resolve(); }
    });
    observer.observe(button, { attributes: true, attributeFilter: ['aria-checked'] });
  }), checked);
}

module.exports = { setDrawerLanguage };
