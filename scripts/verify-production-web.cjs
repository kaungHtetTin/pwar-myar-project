// Smoke-test compiled production assets locally; every remote API is intercepted.
const {chromium}=require('../shop/node_modules/playwright');
const {createServer}=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 const version=JSON.parse(await fs.readFile('frontend/package.json','utf8')).version;
 const output=`artifacts/release-${version}-web-smoke`;await fs.mkdir(output,{recursive:true});
 try{
  for(const app of ['app','mobile','office','shop','shop-hosting']){
   const base=app==='shop-hosting'?path.resolve('laravel/shop'):path.resolve('laravel/public',app);
   const server=createServer(async(req,res)=>{
    try{
     let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
     if(file!==base&&!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
     if(file===base)file=path.join(base,'index.html');
     const bytes=await fs.readFile(file);
     res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream'});res.end(bytes);
    }catch{res.writeHead(404);res.end();}
   });
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   const page=await browser.newPage({viewport:{width:app==='mobile'?390:1440,height:900},serviceWorkers:'block'});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='127.0.0.1')return route.continue();
    if(!url.hostname.endsWith('pwarmyar.com'))return route.abort();
    assert.ok(['GET','HEAD','OPTIONS'].includes(req.method()),'A smoke test must never mutate server data.');
    const headers={'Access-Control-Allow-Origin':req.headers().origin||'*','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(url.pathname.endsWith('/auth/me'))return route.fulfill({status:401,headers,json:{message:'Unauthenticated.'}});
    return route.fulfill({headers,json:{items:[],total:0,has_more:false,enabled:false,realtime_enabled:false,theme_mode:'light',primary_color:'#087f74'}});
   });
   try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>document.querySelector('#root')?.children.length>0);
    if(!app.startsWith('shop'))await page.locator('input[type=password]').first().waitFor();
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`${output}/${app}.png`,fullPage:true});
    console.log(JSON.stringify({app,production_bundle_mounted:true,login_form:!app.startsWith('shop'),page_errors:errors.length}));
   }finally{await page.close();await new Promise(resolve=>server.close(resolve));}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
