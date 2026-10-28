import { beforeEach, describe, expect, it } from 'vitest';
import { addToCarts, readCarts, saveCart, saveCarts, updateShopCart } from '../cart';

const first = { id: 1, store_slug: 'first', store_name: 'First', name: 'Rice', price: 1000 };
const second = { ...first, store_slug: 'second', store_name: 'Second', price: 2000 };

describe('separate shop carts', () => {
  beforeEach(() => localStorage.clear());
  it('keeps identical product IDs in different shops separate and merges within the correct shop', () => {
    let carts = addToCarts([], first, 2, 'marketplace');
    carts = addToCarts(carts, second, 1);
    carts = addToCarts(carts, first, .375);
    expect(carts.map(cart => cart.items[0].quantity)).toEqual([2.375, 1]);
    expect(carts.map(cart => cart.origin)).toEqual(['marketplace', 'storefront']);
    saveCarts(carts);
    expect(readCarts()).toEqual(carts);
  });
  it('migrates an existing single-shop cart without discarding its data', () => {
    const legacy = { slug: 'first', name: 'First', origin: 'marketplace', items: [{ ...first, quantity: 2 }] };
    saveCart(legacy);
    expect(readCarts()).toEqual([legacy]);
    saveCarts(addToCarts(readCarts(), second, 1));
    expect(localStorage.getItem('mkpos.shop.cart.v1')).toBeNull();
    expect(readCarts()).toHaveLength(2);
  });
  it('updates and removes only the selected shop, including after successful checkout', () => {
    const carts = addToCarts(addToCarts([], first, 2), second, 1);
    const changed = updateShopCart(carts, 'first', { ...carts[0], items: [{ ...first, quantity: 4 }] });
    expect(changed[1]).toBe(carts[1]);
    const remaining = updateShopCart(changed, 'first', null);
    expect(remaining).toEqual([carts[1]]);
    saveCarts(remaining);
    expect(readCarts()).toEqual([carts[1]]);
    expect(updateShopCart(remaining, 'second', { ...remaining[0], items: [] })).toEqual([]);
  });
  it('rejects updating the wrong shop and ignores corrupt saved collections', () => {
    expect(() => updateShopCart([], 'first', { slug: 'second', items: [{ id: 1 }] })).toThrow();
    localStorage.setItem('mkpos.shop.carts.v2', '{broken');
    expect(readCarts()).toEqual([]);
    localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify([{ slug: 'first', items: [{ id: 1, quantity: -1 }] }, null]));
    expect(readCarts()).toEqual([]);
  });
});
