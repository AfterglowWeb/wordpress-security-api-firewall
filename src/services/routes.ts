import { apiRequest } from '@services/api';
import type { RouteNode, RoutesSettings } from '@app-types/routes';

export const RoutesAPI = {
  getRoutes: () =>
    apiRequest<{ tree: RouteNode[] }>('bromate_get_routes_policy_tree'),

  getDefaultHiddenRoutes: () =>
    apiRequest<{ default_hidden_routes: string[] }>('bromate_get_default_hidden_routes'),

  getAllSettings: () =>
    apiRequest<{ tree: RouteNode[]; settings: RoutesSettings; default_hidden_routes: string[] }>(
      'bromate_get_routes_settings'
    ),

  saveAllSettings: (payload: { settings: RoutesSettings; tree: RouteNode[] }) =>
    apiRequest<{ message: string }>('bromate_save_all_routes_settings', {
      settings: JSON.stringify(payload),
    }),
};