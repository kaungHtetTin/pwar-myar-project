import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BillingHeader } from '../billing/BillingReferenceParts';
import { CustomerReferenceHeader } from '../customers/CustomerReferenceParts';
import { ProductReferenceHeader } from '../products/ProductReferenceParts';
import { PurchaseReferenceHeader } from '../purchases/PurchaseReferenceParts';
import { SupplierReferenceHeader } from '../suppliers/SupplierReferenceParts';
import { PaymentReferenceHeader } from '../transactions/PaymentReferenceParts';
import { SalesReferenceHeader } from '../transactions/SalesReferenceParts';
import { AppNavigationContext } from './AppNavigationContext';

describe.each([BillingHeader, CustomerReferenceHeader, ProductReferenceHeader, PurchaseReferenceHeader, SupplierReferenceHeader, PaymentReferenceHeader, SalesReferenceHeader])('%s entry navigation', Header => {
  it('omits Back at the module entry and preserves the explicit return action on nested screens', () => {
    const onBack = vi.fn();
    const { rerender } = render(<Header title="Module" />);
    expect(screen.queryByRole('button', { name: /^Back/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Module' })).toBeInTheDocument();
    rerender(<Header title="Details" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /^Back/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
  it('places the app drawer trigger last and invokes navigation once', () => {
    const openNavigation = vi.fn();
    const { container } = render(<AppNavigationContext.Provider value={{ openNavigation, navigationOpen: false }}><Header title="Module" /></AppNavigationContext.Provider>);
    const menu = screen.getByRole('button', { name: 'Open app menu' });
    expect(container.querySelector('header').lastElementChild).toBe(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveAttribute('type', 'button');
    fireEvent.click(menu);
    expect(openNavigation).toHaveBeenCalledTimes(1);
  });
});
