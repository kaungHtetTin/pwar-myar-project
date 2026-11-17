import { createContext, useContext } from 'react';

export const RetainedActivityContext = createContext(true);
export function useRetainedActivity() {
  return useContext(RetainedActivityContext);
}
