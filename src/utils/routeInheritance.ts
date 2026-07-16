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

// A completely rule-free globals object: no hidden namespaces, no hidden
// methods, no hidden WP objects. Used only to compute the "natural" tree
// below — what every route would look like with zero policy applied.
const NEUTRAL_GLOBALS: RoutesSettings = {
  routes_policy_enabled: false,
  routes_policy_default_hidden_routes: false,
  routes_policy_hidden_methods: [],
  routes_policy_hidden_wp_objects: [],
  routes_policy_auth_enforce: false,
  routes_policy_hidden_routes_redirect_option: '404',
  routes_policy_hidden_routes_redirect_user_url: '',
};

function stripToUnresolved(node: RouteNode): RouteNode {
  return {
    ...node,
    settings: {
      ...node.settings,
      disabled: { value: false, inherited: false },
      protect: { value: false, inherited: false },
    },
    children: node.children?.map(stripToUnresolved),
  };
}

/**
 * Resolves the tree as if NO policy existed at all: no global rules, no
 * route-level overrides anywhere. This is the reference point a route's
 * current state is compared against to decide whether it's "custom" —
 * whether that deviation comes from a global setting cascading down or
 * from an explicit override on the route itself makes no difference to
 * the admin looking at the tree, so it shouldn't make a difference here.
 *
 * Only the tree's STRUCTURE matters (ids/paths/methods/children) — any
 * existing settings are stripped before resolving, so this is safe to
 * call with the live, edited tree at any point.
 */
export function resolveNaturalState(tree: RouteNode[]): RouteNode[] {
  return resolveInheritance(tree.map(stripToUnresolved), NEUTRAL_GLOBALS, []);
}
