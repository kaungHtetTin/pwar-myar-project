import { useContext, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageAppBarContext } from './PageAppBarContext';
import { PageActivityContext } from './pageRefresh';

// Nested histories retain their own export/filter state while placing the action
// in their page's explicitly supplied header slot.
export function AppBarAction({ target, active = true, children }) {
  const [host, setHost] = useState(null);
  const shell = useContext(PageAppBarContext);
  const pageActive = useContext(PageActivityContext);
  useLayoutEffect(() => { setHost(target?.current || null); }, [target, shell?.host, pageActive]);
  return active && pageActive && host ? createPortal(children, host) : null;
}
