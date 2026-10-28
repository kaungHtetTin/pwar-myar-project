import React from 'react';
import { Edit, Eye, Trash2 } from 'lucide-react';
import { money } from '../utils';
import { EmptyState, TableLoadingState, TablePagination } from './common';
import { RowActions } from './RowActions';

export function PurchaseHistoryTable({
  purchases,
  loading,
  emptyMessage = 'No purchase history yet.',
  supplierName = '',
  page,
  pageSize,
  total,
  deletingId = null,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="purchase-table-card purchase-history-card">
      <div className="purchase-table-wrap">
        <table className="purchase-history-table">
          <colgroup><col span="6" /><col className="table-action-column" /></colgroup>
          <thead>
            <tr><th>Date</th><th>Supplier</th><th>Total</th><th>Paid</th><th>Credit</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td>{purchase.created_at}</td>
                <td>{purchase.supplier_name || supplierName || '-'}</td>
                <td>{money(purchase.total_cost)}</td>
                <td>{money(purchase.paid_amount)}</td>
                <td>{money(purchase.credit_amount)}</td>
                <td><span className="status-badge completed">{purchase.status || 'completed'}</span></td>
                <td>
                  <RowActions label={`purchase ${purchase.id}`}>
                    <button type="button" onClick={() => onView(purchase.id)}><Eye size={15} /> View</button>
                    <button type="button" aria-label={`Edit purchase ${purchase.id}`} title="Edit purchase" onClick={() => onEdit(purchase.id)}><Edit size={15} /> Edit purchase</button>
                    <button type="button" className="danger-button" aria-label={`Delete purchase ${purchase.id}`} title="Delete purchase" disabled={deletingId === purchase.id} onClick={() => onDelete(purchase)}>
                      <Trash2 size={15} /> Delete purchase
                    </button>
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <TableLoadingState>Loading purchase history…</TableLoadingState>}
        {!purchases.length && !loading && <EmptyState>{emptyMessage}</EmptyState>}
      </div>
      <TablePagination className="purchase-history-footer" page={page} pageSize={pageSize} total={total} loading={loading} onPageChange={onPageChange} />
    </div>
  );
}
