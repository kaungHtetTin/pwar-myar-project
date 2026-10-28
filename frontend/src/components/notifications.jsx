import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentLanguage, translateText } from '../translations';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const nextId = useRef(1);
  const [notification, setNotification] = useState(null);

  const notify = useCallback((message, type = 'information') => {
    const clean = translateText(String(message || '').trim(), getCurrentLanguage());
    if (!clean) return;
    setNotification({ id: nextId.current++, message: clean, type });
  }, []);

  const dismiss = useCallback((id) => {
    setNotification((current) => (!id || current?.id === id ? null : current));
  }, []);

  const clear = useCallback(() => setNotification(null), []);

  useEffect(() => {
    if (!notification) return undefined;
    const duration = notification.type === 'error' ? 7000 : notification.type === 'warning' ? 6000 : 3500;
    const timeout = window.setTimeout(() => dismiss(notification.id), duration);
    return () => window.clearTimeout(timeout);
  }, [dismiss, notification]);

  const value = useMemo(() => ({ notification, notify, dismiss, clear }), [notification, notify, dismiss, clear]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}

export function useScreenNotifications() {
  const { notify } = useNotifications();
  const setMessage = useCallback((message) => {
    if (message) notify(message, 'success');
  }, [notify]);
  const setError = useCallback((message) => {
    if (message) notify(message, 'error');
  }, [notify]);
  const setWarning = useCallback((message) => {
    if (message) notify(message, 'warning');
  }, [notify]);
  const setInformation = useCallback((message) => {
    if (message) notify(message, 'information');
  }, [notify]);
  return { setMessage, setError, setWarning, setInformation };
}

export function NotificationRegion() {
  const { notification, dismiss } = useNotifications();
  return (
    <div className="global-notification-region" aria-live="polite" aria-atomic="true">
      {notification && (
        <div
          className={`global-notification ${notification.type}`}
          role={notification.type === 'error' ? 'alert' : 'status'}
          title={notification.message}
        >
          <span>{notification.message}</span>
          <button type="button" onClick={() => dismiss(notification.id)} aria-label="Dismiss notification">x</button>
        </div>
      )}
    </div>
  );
}
