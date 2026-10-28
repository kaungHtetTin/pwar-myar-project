import { createContext, useContext, useLayoutEffect, useId } from 'react';

export const PageLoadingContext = createContext(null);
export const PageReadyContext = createContext(true);
export const usePageReady = () => useContext(PageReadyContext);

export function useInitialPageLoading(pending) {
  const register = useContext(PageLoadingContext);
  const id = useId();
  useLayoutEffect(() => {
    if (pending && register) return register(id);
  }, [pending, register, id]);
}
