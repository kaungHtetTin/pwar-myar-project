import { useEffect, useRef } from 'react';

export function useLatestEffect(callback, dependencies) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Dependencies describe when to run; the ref ensures the newest callback runs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => callbackRef.current(), dependencies);
}
