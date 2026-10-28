import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShopScreen } from './ShopScreen';
import { SHOP_SECTIONS } from './shopUtils';
vi.mock('./ShopLocation', () => ({ ShopLocation: () => null, ShopLocationGate: ({ children }) => children }));
describe('My Shop overview', () => {
  it('routes each grouped destination and business identity to its real screen', () => {
    const onNavigate = vi.fn();
    render(<ShopScreen pathname="/shop" onNavigate={onNavigate} session={{user:{role:'owner'},business:{name:'Evergreen Market'},subscription:{is_valid:true}}} />);
    expect(screen.getByText('Evergreen Market')).toBeInTheDocument();
    for (const row of SHOP_SECTIONS) { fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${row.label}`)})); expect(onNavigate).toHaveBeenLastCalledWith(`/shop/${row.id}`); }
    fireEvent.click(screen.getByRole('button',{name:'Manage storefront'})); expect(onNavigate).toHaveBeenLastCalledWith('/shop/storefront');
    fireEvent.click(screen.getByRole('button',{name:/^Business logo/})); expect(onNavigate).toHaveBeenLastCalledWith('/shop/logo');
    fireEvent.click(screen.getByRole('button',{name:/^Shop location/})); expect(onNavigate).toHaveBeenLastCalledWith('/shop/location');
    expect(screen.queryByRole('button',{name:/^Back/})).not.toBeInTheDocument();
  });
  it('keeps staff permissions and omits empty groups and inaccessible identity actions', () => {
    render(<ShopScreen pathname="/shop" onNavigate={vi.fn()} session={{user:{role:'staff'},permissions:['ecommerce_orders']}} />);
    expect(screen.getByRole('heading',{name:'Operations'})).toBeInTheDocument();
    expect(screen.queryByRole('heading',{name:'Configuration'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Manage storefront'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/^Business logo/})).not.toBeInTheDocument();
  });
  it('retains order access and original owner tools when subscription expires', () => {
    render(<ShopScreen pathname="/shop" onNavigate={vi.fn()} session={{user:{role:'owner'},subscription:{is_valid:false}}} />);
    expect(screen.getByRole('button',{name:/^Orders/})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/^Publication/})).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:/^Shop location/})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Manage storefront'})).not.toBeInTheDocument();
  });
});
