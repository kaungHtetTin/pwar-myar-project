export const PAYMENT_PRESETS=[['all','All time'],['today','Today'],['last7','Last 7 days'],['last30','Last 30 days'],['month','This month'],['lastmonth','Last month'],['custom','Custom range']];
export function paymentDateRange(preset,now=new Date()){
 const format=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const start=new Date(now),end=new Date(now);
 if(preset==='all'||preset==='custom')return {start:'',end:''};
 if(preset==='last7')start.setDate(start.getDate()-6);
 if(preset==='last30')start.setDate(start.getDate()-29);
 if(preset==='month')start.setDate(1);
 if(preset==='lastmonth'){start.setDate(1);start.setMonth(start.getMonth()-1);end.setDate(0);}
 return {start:format(start),end:format(end)};
}
export function paymentDirection(supplier,direction){return supplier?(direction==='supplier_to_shop'?'Supplier refunds shop':'Shop pays supplier'):(direction==='shop_to_customer'?'Shop pays customer':'Customer pays shop');}
