import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const navigationCss = readFileSync('src/styles/navigation.css', 'utf8');

describe('mobile trial banner responsive contract', () => {
  it('uses a wide layout, a phone layout, accessible touch sizing, and a keyboard focus ring', () => {
    expect(navigationCss).toMatch(/\.mobile-trial-banner\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/s);
    expect(navigationCss).toMatch(/\.mobile-trial-banner button\s*\{[^}]*min-height:\s*2\.75rem/s);
    expect(navigationCss).toMatch(/\.mobile-trial-banner button:focus-visible\s*\{[^}]*outline:/s);
    expect(navigationCss).toMatch(/@media \(max-width:\s*30rem\)\s*\{[^}]*\.mobile-trial-banner\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/s);
  });
});
