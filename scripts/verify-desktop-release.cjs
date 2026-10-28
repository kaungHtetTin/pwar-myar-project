const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('../desktop/node_modules/@electron/asar');
const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'desktop/package.json'), 'utf8')).version;
const renderer = path.join(root, 'frontend/dist-desktop');
const results = [];
for (const [arch, directory] of [['x64', 'win-unpacked'], ['ia32', 'win-ia32-unpacked']]) {
  const archive = path.join(root, 'release/electron', directory, 'resources/app.asar');
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, version);
  const html = asar.extractFile(archive, 'renderer/index.html');
  assert.deepEqual(html, fs.readFileSync(path.join(renderer, 'index.html')));
  const assets = [...html.toString().matchAll(/(?:src|href)="\.\/(assets\/[^"#?]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith('.js')));
  for (const asset of assets) assert.deepEqual(asar.extractFile(archive, path.join('renderer', asset)), fs.readFileSync(path.join(renderer, asset)));
  assert.ok(fs.statSync(path.join(root, 'release/electron', `PwarMyar-${version}-Portable-${arch}.exe`)).size > 1000000);
  results.push({ arch, version, packaged_renderer_matches_current_build: true, entry_assets: assets.length });
}
const report = { version, windows: results };
fs.writeFileSync(path.join(root, 'artifacts', `release-${version}-desktop-verification.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
