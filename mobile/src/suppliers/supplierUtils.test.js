import { describe, expect, it } from 'vitest';
import {
  blankSupplierForm,
  blankSupplierPaymentForm,
  supplierHistoryPath,
  supplierPaymentHistoryPath,
  supplierPaymentPayload,
  supplierPageFromPath,
  supplierPayload,
} from './supplierUtils';

describe('supplier utilities', () => {
  it('recognizes list, create, detail and edit routes', () => {
    expect(supplierPageFromPath('/suppliers')).toEqual({ kind: 'list', supplierId: null });
    expect(supplierPageFromPath('/suppliers/new')).toEqual({ kind: 'new', supplierId: null });
    expect(supplierPageFromPath('/suppliers/14')).toEqual({ kind: 'detail', supplierId: 14 });
    expect(supplierPageFromPath('/suppliers/14/edit')).toEqual({ kind: 'edit', supplierId: 14 });
    expect(supplierPageFromPath('/suppliers/14/payments/new')).toEqual({ kind: 'payment-new', supplierId: 14, paymentId: null });
    expect(supplierPageFromPath('/suppliers/14/payments/9/edit')).toEqual({ kind: 'payment-edit', supplierId: 14, paymentId: 9 });
  });

  it('builds supplier payment history and mutation payloads', () => {
    expect(supplierPaymentHistoryPath(8, 20, 40)).toContain('supplier_id=8');
    expect(supplierPaymentHistoryPath(8, 20, 40)).toContain('offset=40');
    expect(supplierPaymentPayload({ ...blankSupplierPaymentForm(), amount: '1500', note: ' Part ' }, 8)).toEqual({ supplier_id: 8, direction: 'shop_to_supplier', payment_method: 'Cash', amount: 1500, note: 'Part' });
  });

  it('normalizes form values for Laravel', () => {
    expect(supplierPayload({ ...blankSupplierForm(), name: '  Acme  ', phone: ' 09  ', note: '  Main  ' })).toEqual({
      name: 'Acme', phone: '09', contact_person: '', address: '', note: 'Main',
    });
  });

  it('builds bounded purchase history queries', () => {
    const path = supplierHistoryPath(8, { q: 'weekly', date_from: '2026-08-01', date_to: '2026-08-08' }, 20, 40);
    expect(path).toContain('/suppliers/8?');
    expect(path).toContain('limit=20');
    expect(path).toContain('offset=40');
    expect(path).toContain('purchase_q=weekly');
  });
});

it('keeps payment export pagination free so subsequent CSV pages can advance',()=>{
 const path=supplierPaymentHistoryPath(3,undefined,undefined,{direction:'shop_to_supplier',q:'stock'});
 expect(path).toContain('direction=shop_to_supplier');expect(path).toContain('q=stock');
 expect(path).not.toContain('offset=');expect(path).not.toContain('limit=');
});
