import { createContext, useContext } from 'react';
export const PortalContext = createContext<HTMLElement | undefined>(undefined);
export const usePortalContainer = () => useContext(PortalContext);
