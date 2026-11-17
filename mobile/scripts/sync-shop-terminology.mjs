// Copy matching language entries as mobile-owned data; no desktop runtime dependency.
import fs from 'node:fs/promises';
import { UI_TEXT } from '../../frontend/src/translations.js';
const directory = new URL('../src/shop/', import.meta.url);
const sources = await Promise.all((await fs.readdir(directory)).filter(name => /\.jsx?$/.test(name) && !name.includes('.test.') && name !== 'shopLocale.js').map(name => fs.readFile(new URL(name, directory), 'utf8')));
const source = sources.join('\n');
const messages = Object.fromEntries(Object.entries(UI_TEXT).filter(([english]) => source.includes(english)));
await fs.writeFile(new URL('../src/shop/shopLocale.js', import.meta.url), `// Mobile-owned shop terminology, shared wording with the desktop catalog.\nexport const SHOP_MESSAGES = ${JSON.stringify(messages, null, 2)};\n`);
console.log(`Copied ${Object.keys(messages).length} matching shop translations.`);
