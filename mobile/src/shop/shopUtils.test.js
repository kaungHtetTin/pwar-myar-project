import { describe, expect, it } from 'vitest';
import { orderActionRequest, shopOrderActions } from './shopUtils';

const owner = { user: { role: 'owner' } };
const order = { id: 8, status: 'packing', fulfillment: 'pickup', payment_status: 'unpaid', payment_method: { provider: 'manual' }, total: 32000 };
describe('mobile shop order rules', () => {
  it('offers only pickup transitions and blocks unpaid completion', () => {
    expect(shopOrderActions(order, owner).map(a => a.key)).toEqual(['ready_for_pickup', 'cancelled', 'confirm']);
    expect(shopOrderActions({ ...order, status: 'ready_for_pickup' }, owner).find(a => a.key === 'completed').disabled).toBe(true);
  });
  it('separates viewing, processing, payment and refund permissions', () => {
    expect(shopOrderActions(order, { user: { role: 'staff' }, permissions: ['ecommerce_orders'] })).toEqual([]);
    expect(shopOrderActions(order, { user: { role: 'staff' }, permissions: ['ecommerce_payments'] }).map(a => a.key)).toEqual(['confirm']);
    expect(shopOrderActions({ ...order, payment_status: 'refund_pending' }, { user: { role: 'staff' }, permissions: ['ecommerce_refunds'] }).map(a => a.key)).toEqual(['refund']);
  });
  it('supports reopening expired proofs and recording late receipt for refund', () => {
    const actions = shopOrderActions({ ...order, status: 'expired', payment_status: 'proof_submitted' }, owner);
    expect(actions.map(a => a.key)).toEqual(['reopen', 'confirm', 'reject']);
    expect(actions.find(a => a.key === 'confirm').label).toBe('Record payment for refund');
  });
  it('does not offer manual review for provider payments', () => {
    expect(shopOrderActions({ ...order, payment_method: { provider: 'gateway' }, payment_status: 'proof_submitted' }, owner).map(a => a.key)).toEqual(['ready_for_pickup', 'cancelled']);
  });
  it('uses the full order total and explicit verification for a receipt', () => {
    expect(orderActionRequest(order, 'confirm', { reference: ' txn ', verified: true, review_note: ' verified ' })).toEqual({ path: '/shop-admin/orders/8/payments/confirm', payload: { amount: 32000, reference: 'txn', verified: true, review_note: 'verified' } });
  });
  it('preserves physical return confirmation in cancellation', () => {
    expect(orderActionRequest(order, 'cancelled', { reason: ' returned ', return_confirmed: true }).payload).toEqual({ status: 'cancelled', reason: 'returned', return_confirmed: true });
  });
});
