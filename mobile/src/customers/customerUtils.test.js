import { describe, expect, it } from 'vitest';
import {
  balanceState,
  cleanPaymentMethods,
  customerHistoryPath,
  customerPageFromPath,
  customerPayload,
  customerStatementHtml,
  paymentPayload,
} from './customerUtils';

describe('customer utilities', () => {
  it('recognizes customer and payment full-page routes', () => {
    expect(customerPageFromPath('/customers')).toMatchObject({ kind: 'list' });
    expect(customerPageFromPath('/customers/new')).toMatchObject({ kind: 'new' });
    expect(customerPageFromPath('/customers/4/edit')).toMatchObject({ kind: 'edit', customerId: 4 });
    expect(customerPageFromPath('/customers/4/payments/new')).toMatchObject({ kind: 'payment-new', customerId: 4 });
    expect(customerPageFromPath('/customers/4/payments/9/edit')).toEqual({ kind: 'payment-edit', customerId: 4, paymentId: 9 });
  });

  it('normalizes customer and payment payloads', () => {
    expect(customerPayload({ name: ' Moe ', phone: ' 09 ', email: ' Buyer@Example.com ', address: ' YGN ', note: ' VIP ' })).toEqual({ name: 'Moe', phone: '09', email: 'buyer@example.com', address: 'YGN', note: 'VIP' });
    expect(customerPayload({ name: 'No email' }).email).toBe('');
    expect(paymentPayload({ direction: 'customer_to_shop', payment_method: ' Cash ', amount: '1200', note: ' paid ' })).toEqual({ direction: 'customer_to_shop', payment_method: 'Cash', amount: 1200, note: 'paid' });
  });

  it('removes credit from configured payment methods', () => {
    expect(cleanPaymentMethods({ payment_methods: 'Cash, Credit, KBZ Pay' })).toEqual(['Cash', 'KBZ Pay']);
    expect(cleanPaymentMethods({})).toEqual(['Cash']);
  });

  it('builds paginated history filters and balance meanings', () => {
    expect(customerHistoryPath(4, 'payments', { start: '2026-08-01', end: '2026-08-08' }, 20, 40)).toContain('with_total=true');
    expect(balanceState(500)).toMatchObject({ key: 'receivable', amount: 500 });
    expect(balanceState(-300)).toMatchObject({ key: 'payable', amount: 300 });
    expect(balanceState(0).label).toBe('Settled');
  });

  it('escapes customer content in printable statements', () => {
    const html = customerStatementHtml({ customer: { name: '<Moe>' }, sales: [], payments: [], summary: { current_balance: 500 } }, { shop_name: 'PwarMyar & Co' });
    expect(html).toContain('&lt;Moe&gt;');
    expect(html).toContain('PwarMyar &amp; Co');
    expect(html).toContain('500 Ks');
  });
});
