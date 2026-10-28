import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { OrderProgress } from '../OrderProgress';

afterEach(cleanup);
it.each([
  ['pending', 'delivery', 'Order placed', 0],
  ['accepted', 'delivery', 'Shop confirmed', 1],
  ['packing', 'delivery', 'Preparing', 2],
  ['dispatched', 'delivery', 'Out for delivery', 3],
  ['ready_for_pickup', 'pickup', 'Ready for pickup', 3],
  ['completed', 'delivery', 'Delivered', 5],
  ['completed', 'pickup', 'Collected', 5],
])('maps %s (%s) to its current step', (status, fulfillment, label, completed) => {
  const { container } = render(<OrderProgress order={{ status, fulfillment }} />);
  expect(container.querySelector('[aria-current="step"]')).toHaveTextContent(label);
  expect(container.querySelectorAll('.is-done')).toHaveLength(completed);
  expect(container.querySelectorAll('time')).toHaveLength(0);
});
it.each(['cancelled', 'expired'])('shows %s without claiming delivery milestones', status => {
  const { container } = render(<OrderProgress order={{ status, fulfillment: 'delivery' }} />);
  expect(container.querySelectorAll('li')).toHaveLength(2);
  expect(container.querySelector('[aria-current="step"]')).toHaveClass('is-stopped');
  expect(container.textContent).not.toContain('Delivered');
});
it('shows a pending return after dispatch without claiming delivery completed', () => {
  const { container } = render(<OrderProgress order={{ status: 'return_pending', fulfillment: 'delivery' }} />);
  expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Return in progress');
  expect(container.textContent).not.toContain('Delivered');
});
