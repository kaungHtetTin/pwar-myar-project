import { offlineReceiptPayload } from './offlineReceipt';

// Uses the same receipt classes and layout as completed offline invoices.
// Available immediately in packaged apps even before a server template update.
export function sampleReceiptPayload(settings) {
  return offlineReceiptPayload({
    id: 0, is_sample: true, created_at: new Date().toISOString(), local_total: 1000,
    payload: { discount: 0, payment_method: 'Cash', items: [{
      product_name: 'Sample Product — မြန်မာစာ စမ်းသပ်ရန်', quantity: 1,
      unit_price: 1000, foc_quantity: 0, price_type: 'Retail',
    }] },
  }, settings);
}
