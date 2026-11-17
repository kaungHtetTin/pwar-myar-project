import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { OrderDetailContent } from '../OrderDetailContent';

afterEach(cleanup);
const order = { reference: 'ORDER-1', store_name: 'Demo Shop', store_slug: 'demo', status: 'packing', payment_status: 'proof_submitted', fulfillment: 'delivery', currency: 'K', subtotal: 30000, delivery_fee: 2000, discount: 1500, total: 30500, receipt: { customer_name: 'Buyer', phone: '0912345', address: 'Delivery address', shop_address: 'Pickup address' }, items: [{ product_id: 1, name: 'Rice', unit_name: 'Bag', quantity: 2, unit_price: 15000, line_total: 30000 }], payment_method: { name: 'KBZ Pay', type: 'transfer' }, payment_reviews: [{ id: 1, status: 'pending' }] };

it('shows order snapshots, separate totals, delivery details and pending proof without invented milestones', () => {
  const { container } = render(<OrderDetailContent order={order} />);
  expect(screen.getByRole('heading', { name: 'ORDER-1', exact: true })).toBeInTheDocument();
  expect(within(container.querySelector('.order-delivery')).getByText('Delivery address')).toBeInTheDocument();
  expect(within(container.querySelector('.order-delivery')).queryByText('Pickup address')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '0912345' })).toHaveAttribute('href', 'tel:0912345');
  expect(screen.getByText('Payment proof: Awaiting review')).toBeInTheDocument();
  expect(within(container.querySelector('.order-detail-summary')).getByText('Subtotal').nextElementSibling).toHaveTextContent('K 30,000');
  expect(within(container.querySelector('.order-detail-summary')).getByText('Discount').nextElementSibling).toHaveTextContent('K -1,500');
  expect(screen.getByRole('heading', { name: 'Order progress' })).toBeInTheDocument();
  expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Preparing');
});

it('uses pickup details and explains delivery-service fees without changing the shop total', () => {
  const { container } = render(<OrderDetailContent order={{ ...order, fulfillment: 'pickup', delivery_fee_recipient: 'delivery_service', total: 28500 }} />);
  expect(screen.getByRole('heading', { name: 'Pickup information' })).toBeInTheDocument();
  expect(within(container.querySelector('.order-delivery')).getByText('Pickup address')).toBeInTheDocument();
  expect(within(container.querySelector('.order-delivery')).queryByText('Delivery address')).not.toBeInTheDocument();
  expect(screen.getByText('Total payable to shop').nextElementSibling).toHaveTextContent('K 28,500');
  expect(screen.getByText('Delivery fee is paid separately to the delivery service and is excluded from the shop total.')).toBeInTheDocument();
});
