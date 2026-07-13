import type { RouteNode, RouteSettings, RoutesSettings, InheritableSetting } from '@app-types/routes';

function isGloballyDisabled(
  node: RouteNode,
  globals: RoutesSettings,
  defaultHiddenNamespaces: string[],
): boolean {
  if (globals.routes_policy_default_hidden_routes) {
    if (defaultHiddenNamespaces.some((ns) => node.path.startsWith(`/${ns}`))) {
      return true;
    }
  }

  if (node.isMethod && node.method) {
    if (globals.routes_policy_hidden_methods?.includes(node.method.toLowerCase())) {
      return true;
    }
  }

  if (globals.routes_policy_hidden_wp_objects?.length) {
    if (globals.routes_policy_hidden_wp_objects.some((obj) => node.path.includes(`/${obj}`))) {
      return true;
    }
  }

  return false;
}

function resolveNode(
  node: RouteNode,
  parentDisabled: InheritableSetting,
  parentProtect: InheritableSetting,
  globals: RoutesSettings,
  defaultHiddenNamespaces: string[],
): RouteNode {
  const rawDisabled = (node.settings?.disabled as any) === true || (node.settings?.disabled as any)?.value === true;
  const rawProtect  = (node.settings?.protect  as any) === true || (node.settings?.protect  as any)?.value  === true;
  const isOverriddenDisabled = (node.settings?.disabled as any)?.overridden === true;
  const isOverriddenProtect  = (node.settings?.protect  as any)?.overridden === true;

  const globallyDisabled = isGloballyDisabled(node, globals, defaultHiddenNamespaces);

  // Priority order matters here: an explicit override on THIS route must
  // win over a global rule or an inherited parent value — that's the whole
  // point of letting an admin allow a single route even when its method or
  // namespace is blocked globally. It used to be checked last (or not at
  // all against globallyDisabled), so the override never had a chance.
  let disabled: InheritableSetting;
  if (isOverriddenDisabled) {
    disabled = { value: rawDisabled, inherited: false, overridden: true };
  } else if (globallyDisabled) {
    disabled = { value: true, inherited: true };
  } else if (parentDisabled.value) {
    disabled = { value: true, inherited: true };
  } else if (rawDisabled) {
    // Legacy/initial shape: the route came back from the server already
    // marked disabled as a plain value, without override metadata attached.
    disabled = { value: true, inherited: false, overridden: false };
  } else {
    disabled = { value: false, inherited: false };
  }

  let protect: InheritableSetting;
  if (isOverriddenProtect) {
    protect = { value: rawProtect, inherited: false, overridden: true };
  } else if (parentProtect.value) {
    protect = { value: true, inherited: true };
  } else if (rawProtect) {
    protect = { value: true, inherited: false, overridden: false };
  } else {
    protect = { value: false, inherited: false };
  }

  const resolvedSettings: RouteSettings = {
    ...node.settings,
    disabled,
    protect,
  };

  const resolvedChildren = node.children?.map((child) =>
    resolveNode(child, disabled, protect, globals, defaultHiddenNamespaces)
  );

  return {
    ...node,
    settings: resolvedSettings,
    children: resolvedChildren,
  };
}

export function resolveInheritance(
  tree: RouteNode[],
  globals: RoutesSettings,
  defaultHiddenNamespaces: string[] = [],
): RouteNode[] {
  const noInheritance: InheritableSetting = { value: false, inherited: false };
  return tree.map((node) =>
    resolveNode(node, noInheritance, noInheritance, globals, defaultHiddenNamespaces)
  );
}
