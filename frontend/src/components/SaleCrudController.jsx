import { storedTimestamp } from '../timezone';
import React, { useMemo, useRef, useState } from 'react';
import { Edit, Plus, Printer, Trash2, X } from 'lucide-react';
import { request } from '../api';
import { actionLabel, formatQuantity, money, normalizeNumber } from '../utils';
import { Field, Modal } from './common';
import { RemoteCombobox } from './RemoteCombobox';
import { cleanPriceTypes } from '../priceTypes';
import { emitDataChange } from '../dataEvents';
import { printReceiptText, printResultMessage, receiptLayoutClassNames } from '../printing';
import { usePrinting } from '../hooks/usePrinting';
import { useScreenNotifications } from './notifications';
import { useConfirmation } from './confirmations';

function cleanPaymentMethods(settings) {
  const fallback = ['Cash', 'Wallet Pay', 'Banking Pay', 'KPay', 'Wave Pay', 'Credit'];
  const rows = String(settings?.payment_methods || '').split(',').map((item) => item.trim()).filter(Boolean);
  return rows.length ? rows : fallback;
}

function productPrice(product, priceType) {
  const prices = product?.prices || [];
  const selected = prices.find((price) => price.name === priceType);
  if (selected) return Number(selected.price || 0);
  if (priceType !== 'Retail') return 0;
  const retail = prices.find((price) => price.name === 'Retail' && Number(price.price || 0) > 0);
  return Number((retail && retail.price) || product?.price || 0);
}

function saleToForm(sale) {
  return {
    id: sale.id,
    discount: sale.discount || 0,
    payment_type: sale.payment_type || 'cash',
    payment_method: sale.payment_method || 'Cash',
    paid_amount: sale.paid_amount || 0,
    customer_id: sale.customer_id || '',
    customer_option: sale.customer_id ? { id: sale.customer_id, name: sale.customer_name || `Customer ${sale.customer_id}` } : null,
    admin_pin: '',
    adding_item: false,
    items: (sale.items || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      unit_name: item.unit_name || 'Unit',
      price_type: item.price_type || 'Retail',
      quantity: item.quantity,
      foc_quantity: item.foc_quantity || 0,
      unit_price: item.unit_price,
    })),
  };
}

export function SaleCrudController({ settings = {}, onChanged, children }) {
  const printing = usePrinting();
  const printRequest = useRef(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saleForm, setSaleForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { setMessage, setError } = useScreenNotifications();
  const confirmAction = useConfirmation();
  const paymentMethods = useMemo(() => cleanPaymentMethods(settings), [settings]);
  const priceTypes = useMemo(() => cleanPriceTypes(settings.price_types), [settings.price_types]);
  const adminPinRequired = String(settings.admin_pin_set) === '1';
  const subtotal = saleForm?.items.reduce((sum, item) => sum + Math.round(normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_price, 0)), 0) || 0;
  const total = Math.max(0, subtotal - Math.round(normalizeNumber(saleForm?.discount, 0)));
  const paidInput = saleForm ? Math.max(0, Math.round(normalizeNumber(saleForm.paid_amount, 0))) : 0;
  const paid = Math.min(paidInput, total);
  const unpaid = Math.max(total - paid, 0);
  const change = Math.max(paidInput - total, 0);

  const loadCustomerOptions = React.useCallback(async (query) => {
    const params = new URLSearchParams({ with_total: 'true', limit: '20', offset: '0' });
    if (query) params.set('q', query);
    const data = await request(`/customers?${params.toString()}`);
    return data.items || [];
  }, []);

  const loadProductOptions = React.useCallback(async (query) => {
    const params = new URLSearchParams({ with_total: 'true', limit: '20', offset: '0' });
    if (query) params.set('q', query);
    const data = await request(`/products?${params.toString()}`);
    return data.items || [];
  }, []);

  async function openSaleDetail(id) {
    setError('');
    try { setDetail({ type: 'sale', data: await request(`/sales/${id}`) }); }
    catch (error) { setError(error.message); }
  }

  async function printPreparedReceipt(payload) {
    const result = await printReceiptText(
      payload.text,
      payload.paper_size || settings.receipt_paper_size,
      { html: payload.html, layout: payload.layout, printerName: settings.printer_name },
    );
    setMessage(printResultMessage(result));
  }

  async function reprintSale(id, showPreview = true) {
    if (printRequest.current || printing) return;
    printRequest.current = true;
    setPreparingPrint(true);
    setError('');
    try {
      const payload = await request(`/sales/${id}/receipt`);
      if (showPreview) setDetail({ type: 'receipt', data: payload });
      if (window.mkposDesktop?.printReceipt) {
        await printPreparedReceipt(payload);
        return;
      }
      const result = await request(`/sales/${id}/print`, { method: 'POST' });
      if (!result.ok) {
        await printPreparedReceipt({
          ...payload,
          text: result.text || payload.text,
          html: result.html || payload.html,
          paper_size: result.paper_size || payload.paper_size,
          layout: result.layout || payload.layout,
        });
      } else setMessage(result.message || 'Receipt print requested.');
    } catch (error) {
      setError(error.message || 'Receipt could not be printed.');
    } finally {
      printRequest.current = false;
      setPreparingPrint(false);
    }
  }

  async function editSale(id) {
    setError('');
    try {
      setSaleForm(saleToForm(await request(`/sales/${id}`)));
      setDetail(null);
    } catch (error) { setError(error.message); }
  }

  function updateSaleItem(index, patch) {
    setSaleForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addSaleItem(product) {
    if (!product) return;
    const priceType = priceTypes[0] || 'Retail';
    setSaleForm((current) => ({
      ...current,
      adding_item: false,
      items: [{
        product_id: product.id,
        product_name: product.name,
        unit_name: product.base_unit || 'Unit',
        price_type: priceType,
        quantity: 1,
        foc_quantity: 0,
        unit_price: productPrice(product, priceType),
      }, ...current.items],
    }));
    setError('');
  }

  async function saveSaleEdit(event) {
    event.preventDefault();
    if (!saleForm.items.length) return setError('Sale must contain at least one item.');
    const invalid = saleForm.items.find((item) => normalizeNumber(item.quantity, 0) < 0
      || normalizeNumber(item.foc_quantity, 0) < 0
      || normalizeNumber(item.quantity, 0) + normalizeNumber(item.foc_quantity, 0) <= 0
      || normalizeNumber(item.unit_price, -1) < 0);
    if (invalid) return setError('Each sale item needs a paid quantity or FOC quantity greater than zero and price zero or greater.');
    if (unpaid > 0 && !saleForm.customer_id) return setError('Unpaid amount requires a customer.');
    if (adminPinRequired && !String(saleForm.admin_pin || '').trim()) return setError('Admin PIN is required to update this sale.');
    const payload = {
      items: saleForm.items.map((item) => ({
        product_id: item.product_id,
        price_type: item.price_type,
        quantity: normalizeNumber(item.quantity, 0),
        foc_quantity: normalizeNumber(item.foc_quantity, 0),
        unit_price: Math.round(normalizeNumber(item.unit_price, 0)),
      })),
      discount: Math.round(normalizeNumber(saleForm.discount, 0)),
      payment_type: unpaid > 0 ? 'credit' : 'cash',
      payment_method: unpaid > 0 && paid === 0 ? 'Credit' : saleForm.payment_method,
      paid_amount: paid,
      customer_id: saleForm.customer_id ? Number(saleForm.customer_id) : null,
      ...(adminPinRequired ? { admin_pin: saleForm.admin_pin || '' } : {}),
    };
    setSaving(true);
    setError('');
    try {
      await request(`/sales/${saleForm.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      setSaleForm(null);
      setMessage('Sale updated.');
      await onChanged?.();
      emitDataChange(['sales', 'products', 'customers', 'reports'], 'customers');
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  async function deleteSale(sale) {
    const { confirmed, pin: adminPin } = await confirmAction({
      title: 'Delete sale',
      message: `Delete sale ${sale.receipt_no}? Stock will be restored, amounts and customer debt will be recalculated, and the sale will be removed from history.`,
      confirmLabel: 'Delete Sale',
      requirePin: true,
    });
    if (!confirmed) return;
    setDeletingId(sale.id);
    setError('');
    try {
      await request(`/sales/${sale.id}`, { method: 'DELETE', ...(adminPin ? { body: JSON.stringify({ admin_pin: adminPin }) } : {}) });
      setMessage('Sale deleted.');
      setDetail(null);
      await onChanged?.();
      emitDataChange(['sales', 'products', 'customers', 'reports'], 'customers');
    } catch (error) { setError(error.message); }
    finally { setDeletingId(null); }
  }

  const actions = { onView: openSaleDetail, onPrint: reprintSale, onEdit: editSale, onDelete: deleteSale, deletingId };

  return <>
    {children(actions)}
    <Modal
      open={Boolean(detail)}
      title={detail?.type === 'receipt' ? 'Receipt Preview' : 'Transaction Detail'}
      onClose={() => setDetail(null)}
      footer={detail?.type === 'sale'
        ? <><button type="button" onClick={() => reprintSale(detail.data.id)}><Printer size={16} /> Reprint</button><button type="button" className="primary" onClick={() => editSale(detail.data.id)}><Edit size={16} /> Edit Sale</button></>
        : detail?.type === 'receipt'
          ? <button type="button" disabled={printing || preparingPrint} onClick={() => printPreparedReceipt(detail.data)}><Printer size={16} /> {window.mkposDesktop?.printReceipt ? 'Print Receipt' : 'Browser Print'}</button>
          : null}
    >
      {detail?.type === 'sale' && <SaleDetail sale={detail.data} />}
      {detail?.type === 'receipt' && <div className="sale-receipt-preview">{detail.data.html ? <div className={receiptLayoutClassNames(detail.data.layout, detail.data.paper_size)} dangerouslySetInnerHTML={{ __html: detail.data.html }} /> : <pre>{detail.data.text}</pre>}</div>}
    </Modal>
    <Modal
      open={Boolean(saleForm)}
      title="Edit Sale"
      onClose={() => setSaleForm(null)}
      busy={saving}
      className="transaction-sale-edit-modal"
      focusFirstField={false}
      footer={saleForm && <div className="transaction-sale-edit-footer"><div className="transaction-sale-edit-summary" aria-label="Sale totals summary"><span>Subtotal <strong>{money(subtotal)}</strong></span><span>Paid <strong>{money(paid)}</strong></span><span className={unpaid > 0 ? 'danger-text' : ''}>Unpaid <strong>{money(unpaid)}</strong></span>{change > 0 && <span className="gain-text">Change <strong>{money(change)}</strong></span>}<span className="total">Total <strong>{money(total)}</strong></span></div><div className="transaction-sale-edit-actions"><button type="button" onClick={() => setSaleForm(null)}>Cancel</button><button type="submit" form="customer-sale-edit-form" className="primary" disabled={saving}>{actionLabel(saving, 'Saving...', 'Update Sale')}</button></div></div>}
    >
      {saleForm && <form id="customer-sale-edit-form" className="transaction-edit-form" onSubmit={saveSaleEdit}>
        <div className="transaction-sale-basic-section">
          <Field label="Customer"><RemoteCombobox value={saleForm.customer_id} selectedOption={saleForm.customer_option} loadOptions={loadCustomerOptions} placeholder="No customer or search name/phone" onSelect={(customer) => setSaleForm((current) => ({ ...current, customer_id: customer ? customer.id : '', customer_option: customer }))} /></Field>
          <div className="transaction-sale-payment-grid"><Field label="Payment Status"><input value={unpaid > 0 ? 'Credit / unpaid balance' : 'Paid'} readOnly /></Field><Field label="Payment Method"><select value={unpaid > 0 && paid === 0 ? 'Credit' : saleForm.payment_method} disabled={unpaid > 0 && paid === 0} onChange={(event) => setSaleForm({ ...saleForm, payment_method: event.target.value })}>{[...new Set([...paymentMethods, 'Credit', 'FOC'])].map((method) => <option key={method} value={method}>{method}</option>)}</select></Field><Field label="Discount"><input type="number" min="0" value={saleForm.discount} onChange={(event) => setSaleForm({ ...saleForm, discount: event.target.value })} /></Field><Field label="Paid Amount"><input type="number" min="0" value={saleForm.paid_amount} onChange={(event) => setSaleForm({ ...saleForm, paid_amount: event.target.value })} placeholder="0" /></Field></div>
          {adminPinRequired && <div className="transaction-sale-admin-pin"><Field label="Admin PIN"><input type="password" value={saleForm.admin_pin} onChange={(event) => setSaleForm({ ...saleForm, admin_pin: event.target.value })} autoComplete="off" /></Field></div>}
        </div>
        <div className="table-wrap sheet-table transaction-sale-edit-table-wrap"><table className="transaction-sale-edit-table"><colgroup><col className="sale-edit-product-column" /><col className="sale-edit-unit-column" /><col className="sale-edit-type-column" /><col className="sale-edit-quantity-column" /><col className="sale-edit-foc-column" /><col className="sale-edit-price-column" /><col className="sale-edit-total-column" /><col className="table-action-column" /></colgroup><thead><tr className="sale-edit-add-item-heading"><th colSpan="8"><button type="button" disabled={saleForm.adding_item} onClick={() => setSaleForm((current) => ({ ...current, adding_item: true }))}><Plus size={14} /> Add new item</button></th></tr><tr className="sale-edit-column-heading"><th>Product</th><th>Unit</th><th>Type</th><th>Paid Qty</th><th>FOC Qty</th><th>Unit Price</th><th>Total</th><th></th></tr></thead><tbody>
          {saleForm.adding_item && <tr className="sale-edit-new-item-row"><td className="sale-edit-new-product-cell"><RemoteCombobox value="" selectedOption={null} loadOptions={loadProductOptions} placeholder="Search product to add" allowClear={false} autoFocus onSelect={addSaleItem} /></td><td aria-hidden="true">—</td><td aria-hidden="true">—</td><td aria-hidden="true">—</td><td aria-hidden="true">—</td><td aria-hidden="true">—</td><td aria-hidden="true">—</td><td><button type="button" className="icon-btn sale-edit-cancel-item mkpos-dismiss-icon" aria-label="Cancel new item" title="Cancel new item" onClick={() => setSaleForm((current) => ({ ...current, adding_item: false }))}><X size={14} /></button></td></tr>}
          {saleForm.items.map((item, index) => <tr key={`${item.product_id}-${index}`}><td>{item.product_name}</td><td>{item.unit_name || 'Unit'}</td><td><select value={item.price_type} onChange={(event) => updateSaleItem(index, { price_type: event.target.value })}>{[...new Set([item.price_type, ...priceTypes])].map((type) => <option key={type} value={type}>{type}</option>)}</select></td><td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateSaleItem(index, { quantity: event.target.value })} /></td><td><input type="number" min="0" step="0.001" value={item.foc_quantity ?? ''} onChange={(event) => updateSaleItem(index, { foc_quantity: event.target.value })} /></td><td><input type="number" min="0" value={item.unit_price} onChange={(event) => updateSaleItem(index, { unit_price: event.target.value })} /></td><td>{money(normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_price, 0))}</td><td><button type="button" className="icon-btn danger sale-edit-remove-item" aria-label={`Remove ${item.product_name}`} title="Remove item" onClick={() => setSaleForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} /></button></td></tr>)}
        </tbody></table></div>
      </form>}
    </Modal>
  </>;
}

function SaleDetail({ sale }) {
  return <div className="transaction-detail"><div className="transaction-detail-meta"><span>Receipt <strong>{sale.receipt_no}</strong></span><span>Date <strong>{storedTimestamp(sale.created_at)}</strong></span><span>Customer <strong>{sale.customer_name || '-'}</strong></span><span>Payment Type <strong>{sale.payment_type}</strong></span><span>Payment Method <strong>{sale.payment_method}</strong></span><span>Status <strong>{sale.status}</strong></span><span>Subtotal <strong>{money(sale.subtotal)}</strong></span><span>Discount <strong>{money(sale.discount)}</strong></span><span>Total <strong>{money(sale.total)}</strong></span><span>Paid <strong>{money(sale.paid_amount)}</strong></span><span>Credit <strong>{money(sale.credit_amount)}</strong></span><span>Sale ID <strong>{sale.id}</strong></span></div><div className="table-wrap sheet-table"><table><thead><tr><th>Item</th><th>Item ID</th><th>Type</th><th>Paid Qty</th><th>FOC Qty</th><th>Issued</th><th>Unit Price</th><th>Unit Cost</th><th>Total</th></tr></thead><tbody>{(sale.items || []).map((item) => <tr key={item.id}><td>{item.product_name}</td><td>{item.product_id || '-'}</td><td>{item.price_type}</td><td>{formatQuantity(item.quantity)}</td><td>{formatQuantity(item.foc_quantity || 0)}</td><td>{formatQuantity(Number(item.quantity || 0) + Number(item.foc_quantity || 0))}</td><td>{money(item.unit_price)}</td><td>{money(item.unit_cost)}</td><td>{money(item.line_total)}</td></tr>)}</tbody></table></div></div>;
}
