// Compose existing browser evidence; run the four check-*-reference scripts first.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const states = [
  ['001','sell-reference/sell-393.png'], ['002','sell-reference/cart-393.png'],
  ['003','checkout-reference/checkout-393.png'], ['004','new-customer-reference/new-customer-393.png'],
  ['005','offline-sales-reference/offline-sales-393.png'], ['111','sell-reference/filters-393.png'],
  ['127','checkout-reference/customer-picker-393.png'], ['128','sell-reference/scanner-denied-393.png'],
  ['143','checkout-reference/sale-success-393.png'], ['144','offline-sales-reference/conflict-393.png'],
  ['169','offline-sales-reference/unavailable-393.png'],
];
execFileSync('python',['-c',`
import json,sys
from pathlib import Path
from PIL import Image
out=Path('artifacts/sell-module');out.mkdir(parents=True,exist_ok=True)
for identity,source in json.loads(sys.argv[1]):
    reference=next(Path('docs/design/sell').glob(identity+'-*.png'))
    target=Image.open(reference).resize((393,850)).crop((0,33,393,850)).convert('RGB')
    actual=Image.open(Path('artifacts')/source).convert('RGB')
    target.save(out/('reference-'+identity+'.png'));actual.save(out/('screen-'+identity+'.png'))
    canvas=Image.new('RGB',(786,817),'white');canvas.paste(target,(0,0));canvas.paste(actual,(393,0));canvas.save(out/('comparison-'+identity+'.png'))
`,JSON.stringify(states)],{cwd:path.resolve(__dirname,'..')});
console.log('Composed all eleven Sell reference comparisons.');
