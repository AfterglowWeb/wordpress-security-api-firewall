import { useState, useCallback, useMemo, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { RoutePolicyTreeContext } from '@contexts/RoutePolicyTreeContext';
import { resolveInheritance, resolveNaturalState } from '@app-utils/routeInheritance';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import RouteTreeItem from '@features/routes/RouteTreeItem';

import type {
	RouteNode,
	RoutesPolicyTreeProps,
	ToggleableSettingKey,
	InheritableSetting
} from '@app-types/routes';

type TreeState = {
	rootId: string;
	nodes: Record<string, RouteNode>;
};

type NaturalValues = Record<string, { disabled: boolean; protect: boolean }>;

function updateNode(
	node: RouteNode,
	id: string,
	updater: (node: RouteNode) => RouteNode
): RouteNode {
	if (node.id === id) {
		return updater(node);
	}

	return {
		...node,
		children: node.children?.map((child) =>
			updateNode(child, id, updater)
		),
	};
}

function countOwnOverrides(node: RouteNode): number {
	const hasOwnOverride =
		!!node.settings?.disabled?.overridden ||
		!!node.settings?.protect?.overridden;
	let count = hasOwnOverride ? 1 : 0;
	for (const child of node.children ?? []) {
		count += countOwnOverrides(child);
	}
	return count;
}

function toRawNode(node: RouteNode): RouteNode {
	const stripKey = (key: ToggleableSettingKey): InheritableSetting => {
		const s = node.settings?.[key];
		if (s?.overridden) {
			return { value: !!s.value, inherited: false, overridden: true };
		}
		return { value: false, inherited: false };
	};

	return {
		...node,
		settings: {
			...node.settings,
			disabled: stripKey('disabled'),
			protect: stripKey('protect'),
		},
		children: node.children?.map(toRawNode),
	};
}

function clearOverridesForKey(node: RouteNode, key: ToggleableSettingKey): RouteNode {
	return {
		...node,
		settings: {
			...node.settings,
			[key]: { value: false, inherited: false },
		},
		children: node.children?.map((child) => clearOverridesForKey(child, key)),
	};
}

function computeCustom(node: RouteNode, natural: NaturalValues): RouteNode {
	const n = natural[node.id];

	const disabledCustom =
		!!node.settings?.disabled?.overridden ||
		(!!n && (!!node.settings?.disabled?.value) !== n.disabled);

	const protectCustom =
		!!node.settings?.protect?.overridden ||
		(!!n && (!!node.settings?.protect?.value) !== n.protect);

	const custom = disabledCustom || protectCustom;

	return {
		...node,
		settings: { ...node.settings, custom },
		children: node.children?.map((child) => computeCustom(child, natural)),
	};
}

function collectNaturalValues(nodes: RouteNode[]): NaturalValues {
	const map: NaturalValues = {};
	function walk(node: RouteNode) {
		map[node.id] = {
			disabled: !!node.settings?.disabled?.value,
			protect: !!node.settings?.protect?.value,
		};
		node.children?.forEach(walk);
	}
	nodes.forEach(walk);
	return map;
}

const defaultSetting: InheritableSetting = {
  value: false,
};

function wrapTree(nodes: RouteNode[]): RouteNode {
  return {
    id: '__root__',
    label: 'root',
    path: '/',
    settings: {
      protect: { ...defaultSetting },
      disabled: { ...defaultSetting },
      tags: [],
    },
    children: nodes,
  };
}

function normalizeTree(tree: RouteNode): TreeState {
  const nodes: Record<string, RouteNode> = {};
  function walk(node: RouteNode) {
    nodes[node.id] = node;
    node.children?.forEach(walk);
  }
  walk(tree);
  return { rootId: tree.id, nodes };
}

export default function RoutesPolicyTree({ tree, globals, defaultHiddenRoutes, onChange }: RoutesPolicyTreeProps): JSX.Element {
	// Only the tree's STRUCTURE (ids/paths/methods/children) affects this —
	// resolveNaturalState strips every setting before resolving, so this is
	// a pure function of "what routes exist", not of their current values.
	const naturalValues = useMemo(
		() => collectNaturalValues(resolveNaturalState(tree)),
		[tree]
	);

	// Resolves inheritance AND computes `.custom` in one pass, so both the
	// initial render and any later re-resolve (globals/defaultHiddenRoutes
	// changing) correctly flag routes that are custom purely because of a
	// global rule cascading down — not just ones touched by a toggle.
	const buildResolvedState = useCallback(
		(currentTree: RouteNode[]): TreeState => {
			const resolved = resolveInheritance(currentTree, globals, defaultHiddenRoutes);
			const withCustom = computeCustom(wrapTree(resolved), naturalValues);
			return normalizeTree(withCustom);
		},
		[globals, defaultHiddenRoutes, naturalValues]
	);

	const [state, setState] = useState(() => buildResolvedState(tree));

	useEffect(() => {
		setState(buildResolvedState(tree));
		// Deliberately NOT depending on `tree` here: `tree` round-trips through
		// onChange on every toggle, and reacting to it would wipe in-progress
		// local edits on every single click. This only re-resolves from
		// scratch when the GLOBAL inputs change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [globals, defaultHiddenRoutes]);

	const [version, setVersion] = useState(0);
	const [expandedItems, setExpandedItems] = useState<string[]>([]);

	const getNode = useCallback((id: string) => state.nodes[id], [state.nodes]);

	const memoTree = useMemo(() => {
		const nodes = state.nodes;
		function build(id: string): RouteNode {
			const node = nodes[id];
			return { ...node, children: node.children?.map((child) => build(child.id)) };
		}
		return build(state.rootId);
	}, [state]);

	// Own overrides only (see countOwnOverrides) — computed from the locally
	// resolved `memoTree`, not the raw `tree` prop, so it's correct on the
	// very first render rather than only after the first toggle.
	const customCount = useMemo(
		() => (memoTree.children ?? []).reduce((acc, node) => acc + countOwnOverrides(node), 0),
		[memoTree]
	);

	useEffect(() => {
		if (version === 0) return;
		onChange(memoTree.children ?? []);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [version]);

	const toggleSetting = useCallback(
		(id: string, key: ToggleableSettingKey) => {
			setState((prev) => {
				const targetNode = prev.nodes[id];
				if (!targetNode) return prev;

				const currentValue = targetNode.settings?.[key]?.value ?? false;
				const newValue = !currentValue;

				function build(nodeId: string): RouteNode {
					const n = prev.nodes[nodeId];
					return { ...n, children: n.children?.map((c) => build(c.id)) };
				}
				const rawRoot = toRawNode(build(prev.rootId));

				const toggledRoot = updateNode(rawRoot, id, (n) => ({
					...n,
					// Any explicit toggle — ON or OFF — is a new custom rule for
					// this route, and it must win over whatever this subtree's
					// descendants had customized before for the SAME setting.
					children: n.children?.map((child) => clearOverridesForKey(child, key)),
					settings: {
						...n.settings,
						// `overridden: true` regardless of newValue: an explicit
						// "off" is just as much a deliberate override as an
						// explicit "on" — it must persist and cascade the same
						// way, not silently fall back to being re-inherited.
						[key]: { value: newValue, inherited: false, overridden: true },
					},
				}));

				const resolvedChildren = resolveInheritance(
					toggledRoot.children ?? [],
					globals,
					defaultHiddenRoutes
				);

				const resolvedRoot = computeCustom(
					{ ...toggledRoot, children: resolvedChildren },
					naturalValues
				);

				return normalizeTree(resolvedRoot);
			});
			setVersion((v) => v + 1);
		},
		[globals, defaultHiddenRoutes, naturalValues]
	);

	// Clears BOTH keys' local override on a single route (not its
	// descendants — they were never touched by this route's own override
	// in the first place, they just inherit whatever this route resolves
	// to next). This is what the Undo icon next to the "custom" chip calls;
	// it only makes sense — and is only shown — when the route actually has
	// an override of its own to remove (see RouteTreeItem).
	const resetSetting = useCallback(
		(id: string) => {
			setState((prev) => {
				const targetNode = prev.nodes[id];
				if (!targetNode) return prev;

				function build(nodeId: string): RouteNode {
					const n = prev.nodes[nodeId];
					return { ...n, children: n.children?.map((c) => build(c.id)) };
				}
				const rawRoot = toRawNode(build(prev.rootId));

				const resetRoot = updateNode(rawRoot, id, (n) => ({
					...n,
					settings: {
						...n.settings,
						disabled: { value: false, inherited: false },
						protect: { value: false, inherited: false },
					},
				}));

				const resolvedChildren = resolveInheritance(
					resetRoot.children ?? [],
					globals,
					defaultHiddenRoutes
				);

				const resolvedRoot = computeCustom(
					{ ...resetRoot, children: resolvedChildren },
					naturalValues
				);

				return normalizeTree(resolvedRoot);
			});
			setVersion((v) => v + 1);
		},
		[globals, defaultHiddenRoutes, naturalValues]
	);

	return (
		<Stack spacing={2}>
			<Typography variant="h6">{__('REST API Tree','bromate-security-api-firewall')}</Typography>
			<Stack flexDirection="row" gap={2}>
				<Chip size="small" label={`${customCount} custom rules`} />
				<Stack flex={1} />
				<Button startIcon={<RefreshIcon />}>{__('Refresh','bromate-security-api-firewall')}</Button>
			</Stack>
			<RoutePolicyTreeContext.Provider value={{ toggleSetting, resetSetting, getNode }}>
				<RichTreeView<RouteNode>
					items={memoTree.children ?? []}
					getItemId={(item) => item.id}
					getItemLabel={(item) => item.label}
					expandedItems={expandedItems}
					onExpandedItemsChange={(_, items) => setExpandedItems(items as string[])}
					slots={{ item: RouteTreeItem }}
				/>
			</RoutePolicyTreeContext.Provider>
		</Stack>
	);
}
