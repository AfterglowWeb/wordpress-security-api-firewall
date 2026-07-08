import { createContext, useContext } from '@wordpress/element';

export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer() {
  return useContext(PortalContainerContext);
}