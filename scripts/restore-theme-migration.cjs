// Restore only the replacements recorded by the migration, for classification refinements.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('../frontend/node_modules/postcss');
const root = path.resolve(__dirname, '..');
const {records} = JSON.parse(fs.readFileSync(path.join(root,'shared/theme/color-migration.json'),'utf8'));
const grouped = new Map();
for(const item of records){if(!grouped.has(item.file))grouped.set(item.file,[]);grouped.get(item.file).push(item);}
for(const [file, entries] of grouped){
 const full=path.join(root,file);let source=fs.readFileSync(full,'utf8');
 function restore(value,list){let cursor=0;for(const entry of list){const token=`var(--theme-${entry.role.replaceAll('_','-')})`;let start=value.indexOf(token,cursor);if(start<0){if(value.includes('transparent'))continue;throw new Error(`${file}:${entry.line} missing ${token}`);}let end=start+token.length;
  // Alpha colors replace the entire color-mix expression.
  const before=value.slice(0,start);const mix=before.lastIndexOf('color-mix(in srgb, ');if(mix>=cursor && before.slice(mix)==='color-mix(in srgb, '){start=mix;end=value.indexOf('transparent)',end)+'transparent)'.length;}
  value=value.slice(0,start)+entry.original+value.slice(end);cursor=start+entry.original.length;
 }return value;}
 if(file.endsWith('.css')){const ast=postcss.parse(source);ast.walkDecls(decl=>{const list=entries.filter(e=>e.line===decl.source.start.line&&e.property===decl.prop&&e.selector===(decl.parent.selector||''));if(list.length)decl.value=restore(decl.value,list);});source=ast.toString();}
 else{source=restore(source,entries);}
 fs.writeFileSync(full,source);
}
console.log('Restored recorded color literals.');
