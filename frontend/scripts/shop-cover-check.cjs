const { chromium } = require('../../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.on('pageerror', error => console.error(error.message));
    const writes = [];
    const image = fs.readFileSync('../shop/src/assets/home-local-groceries.webp');
    const png = `data:image/webp;base64,${image.toString('base64')}`;
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.route('**/api/shop-admin/cover', route => {
      writes.push(route.request().method());
      return route.fulfill({ json: { cover_data_url: route.request().method() === 'DELETE' ? '' : png } });
    });
    await page.route('**/__cover-preview', route => route.fulfill({ contentType: 'text/html', body: `<html><body><div id="root"></div><script type="module">
      import R from '/@react-refresh'; R.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>t=>t; window.__vite_plugin_react_preamble_installed__=true;
      const source=await (await fetch('/src/screens/ShopCoverSettings.jsx')).text();
      const reactUrl=source.match(/"([^" ]*react.js\\?[^" ]+)"/)[1];
      const React=(await import(reactUrl)).default;
      const client=await import(reactUrl.replace('react.js','react-dom_client.js')); const {createRoot}=client.default || client;
      const {ShopCoverSettings}=await import('/src/screens/ShopCoverSettings.jsx');
      await import('/src/styles.css');
      await import('/src/styles/shop.css');
      function App(){const [cover,setCover]=React.useState('');return React.createElement('main',{style:{padding:'32px',fontFamily:'Arial',background:'#fff'}},React.createElement('h2',null,'Storefront'),React.createElement('input',{'aria-label':'Public shop name',defaultValue:'Unsaved shop draft'}),React.createElement(ShopCoverSettings,{cover,onChange:setCover}));}
      createRoot(document.getElementById('root')).render(React.createElement(App));
    </script></body></html>` }));
    await page.goto('http://127.0.0.1:5174/__cover-preview');
    await page.getByRole('button', { name: 'Upload cover photo' }).waitFor();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload cover photo' }).click();
    await (await chooser).setFiles({ name: 'cover.webp', mimeType: 'image/webp', buffer: image });
    await page.getByRole('button', { name: 'Replace cover photo' }).waitFor();
    assert.equal(await page.getByLabel('Public shop name').inputValue(), 'Unsaved shop draft');
    fs.mkdirSync('test-artifacts/shop-cover', { recursive: true });
    await page.screenshot({ path: 'test-artifacts/shop-cover/settings.png' });
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Remove cover photo' }).click();
    assert.equal(writes.length, 1);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Remove cover photo' }).click();
    await page.getByRole('button', { name: 'Upload cover photo' }).waitFor();
    assert.deepEqual(writes, ['POST', 'DELETE']);
    console.log('PASS: upload picker, preview, preserved draft, cancel/confirmed removal. Writes intercepted.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
