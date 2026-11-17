import { beforeEach, describe, expect, it } from "vitest";
import { readCart, saveCart, addToCarts } from "../cart";

const product = {
  id: 1,
  store_slug: "first",
  store_name: "First",
  name: "Rice",
  price: 1000,
};
describe("cart storage and legacy migration", () => {
  beforeEach(() => localStorage.clear());
  it("merges quantities within a shop and preserves marketplace attribution", () => {
    const carts = addToCarts([], product, 2, "marketplace");
    const merged = addToCarts(carts, product, 1)[0];
    expect(merged.items[0].quantity).toBe(3);
    expect(merged.origin).toBe("marketplace");
    saveCart(merged);
    expect(readCart()).toEqual(merged);
  });
  it("ignores malformed persisted cart data", () => {
    localStorage.setItem("mkpos.shop.cart.v1", "{bad json");
    expect(readCart()).toBeNull();
    localStorage.setItem(
      "mkpos.shop.cart.v1",
      JSON.stringify({ slug: "first", items: [{ id: 1, quantity: -2 }] }),
    );
    expect(readCart().items).toEqual([]);
  });
});
