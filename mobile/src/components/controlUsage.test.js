import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : [join(directory, entry.name)]);
}

describe('shared control adoption', () => {
  it('keeps native form controls inside the reusable control library', () => {
    const violations = sourceFiles('src').filter(file => file.endsWith('.jsx') && !file.endsWith('.test.jsx') && !file.endsWith('Controls.jsx'))
      .filter(file => /<(?:input|select|textarea)\b/.test(readFileSync(file, 'utf8')));
    expect(violations).toEqual([]);
  });

  it('loads page styles through the shared cascade so they cannot override controls', () => {
    const violations = sourceFiles('src').filter(file => file.endsWith('.jsx') && !file.endsWith('.test.jsx'))
      .flatMap(file => [...readFileSync(file, 'utf8').matchAll(/import\s+['"]([^'"]+\.css)['"]/g)]
        .filter(match => !match[1].startsWith('@fontsource/') && match[1] !== './styles/cascade.css').map(match => `${file}: ${match[1]}`));
    expect(violations).toEqual([]);
  });
});
