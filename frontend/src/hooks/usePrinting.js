import { useSyncExternalStore } from 'react';
import { getPrintBusy, subscribePrinting } from '../printing';

export function usePrinting() {
  return useSyncExternalStore(subscribePrinting, getPrintBusy, () => false);
}
