import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal } from './common';
import { request } from '../api';

const ConfirmationContext = createContext(null);

export function ConfirmationProvider({ children }) {
  const resolver = useRef(null);
  const [dialog, setDialog] = useState(null);
  const [pin, setPin] = useState('');

  const confirm = useCallback(async (options) => {
    const nextDialog = {
      title: 'Confirm action',
      message: '',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      danger: true,
      requirePin: false,
      pinLabel: 'Admin PIN',
      ...options,
    };
    if (nextDialog.requirePin) {
      try {
        const settings = await request('/settings');
        nextDialog.requirePin = String(settings.admin_pin_set) === '1';
      } catch {
        // Fail closed: retain the PIN field if security status cannot be checked.
      }
    }

    return new Promise((resolve) => {
      if (resolver.current) resolver.current({ confirmed: false, pin: '' });
      resolver.current = resolve;
      setPin('');
      setDialog(nextDialog);
    });
  }, []);

  const finish = useCallback((confirmed) => {
    const resolve = resolver.current;
    resolver.current = null;
    setDialog(null);
    if (resolve) resolve({ confirmed, pin: confirmed ? pin : '' });
  }, [pin]);

  const value = useMemo(() => ({ confirm }), [confirm]);
  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      <Modal open={Boolean(dialog)} title={dialog?.title || 'Confirm action'} onClose={() => finish(false)} size="small" footer={dialog ? <><button type="button" onClick={() => finish(false)}>{dialog.cancelLabel}</button><button type="button" className={dialog.danger ? 'danger-button' : 'primary'} disabled={dialog.requirePin && !pin.trim()} onClick={() => finish(true)}>{dialog.confirmLabel}</button></> : null}>
        {dialog && (
          <div className="confirmation-dialog">
            <p>{dialog.message}</p>
            {dialog.requirePin && (
              <label className="field">
                <span>{dialog.pinLabel}</span>
                <input type="password" required value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="off" />
              </label>
            )}
          </div>
        )}
      </Modal>
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error('useConfirmation must be used inside ConfirmationProvider');
  return context.confirm;
}
