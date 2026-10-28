const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'shared/theme/themeRuntime.js'), 'utf8');
let failed = false;
for (const app of ['office', 'frontend', 'mobile', 'shop']) {
  const file = path.join(root, app, 'src/themeRuntime.js');
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== source) { console.error(`${app}: theme runtime is out of sync`); failed = true; }
  } else fs.writeFileSync(file, source);
}
const website = path.join(root, 'laravel/public/landing/themeRuntime.js');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(website) || fs.readFileSync(website, 'utf8') !== source) { console.error('Website: theme runtime is out of sync'); failed = true; }
} else fs.writeFileSync(website, source);
process.exitCode = failed ? 1 : 0;
