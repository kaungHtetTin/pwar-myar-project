const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const postcss = require('../frontend/node_modules/postcss');
const parser = require('../frontend/node_modules/@babel/parser');
const traverse = require('../frontend/node_modules/@babel/traverse').default;
const root=path.resolve(__dirname,'..');
const authOnly=process.argv.includes('--auth');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
(async()=>{
 const source=fs.readFileSync(path.join(root,'shared/theme/themeRuntime.js'),'utf8');
 const runtime=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const roles=new Set(runtime.themeRoles.map(role=>role.replaceAll('_','-'))),issues=[];
 for(const file of ['office','frontend','mobile','shop'].map(app=>`${app}/src/themeRuntime.js`).concat('laravel/public/landing/themeRuntime.js'))assert.equal(fs.readFileSync(path.join(root,file),'utf8'),source,`${file} out of sync`);
 let declarations=0;
 for(const app of ['office','frontend','mobile','shop','landing'])for(const file of walk(app==='landing'?path.join(root,'laravel/public/landing'):path.join(root,app,'src'))){
  if(/themeRuntime|platformBranding|\.test\./.test(file))continue;
  if(file.endsWith('.css')){
   postcss.parse(fs.readFileSync(file,'utf8')).walkDecls(decl=>{
    if(authOnly&&!/auth|password-reset|office-login/i.test(decl.parent.selector||''))return;
    let parent=decl.parent;while(parent){if(parent.type==='atrule'&&parent.name==='media'&&/print/.test(parent.params))return;parent=parent.parent;}
    if(decl.prop==='content')return;
    const value=decl.value.replace(/url\((?:[^()'"\\]|\\.|'[^']*'|"[^"]*")*\)/gi,'');
    if(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|(?<![-\w])(?:white|black|red|green|blue|gray|grey|silver|navy|orange)(?![-\w])/i.test(value))issues.push(`${path.relative(root,file)}:${decl.source.start.line} hardcoded UI color`);
    if(/var\(--var\(/.test(value))issues.push(`${file}:${decl.source.start.line} malformed theme variable`);
    for(const match of value.matchAll(/var\(--theme-([\w-]+)\)/g))if(!roles.has(match[1]))issues.push(`${file}: unknown role ${match[1]}`);
    declarations++;
   });
  }else if(/\.(jsx|js)$/.test(file)&&!/printing|Print\.js|Receipt\.jsx|barcodeSettings|productPhoto/i.test(path.basename(file))){
   if(authOnly&&!/auth|password-reset/i.test(path.basename(file)))continue;
   const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx']});
   traverse(ast,{StringLiteral(p){if(/^(#[\da-f]{6,8}|rgba?\([^)]*\))$/i.test(p.node.value))issues.push(`${path.relative(root,file)}:${p.node.loc.start.line} hardcoded JS UI color`);}});
  }
 }
 assert.deepEqual(issues,[]);
 const cases=['#0e684e','#4f46e5','#ffff00','#000000','#ffffff','#ff0000','#00ffff'];
 for(const primary of cases){
  const palettes=runtime.makeThemePalettes(primary);
  const php=spawnSync('php',['-r',"require 'vendor/autoload.php'; echo json_encode(\\App\\Support\\ThemePalette::generate(trim(stream_get_contents(STDIN))));"],{cwd:path.join(root,'laravel'),input:primary,encoding:'utf8'});
  assert.equal(php.status,0,php.stderr);assert.deepEqual(palettes,JSON.parse(php.stdout),'PHP and JS palette algorithms must match');
  for(const palette of Object.values(palettes))for(const [fg,bg] of [['text','surface'],['text_muted','surface'],['primary_text','primary_soft'],['on_primary','primary'],['sidebar_text','sidebar'],['sidebar_selected_text','sidebar_selected']])assert.ok(runtime.themeContrast(palette[fg],palette[bg])>=4.5,`${primary} ${fg}/${bg}`);
 }
 console.log(`${authOnly?'Authentication theme':'Theme'} audit passed: ${declarations} CSS declarations${authOnly?' in authentication rules':', all four app JS sources and Website CSS'}; no hardcoded UI colors in scope. PHP/JS parity and contrast passed for ${cases.length} boundary colors.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
