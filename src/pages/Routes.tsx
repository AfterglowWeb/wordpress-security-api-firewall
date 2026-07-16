import { useEffect, useState, useCallback, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';

import type { RoutesSettings, RouteNode } from '@app-types/routes';

import GlobalRoutesPolicy from '@features/routes/GlobalRoutesPolicy';
import RoutesPolicyTree from '@features/routes/RoutesPolicyTree';

import { RoutesAPI } from '@services/routes';
import SaveButton from '@components/SaveButton';
import type { SaveButtonMessages } from '@components/SaveButton';

export default function Routes(): JSX.Element {
	const [loading, setLoading] = useState(true);

	const [tree, setTree] = useState<RouteNode[]>([]);
	const [loadedTree, setLoadedTree] = useState<RouteNode[]>([]);
	const [defaultHiddenRoutes, setDefaultHiddenRoutes] = useState<string[]>([]);
	const [settings, setSettings] = useState<RoutesSettings>({
		routes_policy_enabled:               false,
		routes_policy_default_hidden_routes: false,
		routes_policy_hidden_methods:        [],
		routes_policy_hidden_wp_objects:     [],
		routes_policy_auth_enforce: false,
		routes_policy_hidden_routes_redirect_option:  '404',
		routes_policy_hidden_routes_redirect_user_url: '',

	});
	const [loadedSettings, setLoadedSettings] = useState<RoutesSettings>(settings);
	
	const isDirty = useMemo(
	() => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
	[settings, loadedSettings]
	);

	const saveMessages: SaveButtonMessages = {
		confirmTitle: __('Save Changes', 'bromate-security-api-firewall'),
		confirmContent: __('Are you sure you want to save these route policy settings?', 'bromate-security-api-firewall'),
		confirmLabel: __('Save', 'bromate-security-api-firewall'),
		successMessage: __('Your route policy settings were saved successfully.', 'bromate-security-api-firewall'),
		errorMessage: __('Failed to save route policy settings. Please try again.', 'bromate-security-api-firewall'),
		saveLabel: __('Save', 'bromate-security-api-firewall'),
		savingLabel: __('Saving...', 'bromate-security-api-firewall'),
	};

	const update = useCallback(
		<K extends keyof RoutesSettings>(key: K, value: RoutesSettings[K]) => {
			setSettings((prev) => ({ ...prev, [key]: value }));
		},
		[]
	);

	const handleTreeChange = useCallback((next: RouteNode[]) => {
		setTree(next);
	}, []);

	const loadSettings = useCallback(async () => {
		try {
			const data = await RoutesAPI.getAllSettings();
			setTree(data.tree);
			setLoadedTree(data.tree);
			setSettings(data.settings);
			setLoadedSettings(data.settings);
			setDefaultHiddenRoutes(data.default_hidden_routes);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { void loadSettings(); }, [loadSettings]);

	const handleSave = useCallback(async () => {
		await RoutesAPI.saveAllSettings({ settings, tree });
		setLoadedSettings(settings);
		setLoadedTree(tree);
	}, [tree, settings]);

	if (loading) {
		return (
			<Stack spacing={3}>
				<Stack flexDirection={"row"} justifyContent={"flex-end"}>
				  <Skeleton variant="rounded" width={65} height={35} />
        		</Stack>
				<Skeleton variant="rounded" width={'100%'} height={680} />
				<Skeleton variant="rounded" width={'100%'} height={420} />
			</Stack>
		);
	}


	return (
		<Stack flexGrow={1} spacing={3}>
			<Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={2}>
				<SaveButton
					onSave={handleSave}
					disabled={!isDirty}
					messages={saveMessages}
				/>
			</Stack>

			<Paper sx={{p:2}} elevation={0}>
				<GlobalRoutesPolicy settings={settings} onChange={update} />
			</Paper>

			<Paper sx={{p:2}} elevation={0}>
				<Stack direction="column" gap={2}>
					<RoutesPolicyTree
						tree={tree}
						baselineTree={loadedTree}
						globals={settings}
						onChange={handleTreeChange}
						defaultHiddenRoutes={defaultHiddenRoutes}
					/>
					<Alert severity="info">
						{__('Route Policy Tree settings take priority over global settings.', 'bromate-security-api-firewall')}
					</Alert>
				</Stack>
			</Paper>

			
		</Stack>
	);
}
