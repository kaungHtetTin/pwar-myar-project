const DATABASE_NAME = 'mkpos-mobile-offline';
const DATABASE_VERSION = 1;
const META_STORE = 'metadata';
const PRODUCT_STORE = 'products';
const SALE_STORE = 'offline_sales';
const QUEUED_STATUSES = new Set(['pending', 'syncing', 'failed']);
let databasePromise;

export function offlineStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline storage request failed.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Offline storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Offline storage transaction was cancelled.'));
  });
}

function openDatabase() {
  if (!offlineStorageAvailable()) return Promise.reject(new Error('Offline storage is not available on this device.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
        if (!database.objectStoreNames.contains(PRODUCT_STORE)) database.createObjectStore(PRODUCT_STORE, { keyPath: 'id' });
        if (!database.objectStoreNames.contains(SALE_STORE)) {
          const sales = database.createObjectStore(SALE_STORE, { keyPath: 'id', autoIncrement: true });
          sales.createIndex('status', 'status', { unique: false });
          sales.createIndex('business_id', 'business_id', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromise = null;
        reject(request.error || new Error('Cannot open offline storage.'));
      };
    });
  }
  return databasePromise;
}

async function allFrom(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const completed = transactionDone(transaction);
  const result = await requestResult(transaction.objectStore(storeName).getAll());
  await completed;
  return result;
}

async function metaValue(key, fallback = null) {
  const database = await openDatabase();
  const transaction = database.transaction(META_STORE, 'readonly');
  const completed = transactionDone(transaction);
  const row = await requestResult(transaction.objectStore(META_STORE).get(key));
  await completed;
  return row?.value ?? fallback;
}

export function authorizedOfflineSession(session, now = Date.now()) {
  if (!session?.permissions?.includes('sell') || !session?.subscription?.is_valid) return false;
  const endsAt = session.subscription?.ends_at || session.subscription?.subscription?.ends_at;
  return !endsAt || new Date(endsAt).getTime() > now;
}

export function cachedProductPrice(product, priceType) {
  const named = (product?.prices || []).find((row) => row.name === priceType)?.price;
  if (named !== undefined && named !== null) return Number(named);
  return priceType === 'Retail' ? Number(product?.price || 0) : 0;
}

export function offlinePaymentMethods(settings = {}) {
  const methods = String(settings.payment_methods || 'Cash')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && item.toLowerCase() !== 'credit');
  return methods.length ? methods : ['Cash'];
}

export async function replaceOfflineCache({ session, appConfig = {}, products, settings = {}, categories = [] }) {
  if (!session?.user?.id || !session?.business?.id) throw new Error('A valid online session is required to prepare offline sales.');
  if (!session.permissions?.includes('sell')) throw new Error('This account does not have Sell permission.');
  if (!session.subscription?.is_valid) throw new Error('An active subscription is required for offline sales.');
  if (!Array.isArray(products)) throw new Error('The offline product cache is invalid.');

  const sales = await allFrom(SALE_STORE);
  const foreign = sales.find((sale) => ['pending', 'syncing'].includes(sale.status) && Number(sale.business_id) !== Number(session.business.id));
  if (foreign) throw new Error('Unsynced sales from another business must be resolved before changing businesses.');

  const database = await openDatabase();
  const transaction = database.transaction([META_STORE, PRODUCT_STORE], 'readwrite');
  const metadata = transaction.objectStore(META_STORE);
  const productStore = transaction.objectStore(PRODUCT_STORE);
  productStore.clear();
  const cachedSession = {
    ...session,
    permissions: session.permissions || appConfig.permissions || [],
  };
  metadata.put({ key: 'session', value: cachedSession });
  metadata.put({ key: 'app_config', value: appConfig });
  metadata.put({ key: 'settings', value: settings });
  metadata.put({ key: 'categories', value: categories });
  metadata.put({ key: 'last_product_sync', value: new Date().toISOString() });
  products.filter((product) => product?.is_active !== false).forEach((product) => productStore.put({ ...product, id: Number(product.id) }));
  await transactionDone(transaction);
  return getOfflineBootstrap();
}

export async function clearOfflineSession() {
  if (!offlineStorageAvailable()) return;
  const database = await openDatabase();
  const transaction = database.transaction(META_STORE, 'readwrite');
  transaction.objectStore(META_STORE).delete('session');
  await transactionDone(transaction);
}

export async function recoverInterruptedOfflineSales() {
  if (!offlineStorageAvailable()) return;
  const sales = await allFrom(SALE_STORE);
  const syncing = sales.filter((sale) => sale.status === 'syncing');
  if (!syncing.length) return;
  const database = await openDatabase();
  const transaction = database.transaction(SALE_STORE, 'readwrite');
  const store = transaction.objectStore(SALE_STORE);
  const now = new Date().toISOString();
  syncing.forEach((sale) => store.put({ ...sale, status: 'pending', updated_at: now }));
  await transactionDone(transaction);
}

export async function getOfflineBootstrap() {
  if (!offlineStorageAvailable()) return { cache_ready: false, product_count: 0, pending_count: 0, failed_count: 0, session: null };
  const [session, lastSync, products, sales] = await Promise.all([
    metaValue('session'),
    metaValue('last_product_sync'),
    allFrom(PRODUCT_STORE),
    allFrom(SALE_STORE),
  ]);
  const queued = sales.filter((sale) => QUEUED_STATUSES.has(sale.status));
  return {
    cache_ready: products.length > 0 && authorizedOfflineSession(session),
    product_count: products.length,
    sale_counts: sales.reduce((counts, sale) => { if (Object.hasOwn(counts, sale.status)) counts[sale.status] += 1; return counts; }, { pending: 0, syncing: 0, failed: 0, synced: 0 }),
    pending_count: sales.filter((sale) => ['pending', 'syncing'].includes(sale.status)).length,
    failed_count: sales.filter((sale) => sale.status === 'failed').length,
    queue_business_id: queued.length ? Number(queued.sort((a, b) => a.id - b.id)[0].business_id) : null,
    last_product_sync: lastSync,
    session,
    app_config: await metaValue('app_config', {}),
  };
}

export async function getOfflineData() {
  const bootstrap = await getOfflineBootstrap();
  if (!bootstrap.cache_ready) throw new Error('Offline POS is unavailable until products are downloaded while online.');
  const [products, settings, categories] = await Promise.all([
    allFrom(PRODUCT_STORE),
    metaValue('settings', {}),
    metaValue('categories', []),
  ]);
  return { ...bootstrap, products, settings, categories };
}

export async function cachedProductPage({ q = '', category = '', barcode = '', sort = 'name_asc', limit = 20, offset = 0 } = {}) {
  const data = await getOfflineData();
  const query = String(q).trim().toLowerCase();
  const exactBarcode = String(barcode).trim().toLowerCase();
  const filtered = data.products.filter((product) => {
    const searchable = [product.name, product.sku, product.barcode, product.category].join(' ').toLowerCase();
    return (!query || searchable.includes(query))
      && (!category || product.category === category)
      && (!exactBarcode || String(product.barcode || '').toLowerCase() === exactBarcode);
  }).sort((left, right) => (sort === 'name_desc' ? -1 : 1) * (String(left.name).localeCompare(String(right.name)) || Number(left.id) - Number(right.id)));
  return { items: filtered.slice(offset, offset + limit), total: filtered.length };
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export async function createOfflineSale(input) {
  const data = await getOfflineData();
  if (!Array.isArray(input?.items) || !input.items.length) throw new Error('Add at least one product to the cart.');
  const paymentMethod = String(input.payment_method || '').trim();
  if (!offlinePaymentMethods(data.settings).includes(paymentMethod)) throw new Error('Choose a cached payment method.');
  const products = new Map(data.products.map((product) => [Number(product.id), product]));
  const items = input.items.map((item) => {
    const product = products.get(Number(item.product_id));
    if (!product) throw new Error('A cart product is no longer available in the offline cache.');
    const quantity = Number(item.quantity);
    const focQuantity = Number(item.foc_quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(focQuantity) || focQuantity < 0) throw new Error('Every item requires a valid quantity.');
    const priceType = String(item.price_type || 'Retail');
    const price = cachedProductPrice(product, priceType);
    if (!Number.isFinite(price) || price < 0) throw new Error(`No cached ${priceType} price exists for ${product.name}.`);
    return {
      product_id: Number(product.id),
      product_name: String(product.name),
      price_type: priceType,
      quantity,
      foc_quantity: focQuantity,
      unit_price: Math.round(price),
    };
  });
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));
  const discount = Math.min(Math.max(Math.round(Number(input.discount || 0)), 0), subtotal);
  const discountFactor = subtotal > 0 ? 1 - discount / subtotal : 0;
  if (String(data.settings?.admin_pin_set) === '1' && items.some(item => item.quantity * item.unit_price * discountFactor + 0.0005 < (item.quantity + item.foc_quantity) * Number(products.get(item.product_id)?.cost || 0))) {
    throw new Error('Selling below cost requires admin authorization. Connect to the server to complete this sale.');
  }

  const total = subtotal - discount;
  const createdAt = new Date().toISOString();
  const saleUuid = uuid();
  const payload = {
    offline_sale_uuid: saleUuid,
    offline_created_at: createdAt,
    items,
    discount,
    payment_type: 'cash',
    payment_method: paymentMethod,
    paid_amount: total,
    customer_id: null,
  };
  const database = await openDatabase();
  const transaction = database.transaction(SALE_STORE, 'readwrite');
  const completed = transactionDone(transaction);
  const id = await requestResult(transaction.objectStore(SALE_STORE).add({
    uuid: saleUuid,
    business_id: Number(data.session.business.id),
    user_id: Number(data.session.user.id),
    status: 'pending',
    payload,
    local_total: total,
    created_at: createdAt,
    updated_at: createdAt,
    synced_at: null,
    server_sale_id: null,
    receipt_no: '',
    error_message: '',
    attempt_count: 0,
  }));
  await completed;
  return offlineSaleById(Number(id));
}

export async function offlineSaleById(id) {
  const database = await openDatabase();
  const transaction = database.transaction(SALE_STORE, 'readonly');
  const completed = transactionDone(transaction);
  const sale = await requestResult(transaction.objectStore(SALE_STORE).get(Number(id)));
  await completed;
  return sale || null;
}

export async function listOfflineSales({ statuses = [], limit = 25, offset = 0, ascending = false } = {}) {
  const allowed = statuses.filter((status) => ['pending', 'syncing', 'synced', 'failed'].includes(status));
  const rows = (await allFrom(SALE_STORE))
    .filter((sale) => !allowed.length || allowed.includes(sale.status))
    .sort((left, right) => ascending ? left.id - right.id : right.id - left.id);
  return { items: rows.slice(offset, offset + limit), total: rows.length };
}

async function patchOfflineSale(id, updater) {
  const sale = await offlineSaleById(id);
  if (!sale) return null;
  const database = await openDatabase();
  const transaction = database.transaction(SALE_STORE, 'readwrite');
  const next = updater({ ...sale, updated_at: new Date().toISOString() });
  transaction.objectStore(SALE_STORE).put(next);
  await transactionDone(transaction);
  return next;
}

export function markOfflineSaleSyncing(id) {
  return patchOfflineSale(id, (sale) => ({ ...sale, status: 'syncing', attempt_count: Number(sale.attempt_count || 0) + 1, error_message: '' }));
}

export function markOfflineSaleSynced(id, serverSale) {
  return patchOfflineSale(id, (sale) => ({ ...sale, status: 'synced', server_sale_id: Number(serverSale.id), receipt_no: String(serverSale.receipt_no || ''), error_message: '', synced_at: new Date().toISOString() }));
}

export function markOfflineSaleFailed(id, message) {
  return patchOfflineSale(id, (sale) => ({ ...sale, status: 'failed', error_message: String(message || 'Sync failed').slice(0, 1000) }));
}

export function markOfflineSalePending(id, message = '') {
  return patchOfflineSale(id, (sale) => ({ ...sale, status: 'pending', error_message: String(message || '').slice(0, 1000) }));
}

export function retryOfflineSale(id) {
  return patchOfflineSale(id, (sale) => sale.status === 'failed' ? { ...sale, status: 'pending', error_message: '' } : sale);
}
