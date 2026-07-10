import { useState, useCallback, useMemo, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { RoutePolicyTreeContext } from '@contexts/RoutePolicyTreeContext';
import { resolveInheritance } from '@app-utils/routeInheritance';
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

function countCustomRules(node: RouteNode): number {
	let count = node.settings?.custom ? 1 : 0;
	for (const child of node.children ?? []) {
		count += countCustomRules(child);
	}
	return count;
}

// Converts a resolved node back into "raw" input suitable for re-resolving:
// explicit overrides are kept as forced values, everything else (including
// previously-inherited values) is reset so resolveNode recomputes it fresh
// instead of that inherited snapshot leaking back in as a new explicit truth.
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

function computeCustom(node: RouteNode, baselineCustom: Record<string, boolean>): RouteNode {
	const custom =
		!!node.settings?.disabled?.overridden ||
		!!node.settings?.protect?.overridden ||
		!!baselineCustom[node.id];

	return {
		...node,
		settings: { ...node.settings, custom },
		children: node.children?.map((child) => computeCustom(child, baselineCustom)),
	};
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
	const [state, setState] = useState(() =>
		normalizeTree(wrapTree(resolveInheritance(tree, globals, defaultHiddenRoutes)))
	);

	const [version, setVersion] = useState(0);

	const baselineCustom = useMemo(() => {
		const map: Record<string, boolean> = {};
		function walk(node: RouteNode) {
			map[node.id] = !!node.settings?.custom;
			node.children?.forEach(walk);
		}
		tree.forEach(walk);
		return map;
	}, [tree]);

	useEffect(() => {
		setState(normalizeTree(wrapTree(resolveInheritance(tree, globals, defaultHiddenRoutes))));
	}, [globals, defaultHiddenRoutes]);

	const [expandedItems, setExpandedItems] = useState<string[]>([]);

	const customCount = useMemo(
		() => tree.reduce((acc, node) => acc + countCustomRules(node), 0),
		[tree]
	);

	const getNode = useCallback((id: string) => state.nodes[id], [state.nodes]);

	const memoTree = useMemo(() => {
		const nodes = state.nodes;
		function build(id: string): RouteNode {
			const node = nodes[id];
			return { ...node, children: node.children?.map((child) => build(child.id)) };
		}
		return build(state.rootId);
	}, [state]);

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
					settings: {
						...n.settings,
						[key]: newValue
							? { value: true, inherited: false, overridden: true }
							: { value: false, inherited: false },
					},
				}));

				const resolvedChildren = resolveInheritance(
					toggledRoot.children ?? [],
					globals,
					defaultHiddenRoutes
				);

				const resolvedRoot = computeCustom(
					{ ...toggledRoot, children: resolvedChildren },
					baselineCustom
				);

				return normalizeTree(resolvedRoot);
			});
			setVersion((v) => v + 1);
		},
		[globals, defaultHiddenRoutes, baselineCustom]
	);

	return (
		<Stack spacing={2}>
			<Typography variant="h6">{__('REST API Tree','bromate-security-api-firewall')}</Typography>
			<Stack flexDirection="row" gap={2}>
				<Chip size="small" label={`${customCount} custom rules`} />
				<Stack flex={1} />
				<Button startIcon={<RefreshIcon />}>{__('Refresh','bromate-security-api-firewall')}</Button>
			</Stack>
			<RoutePolicyTreeContext.Provider value={{ toggleSetting, getNode }}>
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