/* Read-only source/doc validation; writes only the derived screen inventory. */
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs/ui-ux');
const fail = [];
const manifest = JSON.parse(fs.readFileSync(path.join(docs, 'component-inventory.json'), 'utf8'));
const catalog = fs.readFileSync(path.join(docs, '03-component-catalog.md'), 'utf8');
const spec = fs.readFileSync(path.join(docs, '02-screen-specifications.md'), 'utf8');
const files = [path.join(root, 'UI-UX-HANDOFF.md'), ...fs.readdirSync(docs).filter(f => f.endsWith('.md')).map(f => path.join(docs, f))];
let links = 0;
function validateLinks() {
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [relative, anchor] = target.split('#');
    const resolved = path.resolve(path.dirname(file), relative);
    if (!fs.existsSync(resolved)) fail.push(`Broken link in ${path.relative(root, file)}: ${target}`);
    else if (anchor && /^L\d+$/.test(anchor)) {
      const lineCount = fs.readFileSync(resolved, 'utf8').split(/\r?\n/).length;
      if (Number(anchor.slice(1)) > lineCount) fail.push(`Invalid source line: ${target}`);
    } else if (anchor) fail.push(`Unchecked anchor requires validation: ${target}`);
    links++;
  }
}
}
const ids = new Set();
for (const component of manifest.components) {
  if (ids.has(component.id)) fail.push(`Duplicate component: ${component.id}`);
  ids.add(component.id);
  const source = fs.readFileSync(path.join(root, component.source), 'utf8').split(/\r?\n/)[component.line - 1];
  if (!source?.includes(component.name)) fail.push(`Stale source location: ${component.id}`);
  const expected = `[${component.name}](../../${component.source}#L${component.line})`;
  if (!catalog.includes(expected)) fail.push(`Missing catalog component: ${component.id}`);
}
const screens = [];
let section = '';
for (const line of spec.split(/\r?\n/)) {
  if (line.startsWith('## ')) section = line.slice(3);
  if (!line.startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map(x => x.trim());
  if (cells.length !== 3) continue;
  for (const match of cells[0].matchAll(/`(\/[^`]+)`/g)) screens.push({ route: match[1], screen: cells[0].replace(/`[^`]+`/g, '').trim(), section, layout: cells[1], behavior: cells[2] });
}
const routes = new Set(screens.map(s => s.route));
if (routes.size !== screens.length) fail.push('Duplicate route in screen specification tables.');
const modules = ['sell', 'products', 'purchases', 'sales', 'shop', 'suppliers', 'customers', 'expenses', 'transactions', 'reports', 'billing', 'access', 'settings'];
for (const module of modules) if (!routes.has(`/${module}`)) fail.push(`Missing module index: ${module}`);
for (const route of ['/login', '/signup']) if (!routes.has(route)) fail.push(`Missing auth route: ${route}`);
const samples = screens.map(s => s.route.replace(/:([A-Za-z]+)/g, (_, name) => ({ uuid: '11111111-1111-1111-1111-111111111111', customerKey: 'account%3A1', name: 'Retail', action: 'accepted' })[name] || '1'));
const children = node => Object.values(node).flatMap(v => Array.isArray(v) ? v : [v]).filter(v => v && typeof v === 'object' && typeof v.type === 'string');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
const routeMatchers = [];
for (const file of walk(path.join(root, 'src')).filter(f => /\.(js|jsx)$/.test(f) && !/\.(test|spec)\./.test(f))) {
  const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  function visit(node) {
    if (node.type === 'RegExpLiteral' && node.pattern.startsWith('^\\/') && /sell|products|purchases|sales|shop|suppliers|customers|expenses|transactions|reports|billing|access|settings/.test(node.pattern)) {
      const regex = new RegExp(node.pattern, node.flags.replace(/[gy]/g, ''));
      routeMatchers.push({ source: path.relative(root, file).replace(/\\/g, '/'), line: node.loc.start.line, pattern: node.pattern });
      if (!samples.some(sample => regex.test(sample))) fail.push(`No documented representative route matches ${path.relative(root, file)}:${node.loc.start.line} /${node.pattern}/`);
    }
    children(node).forEach(visit);
  }
  visit(ast);
}
fs.writeFileSync(path.join(docs, 'screen-inventory.json'), JSON.stringify({ schemaVersion: 1, source: 'Route-bearing rows in 02-screen-specifications.md; non-route surfaces remain in prose.', screens, routeMatchers }, null, 2) + '\n');
validateLinks();
if (fail.length) { console.error(fail.join('\n')); process.exitCode = 1; }
else console.log(`Validated ${files.length} Markdown files, ${links} local links, ${manifest.components.length} components, ${screens.length} documented routes, ${routeMatchers.length} source route regexes, and ${modules.length} module indexes.`);
