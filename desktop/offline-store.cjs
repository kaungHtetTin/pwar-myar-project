const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function cleanPaymentMethods(settings) {
  const methods = String(settings?.payment_methods || 'Cash')
    .split(',').map((item) => item.trim()).filter((item) => item && item.toLowerCase() !== 'credit');
  return methods.length ? methods : ['Cash'];
}

class OfflineStore {
  constructor(databasePath, { now = () => new Date(), uuid = randomUUID } = {}) {
    this.now = now;
    this.uuid = uuid;
    this.db = new DatabaseSync(databasePath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        barcode TEXT NOT NULL DEFAULT '',
        searchable TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS offline_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        business_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payload TEXT NOT NULL,
        local_total INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        server_sale_id INTEGER,
        receipt_no TEXT,
        error_message TEXT NOT NULL DEFAULT '',
        attempt_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS offline_sales_status_id ON offline_sales(status, id);
    `);
    this.db.prepare("UPDATE offline_sales SET status='pending', updated_at=? WHERE status='syncing'")
      .run(this.timestamp());
  }

  timestamp() { return this.now().toISOString(); }

  close() { this.db.close(); }

  setMeta(key, value) {
    this.db.prepare('INSERT INTO metadata(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, JSON.stringify(value));
  }

  getMeta(key, fallback = null) {
    return parseJson(this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key)?.value, fallback);
  }

  replaceOnlineCache({ session, products, settings = {}, categories = [] }) {
    if (!session?.user?.id || !session?.business?.id) throw new Error('A valid online session is required to cache offline data.');
    if (!Array.isArray(session.permissions) || !session.permissions.includes('sell')) throw new Error('This user does not have Sell permission.');
    if (!session.subscription?.is_valid) throw new Error('An active subscription is required for offline access.');
    if (!Array.isArray(products)) throw new Error('Product cache must be an array.');
    const foreignQueue = this.db.prepare("SELECT business_id FROM offline_sales WHERE status IN ('pending','syncing') AND business_id<>? LIMIT 1")
      .get(Number(session.business.id));
    if (foreignQueue) throw new Error('Unsynced sales from another business must be resolved before this device can change businesses.');

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec('DELETE FROM products');
      const insert = this.db.prepare('INSERT INTO products(id, name, category, barcode, searchable, payload) VALUES(?, ?, ?, ?, ?, ?)');
      for (const product of products.filter((item) => item?.is_active !== false)) {
        const searchable = [product.name, product.sku, product.barcode, product.category].join(' ').toLocaleLowerCase();
        insert.run(Number(product.id), String(product.name || ''), String(product.category || ''), String(product.barcode || ''), searchable, JSON.stringify(product));
      }
      this.setMeta('session', {
        user: { id: session.user.id, name: session.user.name, role: session.user.role },
        business: session.business,
        permissions: session.permissions,
        role_name: session.role_name,
        subscription: session.subscription,
      });
      this.setMeta('settings', settings);
      this.setMeta('categories', categories);
      this.setMeta('last_product_sync', this.timestamp());
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.getBootstrap(true);
  }

  clearOfflineSession() { this.db.prepare("DELETE FROM metadata WHERE key='session'").run(); }

  isAuthorized(session = this.getMeta('session')) {
    if (!session?.permissions?.includes('sell') || !session.subscription?.is_valid) return false;
    const end = session.subscription?.ends_at || session.subscription?.subscription?.ends_at;
    return !end || new Date(end).getTime() > this.now().getTime();
  }

  getBootstrap(online = false) {
    const session = this.getMeta('session');
    const productCount = Number(this.db.prepare('SELECT COUNT(*) AS count FROM products').get().count);
    const pendingCount = Number(this.db.prepare("SELECT COUNT(*) AS count FROM offline_sales WHERE status IN ('pending','syncing')").get().count);
    const failedCount = Number(this.db.prepare("SELECT COUNT(*) AS count FROM offline_sales WHERE status='failed'").get().count);
    const queueBusinessId = this.db.prepare("SELECT business_id FROM offline_sales WHERE status IN ('pending','syncing','failed') ORDER BY id LIMIT 1").get()?.business_id;
    return {
      online: Boolean(online),
      cache_ready: productCount > 0 && this.isAuthorized(session),
      product_count: productCount,
      pending_count: pendingCount,
      failed_count: failedCount,
      queue_business_id: queueBusinessId ? Number(queueBusinessId) : null,
      last_product_sync: this.getMeta('last_product_sync'),
      session,
    };
  }

  getOfflineData() {
    const bootstrap = this.getBootstrap(false);
    if (!bootstrap.cache_ready) throw new Error('Offline POS is unavailable until an authorized product cache has been downloaded.');
    return {
      ...bootstrap,
      products: this.db.prepare('SELECT payload FROM products ORDER BY name').all().map((row) => parseJson(row.payload, {})),
      settings: this.getMeta('settings', {}),
      categories: this.getMeta('categories', []),
    };
  }

  createSale(input) {
    const data = this.getOfflineData();
    if (!Array.isArray(input?.items) || !input.items.length) throw new Error('Add at least one product to the cart.');
    const paymentMethod = String(input.payment_method || '').trim();
    if (!cleanPaymentMethods(data.settings).includes(paymentMethod)) throw new Error('Choose a cached payment method.');

    const products = new Map(data.products.map((product) => [Number(product.id), product]));
    const items = input.items.map((item) => {
      const product = products.get(Number(item.product_id));
      if (!product) throw new Error('A cart product is no longer available in the offline cache.');
      const quantity = Number(item.quantity);
      const focQuantity = Number(item.foc_quantity || 0);
      if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(focQuantity) || focQuantity < 0 || quantity + focQuantity <= 0) throw new Error('Every item requires a paid quantity or FOC quantity greater than zero.');
      const priceType = String(item.price_type || 'Retail');
      const price = (product.prices || []).find((row) => row.name === priceType)?.price
        ?? (priceType === 'Retail' ? product.price : null);
      if (price === null || Number(price) < 0) throw new Error(`No cached ${priceType} price exists for ${product.name}.`);
      return {
        product_id: Number(product.id),
        product_name: String(product.name),
        price_type: priceType,
        quantity,
        foc_quantity: focQuantity,
        unit_price: Math.round(Number(price)),
      };
    });
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));
    const discount = Math.min(Math.max(Math.round(Number(input.discount || 0)), 0), subtotal);
    const total = subtotal - discount;
    const focOnly = items.every((item) => item.quantity === 0) && items.some((item) => item.foc_quantity > 0);
    const createdAt = this.timestamp();
    const uuid = this.uuid();
    const payload = {
      offline_sale_uuid: uuid,
      offline_created_at: createdAt,
      items,
      discount,
      payment_type: 'cash',
      payment_method: focOnly ? 'FOC' : paymentMethod,
      paid_amount: total,
      customer_id: null,
    };
    const result = this.db.prepare(`INSERT INTO offline_sales
      (uuid, business_id, user_id, status, payload, local_total, created_at, updated_at)
      VALUES(?, ?, ?, 'pending', ?, ?, ?, ?)`)
      .run(uuid, Number(data.session.business.id), Number(data.session.user.id), JSON.stringify(payload), total, createdAt, createdAt);
    return this.saleById(Number(result.lastInsertRowid));
  }

  saleById(id) {
    const row = this.db.prepare('SELECT * FROM offline_sales WHERE id=?').get(id);
    return row ? { ...row, payload: parseJson(row.payload, {}) } : null;
  }

  listSales({ statuses = [], limit = 500 } = {}) {
    const allowed = statuses.filter((status) => ['pending', 'syncing', 'synced', 'failed'].includes(status));
    const sql = allowed.length
      ? `SELECT * FROM offline_sales WHERE status IN (${allowed.map(() => '?').join(',')}) ORDER BY id LIMIT ?`
      : 'SELECT * FROM offline_sales ORDER BY id DESC LIMIT ?';
    const rows = this.db.prepare(sql).all(...allowed, Math.max(1, Math.min(Number(limit) || 500, 2000)));
    return rows.map((row) => ({ ...row, payload: parseJson(row.payload, {}) }));
  }

  markSyncing(id) {
    this.db.prepare("UPDATE offline_sales SET status='syncing', attempt_count=attempt_count+1, error_message='', updated_at=? WHERE id=? AND status IN ('pending','failed')")
      .run(this.timestamp(), id);
    return this.saleById(id);
  }

  markSynced(id, serverSale) {
    const now = this.timestamp();
    this.db.prepare("UPDATE offline_sales SET status='synced', server_sale_id=?, receipt_no=?, error_message='', synced_at=?, updated_at=? WHERE id=?")
      .run(Number(serverSale.id), String(serverSale.receipt_no || ''), now, now, id);
    return this.saleById(id);
  }

  markFailed(id, message) {
    this.db.prepare("UPDATE offline_sales SET status='failed', error_message=?, updated_at=? WHERE id=?")
      .run(String(message || 'Sync failed').slice(0, 1000), this.timestamp(), id);
    return this.saleById(id);
  }

  retryFailed(id) {
    this.db.prepare("UPDATE offline_sales SET status='pending', error_message='', updated_at=? WHERE id=? AND status='failed'")
      .run(this.timestamp(), id);
    return this.saleById(id);
  }

  markPending(id, message = '') {
    this.db.prepare("UPDATE offline_sales SET status='pending', error_message=?, updated_at=? WHERE id=? AND status IN ('syncing','failed')")
      .run(String(message || '').slice(0, 1000), this.timestamp(), id);
    return this.saleById(id);
  }
}

module.exports = { OfflineStore, cleanPaymentMethods };
