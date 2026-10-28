import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emitDataChange, useDataRefresh } from './dataEvents';

function Listener({ source, resources, refresh }) {
  useDataRefresh(resources, source, refresh);
  return null;
}

describe('data change events', () => {
  it('refreshes matching subscribers and supports a targeted stale refresh', () => {
    const productRefresh = vi.fn();
    const saleRefresh = vi.fn();
    render(
      <>
        <Listener source="products" resources={['products']} refresh={productRefresh} />
        <Listener source="sale" resources={['products']} refresh={saleRefresh} />
      </>,
    );

    act(() => emitDataChange(['products'], 'purchases'));
    expect(productRefresh).toHaveBeenCalledTimes(1);
    expect(saleRefresh).toHaveBeenCalledTimes(1);

    act(() => emitDataChange(['*'], 'navigation', 'products'));
    expect(productRefresh).toHaveBeenCalledTimes(2);
    expect(saleRefresh).toHaveBeenCalledTimes(1);
  });
});
