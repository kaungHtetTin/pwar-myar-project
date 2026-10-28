import { storedTimestamp } from '../timezone';
import React from 'react';
import { Edit, Eye, Printer, Trash2 } from 'lucide-react';
import { money } from '../utils';
import { EmptyState, TableLoadingState, TablePagination } from './common';
import { RowActions } from './RowActions';

export function SaleHistoryTable({ sales, loading, customerName = '', page, pageSize, total, deletingId = null, onPageChange, onView, onPrint, onEdit, onDelete }) {
  return (
    <div className="transaction-table-card customer-sale-history-card">
      <div className="transaction-table-wrap">
        <table className="transaction-table transaction-table-sales customer-sale-history-table">
          <colgroup><col span="8" /><col className="table-action-column" /></colgroup>
          <thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Type</th><th>Method</th><th>Total</th><th>Paid</th><th>Credit</th><th>Actions</th></tr></thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{storedTimestamp(sale.created_at)}</td>
                <td><strong className="transaction-reference">{sale.receipt_no}</strong></td>
                <td>{sale.customer_name || customerName || '-'}</td>
                <td><span className={`transaction-type-badge ${sale.payment_type === 'credit' || Number(sale.credit_amount || 0) > 0 ? 'credit' : 'paid'}`}>{sale.payment_type === 'credit' || Number(sale.credit_amount || 0) > 0 ? 'Credit' : 'Paid'}</span></td>
                <td><span className="transaction-method-badge">{sale.payment_method || '-'}</span></td>
                <td className="transaction-money-cell">{money(sale.total)}</td>
                <td className="transaction-money-cell transaction-paid-cell">{money(sale.paid_amount)}</td>
                <td className={`transaction-money-cell ${Number(sale.credit_amount || 0) > 0 ? 'transaction-credit-cell' : ''}`}>{money(sale.credit_amount)}</td>
                <td><RowActions label={`sale ${sale.receipt_no}`}>
                  <button type="button" onClick={() => onView(sale.id)}><Eye size={15} /> View</button>
                  <button type="button" aria-label={`Print receipt ${sale.receipt_no}`} title="Print receipt" onClick={() => onPrint(sale.id)}><Printer size={15} /> Print receipt</button>
                  <button type="button" aria-label={`Edit sale ${sale.receipt_no}`} title="Edit sale" onClick={() => onEdit(sale.id)}><Edit size={15} /> Edit</button>
                  <button type="button" className="danger-button" aria-label={`Delete sale ${sale.receipt_no}`} title="Delete sale" disabled={deletingId === sale.id} onClick={() => onDelete(sale)}><Trash2 size={15} /> Delete</button>
                </RowActions></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <TableLoadingState>Loading sales…</TableLoadingState>}
        {!sales.length && !loading && <EmptyState>No sale history for this customer.</EmptyState>}
      </div>
      <TablePagination className="transaction-table-footer" page={page} pageSize={pageSize} total={total} loading={loading} onPageChange={onPageChange} />
    </div>
  );
}
