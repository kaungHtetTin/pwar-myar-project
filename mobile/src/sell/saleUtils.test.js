import { describe, expect, it } from 'vitest';
import { cartItemFromProduct, cartUnits, cleanPaymentMethods, repriceSaleCart, saleDraftFrom, salePageFromPath, salePayload, saleProductPrice, saleTotals } from './saleUtils';

describe('mobile sale helpers', () => {
  it('keeps selected prices in saved drafts and does not substitute Retail for missing prices', () => {
    const product = { id: 1, name: 'Water', price: 1000, prices: [{ name: 'Retail', price: 1000 }, { name: 'Wholesale', price: 800 }] };
    const item = cartItemFromProduct(product, 'Wholesale');
    expect(saleProductPrice(product, 'Credit')).toBe(0);
    expect(item.unit_price).toBe(800);
    expect(saleDraftFrom({ cart: [item] }).priceType).toBe('Wholesale');
    expect(saleDraftFrom({ cart: [], priceType: 'Wholesale' }).priceType).toBe('Wholesale');
  });

  it('reprices and merges mixed-price lines without losing sold or free quantities', () => {
    const product = { id: 1, name: 'Water', prices: [{ name: 'Retail', price: 1000 }, { name: 'Wholesale', price: 800 }] };
    const cart = [{ ...cartItemFromProduct(product, 'Retail'), quantity: 2, foc_quantity: 1 }, { ...cartItemFromProduct(product, 'Wholesale'), quantity: 3, foc_quantity: 2 }];
    const result = repriceSaleCart(cart, 'Wholesale', new Map());
    expect(result.cart).toHaveLength(1);
    expect(result.cart[0]).toMatchObject({ price_type: 'Wholesale', unit_price: 800, quantity: 5, foc_quantity: 3 });
    expect(saleTotals(result.cart, 0, 0).subtotal).toBe(4000);
    expect(repriceSaleCart(cart, 'Credit', new Map())).toEqual({ missing: ['Water'] });
    expect(cart[0].unit_price).toBe(1000);
  });
  it('calculates discount, credit and change without overpaying the sale', () => {
    const cart = [{ quantity: 2, unit_price: 1000 }];
    expect(saleTotals(cart, 200, 500)).toEqual({ subtotal: 2000, discount: 200, total: 1800, paid: 500, unpaid: 1300, change: 0 });
    expect(saleTotals(cart, 200, 2000).change).toBe(200);
  });

  it('builds the Laravel credit payload', () => {
    const payload = salePayload({ cart: [{ product_id: 4, price_type: 'Retail', quantity: 2, foc_quantity: 1, unit_price: 500 }], discount: 0, paidAmount: 0, paymentMethod: 'Cash', customerId: '9' });
    expect(payload).toMatchObject({ payment_type: 'credit', payment_method: 'Credit', paid_amount: 0, customer_id: 9 });
  });

  it('builds an FOC-only payload with no payment or customer', () => {
    const payload = salePayload({ cart: [{ product_id: 4, price_type: 'Retail', quantity: 0, foc_quantity: 2, unit_price: 500 }], discount: 0, paidAmount: 500, paymentMethod: 'Cash', customerId: '9' });
    expect(payload).toMatchObject({ payment_type: 'cash', payment_method: 'FOC', paid_amount: 0, customer_id: null });
    expect(cartUnits(payload.items)).toBe(2);
  });

  it('cleans settings and maps products into cart rows', () => {
    expect(cleanPaymentMethods({ payment_methods: 'Cash, Credit, KPay' })).toEqual(['Cash', 'KPay']);
    expect(cartItemFromProduct({ id: 2, name: 'Water', price: 700 }, 'Retail')).toMatchObject({ product_id: 2, unit_price: 700, base_unit: 'Unit' });
    expect(salePageFromPath('/sell')).toBe('products');
    expect(salePageFromPath('/sell/cart')).toBe('cart');
    expect(salePageFromPath('/sell/checkout')).toBe('checkout');
  });

  it('restores only usable draft data and counts selected units', () => {
    const draft = saleDraftFrom({ cart: [{ product_id: 1, unit_price: 20, quantity: 2 }, null], customer: { id: 3, name: 'May' } });
    expect(draft.cart).toHaveLength(1);
    expect(draft.customer.name).toBe('May');
    expect(cartUnits([{ quantity: 2 }, { quantity: '1.5' }])).toBe(3.5);
  });
});
