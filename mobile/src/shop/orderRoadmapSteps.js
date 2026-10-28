const LABELS = {
  pending: 'Order placed', accepted: 'Accepted', packing: 'Packing',
  ready_for_pickup: 'Ready for pickup', dispatched: 'Dispatched', completed: 'Completed',
  return_pending: 'Return pending', cancelled: 'Cancelled', expired: 'Expired',
};

export function orderRoadmap(order) {
  const path = ['pending', 'accepted', 'packing', order.fulfillment === 'pickup' ? 'ready_for_pickup' : 'dispatched', 'completed'];
  const allEvents = order.events || [];
  const reopened = allEvents.findLastIndex(event => event.event === 'reopened');
  const events = reopened < 0 ? allEvents : allEvents.slice(reopened);
  const lastEvent = key => events.findLast(event => event.event === key);
  const date = key => key === 'pending'
    ? (lastEvent('reopened') || lastEvent('created'))?.created_at || order.created_at
    : lastEvent(key)?.created_at;
  const currentIndex = path.indexOf(order.status);
  if (currentIndex >= 0) {
    return path.map((key, index) => ({
      key, label: LABELS[key], date: index <= currentIndex ? date(key) : null,
      state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
      tone: key === 'completed' && index === currentIndex ? 'success' : '',
    }));
  }
  // Closed/failed orders show only reached stages, without implying completion.
  const reachedIndex = order.status === 'return_pending' ? 3
    : Math.max(0, ...events.map(event => path.indexOf(event.event)));
  const reached = path.slice(0, reachedIndex + 1);
  if (order.status !== 'return_pending' && lastEvent('return_pending')) reached.push('return_pending');
  return [
    ...reached.map(key => ({ key, label: LABELS[key], date: date(key), state: 'done', tone: key === 'return_pending' ? 'warning' : '' })),
    { key: order.status, label: LABELS[order.status] || String(order.status || 'Unknown status').replaceAll('_', ' '), date: date(order.status), state: 'current', tone: order.status === 'return_pending' ? 'warning' : 'danger' },
  ];
}
