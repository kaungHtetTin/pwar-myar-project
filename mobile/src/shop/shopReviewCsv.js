import { requestAllPages } from '../utils/csvExport';

export const SHOP_REVIEW_COLUMNS = [
  ['Review ID',row=>row.id],['Customer',row=>row.customer_name],['Review type',row=>Number(row.target_id)?'Product':'Shop'],
  ['Product',row=>row.product_name],['Product unit',row=>row.product_unit],['Rating',row=>row.rating],['Comment',row=>row.comment],
  ['Reply',row=>row.reply],['Created at (UTC)',row=>row.created_at],['Replied at (UTC)',row=>row.replied_at],
].map(([label,value])=>({label,value}));
export function loadShopReviewExport(path) { return requestAllPages(path,{pageSize:50}); }
