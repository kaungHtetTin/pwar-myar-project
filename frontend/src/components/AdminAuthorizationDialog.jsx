import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './common';
import { registerAdminAuthorization } from '../../../shared/network/adminAuthorization';

export function AdminAuthorizationDialog() {
  const pending = useRef(null);
  const [dialog, setDialog] = useState(null);
  const [secret, setSecret] = useState('');
  const [recovery, setRecovery] = useState(false);
  const finish = (credentials) => {
    const current = pending.current;
    pending.current = null;
    current?.cleanup();
    setDialog(null); setSecret(''); setRecovery(false);
    current?.resolve(credentials);
  };
  useEffect(() => {
    const unregister = registerAdminAuthorization(options => new Promise(resolve => {
      pending.current?.cleanup(); pending.current?.resolve(null);
      const abort = () => finish(null);
      options.signal?.addEventListener('abort', abort, { once: true });
      pending.current = { resolve, cleanup: () => options.signal?.removeEventListener('abort', abort) };
      setSecret(''); setRecovery(false); setDialog(options);
    }));
    return () => { unregister(); pending.current?.cleanup(); pending.current?.resolve(null); pending.current = null; };
  }, []);
  return <Modal open={Boolean(dialog)} title="Admin authorization" size="small" onClose={() => finish(null)}>
    {dialog && <form className="confirmation-dialog" onSubmit={event => { event.preventDefault(); if (secret.trim()) finish(recovery ? { owner_password: secret } : { authorization_pin: secret }); }}>
      <p>{dialog.message}</p>
      <label className="field"><span>{recovery ? 'Owner password' : 'Admin PIN'}</span><input autoFocus type="password" inputMode={recovery ? undefined : 'numeric'} autoComplete="off" required value={secret} onChange={event => setSecret(event.target.value)} /></label>
      {dialog.allowOwnerRecovery && <label><input type="checkbox" checked={recovery} onChange={event => { setRecovery(event.target.checked); setSecret(''); }} />Use owner password to recover PIN</label>}
      <div className="modal-footer"><button type="button" onClick={() => finish(null)}>Cancel</button><button className="primary" type="submit" disabled={!secret.trim()}>Authorize</button></div>
    </form>}
  </Modal>;
}
