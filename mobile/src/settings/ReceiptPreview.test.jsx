import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReceiptPreview } from './ReceiptPreview';

describe('contained receipt preview', () => {
  it('isolates and styles receipt HTML without enabling scripts or printing', () => {
    render(<ReceiptPreview settings={{ receipt_paper_size: '80mm' }} preview={{ html: '<div class="receipt-document"><div class="receipt-row"><span>Total</span><strong>1,000 Ks</strong></div></div>' }} />);
    const frame = screen.getByTitle('Receipt preview document');
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame.getAttribute('srcdoc')).toContain('grid-template-columns:minmax(0,1fr) minmax(0,1fr)');
    expect(frame.getAttribute('srcdoc')).toContain('MKPOSReceipt');
    expect(frame.getAttribute('srcdoc')).not.toContain('window.print');
    expect(screen.queryByText('1,000 Ks')).not.toBeInTheDocument();
  });
  it('preserves loading and safely renders a text-only receipt', () => {
    const { rerender } = render(<ReceiptPreview settings={{}} preparing />);
    expect(screen.getByRole('status')).toHaveTextContent('Preview loading');
    rerender(<ReceiptPreview settings={{ receipt_paper_size: '58mm' }} preview={{ text: 'Shop <Main>' }} />);
    expect(screen.getByTitle('Receipt preview document').getAttribute('srcdoc')).toContain('Shop &lt;Main&gt;');
  });
});
