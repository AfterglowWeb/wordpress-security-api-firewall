import { type TreeItemProps } from '@mui/x-tree-view/TreeItem';

export type InheritableSetting = {
  value: boolean;
  inherited?: boolean;
  overridden?: boolean;
};

export type RouteSettings = {
  disabled: InheritableSetting;
  protect:  InheritableSetting;
  tags:     string[];
  custom?:  boolean;
};

export type RouteNode = {
  id:          string;
  label:       string;
  path:        string;
  method?:     string;
  route?:      string;
  params?:     { name: string; regex: string }[];
  isMethod?:   boolean;
  callback?:   string;
  permission?: { type: string; callback: string | null };
  settings:    RouteSettings;
  children?:   RouteNode[];
};

export type RoutesSettings = {
  routes_policy_enabled:               boolean;
  routes_policy_default_hidden_routes: boolean;
  routes_policy_hidden_methods:        string[];
  routes_policy_hidden_wp_objects:     string[];
  routes_policy_hidden_response_code:  '401' | '403' | '404';
};

export type RoutesPolicyTreeProps = {
  tree:     RouteNode[];
  globals:  RoutesSettings;   // ← ajout
  onChange: (tree: RouteNode[]) => void;
  defaultHiddenRoutes: string[];
};

export type ToggleableSettingKey = {
  [K in keyof RouteSettings]-?:
    RouteSettings[K] extends InheritableSetting ? K : never;
}[keyof RouteSettings];