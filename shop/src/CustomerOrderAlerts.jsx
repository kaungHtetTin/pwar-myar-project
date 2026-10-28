import { useEffect } from 'react';
import { useShopAlerts } from './ShopAlertProvider';
import { request } from './api';
import { useText } from './i18n';
import { monitorCustomerOrders } from './customerOrderRealtime';
import { noticeTitle } from './ShopUpdates';
import { go } from './shopNavigation';

export function CustomerOrderAlerts({ customerId, reference, credential }) {
  const text = useText();
  const { publish, clear } = useShopAlerts();
  useEffect(() => {
    return monitorCustomerOrders(request, { customerId, reference, credential }, (incoming, delivery = {}) => {
      if (!incoming.length) { clear('order'); return; }
      const newest = incoming.at(-1);
      publish({ kind: 'order', items: incoming, catchUp: delivery.catchUp, recoveryId: delivery.recoveryId,
        title: 'Order updated', label: text(noticeTitle(newest.event)),
        preview: [newest.store_name, newest.reference, newest.reason].filter(Boolean).join(' · '),
        openLabel: 'View order', open });
      if (incoming.length) {
        window.dispatchEvent(new Event('mkpos:customer-order-alerts'));
        for (const ref of new Set(incoming.map(item => item.reference))) window.dispatchEvent(new CustomEvent('mkpos:customer-order-changed', { detail: { reference: ref } }));
      }
    });
  }, [customerId, reference, credential, publish, clear]);
  function open(notice) {
    // Give an existing tracking page its own reference before opening another
    // order, so Back can resume the actual source order and its retained state.
    try {
      const previous = JSON.parse(sessionStorage.getItem('mkpos.shop.tracking') || 'null');
      const route = window.location.hash.slice(1).split('?')[0];
      if (route === '/orders/track' && previous?.reference && previous.reference !== notice.reference) {
        const url = new URL(window.location.href);
        url.hash = `/orders/track?reference=${encodeURIComponent(previous.reference)}`;
        window.history.replaceState(window.history.state, '', url);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    } catch { /* There is no saved source order to retain. */ }
    sessionStorage.setItem('mkpos.shop.tracking', JSON.stringify(customerId ? { reference: notice.reference } : { reference, credential }));
    sessionStorage.setItem('mkpos.shop.tracking.customer', JSON.stringify(customerId || null));
    window.dispatchEvent(new Event('mkpos:tracking-changed'));
    go(`/orders/track?reference=${encodeURIComponent(notice.reference)}`);
  }
  return null;
}
