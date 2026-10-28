import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesDirectory = dirname(fileURLToPath(import.meta.url));

describe('mobile border-radius design tokens', () => {
  it('defines the shared compact radius scale', () => {
    const indexCss = readFileSync(join(stylesDirectory, 'index.css'), 'utf8');

    expect(indexCss).toContain('--radius-subtle: 0.25rem;');
    expect(indexCss).toContain('--radius-control: 0.5rem;');
    expect(indexCss).toContain('--radius-card: 0.625rem;');
    expect(indexCss).toContain('--radius-surface: 0.75rem;');
    expect(indexCss).toContain('--radius-sheet: 0.875rem;');
    expect(indexCss).toContain('--radius-round: 999px;');
  });

  it('uses shared tokens for every non-circular component radius', () => {
    const violations = [];

    readdirSync(stylesDirectory)
      .filter((name) => name.endsWith('.css'))
      .forEach((name) => {
        const css = readFileSync(join(stylesDirectory, name), 'utf8');
        for (const match of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
          const value = match[1].trim();
          if (/\d(?:\.\d+)?(?:rem|px)/.test(value)) violations.push(`${name}: ${value}`);
        }
      });

    expect(violations).toEqual([]);
  });
});
