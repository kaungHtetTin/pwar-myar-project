const KEY = "mkpos.shop.cart.v1";
const CARTS_KEY = "mkpos.shop.carts.v2";

export function readCarts() {
  try {
    const saved = localStorage.getItem(CARTS_KEY);
    if (!saved) {
      const legacy = readCart();
      return legacy?.items.length ? [legacy] : [];
    }
    const carts = JSON.parse(saved);
    if (!Array.isArray(carts)) return [];
    const seen = new Set();
    return carts.filter(cart => cart && typeof cart.slug === 'string' && cart.slug && Array.isArray(cart.items)).map(cart => ({
      ...cart, items: cart.items.filter(item => Number.isInteger(item.id) && item.id > 0 && Number(item.quantity) > 0 && Number(item.quantity) <= 100000),
    })).filter(cart => {
      if (!cart.items.length || seen.has(cart.slug)) return false;
      seen.add(cart.slug);
      return true;
    });
  } catch { return []; }
}

export function saveCarts(carts) {
  localStorage.setItem(CARTS_KEY, JSON.stringify(carts));
  localStorage.removeItem(KEY);
}

export function updateShopCart(carts, slug, next) {
  const remaining = carts.filter(cart => cart.slug !== slug);
  if (!next?.items.length) return remaining;
  if (next.slug !== slug) throw new Error('Cart shop must match the selected shop.');
  return carts.some(cart => cart.slug === slug)
    ? carts.map(cart => cart.slug === slug ? next : cart)
    : [...remaining, next];
}

export function addToCarts(carts, product, quantity, origin = 'storefront') {
  const existing = carts.find(cart => cart.slug === product.store_slug);
  const next = addItem(existing, product, quantity, origin);
  return updateShopCart(carts, product.store_slug, next);
}
export function readCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(KEY));
    if (!cart || typeof cart.slug !== "string" || !Array.isArray(cart.items))
      return null;
    return {
      ...cart,
      items: cart.items.filter(
        (i) =>
          Number.isInteger(i.id) &&
          i.id > 0 &&
          Number(i.quantity) > 0 &&
          Number(i.quantity) <= 100000,
      ),
    };
  } catch {
    return null;
  }
}
export function saveCart(cart) {
  if (cart) localStorage.setItem(KEY, JSON.stringify(cart));
  else localStorage.removeItem(KEY);
}
function addItem(
  cart,
  product,
  quantity,
  origin = "storefront",
) {
  const current =
    cart?.slug === product.store_slug
      ? cart
      : {
          slug: product.store_slug,
          name: product.store_name,
          origin,
          items: [],
        };
  const found = current.items.find((i) => i.id === product.id);
  const items = found
    ? current.items.map((i) =>
        i.id === product.id
          ? {
              ...i,
              ...product,
              quantity: Number(i.quantity) + Number(quantity),
            }
          : i,
      )
    : [...current.items, { ...product, quantity: Number(quantity) }];
  return { ...current, items };
}
