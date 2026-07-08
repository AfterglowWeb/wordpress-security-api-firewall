import { createContext, useContext } from '@wordpress/element';
import type { RouteNode, ToggleableSettingKey } from '@app-types/routes';

export type RoutePolicyTreeContextType = {
  toggleSetting: (id: string, key: ToggleableSettingKey) => void;
  getNode:       (id: string) => RouteNode | undefined;
};

export const RoutePolicyTreeContext =
  createContext<RoutePolicyTreeContextType | null>(null);

export function useRoutePolicyTreeContext(): RoutePolicyTreeContextType {
  const ctx = useContext(RoutePolicyTreeContext);
  if (!ctx) throw new Error('useRoutePolicyTreeContext must be inside Provider');
  return ctx;
}