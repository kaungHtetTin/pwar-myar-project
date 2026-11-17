// One-time semantic migration; the generated manifest records every affected declaration.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('../frontend/node_modules/postcss');
const parser = require('../frontend/node_modules/@babel/parser');
const traverse = require('../frontend/node_modules/@babel/traverse').default;
const root = path.resolve(__dirname, '..');
const pattern = /#[\da-f]{3,8}\b|rgba?\([^()]*\)|hsla?\([^()]*\)|(?<![-\w])(?:white|black|whitesmoke|red|darkred|green|blue|gray|grey|lightgray|lightgrey|silver|navy|orange)(?![-\w])/gi;
const names = { white:'#ffffff', black:'#000000', whitesmoke:'#f5f5f5', red:'#ff0000', darkred:'#8b0000', green:'#008000', blue:'#0000ff', gray:'#808080', grey:'#808080', lightgray:'#d3d3d3', lightgrey:'#d3d3d3', silver:'#c0c0c0', navy:'#000080', orange:'#ffa500' };
const records = [], exceptions = [];
function walk(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
function rgb(value) {
  value = names[value.toLowerCase()] || value.toLowerCase();
  if (value.startsWith('#')) { let hex=value.slice(1); if (hex.length<=4) hex=[...hex].map(c=>c+c).join(''); if (![6,8].includes(hex.length)) return null; return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).concat(hex.length===8?parseInt(hex.slice(6),16)/255:1); }
  const parts=value.slice(value.indexOf('(')+1,-1).split(/[,/\s]+/).filter(Boolean);
  if (/^rgba?/.test(value)) return parts.slice(0,3).map(v=>v.endsWith('%')?parseFloat(v)*2.55:Number(v)).concat(parts[3]?.endsWith('%')?parseFloat(parts[3])/100:Number(parts[3]??1));
  if (/^hsla?/.test(value)) { const h=parseFloat(parts[0])/60,s=parseFloat(parts[1])/100,l=parseFloat(parts[2])/100,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(h%2-1)),m=l-c/2; const v=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];return v.map(v=>(v+m)*255).concat(Number(parts[3]??1)); }
  return null;
}
function hsl(channels) { const [r,g,b]=channels.map(x=>x/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0;if(d){h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;h*=60;}return [h,d===0?0:d/(1-Math.abs(2*l-1)),l]; }
function semantic(value, prop, selector, parent) {
  const channels=rgb(value); if(!channels || channels.some(Number.isNaN))return null;
  const [h,s,l]=hsl(channels.slice(0,3)), alpha=channels[3];
  const text=/^(?:color|fill|stroke|stop-color|caret-color|accent-color|-webkit-text-fill-color)$/.test(prop);
  const shadow=/shadow|filter/.test(prop), border=/border|outline|line|divider/.test(prop);
  const hint=(selector+' '+prop).toLowerCase();
  const sidebar=/sidebar|side-nav|main-nav|nav-brand|office-nav|account-footer/.test(selector);
  let role;
  if(shadow) role=l>.9?'inverse_text':'shadow';
  else if(prop.startsWith('--') && /(?:text|ink|label|muted|canvas|surface|background|border|line|brand|danger|success|warning|info|accent)/.test(prop)) {
    if(/(?:danger|error)/.test(prop)) role=/bg|soft|light/.test(prop)?'danger_soft':'danger_text';
    else if(/warning/.test(prop)) role=/bg|soft/.test(prop)?'warning_soft':'warning_text';
    else if(/success/.test(prop)) role=/bg|soft/.test(prop)?'success_soft':'success_text';
    else if(/info/.test(prop)) role=/bg|soft/.test(prop)?'info_soft':'info_text';
    else if(/border|line/.test(prop)) role='border';
    else if(/muted/.test(prop)) role='text_muted';
    else if(/text|ink|label/.test(prop)) role='text';
    else if(/canvas|background|bg/.test(prop)) role='background';
    else if(/surface/.test(prop)) role=/soft|muted/.test(prop)?'surface_muted':'surface';
    else if(/accent/.test(prop)) role='secondary_soft';
    else if(/950/.test(prop))role='sidebar';
    else if(/900|hover/.test(prop))role='primary_hover';
    else if(/100|soft|light/.test(prop))role='primary_soft';
    else role='primary';
  }
  if (!role) {
    let family = s>.35 ? (h<22||h>=340?'danger':h<65?'warning':h<95?'secondary':h<185?'primary':h<260?'info':'secondary') : null;
    if(family==='primary' && /success|positive|profit|paid|is-valid|online|status-active|is-approved/.test(hint)) family='success';
    if (border) role='border';
    else if(sidebar && !text && (l<.5 || /background/.test(prop)))role='sidebar';
    else if(sidebar && text)role=l>.7?'sidebar_text':'sidebar_muted';
    else if(text) {
      if(l>.90) {
        const backgrounds=parent?.nodes?.filter(n=>n.type==='decl' && /background/.test(n.prop)).map(n=>n.value).join(' ')||'';
        const backgroundColor=backgrounds.match(pattern)?.map(rgb).find(Boolean);
        const bgFamily=backgroundColor&&hsl(backgroundColor.slice(0,3));
        role=bgFamily&&bgFamily[1]>.15&&bgFamily[0]<22?'on_danger':bgFamily&&bgFamily[1]>.15&&bgFamily[0]>=185&&bgFamily[0]<260?'on_info':/danger|error|delete/.test(hint)?'on_danger':/secondary/.test(hint)?'on_secondary':'on_primary';
        if(/tooltip|toast|dark|inverse/.test(hint))role='inverse_text';
      } else role=l<.16?'text':family?`${family}_text`:l>.25?'text_muted':'text';
    } else if(family)role=l>.70?`${family}_soft`:family;
    else role=l>.98?'surface':l>.91?'background':l>.70?'surface_muted':l<.23?'inverse_surface':'surface_raised';
  }
  if(alpha===0)return {role,css:'transparent'};
  const token=`var(--theme-${role.replaceAll('_','-')})`;
  return {role, css:alpha<1?`color-mix(in srgb, ${token} ${Number((alpha*100).toFixed(3))}%, transparent)`:token};
}
function transform(value, prop, selector, parent, file, line) {
  // Embedded image bytes and resource URLs are artwork, not CSS UI colors.
  const urls=[];value=value.replace(/url\((?:[^()'"\\]|\\.|'[^']*'|"[^"]*")*\)/gi,url=>{urls.push(url);return `__MKPOS_URL_${urls.length-1}__`;});
  value=value.replace(pattern, match=>{
    const mapping=semantic(match,prop,selector,parent);if(!mapping)return match;
    records.push({file:path.relative(root,file).replaceAll('\\','/'),line,property:prop,selector,original:match,role:mapping.role});return mapping.css;
  });
  return value.replace(/__MKPOS_URL_(\d+)__/g,(_,i)=>urls[Number(i)]);
}
const appNames={frontend:'Desktop',office:'Office',mobile:'Mobile',shop:'Shop',landing:'Website'};
for(const app of ['frontend','office','mobile','shop','landing']) {
 const dir=app==='landing'?path.join(root,'laravel/public/landing'):path.join(root,app,'src');
 for(const file of walk(dir)) {
  const name=path.basename(file);if(name.includes('.test.')||['themeRuntime.js','platformBranding.js'].includes(name))continue;
  const original=fs.readFileSync(file,'utf8');let output=original;
  if(file.endsWith('.css')) {
   const ast=postcss.parse(original,{from:file});ast.walkDecls(decl=>{
    let p=decl.parent,printed=false;while(p){if(p.type==='atrule'&&p.name==='media'&&/print/.test(p.params))printed=true;p=p.parent;}
    if(printed){if(pattern.test(decl.value))exceptions.push({file:path.relative(root,file),reason:'Printed document',line:decl.source.start.line});pattern.lastIndex=0;return;}
    decl.value=transform(decl.value,decl.prop,decl.parent.selector||'',decl.parent,file,decl.source.start.line);
    if(/^(color|fill|stroke)$/.test(decl.prop))decl.value=decl.value.replace(/var\(--(?:brand(?:-\d+|-2)?|office-brand|green(?:-\d+)?)\)/g,'var(--theme-primary-text)').replace(/var\(--white\)/g,'var(--theme-on-primary)');
   }); output=ast.toString();
  }else if(/\.(jsx|js)$/.test(file)) {
   if(/printing|Print\.js|Receipt\.jsx|barcodeSettings|productPhoto|themeRuntime|platformBranding/i.test(name)){if(original.match(pattern))exceptions.push({file:path.relative(root,file),reason:'Printed document, barcode or uploaded-image pixels'});continue;}
   const ast=parser.parse(original,{sourceType:'module',plugins:['jsx']});const edits=[];
   traverse(ast,{StringLiteral(nodePath){const n=nodePath.node;if(!/^(#[\da-f]{3,8}|rgba?\([^)]*\))$/i.test(n.value))return;
    if(n.value.length===4 && n.value==='#039')return;
    const prop=nodePath.parent.key?.name||nodePath.parent.name?.name||'color';
    const css=transform(n.value,prop,'',null,file,n.loc.start.line);if(css!==n.value)edits.push({start:n.start,end:n.end,text:JSON.stringify(css)});
   }});for(const edit of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);
  }
  if(output!==original)fs.writeFileSync(file,output);
 }
}
const roles={};for(const record of records){const app=record.file.startsWith('laravel/')?'Website':appNames[record.file.split('/')[0]];roles[record.role]??={apps:[],occurrences:0};if(!roles[record.role].apps.includes(app))roles[record.role].apps.push(app);roles[record.role].occurrences++;}
fs.writeFileSync(path.join(root,'shared/theme/color-migration.json'),JSON.stringify({records,exceptions},null,2)+'\n');
fs.writeFileSync(path.join(root,'office/src/themeUsage.json'),JSON.stringify({roles},null,2)+'\n');
console.log(`Mapped ${records.length} UI color usages to ${Object.keys(roles).length} semantic roles. ${exceptions.length} print/image declarations retained.`);
