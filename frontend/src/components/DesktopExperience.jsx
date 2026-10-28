import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  XCircle,
} from 'lucide-react';
import { request } from '../api';
import { OfflinePrinterDrawer } from './OfflinePrinterDrawer';
import {
  cachedProductPrice,
  desktopBridge,
  offlinePaymentMethods,
  refreshDesktopCache,
  syncOfflineSales,
} from '../desktop';
import { money, normalizeNumber } from '../utils';
import { offlineReceiptNumber, offlineReceiptPayload } from '../offlineReceipt';
import { printReceiptText, receiptLayoutVariables } from '../printing';
import { NotificationRegion, useNotifications } from './notifications';
import { TableLoadingState } from './common';
import { APP_ICON } from '../assets';
import { BrandImage } from '../platformBranding';

function DesktopStartup({ children = 'Opening PwarMyar Desktop...' }) {
  return (
    <div className="desktop-startup" role="status">
      <BrandImage asset="icon" className="desktop-mark" src={APP_ICON} alt="PwarMyar" />
      <strong>{children}</strong>
    </div>
  );
}

export function DesktopOnlineModeControl() {
  const bridge = desktopBridge();
  const [busy, setBusy] = useState(false);

  if (!bridge) return null;

  async function useOfflineMode() {
    if (busy) return;
    setBusy(true);
    try {
      await bridge.switchMode('offline');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desktop-sidebar-mode-control" aria-label="Desktop mode">
      <span className="desktop-sidebar-mode-status"><Cloud size={16} /><span>Online mode</span></span>
      <button type="button" disabled={busy} onClick={useOfflineMode}>
        <CloudOff size={16} /><span>{busy ? 'Switching...' : 'Offline POS'}</span>
      </button>
    </div>
  );
}

function queueStatusIcon(status) {
  if (status === 'synced') return <CheckCircle2 size={18} />;
  if (status === 'failed') return <XCircle size={18} />;
  return <RefreshCw size={18} />;
}

function DesktopCacheAgent({ session }) {
  useEffect(() => {
    let cancelled = false;
    const update = () => refreshDesktopCache(session).catch((error) => {
      if (!cancelled) console.warn('Offline product cache could not be updated:', error.message);
    });
    const updateAfterChange = (event) => {
      const resources = event.detail?.resources || [];
      if (resources.includes('*') || resources.some((item) => ['products', 'categories', 'settings', 'priceTypes'].includes(item))) update();
    };
    update();
    const timer = window.setInterval(update, 5 * 60 * 1000);
    window.addEventListener('mkpos:data-change', updateAfterChange);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('mkpos:data-change', updateAfterChange);
    };
  }, [session]);
  return null;
}

function DesktopSyncScreen({ bootstrap, session, onContinue, onLoggedOut }) {
  const bridge = desktopBridge();
  const [sales, setSales] = useState([]);
  const [salesLoaded, setSalesLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState('');
  const wrongBusiness = bootstrap.queue_business_id
    && Number(bootstrap.queue_business_id) !== Number(session.business.id);
  const pendingCount = salesLoaded
    ? sales.filter((sale) => ['pending', 'syncing'].includes(sale.status)).length
    : Number(bootstrap.pending_count || 0);
  const failedCount = salesLoaded
    ? sales.filter((sale) => sale.status === 'failed').length
    : Number(bootstrap.failed_count || 0);

  async function reload() {
    const rows = await bridge.listOfflineSales({ limit: 2000 });
    setSales(rows);
    setSalesLoaded(true);
    return rows;
  }

  async function runSync() {
    if (busy || wrongBusiness) return;
    setBusy(true);
    setMessage('');
    setProgress(null);
    try {
      const result = await syncOfflineSales({
        bridge,
        onProgress: ({ result: current, total, current: sale, error }) => {
          setProgress({ ...current, total, sale, error: error?.message || '' });
        },
      });
      await reload();
      if (result.interrupted) {
        setMessage('Sync paused because the server connection was interrupted. The sale remains pending.');
      } else if (result.failed) {
        setMessage(`${result.synced} synced; ${result.failed} failed. Failed records remain below for review.`);
      } else {
        setMessage(result.synced ? `${result.synced} offline sale${result.synced === 1 ? '' : 's'} synced.` : 'No pending sales.');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function retrySale(id) {
    await bridge.retryFailedSale(id);
    await reload();
    window.setTimeout(runSync, 0);
  }

  async function switchAccount() {
    try { await request('/auth/logout', { method: 'POST' }); } finally { onLoggedOut(); }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const rows = await bridge.listOfflineSales({ limit: 2000 });
        if (cancelled) return;
        setSales(rows);
        setSalesLoaded(true);
        if (wrongBusiness || !rows.some((sale) => sale.status === 'pending')) return;
        setBusy(true);
        const result = await syncOfflineSales({
          bridge,
          onProgress: ({ result: current, total, current: sale, error }) => {
            if (!cancelled) setProgress({ ...current, total, sale, error: error?.message || '' });
          },
        });
        if (cancelled) return;
        setSales(await bridge.listOfflineSales({ limit: 2000 }));
        if (result.interrupted) setMessage('Sync paused because the server connection was interrupted. The sale remains pending.');
        else if (result.failed) setMessage(`${result.synced} synced; ${result.failed} failed. Failed records remain below for review.`);
        else setMessage(result.synced ? `${result.synced} offline sale${result.synced === 1 ? '' : 's'} synced.` : 'No pending sales.');
      } catch (error) {
        if (!cancelled) setMessage(error.message);
      } finally {
        if (!cancelled) {
          setBusy(false);
          setProgress(null);
        }
      }
    }
    initialize();
    return () => { cancelled = true; };
  }, [bridge, wrongBusiness]);

  return (
    <main className="desktop-sync-page">
      <header className="desktop-mode-header">
        <div><BrandImage asset="icon" className="desktop-mark" src={APP_ICON} alt="" /><div><strong>PwarMyar Desktop</strong><small>{session.business.name}</small></div></div>
        <span className="desktop-online-badge"><Cloud size={17} /> Online</span>
      </header>
      <section className="desktop-sync-card">
        <div className="desktop-sync-heading">
          <span><Database size={25} /></span>
          <div><p>OFFLINE SALES</p><h1>Review and sync local sales</h1><small>Sales are sent oldest first. A rejected record stays visible while the next record continues.</small></div>
        </div>

        {wrongBusiness && (
          <div className="desktop-sync-warning">
            <AlertTriangle size={20} />
            <div><strong>These sales belong to another business.</strong><span>Sign in to the business that created them before syncing.</span></div>
            <button type="button" onClick={switchAccount}>Switch account</button>
          </div>
        )}

        <div className="desktop-sync-summary">
          <div><strong>{pendingCount}</strong><span>Pending</span></div>
          <div><strong>{failedCount}</strong><span>Failed</span></div>
          <div><strong>{sales.filter((sale) => sale.status === 'synced').length}</strong><span>Synced</span></div>
        </div>

        {progress && (
          <div className="desktop-sync-progress" role="status">
            <RefreshCw className="spin" size={18} />
            <span>Processing local sale #{progress.sale.id} · {progress.processed} of {progress.total} completed</span>
          </div>
        )}
        {message && <div className="desktop-sync-message">{message}</div>}

        <div className="desktop-sync-table-wrap">
          {!salesLoaded && <TableLoadingState>Loading offline sales…</TableLoadingState>}
          <table className="desktop-sync-table">
            <thead><tr><th>Local sale</th><th>Created</th><th>Items</th><th>Total</th><th>Status</th><th>Result</th><th /></tr></thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td><strong>#{sale.id}</strong><small>{sale.uuid.slice(0, 8)}</small></td>
                  <td>{new Date(sale.created_at).toLocaleString()}</td>
                  <td>{sale.payload.items?.length || 0}</td>
                  <td>{money(sale.local_total, session.business.currency)}</td>
                  <td><span className={`desktop-sale-status ${sale.status}`}>{queueStatusIcon(sale.status)} {sale.status}</span></td>
                  <td className="desktop-sync-result">{sale.error_message || sale.receipt_no || 'Waiting'}</td>
                  <td>{sale.status === 'failed' && <button type="button" disabled={busy} onClick={() => retrySale(sale.id)}>Retry</button>}</td>
                </tr>
              ))}
              {salesLoaded && !sales.length && <tr><td colSpan="7" className="desktop-empty-row">No offline sales have been recorded.</td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="desktop-sync-actions">
          <button type="button" disabled={busy || wrongBusiness} onClick={runSync}><RefreshCw size={17} /> {busy ? 'Syncing...' : 'Sync pending sales'}</button>
          <button type="button" className="primary" disabled={busy || pendingCount > 0 || wrongBusiness} onClick={onContinue}>Continue to PwarMyar</button>
        </footer>
      </section>
    </main>
  );
}

export function DesktopOnlineGate({ session, onLoggedOut, children }) {
  const bridge = desktopBridge();
  const [bootstrap, setBootstrap] = useState(null);
  const [continueOnline, setContinueOnline] = useState(false);

  useEffect(() => {
    bridge?.getBootstrap().then(setBootstrap).catch(() => setBootstrap({ pending_count: 0, failed_count: 0 }));
  }, [bridge]);

  if (!bridge) return children;
  if (!bootstrap) return <DesktopStartup>Checking the offline sale queue...</DesktopStartup>;
  const requiresReview = bootstrap.pending_count > 0 || bootstrap.failed_count > 0;
  if (requiresReview && !continueOnline) {
    return <DesktopSyncScreen bootstrap={bootstrap} session={session} onContinue={() => setContinueOnline(true)} onLoggedOut={onLoggedOut} />;
  }
  return <><DesktopCacheAgent session={session} />{children}</>;
}

function OfflineUnavailable({ bootstrap, retry }) {
  const [queuedSales, setQueuedSales] = useState([]);
  const [checking, setChecking] = useState(false);
  const { notify } = useNotifications();
  useEffect(() => {
    if (!bootstrap?.pending_count && !bootstrap?.failed_count) return;
    desktopBridge()?.listOfflineSales({ statuses: ['pending', 'syncing', 'failed'], limit: 2000 })
      .then(setQueuedSales)
      .catch(() => setQueuedSales([]));
  }, [bootstrap?.failed_count, bootstrap?.pending_count]);
  const currency = bootstrap?.session?.business?.currency || 'Ks';

  async function checkConnection() {
    if (checking) return;
    setChecking(true);
    notify('Checking the PwarMyar server connection...', 'information');
    try {
      const status = await retry();
      const isConnected = Boolean(status?.connected ?? status?.online ?? status);
      if (isConnected) {
        notify('Connection restored. Opening online mode...', 'success');
      } else {
        notify('The PwarMyar server is still unavailable. Check your internet connection and try again.', 'error');
      }
    } catch (connectionError) {
      notify(connectionError?.message || 'The PwarMyar server connection could not be checked.', 'error');
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="desktop-unavailable">
      <NotificationRegion />
      <div className="desktop-unavailable-card">
        <CloudOff size={38} />
        <p>OFFLINE MODE</p>
        <h1>Offline POS is not ready</h1>
        <span>This device must connect successfully and download an authorized product list before it can sell offline.</span>
        {bootstrap?.last_product_sync && <small>Last attempted cache: {new Date(bootstrap.last_product_sync).toLocaleString()}</small>}
        {(bootstrap?.pending_count > 0 || bootstrap?.failed_count > 0) && (
          <section className="desktop-expired-queue" aria-label="Saved offline invoices">
            <strong>{Number(bootstrap.pending_count || 0) + Number(bootstrap.failed_count || 0)} saved invoice(s) remain on this device</strong>
            <span>New sales are blocked, but these invoices remain available and will be checked when the server reconnects.</span>
            {queuedSales.map((sale) => <div key={sale.id}><span>{offlineReceiptNumber(sale)} · {sale.status}</span><strong>{money(sale.local_total, currency)}</strong></div>)}
          </section>
        )}
        <button type="button" className="primary" disabled={checking} onClick={checkConnection}>
          <RefreshCw className={checking ? 'spin' : undefined} size={17} />
          {checking ? 'Checking connection...' : 'Check connection'}
        </button>
      </div>
    </main>
  );
}

function OfflineReceiptModal({ sale, settings, business, onClose }) {
  const receipt = useMemo(() => offlineReceiptPayload(sale, settings, business), [business, sale, settings]);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');

  async function printInvoice() {
    setPrinting(true);
    setPrintError('');
    try {
      await printReceiptText(receipt.text, receipt.paper_size, {
        html: receipt.html,
        layout: receipt.layout,
        printerName: settings.printer_name,
      });
    } catch (error) {
      setPrintError(error.message || 'Receipt could not be printed.');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="mkpos-modal-overlay desktop-receipt-overlay" role="presentation">
      <section className="mkpos-modal desktop-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="offline-receipt-title">
        <header className="mkpos-modal-header">
          <div><p>OFFLINE INVOICE</p><h2 id="offline-receipt-title">{offlineReceiptNumber(sale)}</h2></div>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        <div className="mkpos-modal-body sale-receipt-preview">
          {printError && <div className="error" role="alert">{printError}</div>}
          <div
            className="receipt-document-host"
            style={receiptLayoutVariables(receipt.layout, receipt.paper_size)}
            dangerouslySetInnerHTML={{ __html: receipt.html }}
          />
        </div>
        <footer className="mkpos-modal-footer">
          <button type="button" onClick={onClose}>Close</button>
          <button type="button" className="primary" disabled={printing} onClick={printInvoice}><Printer size={17} /> {printing ? 'Printing...' : 'Print invoice'}</button>
        </footer>
      </section>
    </div>
  );
}

function OfflineInvoiceHistory({ sales, currency, onPreview, onClose }) {
  return (
    <div className="mkpos-modal-overlay" role="presentation">
      <section className="mkpos-modal mkpos-modal-wide desktop-invoice-history" role="dialog" aria-modal="true" aria-labelledby="offline-invoices-title">
        <header className="mkpos-modal-header"><div><p>LOCAL HISTORY</p><h2 id="offline-invoices-title">Offline invoices</h2></div><button type="button" onClick={onClose}>Close</button></header>
        <div className="mkpos-modal-body">
          <div className="desktop-invoice-list">
            {sales.map((sale) => (
              <div className="desktop-invoice-row" key={sale.id}>
                <div><strong>{offlineReceiptNumber(sale)}</strong><span>{new Date(sale.created_at).toLocaleString()}</span></div>
                <span>{sale.payload.items?.length || 0} items</span>
                <strong>{money(sale.local_total, currency)}</strong>
                <span className={`desktop-sale-status ${sale.status}`}>{queueStatusIcon(sale.status)} {sale.status}</span>
                <button type="button" onClick={() => onPreview(sale)}><Printer size={16} /> Preview</button>
              </div>
            ))}
            {!sales.length && <div className="desktop-empty-products">No offline invoices have been saved.</div>}
          </div>
        </div>
        <footer className="mkpos-modal-footer"><button type="button" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}

function OfflinePos({ initialBootstrap }) {
  const bridge = desktopBridge();
  const { notify } = useNotifications();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priceType, setPriceType] = useState('Retail');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [switchingOnline, setSwitchingOnline] = useState(false);
  const [serverOnline, setServerOnline] = useState(Boolean(initialBootstrap.connected ?? initialBootstrap.online));
  const [pendingCount, setPendingCount] = useState(initialBootstrap.pending_count || 0);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [invoiceHistoryOpen, setInvoiceHistoryOpen] = useState(false);
  const [printerSettingsOpen, setPrinterSettingsOpen] = useState(false);
  const [invoiceSales, setInvoiceSales] = useState([]);

  useEffect(() => {
    bridge.getOfflineData().then((payload) => {
      setData(payload);
      setPaymentMethod(offlinePaymentMethods(payload.settings)[0]);
    }).catch((loadError) => setError(loadError.message));
    return bridge.onConnectivityChanged((status) => setServerOnline(Boolean(status?.connected ?? status)));
  }, [bridge]);

  const priceTypes = useMemo(() => {
    const configured = String(data?.settings?.price_types || '').split(',').map((item) => item.trim()).filter(Boolean);
    return configured.length ? configured : ['Retail'];
  }, [data]);
  const paymentMethods = useMemo(() => offlinePaymentMethods(data?.settings), [data]);
  const products = useMemo(() => (data?.products || []).filter((product) => {
    const text = [product.name, product.sku, product.barcode, product.category].join(' ').toLocaleLowerCase();
    return (!search.trim() || text.includes(search.trim().toLocaleLowerCase())) && (!category || product.category === category);
  }), [category, data, search]);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.quantity || 0) * item.unit_price, 0);
  const cleanDiscount = Math.min(Math.max(Math.round(normalizeNumber(discount, 0)), 0), Math.round(subtotal));
  const total = Math.max(Math.round(subtotal) - cleanDiscount, 0);

  function addProduct(product) {
    const price = cachedProductPrice(product, priceType);
    if (price <= 0) {
      setError(`No cached ${priceType} price is available for ${product.name}.`);
      return;
    }
    setError('');
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id && item.price_type === priceType);
      if (existing) return current.map((item) => item === existing ? { ...item, quantity: Number(item.quantity) + 1 } : item);
      return [...current, {
        product_id: product.id, product_name: product.name, price_type: priceType,
        unit_price: price, quantity: 1, foc_quantity: 0, base_unit: product.base_unit || 'Unit',
      }];
    });
  }

  function updateItem(index, field, value) {
    if (value !== '' && !/^\d*\.?\d{0,3}$/.test(String(value))) return;
    setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function stepQuantity(index, amount) {
    setCart((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, quantity: Math.max(0.001, normalizeNumber(item.quantity, 1) + amount) }
      : item));
  }

  async function saveSale() {
    setError('');
    setMessage('');
    if (!cart.length) return setError('Add at least one product to the cart.');
    try {
      setSaving(true);
      const sale = await bridge.createOfflineSale({ items: cart, discount: cleanDiscount, payment_method: paymentMethod });
      const bootstrap = await bridge.getBootstrap();
      setPendingCount(bootstrap.pending_count);
      setCart([]);
      setDiscount(0);
      setMessage(`Offline sale #${sale.id} saved. It will be checked against server stock when online.`);
      setSelectedReceipt(sale);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function checkConnection() {
    setError('');
    try {
      const status = await bridge.checkConnectivity();
      const isConnected = Boolean(status?.connected ?? status);
      setServerOnline(isConnected);
      if (isConnected) {
        notify('PwarMyar server is available. You can go online and sync now.', 'success');
      } else {
        const unavailable = 'The PwarMyar server is still unavailable. Check your connection and try again.';
        setError(unavailable);
        notify(unavailable, 'error');
      }
    } catch (connectionError) {
      const detail = connectionError?.message || 'The server connection could not be checked.';
      setServerOnline(false);
      setError(detail);
      notify(detail, 'error');
    }
  }

  async function useOnlineMode() {
    if (switchingOnline) return;
    setError('');
    setSwitchingOnline(true);
    notify('Opening online mode and preparing offline sales to sync...', 'information');
    try {
      await bridge.switchMode('online');
    } catch (switchError) {
      setServerOnline(false);
      setError(switchError.message);
      notify(switchError.message, 'error');
      setSwitchingOnline(false);
    }
  }

  async function openInvoiceHistory() {
    setError('');
    try {
      setInvoiceSales(await bridge.listOfflineSales({ limit: 2000 }));
      setInvoiceHistoryOpen(true);
    } catch (historyError) {
      setError(historyError.message);
    }
  }

  if (!data) {
    if (error) return <OfflineUnavailable bootstrap={initialBootstrap} retry={checkConnection} />;
    return <DesktopStartup>Loading cached products...</DesktopStartup>;
  }

  return (
    <div className="desktop-offline-shell">
      <NotificationRegion />
      <header className="desktop-mode-header">
        <div><BrandImage asset="icon" className="desktop-mark" src={APP_ICON} alt="" /><div><strong>Offline POS</strong><small>{data.session.business.name} · {data.session.user.name}</small></div></div>
        <div className="desktop-mode-actions">
          <span className={serverOnline ? 'desktop-online-badge' : 'desktop-offline-badge'}>{serverOnline ? <Cloud size={17} /> : <CloudOff size={17} />}{serverOnline ? 'Server available' : 'Offline'}</span>
          <span className="desktop-queue-badge"><Database size={16} /> {pendingCount} pending</span>
          <button type="button" onClick={openInvoiceHistory}><Printer size={16} /> Invoices</button>
          {window.mkposDesktop?.getPrinterConfig && <button type="button" aria-expanded={printerSettingsOpen} onClick={() => setPrinterSettingsOpen(true)}><Printer size={16} /> Printer settings</button>}
          {serverOnline
            ? <button type="button" className="primary" disabled={switchingOnline} onClick={useOnlineMode}>{switchingOnline ? <><RefreshCw className="spin" size={16} /> Opening online mode...</> : 'Go online & sync'}</button>
            : <button type="button" onClick={checkConnection}><RefreshCw size={16} /> Reconnect</button>}
        </div>
      </header>

      <main className="desktop-offline-pos">
        <section className="desktop-product-panel">
          <div className="desktop-offline-notice"><CloudOff size={18} /><span>Local sale mode — server stock is not checked until synchronization.</span></div>
          <div className="desktop-product-filters">
            <label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU, or barcode" autoFocus /></label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{data.categories.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <div className="desktop-price-types">{priceTypes.map((type) => <button key={type} type="button" className={type === priceType ? 'selected' : ''} onClick={() => setPriceType(type)}>{type}</button>)}</div>
          <div className="desktop-product-count">{products.length} cached products</div>
          <div className="desktop-product-grid">
            {products.map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)}><strong>{product.name}</strong><span>{product.category || 'Uncategorized'}</span><b>{money(cachedProductPrice(product, priceType), data.session.business.currency)} / {product.base_unit || 'Unit'}</b></button>)}
            {!products.length && <div className="desktop-empty-products">No cached products match this search.</div>}
          </div>
        </section>

        <aside className="desktop-cart-panel">
          <div className="desktop-cart-heading"><div><ShoppingCart size={20} /><strong>Cart</strong><span>{cart.length} lines</span></div>{cart.length > 0 && <button type="button" onClick={() => setCart([])}><Trash2 size={16} /> Clear</button>}</div>
          <div className="desktop-cart-lines">
            {cart.map((item, index) => (
              <div className="desktop-cart-line" key={`${item.product_id}-${item.price_type}`}>
                <div className="desktop-cart-name"><strong>{item.product_name}</strong><span>{item.price_type} · {money(item.unit_price, data.session.business.currency)}</span></div>
                <div className="desktop-quantity-row"><button type="button" onClick={() => stepQuantity(index, -1)}><Minus size={15} /></button><input aria-label={`${item.product_name} quantity`} value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} /><button type="button" onClick={() => stepQuantity(index, 1)}><Plus size={15} /></button><label>FOC<input aria-label={`${item.product_name} FOC quantity`} value={item.foc_quantity} onChange={(event) => updateItem(index, 'foc_quantity', event.target.value)} /></label></div>
                <div className="desktop-cart-line-footer"><b>{money(Number(item.quantity || 0) * item.unit_price, data.session.business.currency)}</b><button type="button" aria-label={`Remove ${item.product_name}`} onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button></div>
              </div>
            ))}
            {!cart.length && <div className="desktop-empty-cart"><ShoppingCart size={32} /><strong>Cart is empty</strong><span>Select a cached product to begin.</span></div>}
          </div>
          <div className="desktop-checkout">
            {error && <div className="desktop-error">{error}</div>}
            {message && <div className="desktop-success">{message}</div>}
            <label>Discount<input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
            <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
            <div className="desktop-total"><span>Total</span><strong>{money(total, data.session.business.currency)}</strong></div>
            <button type="button" className="primary desktop-save-sale" disabled={saving || !cart.length} onClick={saveSale}>{saving ? 'Saving locally...' : 'Complete offline sale'}</button>
            <small>Fully paid sales only. Customer credit is unavailable offline.</small>
          </div>
        </aside>
      </main>
      {invoiceHistoryOpen && (
        <OfflineInvoiceHistory
          sales={invoiceSales}
          currency={data.session.business.currency}
          onClose={() => setInvoiceHistoryOpen(false)}
          onPreview={(sale) => { setInvoiceHistoryOpen(false); setSelectedReceipt(sale); }}
        />
      )}
      {printerSettingsOpen && <OfflinePrinterDrawer settings={data.settings} onClose={() => setPrinterSettingsOpen(false)} />}
      {selectedReceipt && (
        <OfflineReceiptModal
          sale={selectedReceipt}
          settings={data.settings}
          business={data.session.business}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

export function DesktopEntry({ children }) {
  const bridge = desktopBridge();
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bridge) return;
    bridge.getBootstrap().then(async (payload) => {
      setBootstrap(payload);
    }).catch((startupError) => setError(startupError.message));
    return bridge.onConnectivityChanged((status) => {
      setBootstrap((current) => current ? { ...current, ...status } : current);
    });
  }, [bridge]);

  if (!bridge) return children;
  if (error) return <div className="desktop-startup"><AlertTriangle size={30} /><strong>{error}</strong></div>;
  if (!bootstrap) return <DesktopStartup />;
  if (bootstrap.mode === 'offline' || !bootstrap.online) {
    if (!bootstrap.cache_ready) return <OfflineUnavailable bootstrap={bootstrap} retry={() => bridge.openOnline()} />;
    return <OfflinePos initialBootstrap={bootstrap} />;
  }
  return children;
}
