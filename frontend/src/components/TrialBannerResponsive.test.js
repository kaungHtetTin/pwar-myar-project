import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const subscriptionCss = readFileSync('src/styles/subscription.css', 'utf8');

describe('web and desktop trial banner responsive contract', () => {
  it('keeps readable wide and compact layouts with visible keyboard focus', () => {
    expect(subscriptionCss).toMatch(/\.trial-banner\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/s);
    expect(subscriptionCss).toMatch(/\.trial-banner > button:focus-visible\s*\{[^}]*outline:/s);
    expect(subscriptionCss).toMatch(/@media \(max-width:\s*700px\)\s*\{[^}]*\.trial-banner\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/s);
  });
});
