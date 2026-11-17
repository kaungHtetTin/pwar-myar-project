import { describe, expect, it } from 'vitest';
import { renderBarcodeSvg } from './barcodePrinting';

describe('mobile barcode printing', () => {
  it('renders a scannable Code 128 SVG', () => {
    const markup = renderBarcodeSvg('2008934580979');

    expect(markup).toContain('<svg');
    expect(markup).toContain('<rect');
    expect(markup).toContain('fill="#000000"');
  });
});
