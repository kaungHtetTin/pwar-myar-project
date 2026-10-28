import React, { useEffect, useRef, useState } from 'react';
import { registerAdminAuthorization } from '../../../shared/network/adminAuthorization';
import { MobileSheet } from './MobilePrimitives';
import { Button, Input } from './Controls';

export function AdminAuthorizationDialog() {
  const pending = useRef(null);
  const [dialog, setDialog] = useState(null);
  const [secret, setSecret] = useState('');
  const [recovery, setRecovery] = useState(false);
  const finish = credentials => {
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
  return <MobileSheet open={Boolean(dialog)} title="Admin authorization" description={dialog?.message} onClose={() => finish(null)}>
    {dialog && <div className="mobile-delete-confirmation">
      <label className="mobile-field"><span>{recovery ? 'Owner password' : 'Admin PIN'}</span><Input autoFocus type="password" inputMode={recovery ? undefined : 'numeric'} autoComplete="off" value={secret} onChange={event => setSecret(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && secret.trim()) { event.preventDefault(); finish(recovery ? { owner_password: secret } : { authorization_pin: secret }); } }} /></label>
      {dialog.allowOwnerRecovery && <label><input type="checkbox" checked={recovery} onChange={event => { setRecovery(event.target.checked); setSecret(''); }} />Use owner password to recover PIN</label>}
      <div className="mobile-form-actions"><Button variant="secondary" type="button" onClick={() => finish(null)}>Cancel</Button><Button variant="primary" type="button" disabled={!secret.trim()} onClick={() => finish(recovery ? { owner_password: secret } : { authorization_pin: secret })}>Authorize</Button></div>
    </div>}
  </MobileSheet>;
}
