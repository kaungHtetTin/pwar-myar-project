const fs=require('node:fs'),path=require('node:path'),postcss=require('../frontend/node_modules/postcss');
const parser=require('../frontend/node_modules/@babel/parser'),traverse=require('../frontend/node_modules/@babel/traverse').default;
const {chromium}=require('../shop/node_modules/playwright');
const root=path.resolve(__dirname,'..'), candidates=[];
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
for(const app of ['office','frontend','mobile','shop','landing'])for(const file of walk(app==='landing'?path.join(root,'laravel/public/landing'):path.join(root,app,'src'))){
 if(/\.test\.|themeRuntime|platformBranding/.test(file))continue;
 const text=fs.readFileSync(file,'utf8');
 if(file.endsWith('.css'))postcss.parse(text).walkDecls(decl=>{
  if(!/color|fill|stroke|background|shadow|border|outline|accent|^--/.test(decl.prop))return;let p=decl.parent;while(p){if(p.type==='atrule'&&p.name==='media'&&/print/.test(p.params))return;p=p.parent;}
  let value=decl.value.replace(/url\((?:[^()'"\\]|\\.|'[^']*'|"[^"]*")*\)/gi,'');
  // Variable names are identifiers; only standalone words can be named colors.
  for(const match of value.matchAll(/(?<![-\w])[a-zA-Z]+(?![-\w])/g))if(!['transparent','currentcolor','inherit','initial','unset','revert','none','auto'].includes(match[0].toLowerCase()))candidates.push({value:match[0],file:path.relative(root,file),line:decl.source.start.line});
 });
 else if(/\.(jsx|js)$/.test(file)&&!/printing|Print\.js|Receipt\.jsx|barcodeSettings|productPhoto/.test(path.basename(file))){
  const ast=parser.parse(text,{sourceType:'module',plugins:['jsx']});
  traverse(ast,{StringLiteral(p){const key=p.parent.key?.name||p.parent.name?.name||'';if(/^(color|background|backgroundColor|border|borderColor|stroke|fill|stopColor)$/.test(key)&&!p.node.value.includes('var('))for(const token of p.node.value.split(/\s+/))candidates.push({value:token,file:path.relative(root,file),line:p.node.loc.start.line});}});
 }
}
(async()=>{const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();const values=[...new Set(candidates.map(c=>c.value))].filter(value=>!['transparent','currentcolor','inherit','initial','unset','revert','none','auto'].includes(value.toLowerCase()));const actual=await page.evaluate(values=>values.filter(value=>CSS.supports('color',value)),values);const issues=candidates.filter(c=>actual.includes(c.value));if(issues.length)throw new Error(JSON.stringify(issues,null,2));console.log('Browser CSS parser found no remaining hardcoded named colors or inline JS paint colors.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
