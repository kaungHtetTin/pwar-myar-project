// Run in a Playwright page after transitions settle. This inspects visible text only.
module.exports = () => {
  const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const rgba = value => { ctx.clearRect(0,0,1,1); ctx.fillStyle=value; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data].map((n,i)=>i===3?n/255:n); };
  const blend = (a,b) => a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])).concat(1);
  const lum = color => color.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const failures = [];
  for (const node of document.querySelectorAll('body *')) {
    const text = [...node.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
    if (!text || !node.getClientRects().length || node.closest('[hidden], button:disabled, fieldset:disabled, [aria-hidden=true]')) continue;
    const style = getComputedStyle(node); if(style.visibility==='hidden' || style.opacity==='0')continue;
    const chain=[]; let parent=node, gradient=false;
    while(parent){const s=getComputedStyle(parent);if(s.backgroundImage!=='none')gradient=true;chain.push(rgba(s.backgroundColor));parent=parent.parentElement;}
    if(gradient)continue;
    let bg=[255,255,255,1];for(const layer of chain.reverse())bg=blend(layer,bg);
    const fg=blend(rgba(style.color),bg), a=lum(fg),b=lum(bg), ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const large=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
    if(ratio<(large?3:4.5)-.02)failures.push({text:text.slice(0,90),selector:node.tagName.toLowerCase()+'.'+String(node.className).split(' ').join('.'),foreground:style.color,background:bg.slice(0,3).map(Math.round),ratio:Number(ratio.toFixed(2))});
  }
  return failures;
};
