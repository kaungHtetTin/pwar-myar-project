const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { normalizeConfig, fromLegacy, legacyName } = require('./printer-config.cjs');

function getPrinterConfig(configPath) {
  const local = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return local.printerConfig ? normalizeConfig(local.printerConfig, { requireTarget: false }) : fromLegacy(local.printerName);
}
function setPrinterConfig(configPath, input) {
  const clean = normalizeConfig(input);
  const local = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const temporary = `${configPath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ ...local, printerName: legacyName(clean), printerConfig: clean }, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temporary, configPath);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return clean;
}
function forDocument(config) {
  return normalizeConfig({ ...config, connection: 'windows', windows: { ...config.windows, printerName: config.documentPrinterName, media: 'document' } });
}
module.exports = { getPrinterConfig, setPrinterConfig, forDocument };
