const fs = require('node:fs');
const path = require('node:path');
const postcss = require('../frontend/node_modules/postcss');
const root=path.resolve(__dirname,'..');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
for(const app of ['office','frontend','mobile','shop']) for(const file of walk(path.join(root,app,'src')).filter(f=>f.endsWith('.css'))){
 const original=fs.readFileSync(file,'utf8'), ast=postcss.parse(original);
 ast.walkRules(rule=>{
  const background=rule.nodes.filter(n=>n.type==='decl'&&['background','background-color'].includes(n.prop)).at(-1)?.value;
  const backgroundRole=/^var\(--theme-([\w-]+)\)$/.exec(background||'')?.[1] || (background==='var(--danger)'?'danger':null);
  rule.walkDecls(decl=>{
   if(decl.prop==='color'){
    decl.value=decl.value.replace(/var\(--danger\)/g,'var(--theme-danger-text)');
    if(decl.value==='var(--theme-on-primary)'&&backgroundRole){
     const role=['primary','secondary','success','warning','danger','info'].includes(backgroundRole)?`on-${backgroundRole}`:backgroundRole.endsWith('-soft')?`${backgroundRole.slice(0,-5)}-text`:['surface','background','surface-raised','surface-muted'].includes(backgroundRole)?'text':backgroundRole==='inverse-surface'?'inverse-text':null;
     if(role)decl.value=`var(--theme-${role})`;
    }
   }
   if(/:focus/.test(rule.selector)&&/outline|border/.test(decl.prop))decl.value=decl.value.replaceAll('var(--theme-border)','var(--theme-focus)');
  });
  if(!/sidebar|workspace-nav/.test(rule.selector))return;
  const selected=/selected|\.active\b|aria-current/.test(rule.selector);
  rule.walkDecls(decl=>{
   if(/background/.test(decl.prop) && /var\(--(?:theme-sidebar|platform-primary|brand-9)/.test(decl.value))decl.value=`var(--theme-${selected?'sidebar-selected':'sidebar'})`;
   if(selected && decl.prop==='color')decl.value='var(--theme-sidebar-selected-text)';
  });
 });
 const value=ast.toString();if(value!==original)fs.writeFileSync(file,value);
}
// The live usage inventory is generated from current source, not from original migration guesses.
const roles={}, derived=new Map(), formulas=new Map();
const names={office:'Office',frontend:'Desktop',mobile:'Mobile',shop:'Shop',landing:'Website'};
for(const app of Object.keys(names))for(const file of walk(app==='landing'?path.join(root,'laravel/public/landing'):path.join(root,app,'src'))){
 if(!/\.(css|jsx|js)$/.test(file)||/\.test\.|themeRuntime|platformBranding/.test(file))continue;
 const text=fs.readFileSync(file,'utf8');
 for(const match of text.matchAll(/var\(--theme-([\w-]+)\)/g)){
  const role=match[1].replaceAll('-','_');roles[role]??={apps:[],occurrences:0};if(!roles[role].apps.includes(names[app]))roles[role].apps.push(names[app]);roles[role].occurrences++;
 }
 for(const match of text.matchAll(/color-mix\(in srgb, var\(--theme-([\w-]+)\) ([\d.]+)%, transparent\)/g)){
  const key=`${match[1]}:${match[2]}`;
  if(!derived.has(key))derived.set(key,{role:match[1].replaceAll('-','_'),opacity:Number(match[2])/100,apps:[]});
  const row=derived.get(key);if(!row.apps.includes(names[app]))row.apps.push(names[app]);
 }
 for(const match of (file.endsWith('.css') ? text : '').matchAll(/color-mix\(/g)){
  let depth=1,index=match.index+match[0].length;
  while(index<text.length&&depth){if(text[index]==='(')depth++;if(text[index]===')')depth--;index++;}
  const expression=text.slice(match.index,index);
  if(/^color-mix\(in srgb, var\(--theme-[\w-]+\) [\d.]+%, transparent\)$/.test(expression))continue;
  if(!formulas.has(expression))formulas.set(expression,{expression,apps:[]});
  const row=formulas.get(expression);if(!row.apps.includes(names[app]))row.apps.push(names[app]);
 }
}
fs.writeFileSync(path.join(root,'office/src/themeUsage.json'),JSON.stringify({roles,derived:[...derived.values()],formulas:[...formulas.values()]},null,2)+'\n');
console.log('Theme roles refined and current color inventory rebuilt.');
