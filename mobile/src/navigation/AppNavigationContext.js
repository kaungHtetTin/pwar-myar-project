import { createContext } from 'react';

// Full-page task headers use the existing permission-aware module drawer.
export const AppNavigationContext = createContext({ openNavigation: () => {}, backToWorkspace: null });
