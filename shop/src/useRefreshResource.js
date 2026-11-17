import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './api';
import { useShopRefresh } from './pageRefresh';

export function useRefreshResource(path) {
  const [state, setState] = useState({ data: null, error: '', busy: true });
  const generation = useRef(0);
  const load = useCallback(async (retain = false) => {
    const version = ++generation.current;
    // Existing screens use busy to replace their content with initial skeletons.
    // A manual refresh keeps that content mounted while the shared indicator runs.
    setState(current => ({ data: retain ? current.data : null, error: '', busy: !retain || !current.data }));
    try {
      const data = await request(path);
      if (version === generation.current) setState({ data, error: '', busy: false });
    } catch (error) {
      if (version === generation.current) setState(current => ({ ...current, error: error.message, busy: false }));
    }
  }, [path]);
  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [load]);
  useShopRefresh(() => load(true));
  return { ...state, retry: () => load(true) };
}
