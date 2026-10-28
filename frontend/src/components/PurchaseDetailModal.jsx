import React from 'react';
import { money } from '../utils';
import { Modal } from './common';

export function PurchaseDetailModal({ purchase, onClose }) {
  return (
    <Modal open={Boolean(purchase)} title="Purchase Detail" onClose={onClose} footer={<button type="button" onClick={onClose}>Close</button>}>
      {purchase && (
        <div className="purchase-detail">
          <div className="purchase-detail-meta">
            <span>Supplier <strong>{purchase.supplier_name || '-'}</strong></span>
            <span>Date <strong>{purchase.created_at}</strong></span>
            <span>Total <strong>{money(purchase.total_cost)}</strong></span>
            <span>Paid <strong>{money(purchase.paid_amount)}</strong></span>
            <span>Supplier Credit <strong>{money(purchase.credit_amount)}</strong></span>
            <span>Payment Method <strong>{purchase.payment_method || 'Cash'}</strong></span>
          </div>
          {purchase.note && <div className="info-box">{purchase.note}</div>}
          <div className="table-wrap sheet-table">
            <table>
              <thead><tr><th>Product</th><th>Paid Qty</th><th>FOC Qty</th><th>Received</th><th>Unit Cost</th><th>Effective Cost</th><th>Total</th></tr></thead>
              <tbody>
                {(purchase.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity} {item.unit_name}</td>
                    <td>{item.foc_quantity || 0} {item.unit_name}</td>
                    <td>{Number(item.base_quantity || 0) + Number(item.base_foc_quantity || 0)}</td>
                    <td>{money(item.unit_cost)}</td>
                    <td>{money(item.effective_unit_cost ?? item.unit_cost)}</td>
                    <td>{money(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
