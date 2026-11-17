const { setDrawerLanguage } = require('./drawer-language.cjs');
// Isolated fixtures only: all API calls intercepted; no live checkout or inventory mutations.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const output = path.resolve(__dirname, '../artifacts/cart-frame',process.env.SELL_BROWSER||'chromium');
const origin = 'http://127.0.0.1:5176';
const products = [
  { id: 1, name: 'Premium Jasmine Rice', base_unit: '5 kg bag', sku: '001', stock: 48, price: 18500, photo: 'rice' },
  { id: 2, name: 'Sunflower Cooking Oil', base_unit: '1 litre', sku: '002', stock: 72, price: 8500, photo: 'oil' },
  { id: 3, name: 'Green Tea — Original', base_unit: '100 g box', sku: '003', stock: 36, price: 3500, photo: 'tea' },
  { id: 4, name: 'Natural Hand Soap', base_unit: '250 ml', sku: '004', stock: 24, price: 4200, photo: 'soap' },
  ...Array.from({ length: 20 }, (_, index) => ({ id: index + 5, name: `Pantry product ${index + 5}`, base_unit: 'Unit', sku: String(index + 5).padStart(3, '0'), stock: 12, price: 2000 })),
].map(product => ({ ...product, category: product.id <= 3 ? 'Food' : 'Household', cost: 1000, prices: [{ name: 'Retail', price: product.price }, { name: 'Wholesale', price: product.price - 100 }], photo_url: product.photo ? `/products/${product.id}/photo` : '' }));
const session = { user: { id: 101, name: 'Fixture Owner', role: 'owner' }, business: { id: 101, name: 'Reference Shop', currency: 'MMK' }, permissions: ['sell', 'products', 'sales', 'shop'], subscription: { is_valid: true } };
const settings = { price_types: 'Retail,Wholesale', payment_methods: 'Cash,KPay', currency: 'MMK' };
const draft = { cart: products.slice(0, 3).map((p, i) => ({ product_id: p.id, product_name: p.name, photo_url: p.photo_url, price_type: 'Retail', unit_price: p.price, unit_cost: p.cost, base_unit: p.base_unit, quantity: i ? 1 : 2, foc_quantity: 0, stock: p.stock })), discount: 0, paidAmount: '', paymentMethod: 'Cash', customer: null };
(async () => {
  await fs.mkdir(output, { recursive: true });
  // Pillow crops are fixture assets only, never deployed as production product images.
  execFileSync('python', ['-c', `
from PIL import Image
from pathlib import Path
out=Path('artifacts/cart-frame')/('${process.env.SELL_BROWSER||'chromium'}')
im=Image.open('docs/design/sell/001-sell-product-selection-default.png')
for name,box in [('rice',(53,502,256,757)),('oil',(102,811,207,1078)),('tea',(60,1129,261,1376)),('soap',(67,1421,250,1586))]:
    im.crop(box).save(out/(name+'.png'))
for filename,name in [('001-sell-product-selection-default.png','sell'),('002-sell-cart-quantity-step-default.png','cart')]:
    Image.open(Path('docs/design/sell')/filename).resize((393,850)).crop((0,33,393,850)).save(out/(name+'-reference-content.png'))
`], { cwd: path.resolve(__dirname, '..') });
  const engine = process.env.SELL_BROWSER || 'chromium';
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, ...(engine === 'firefox' ? {} : { isMobile: true }), hasTouch: true });
    await context.addInitScript(draft => {
      const key = 'mkpos-mobile-sale-draft-v1:101:101';
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(draft));
      localStorage.setItem('mkpos.language', 'en');
    }, draft);
    const page = await context.newPage();
    await context.addInitScript(()=>{if(navigator.mediaDevices) navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Camera permission denied','NotAllowedError');};});
    const calls = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route(`${origin}/api/**`, async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.slice(4);
      calls.push({ endpoint, query: url.search, method: request.method() });
      let response;
      const photo = endpoint.match(/^\/products\/(\d+)\/photo$/);
      if (photo) {
        const product = products.find(p => p.id === Number(photo[1]));
        return route.fulfill({ contentType: 'image/png', body: await fs.readFile(path.join(output, `${product.photo}.png`)) });
      }
      if (endpoint === '/auth/me') response = session;
      else if (endpoint === '/app-config') response = { enabled_modules: ['sell', 'products', 'sales', 'shop'], permissions: session.permissions, business: {} };
      else if (endpoint === '/settings') response = settings;
      else if (endpoint === '/price-types') response = [];
      else if (endpoint === '/categories') response = ['Food', 'Household'];
      else if (endpoint === '/products') {
        const matches = products.filter(p => (!url.searchParams.get('q') || p.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (!url.searchParams.get('category') || p.category === url.searchParams.get('category')));
        const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20);
        response = { items: matches.slice(offset, offset + limit), total: matches.length };
      }
      else if (endpoint.startsWith('/products/barcode/')) response = products[0];
      else if (endpoint === '/shop-admin/chat/config') response = { enabled: false, realtime_enabled: false };
      else response = { items: [], total: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.goto(`${origin}/sell/cart`);
    await page.getByRole('heading',{name:'Cart',exact:true}).waitFor();
    await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.retail-cart-product-photo')];return images.length===3&&images.every(img=>img.complete&&img.naturalWidth>0);});
    async function checkFrame(name){
      await page.evaluate(()=>document.fonts.ready);
      const problems=await page.evaluate(()=>{
        const failures=[];
        for(const card of document.querySelectorAll('.sale-cart-card')){
          const r=card.getBoundingClientRect();
          for(const el of card.querySelectorAll('input,button,strong,h2,small,.retail-quantity-control,.retail-stock-badge')){
            const e=el.getBoundingClientRect();if(e.right>r.right+1||e.left<r.left-1)failures.push(el.className||el.tagName);
          }
        }
        if(document.documentElement.scrollWidth>innerWidth)failures.push('page');
        const footer=document.querySelector('.retail-cart-summary').getBoundingClientRect();
        if(footer.right>innerWidth+1||footer.left< -1)failures.push('summary');
        return failures;
      });
      assert.deepEqual(problems,[],name+' frame overflow');
      await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});
    }
    for(const width of[320,360,393,768]){
      await page.setViewportSize({width,height:817});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await checkFrame('cart-'+width);
      await page.getByLabel('Premium Jasmine Rice quantity',{exact:true}).fill('123456789');await page.getByLabel('Premium Jasmine Rice quantity',{exact:true}).blur();await checkFrame('large-amount-'+width);
      await page.getByLabel('Premium Jasmine Rice quantity',{exact:true}).fill('2');await page.getByLabel('Premium Jasmine Rice quantity',{exact:true}).blur();
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await checkFrame('bottom-'+width);
      const add=await page.getByRole('button',{name:'Add more products',exact:true}).boundingBox(),summary=await page.locator('.retail-cart-summary').boundingBox();assert.ok(add.y+add.height<=summary.y+1,'Add more must clear summary: '+JSON.stringify({add,summary}));
    }
    await page.setViewportSize({width:320,height:817});await page.getByRole('button',{name:'Open app menu',exact:true}).click();await setDrawerLanguage(page, 'my');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.lang==='my');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await checkFrame('myanmar-320');await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await checkFrame('myanmar-bottom-320');
    await page.evaluate(draft=>{draft.cart[0]={...draft.cart[0],product_name:'PremiumJasmineRiceWithAnUnbrokenVeryLongProductNameForNarrowScreens',purchase_unit:'Large wholesale carton with a very long packaging label',purchase_conversion_factor:12,unit_price:987654321,quantity:9999999,stock:999999999};sessionStorage.setItem('mkpos-mobile-sale-draft-v1:101:101',JSON.stringify(draft));},draft);
    await page.reload();await page.getByRole('heading',{name:'Cart',exact:true}).waitFor();await checkFrame('long-content-320');
    assert.deepEqual(errors,[]);assert.ok(calls.every(call=>call.method==='GET'));await fs.writeFile(path.join(output,engine+'-checks.json'),JSON.stringify({engine,errors,calls},null,2));console.log(engine+': cart frame checks passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
