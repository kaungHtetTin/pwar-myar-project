import React, { useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeepAliveModules } from './KeepAliveModules';
import { emitDataChange, useDataRefresh } from '../dataEvents';

function StatefulScreen({ name, onLoad }) {
  const [value, setValue] = useState('');
  useEffect(() => onLoad(name), [name, onLoad]);
  return <input aria-label={name} value={value} onChange={(event) => setValue(event.target.value)} />;
}

function RefreshingScreen({ name, refresh }) {
  useDataRefresh(['products'], name, refresh);
  return <div>{name}</div>;
}

describe('KeepAliveModules', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads a module once and preserves its state while navigating', () => {
    const onLoad = vi.fn();
    const modules = [{ id: 'products' }, { id: 'suppliers' }];
    const renderModule = (id) => <StatefulScreen name={id} onLoad={onLoad} />;
    const view = render(<KeepAliveModules active="products" modules={modules} renderModule={renderModule} />);

    fireEvent.change(screen.getByLabelText('products'), { target: { value: 'pens' } });
    view.rerender(<KeepAliveModules active="suppliers" modules={modules} renderModule={renderModule} />);
    view.rerender(<KeepAliveModules active="products" modules={modules} renderModule={renderModule} />);

    expect(screen.getByLabelText('products')).toHaveValue('pens');
    expect(onLoad.mock.calls.filter(([name]) => name === 'products')).toHaveLength(1);
    expect(onLoad.mock.calls.filter(([name]) => name === 'suppliers')).toHaveLength(1);
  });

  it('does not refresh a retained module merely because time passed before returning', () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const onStale = vi.fn();
    const modules = [{ id: 'products' }, { id: 'suppliers' }];
    const renderModule = (id) => <div>{id}</div>;
    const view = render(
      <KeepAliveModules active="products" modules={modules} renderModule={renderModule} staleMs={100} onStale={onStale} />,
    );

    now = 1050;
    view.rerender(<KeepAliveModules active="suppliers" modules={modules} renderModule={renderModule} staleMs={100} onStale={onStale} />);
    now = 1080;
    view.rerender(<KeepAliveModules active="products" modules={modules} renderModule={renderModule} staleMs={100} onStale={onStale} />);
    expect(onStale).not.toHaveBeenCalled();

    now = 1200;
    view.rerender(<KeepAliveModules active="suppliers" modules={modules} renderModule={renderModule} staleMs={100} onStale={onStale} />);
    expect(onStale).not.toHaveBeenCalled();
  });

  it('defers data refreshes for hidden modules until they are opened', () => {
    const productRefresh = vi.fn();
    const supplierRefresh = vi.fn();
    const onStale = vi.fn();
    const modules = [{ id: 'products' }, { id: 'suppliers' }];
    const renderModule = (id) => (
      <RefreshingScreen name={id} refresh={id === 'products' ? productRefresh : supplierRefresh} />
    );
    const view = render(
      <KeepAliveModules active="products" modules={modules} renderModule={renderModule} onStale={onStale} />,
    );

    view.rerender(<KeepAliveModules active="suppliers" modules={modules} renderModule={renderModule} onStale={onStale} />);
    act(() => emitDataChange(['products'], 'purchases'));

    expect(productRefresh).not.toHaveBeenCalled();
    expect(supplierRefresh).toHaveBeenCalledTimes(1);

    view.rerender(<KeepAliveModules active="products" modules={modules} renderModule={renderModule} onStale={onStale} />);
    expect(onStale).toHaveBeenCalledWith('products');
  });
});
