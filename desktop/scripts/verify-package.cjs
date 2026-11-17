const path = require('node:path');
const asar = require('@electron/asar');
const fs = require('node:fs');

module.exports = async ({ appOutDir }) => {
  const archive = path.join(appOutDir, 'resources', 'app.asar');
  for (const file of ['main.cjs', 'preload.cjs', 'theme.cjs', 'printing.cjs', 'escpos.cjs', 'serial.cjs', 'printer-config.cjs', 'printer-preferences.cjs', 'renderer/index.html']) {
    if (!asar.extractFile(archive, path.normalize(file)).length) throw new Error(`Packaged file is empty: ${file}`);
  }
  if (!fs.readFileSync(path.join(appOutDir, 'resources', 'serial-print.ps1')).length) throw new Error('Bluetooth serial helper is missing.');
  const html = asar.extractFile(archive, 'renderer/index.html').toString('utf8');
  const assets = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"#?]+)"/g)].map((match) => match[1]);
  if (!assets.some((asset) => asset.endsWith('.js'))) throw new Error('Packaged renderer has no JavaScript entry.');
  for (const asset of assets) asar.extractFile(archive, path.join('renderer', asset));
  console.log(`Verified packaged renderer and ${assets.length} entry assets.`);
};
