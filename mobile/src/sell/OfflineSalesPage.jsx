import { businessDay, getBusinessTimezone } from '../timezone';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, IconButton, Select } from '../components/Controls';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, FileText, MoreVertical, Printer, RefreshCw, RotateCcw, WifiOff } from 'lucide-react';
import { EndlessListFooter, MobileNotice, MobileSheet } from '../components/MobilePrimitives';
import { useEndlessList } from '../hooks/useEndlessList';
import { useLocale } from '../localization/LocaleContext';

import { usePageRefresh } from '../navigation/pageRefresh';
import { getOfflineBootstrap, getOfflineData, listOfflineSales, retryOfflineSale } from '../offline/offlineStore';
import { offlineReceiptNumber, offlineReceiptPayload } from '../offline/offlineReceipt';
import { OFFLINE_STATE_EVENT, syncMobileOfflineSales } from '../offline/offlineSales';
import { formatQuantity, money } from '../products/productUtils';
import { printHtmlDocument, receiptOptions, receiptPrintDocument } from '../utils/printing';
import { sellText } from './sellLocale';

const PAGE_SIZE = 20;

export function OfflineSalesPage({ offlineMode, session, onNavigate }) {
  const { language } = useLocale();
  const t = useCallback((key, fallback, variables = {}) => sellText(key, language, variables, fallback), [language]);
  const [bootstrap, setBootstrap] = useState({ pending_count: 0, failed_count: 0 });
  const [notice, setNotice] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [ascending, setAscending] = useState(false);
  const [menuSale, setMenuSale] = useState(null);
  const [preview, setPreview] = useState(null);
  const [opening, setOpening] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const operation = useRef(false);

  const loadPage = useCallback(({ limit, offset }) => listOfflineSales({ limit, offset, ascending }), [ascending]);
  const list = useEndlessList({ loadPage, queryKey: `offline-sales:${ascending}`, pageSize: PAGE_SIZE });

  const refresh = useCallback(async () => {
    const [nextBootstrap] = await Promise.all([getOfflineBootstrap(), list.reload()]);
    setBootstrap(nextBootstrap);
  }, [list]);
  usePageRefresh(refresh);

  useEffect(() => {
    void getOfflineBootstrap().then(setBootstrap).catch(() => undefined);
  }, []);

  useEffect(() => {
    const update = () => { void refresh().catch(error => setNotice({ type: 'error', text: error.message })); };
    window.addEventListener(OFFLINE_STATE_EVENT, update);
    return () => window.removeEventListener(OFFLINE_STATE_EVENT, update);
  }, [refresh]);

  async function synchronize() {
    if (operation.current || offlineMode) return;
    operation.current = true;
    setSyncing(true);
    setNotice(null);
    try {
      const result = await syncMobileOfflineSales({ businessId: session?.business?.id, interactive: true });
      await refresh();
      if (result.blocked) setNotice({ type: 'error', text: t('offlineSyncBusinessMismatch', 'These invoices belong to another workspace. Sign in to that workspace to sync them.') });
      else if (result.interrupted) setNotice({ type: 'error', text: t('offlineStillDisconnected', 'The server is still unavailable. Sales remain safely on this device.') });
      else if (result.failed) setNotice({ type: 'error', text: t('offlineSyncRejected', `${result.failed} sale(s) need attention.`, { count: result.failed }) });
      else setNotice({ type: 'success', text: t('offlineSyncComplete', `${result.synced} offline sale(s) synchronized.`, { count: result.synced }) });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setSyncing(false);
      operation.current = false;
    }
  }

  async function retry(sale) {
    if (operation.current) return;
    operation.current = true;
    setRetrying(sale.id);
    let queued = false;
    try { await retryOfflineSale(sale.id); await refresh(); queued = true; }
    catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { operation.current = false; setRetrying(null); }
    if (queued && !offlineMode) await synchronize();
  }

  async function viewReceipt(sale) {
    setOpening(sale.id);
    try {
      const data = await getOfflineData();
      const receipt = offlineReceiptPayload(sale, data.settings, session?.business || data.session?.business);
      setPreview({ sale, receipt, document: receiptPrintDocument({ title: receipt.local_receipt_no, html: receipt.html, text: receipt.text, ...receiptOptions(receipt, data.settings), autoPrint: false }) });
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setOpening(null); }
  }

  async function printSale(sale) {
    try {
      const data = await getOfflineData();
      const receipt = offlineReceiptPayload(sale, data.settings, session?.business || data.session?.business);
      if (!await printHtmlDocument({ title: receipt.local_receipt_no, html: receipt.html, text: receipt.text, ...receiptOptions(receipt, data.settings) })) {
        setNotice({ type: 'error', text: t('allowPopups', 'Allow pop-ups to print the receipt.') });
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  const counts = bootstrap.sale_counts;
  const currency = session?.business?.currency || 'Ks';
  const statusLabel = status => ({ pending: t('queuePending', 'Pending sync'), syncing: t('queueSyncing', 'Syncing'), failed: t('queueConflict', 'Conflict'), synced: t('queueCompleted', 'Completed') })[status] || status;
  function saleDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '');
    const timezone = session?.business?.timezone || getBusinessTimezone();
    const today = businessDay(date, timezone) === businessDay(new Date(), timezone);
    return `${today ? t('todayLabel', 'Today') : date.toLocaleDateString(undefined, { timeZone: timezone })} ${date.toLocaleTimeString(language === 'my' ? 'my-MM' : 'en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' })}`;
  }
  return <main className="sale-page sale-retail-page offline-sales-page offline-reference-page">
    <PageAppBar className="retail-sale-header"><IconButton variant="ghost" type="button" aria-label={t('backToSell', 'Back to sell')} onClick={() => onNavigate('/sell', { back: true })}><ChevronLeft size={26} aria-hidden="true" /></IconButton><h1>{t('offlineSalesTitle', 'Offline sales')}</h1><AppBarMenu /></PageAppBar>
    <MobileNotice notice={notice} onClose={() => setNotice(null)} dismissLabel={t('dismissMessage', 'Dismiss message')} />
    <section className={`offline-connection-panel${offlineMode ? ' is-offline' : ''}`}><span className="offline-connection-icon">{offlineMode ? <WifiOff size={23} aria-hidden="true" /> : <RefreshCw size={23} aria-hidden="true" />}</span><div><h2>{offlineMode ? t('youAreOffline', 'You\u2019re offline') : t('connectionReady', 'Connection available')}</h2><p>{offlineMode ? t('localSalesAutoSync', 'Local sales will sync when online.') : t('readyToSync', 'Send waiting invoices to the server now.')}</p></div><span className="offline-connection-badge">{offlineMode ? t('offlineLabel', 'Offline') : t('onlineStatus', 'Online')}</span></section>
    <section className="offline-status-summary" aria-label={t('localSalesStatus', 'Local sales status')}>{[['pending', t('pendingLabel', 'Pending')], ['syncing', t('queueSyncing', 'Syncing')], ['failed', t('queueConflict', 'Conflict')], ['synced', t('queueCompleted', 'Completed')]].map(([status, label]) => <div key={status}><strong>{counts ? counts[status] : '\u2014'}</strong><span>{label}</span><i className={`offline-dot status-${status}`} aria-hidden="true" /></div>)}</section>
    <Button variant="plain" type="button" aria-label={syncing ? t('syncingSales', 'Syncing sales\u2026') : t('syncNow', 'Sync now')} aria-describedby="offline-sync-help" className="offline-sync-action" disabled={offlineMode || syncing || retrying !== null || !bootstrap.pending_count} onClick={synchronize}><RefreshCw className={syncing ? 'spin' : ''} size={24} aria-hidden="true" /><span><strong>{syncing ? t('syncingSales', 'Syncing sales\u2026') : t('syncNow', 'Sync now')}</strong><small id="offline-sync-help">{offlineMode ? t('connectToSync', 'Connect to the internet to sync.') : t('syncWaitingSales', 'Sync waiting local sales.')}</small></span></Button>
    <div className="offline-list-toolbar"><h2>{t('localSalesLabel', 'Local sales')} <span>({list.total ?? '\u2014'})</span></h2><Select aria-label={t('localSalesSort', 'Local sales order')} value={ascending ? 'oldest' : 'latest'} onChange={event => setAscending(event.target.value === 'oldest')}><option value="latest">{t('latestFirst', 'Latest first')}</option><option value="oldest">{t('oldestFirst', 'Oldest first')}</option></Select></div>
    {list.initialLoading ? <div className="offline-reference-loading" role="status"><RefreshCw className="spin" size={20} />{t('loadingOfflineInvoices', 'Loading offline invoices\u2026')}</div> : list.error && !list.items.length ? <div className="endless-first-error"><p role="alert">{list.error}</p><Button variant="plain" type="button" onClick={list.retry}>{t('tryAgain', 'Try again')}</Button></div> : list.items.length ? <>
      <section className="offline-sale-list" aria-label={t('localSalesLabel', 'Local sales')}>{list.items.map(sale => {
        const number = offlineReceiptNumber(sale), items = sale.payload?.items || [], units = items.reduce((sum, item) => sum + Number(item.quantity || 0) + Number(item.foc_quantity || 0), 0);
        return <article className={`offline-reference-card status-${sale.status}`} key={sale.id}>
          <span className="offline-receipt-icon" aria-hidden="true"><FileText size={22} /></span><strong className="offline-reference-number">{number}</strong><strong className="offline-reference-amount">{money(sale.local_total, currency)}</strong><span className={`offline-reference-badge status-${sale.status}`}><i className="offline-dot" aria-hidden="true" />{statusLabel(sale.status)}</span><IconButton variant="ghost" className="offline-row-menu" type="button" aria-label={t('offlineSaleActions', `Actions for ${number}`, { receipt: number })} onClick={() => setMenuSale(sale)}><MoreVertical size={18} /></IconButton>
          <span className="offline-reference-items">{t('localSaleItems', `${formatQuantity(units)} ${units === 1 ? 'unit' : 'units'} \u00b7 ${items.length} ${items.length === 1 ? 'item' : 'items'}`, { units: formatQuantity(units), items: items.length })}</span><time className="offline-reference-date" dateTime={sale.created_at}>{saleDate(sale.created_at)}</time>
          {sale.receipt_no && <small className="offline-server-reference">{sale.receipt_no}</small>}{sale.error_message && <p className="offline-reference-error" role="alert">{sale.error_message}</p>}
          <div className="offline-reference-actions"><Button variant="secondary" type="button" disabled={opening !== null} onClick={() => viewReceipt(sale)} aria-label={t('viewOfflineReceipt', `View local receipt ${number}`, { receipt: number })}><FileText size={19} />{t('viewLocalReceipt', 'View local receipt')}</Button>{sale.status === 'failed' ? <Button variant="secondary" type="button" disabled={syncing || retrying !== null} onClick={() => retry(sale)} aria-label={t('retryOfflineInvoice', `Retry ${number}`, { receipt: number })}><RotateCcw size={18} />{t('retryLabel', 'Retry')}</Button> : <Button variant="secondary" type="button" disabled={offlineMode || syncing || retrying !== null || sale.status !== 'pending'} onClick={synchronize} aria-label={t('syncOfflineSales', `Sync waiting sales from ${number}`, { receipt: number })}><RefreshCw size={18} />{sale.status === 'synced' ? t('queueCompleted', 'Completed') : t('syncNow', 'Sync now')}</Button>}</div>
        </article>;
      })}</section><EndlessListFooter list={list} count={list.items.length} noun={t('offlineInvoicesNoun', 'invoices')} labels={{ loadingMore: t('loadingMoreOfflineInvoices', 'Loading more invoices\u2026'), retry: t('tryAgain', 'Try again'), loadMore: t('loadMore', 'Load more'), end: t('offlineInvoicesEnd', `All ${list.items.length} offline invoices are shown.`, { count: list.items.length }) }} />
    </> : <div className="mobile-empty-state compact"><span><CheckCircle2 size={25} /></span><h2>{t('noOfflineInvoices', 'No offline invoices')}</h2><p>{t('offlineInvoicesAppearHere', 'Sales saved without a connection will appear here.')}</p></div>}
    <MobileSheet open={!!preview} title={t('localReceiptTitle', 'Local receipt')} description={preview?.receipt.local_receipt_no} onClose={() => setPreview(null)}>{preview && <div className="offline-receipt-preview"><iframe title={t('localReceiptTitle', 'Local receipt')} sandbox="" srcDoc={preview.document} /><Button variant="primary" className="mobile-primary" type="button" onClick={() => printSale(preview.sale)}><Printer size={18} />{t('printReceipt', 'Print receipt')}</Button></div>}</MobileSheet>
    <MobileSheet open={!!menuSale} title={t('saleActions', 'Sale actions')} description={menuSale ? offlineReceiptNumber(menuSale) : ''} onClose={() => setMenuSale(null)}>{menuSale && <div className="offline-menu-actions"><Button variant="secondary" className="mobile-secondary" type="button" onClick={() => { const sale = menuSale; setMenuSale(null); void viewReceipt(sale); }}><FileText size={18} />{t('viewLocalReceipt', 'View local receipt')}</Button><Button variant="secondary" className="mobile-secondary" type="button" onClick={() => { const sale = menuSale; setMenuSale(null); void printSale(sale); }}><Printer size={18} />{t('printReceipt', 'Print receipt')}</Button>{menuSale.status === 'failed' && <Button variant="secondary" className="mobile-secondary" type="button" disabled={syncing || retrying !== null} onClick={() => { const sale = menuSale; setMenuSale(null); void retry(sale); }}><RotateCcw size={18} />{t('retryLabel', 'Retry')}</Button>}</div>}</MobileSheet>
  </main>;
}
