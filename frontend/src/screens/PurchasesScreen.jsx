import { useAiPageLink, returnFromAiPage } from '../ai/useAiPageLink';
import React, { useState } from 'react';
import { Filter, Plus, Search } from 'lucide-react';
import { request } from '../api';
import { money } from '../utils';
import { Field, FilterDrawer, Modal } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { useConfirmation } from '../components/confirmations';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { dateRangeError, presetDateFromTo } from '../dateRanges';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../csvExport';
import { loadPurchaseLineItems, PURCHASE_LINE_COLUMNS } from '../purchaseCsv';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { TABLE_PAGE_SIZE } from '../tablePagination';
import { NewPurchaseScreen } from './NewPurchaseScreen';
import { PurchaseHistoryTable } from '../components/PurchaseHistoryTable';

function blankPurchaseHistoryFilters() {
  return {
    preset: 'all',
    q: '',
    date_from: '',
    date_to: '',
  };
}

function purchaseHistoryPath(filters, offset = 0) {
  const params = new URLSearchParams();
  params.set('status', 'completed');
  params.set('limit', String(TABLE_PAGE_SIZE));
  params.set('offset', String(offset));
  params.set('with_total', 'true');
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  return `/purchases?${params.toString()}`;
}

export function PurchasesScreen() {
  const [purchases, setPurchases] = useState([]);
  const [filters, setFilters] = useState(blankPurchaseHistoryFilters());
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewPurchase, setViewPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [editor, setEditor] = useState({ open: false, purchaseId: null, requestKey: 0 });
  const loadSequence = React.useRef(0);
  const { setMessage, setError } = useScreenNotifications();
  const confirmAction = useConfirmation();

  const activeFilterCount = [
    filters.q.trim(),
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  function exportPurchases() {
    const url = new URL(purchaseHistoryPath(filters), window.location.origin);
    url.searchParams.delete('limit');
    url.searchParams.delete('offset');
    url.searchParams.delete('with_total');
    const path = `${url.pathname}${url.search}`;
    return exportFilteredCsv({
      loadRows: () => loadPurchaseLineItems(path),
      filename: csvFilename('purchases'),
      emptyMessage: 'No purchases match the current filters.',
      columns: PURCHASE_LINE_COLUMNS,
    });
  }

  async function loadPurchases({ nextFilters = filters, nextPage = 1 } = {}) {
    const rangeError = dateRangeError(nextFilters.date_from, nextFilters.date_to);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    const sequence = ++loadSequence.current;
    const pageSize = TABLE_PAGE_SIZE;
    const nextOffset = (nextPage - 1) * pageSize;
    setLoading(true);
    setError('');
    try {
      const data = await request(purchaseHistoryPath(nextFilters, nextOffset));
      if (sequence !== loadSequence.current) return;
      const rows = data.items || [];
      setPurchases(rows);
      setTotal(Number(data.total || 0));
      setPage(nextPage);
    } catch (err) {
      if (sequence === loadSequence.current) setError(`Cannot load purchase history. ${err.message}`);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }

  useLatestEffect(() => {
    loadPurchases();
  }, []);

  useDataRefresh(['purchases'], 'purchases', () => loadPurchases({ nextFilters: filters, nextPage: page }));

  function setPreset(preset) {
    const next = { ...filters, preset, ...presetDateFromTo(preset) };
    setFilters(next);
    loadPurchases({ nextFilters: next });
  }

  function applyFilters(event) {
    event.preventDefault();
    const next = { ...filters, preset: 'custom' };
    setFilters(next);
    loadPurchases({ nextFilters: next });
    setFilterOpen(false);
  }

  function clearFilters() {
    const next = blankPurchaseHistoryFilters();
    setFilters(next);
    loadPurchases({ nextFilters: next });
    setFilterOpen(false);
  }

  async function viewPurchaseDetail(purchaseId) {
    setError('');
    try {
      setViewPurchase(await request(`/purchases/${purchaseId}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function deletePurchase(purchase) {
    const { confirmed, pin: adminPin } = await confirmAction({
      title: 'Delete purchase',
      message: `Delete purchase from "${purchase.supplier_name || 'Unknown supplier'}"? Its stock changes will be reversed and the purchase will be removed from history.`,
      confirmLabel: 'Delete Purchase',
      requirePin: true,
    });
    if (!confirmed) return;
    setError('');
    setMessage('');
    try {
      setDeletingId(purchase.id);
      await request(`/purchases/${purchase.id}`, {
        method: 'DELETE',
        ...(adminPin ? { body: JSON.stringify({ admin_pin: adminPin }) } : {}),
      });
      setMessage('Purchase deleted.');
      await loadPurchases({ nextFilters: filters, nextPage: page });
      emitDataChange(['purchases', 'products', 'suppliers', 'reports'], 'purchases');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  useAiPageLink('purchases', target => { if (target.action === 'new' && !editor.open) openPurchaseEditor(null,target.purchaseDraftId); }, !loading);

  function openPurchaseEditor(purchaseId = null, purchaseDraftId = null) {
    setEditor((current) => ({ open: true, purchaseId, purchaseDraftId, requestKey: current.requestKey + 1 }));
  }

  function closePurchaseEditor() {
    setEditor((current) => ({ ...current, open: false }));
    returnFromAiPage('purchases_new');
  }

  return (
    <>
      <section className="screen purchases-layout mkpos-sheet">
        <div className="panel purchase-main-panel">
          <AppBarActions className="purchase-page-actions">
              <button type="button" className="primary" onClick={() => openPurchaseEditor()}>
                <Plus size={16} /> New Purchase
              </button>
              <button type="button" className="filter-drawer-trigger" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}>
                <Filter size={16} /> Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </button>
              <CsvExportButton onExport={exportPurchases} onError={setError} onSuccess={setMessage} />
          </AppBarActions>
          <AppBarSearch><form onSubmit={applyFilters}><label><Search size={16} /><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search purchase, supplier, product, or note" aria-label="Search purchases" /></label></form></AppBarSearch>

          <PurchaseHistoryTable
            purchases={purchases}
            loading={loading}
            page={page}
            pageSize={TABLE_PAGE_SIZE}
            total={total}
            deletingId={deletingId}
            onPageChange={(nextPage) => loadPurchases({ nextFilters: filters, nextPage })}
            onView={viewPurchaseDetail}
            onEdit={openPurchaseEditor}
            onDelete={deletePurchase}
          />
        </div>
      </section>

      <FilterDrawer open={filterOpen} title="Purchase history filters" onClose={() => setFilterOpen(false)} busy={loading}>
        <form className="drawer-filter-form purchase-history-filter" onSubmit={applyFilters}>
          <div className="purchase-quick-ranges">
            {[
              ['today', 'Today'],
              ['week', 'This Week'],
              ['month', 'This Month'],
              ['year', 'This Year'],
              ['all', 'All Time'],
            ].map(([preset, label]) => (
              <button key={preset} type="button" className={filters.preset === preset ? 'selected' : ''} onClick={() => setPreset(preset)}>{label}</button>
            ))}
          </div>
          <Field label="From"><input type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, preset: 'custom', date_from: event.target.value })} /></Field>
          <Field label="To"><input type="date" value={filters.date_to} onChange={(event) => setFilters({ ...filters, preset: 'custom', date_to: event.target.value })} /></Field>
          <div className="drawer-filter-actions">
            <button type="button" onClick={clearFilters} disabled={loading}>Clear</button>
            <button type="submit" className="primary" disabled={loading}>Apply Filter</button>
          </div>
        </form>
      </FilterDrawer>

      <Modal open={Boolean(viewPurchase)} title="Purchase Detail" onClose={() => setViewPurchase(null)} footer={<button type="button" onClick={() => setViewPurchase(null)}>Close</button>}>
        {viewPurchase && (
          <div className="purchase-detail">
            <div className="purchase-detail-meta">
              <span>Supplier <strong>{viewPurchase.supplier_name || '-'}</strong></span>
              <span>Date <strong>{viewPurchase.created_at}</strong></span>
              <span>Total <strong>{money(viewPurchase.total_cost)}</strong></span>
              <span>Paid <strong>{money(viewPurchase.paid_amount)}</strong></span>
              <span>Supplier Credit <strong>{money(viewPurchase.credit_amount)}</strong></span>
              <span>Payment Method <strong>{viewPurchase.payment_method || 'Cash'}</strong></span>
            </div>
            {viewPurchase.note && <div className="info-box">{viewPurchase.note}</div>}
            <div className="table-wrap sheet-table">
              <table>
                <thead><tr><th>Product</th><th>Paid Qty</th><th>FOC Qty</th><th>Received</th><th>Unit Cost</th><th>Effective Cost</th><th>Total</th></tr></thead>
                <tbody>
                  {(viewPurchase.items || []).map((item) => (
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
      {editor.open && <NewPurchaseScreen modal open purchaseDraftId={editor.purchaseDraftId} purchaseId={editor.purchaseId} requestKey={editor.requestKey} onExit={closePurchaseEditor} />}
    </>
  );
}
