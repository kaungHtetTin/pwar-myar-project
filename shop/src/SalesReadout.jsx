import React from 'react';
import { ChatProductCard } from './ShopChatProducts';
import { useText } from './i18n';
import { SalesTable } from './SalesTable';

export function SalesReadout({ content, onViewProduct }) {
  const t = useText();
  if (!content || (!content.products?.length && !content.quote)) return null;
  const products = content.products || [], quote = content.quote;
  const money = (value, currency = '') => `${Number(value || 0).toLocaleString()} ${currency}`;
  const href = p => `#/store/${encodeURIComponent(p.store_slug)}/products/${p.id}`;
  return <section className="sales-action-card" aria-label={t('Verified shop information')}>
    {content.image_candidates && <p>{t('Possible image matches. Confirm the product before adding it.')}</p>}
    {products.length === 1 ? <ChatProductCard product={products[0]} href={href(products[0])} onOpen={onViewProduct} /> : products.length > 1 && <SalesTable label={t('Product comparison')}><table aria-label={t('Product comparison')}><thead><tr><th scope="col">{t('Product')}</th><th scope="col">{t('Price / unit')}</th><th scope="col">{t('Available')}</th></tr></thead><tbody>{products.map(p => <tr key={p.id}><td><a href={href(p)} onClick={onViewProduct}>{p.name}</a></td><td>{money(p.price, p.currency)} / {p.unit_name}</td><td>{p.available_quantity} {p.unit_name}</td></tr>)}</tbody></table></SalesTable>}
    {products.map(p => <details key={p.id}><summary>{p.name} · {t('Product details')}</summary>{p.description && <p>{p.description}</p>}<p>{t('Available')}: {p.available_quantity} {p.unit_name}</p>{products.length > 1 && p.photo_url && <ChatProductCard product={p} href={href(p)} onOpen={onViewProduct} />}</details>)}
    {products.length > 0 && <small>{t('Prices and availability were checked for this reply. Checkout checks them again.')}</small>}
    {quote && <><strong>{t('Quotation')}</strong><SalesTable label={t('Quoted products')}><table aria-label={t('Quoted products')}><thead><tr><th scope="col">{t('Product')}</th><th scope="col">{t('Quantity')}</th><th scope="col">{t('Amount')}</th></tr></thead><tbody>{quote.items.map(item => <tr key={item.product_id}><td>{item.name}<small>{item.unit_name}</small></td><td>{item.quantity}</td><td>{money(item.line_total, quote.currency)}</td></tr>)}</tbody></table></SalesTable><dl>{[['subtotal', 'Subtotal'], ['discount', 'Discount'], ['delivery_fee', 'Delivery fee'], ['total', 'Total']].map(([key, label]) => <React.Fragment key={key}><dt>{t(label)}</dt><dd>{money(quote[key], quote.currency)}</dd></React.Fragment>)}</dl><p>{t('Quotation only. No order has been placed and no stock is reserved.')}</p>{quote.delivery_fee_recipient === 'delivery_service' && <p>{t('Courier charges are payable separately and are not included in this total.')}</p>}</>}
  </section>;
}
