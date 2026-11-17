import JsBarcode from 'jsbarcode';

export function renderBarcodeSvg(value) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, String(value), {
    format: 'CODE128',
    width: 1.5,
    height: 46,
    margin: 0,
    displayValue: false,
  });
  return svg.outerHTML;
}
