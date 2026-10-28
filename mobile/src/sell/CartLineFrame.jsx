import React from 'react';
import { Package } from 'lucide-react';
import { ProductPhoto } from '../products/ProductPhoto.jsx';

export function CartLineFrame({ photo, identity, children }) {
  return <article className="sale-cart-card">
    <div className="retail-cart-photo" aria-hidden="true"><Package size={34} />{photo && <ProductPhoto path={photo} className="retail-cart-product-photo" />}</div>
    <div className="retail-cart-identity">{identity}</div>
    {children}
  </article>;
}
