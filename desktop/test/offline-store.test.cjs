const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { OfflineStore } = require('../offline-store.cjs');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mkpos-offline-test-'));
  let sequence = 0;
  const store = new OfflineStore(path.join(directory, 'offline.sqlite3'), {
    now: () => new Date(Date.parse('2026-08-07T03:30:00.000Z') + sequence++ * 1000),
    uuid: () => `7c434eb3-31c6-4ff0-9179-98c77dacb6${String(sequence).padStart(2, '0')}`,
  });
  return { directory, store };
}

function cache(store, businessId = 8) {
  return store.replaceOnlineCache({
    session: {
      user: { id: 4, name: 'Cashier', role: 'staff' },
      business: { id: businessId, name: 'Offline Shop', currency: 'Ks' },
      permissions: ['sell'], role_name: 'Cashier',
      subscription: { is_valid: true, subscription: { ends_at: '2030-01-01T00:00:00Z' } },
    },
    products: [{
      id: 10, name: 'Cached Product', category: 'Tests', barcode: '1001', stock: 0,
      price: 2500, prices: [{ name: 'Retail', price: 2500 }], is_active: true,
    }],
    settings: { payment_methods: 'Cash,KPay,Credit', price_types: 'Retail' },
    categories: ['Tests'],
  });
}

test('stores a fully paid sale without checking cached stock and tracks its sync result', () => {
  const { directory, store } = fixture();
  try {
    cache(store);
    const sale = store.createSale({
      payment_method: 'KPay', discount: 500,
      items: [{ product_id: 10, price_type: 'Retail', quantity: 2, foc_quantity: 1 }],
    });
    assert.equal(sale.status, 'pending');
    assert.equal(sale.local_total, 4500);
    assert.equal(sale.payload.paid_amount, 4500);
    assert.equal(sale.payload.customer_id, null);
    assert.equal(store.getBootstrap(false).pending_count, 1);

    store.markSyncing(sale.id);
    store.markFailed(sale.id, 'Product was deleted');
    assert.equal(store.saleById(sale.id).error_message, 'Product was deleted');
    store.retryFailed(sale.id);
    store.markSyncing(sale.id);
    store.markSynced(sale.id, { id: 99, receipt_no: 'R260807-0001' });
    assert.equal(store.saleById(sale.id).receipt_no, 'R260807-0001');
    assert.equal(store.getBootstrap(false).pending_count, 0);
  } finally {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('stores an FOC-only offline sale without payment', () => {
  const { directory, store } = fixture();
  try {
    cache(store);
    const sale = store.createSale({
      payment_method: 'Cash',
      items: [{ product_id: 10, price_type: 'Retail', quantity: 0, foc_quantity: 2 }],
    });
    assert.equal(sale.local_total, 0);
    assert.equal(sale.payload.paid_amount, 0);
    assert.equal(sale.payload.payment_method, 'FOC');
  } finally {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('refuses credit and prevents switching businesses while a sale is pending', () => {
  const { directory, store } = fixture();
  try {
    cache(store);
    assert.throws(() => store.createSale({
      payment_method: 'Credit',
      items: [{ product_id: 10, price_type: 'Retail', quantity: 1 }],
    }), /cached payment method/i);
    store.createSale({
      payment_method: 'Cash',
      items: [{ product_id: 10, price_type: 'Retail', quantity: 1 }],
    });
    assert.throws(() => cache(store, 9), /another business/i);
  } finally {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('returns an interrupted sync attempt to pending when the app restarts', () => {
  const { directory, store } = fixture();
  const databasePath = path.join(directory, 'offline.sqlite3');
  try {
    cache(store);
    const sale = store.createSale({
      payment_method: 'Cash',
      items: [{ product_id: 10, price_type: 'Retail', quantity: 1 }],
    });
    store.markSyncing(sale.id);
    store.close();
    const reopened = new OfflineStore(databasePath);
    try { assert.equal(reopened.saleById(sale.id).status, 'pending'); } finally { reopened.close(); }
  } finally {
    if (store.db.isOpen) store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('blocks new sales after trial expiry while keeping pending invoices visible', () => {
  const { directory, store } = fixture();
  try {
    cache(store);
    store.createSale({
      payment_method: 'Cash',
      items: [{ product_id: 10, price_type: 'Retail', quantity: 1 }],
    });
    const session = store.getMeta('session');
    store.setMeta('session', {
      ...session,
      subscription: { ...session.subscription, access_type: 'trial', ends_at: '2026-08-07T03:29:59.000Z' },
    });

    const bootstrap = store.getBootstrap(false);
    assert.equal(bootstrap.cache_ready, false);
    assert.equal(bootstrap.pending_count, 1);
    assert.throws(() => store.createSale({
      payment_method: 'Cash',
      items: [{ product_id: 10, price_type: 'Retail', quantity: 1 }],
    }), /offline pos is unavailable/i);
  } finally {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
