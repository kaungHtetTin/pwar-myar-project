import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { EmptyState, TableLoadingState, TablePagination } from '../components/common';
import { CustomerProfileCard } from '../components/CustomerProfileCard';
import { RowActions } from '../components/RowActions';
import { money } from '../utils';

export function CustomerPaymentsPage({ customer, payments, loading, page, pageSize, total, deletingId, onPageChange, onEdit, onDelete }) {
  return (
    <section className="screen suppliers-layout supplier-payments-page customer-payments-page mkpos-sheet" aria-label="Customer payment records">
      <div className="supplier-payments-page-panel">
        <CustomerProfileCard customer={customer} paymentRecordCount={total} />
        <div className={`supplier-detail-table-card supplier-payments-table-card${payments.length && !loading ? ' has-records' : ''}`}>
          <div className="supplier-detail-table-wrap supplier-payment-table-wrap">
            <table className="supplier-detail-table supplier-payment-records-table customer-payment-records-table">
              <colgroup><col span="5" /><col className="table-action-column" /></colgroup>
              <thead><tr><th>Date</th><th>Direction</th><th>Method</th><th>Amount</th><th>Note</th><th>Actions</th></tr></thead>
              <tbody>{payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.created_at}</td>
                  <td><span className={`supplier-direction-badge ${payment.direction === 'shop_to_customer' ? 'outgoing' : 'incoming'}`}>{payment.direction === 'shop_to_customer' ? 'Shop pays customer' : 'Customer pays shop'}</span></td>
                  <td><span className="supplier-method-badge">{payment.payment_method || 'Cash'}</span></td>
                  <td className="supplier-money-cell">{money(payment.amount)}</td><td>{payment.note || '-'}</td>
                  <td className="supplier-actions-cell"><RowActions label={`payment ${payment.id}`} disabled={deletingId === payment.id}><button type="button" onClick={() => onEdit(payment)}><Edit size={15} /> Edit payment</button><button type="button" className="danger-button" onClick={() => onDelete(payment)}><Trash2 size={15} /> {deletingId === payment.id ? 'Deleting…' : 'Delete payment'}</button></RowActions></td>
                </tr>
              ))}</tbody>
            </table>
            {loading && <TableLoadingState>Loading payment records…</TableLoadingState>}
            {!payments.length && !loading && <EmptyState>No customer payments or payouts yet.</EmptyState>}
          </div>
          <TablePagination className="supplier-history-footer" page={page} pageSize={pageSize} total={total} loading={loading} onPageChange={onPageChange} />
        </div>
      </div>
    </section>
  );
}
