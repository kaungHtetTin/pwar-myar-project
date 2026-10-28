import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { api } from './api';
import { monitorActivity } from './activityRealtime';
import './activity-alerts.css';

export function ActivityAlerts({ scope, onOpen, onActivity }) {
  const [events, setEvents] = useState([]);
  const activity = useRef(onActivity);
  useEffect(() => { activity.current = onActivity; }, [onActivity]);
  useEffect(() => monitorActivity(api, scope, incoming => {
    setEvents(current => incoming.length ? [...current, ...incoming.filter(item => !item.silent && !current.some(event => event.id === item.id))] : []);
    if (incoming.length) {
      activity.current?.(incoming);
      window.dispatchEvent(new CustomEvent('mkpos:office-activity', { detail: incoming }));
    }
  }, '/office/activity-alerts'), [scope]);
  const notice = events[0];
  if (!notice) return null;
  const dismiss = () => setEvents(current => current.slice(1));
  return createPortal(<aside className="office-activity-alert" role="status" aria-live="polite" aria-atomic="true">
    <span className="office-activity-icon" aria-hidden="true"><Bell size={20} /></span><div><strong>{notice.title}</strong><p data-no-localize>{notice.message}</p><button type="button" className="office-button-primary" onClick={() => { onOpen(notice); dismiss(); }}>{notice.target === 'shop-report' ? 'Review report' : 'Review request'}</button></div>
    <button type="button" className="office-activity-dismiss" aria-label="Dismiss activity notification" onClick={dismiss}><X size={18} /></button>
  </aside>, document.body);
}
