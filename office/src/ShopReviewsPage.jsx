import React from 'react';
import { ProductReviewsPage } from './ProductReviewsPage';

export function ShopReviewsPage(props) {
  return <ProductReviewsPage {...props} reviewType="shop" />;
}
