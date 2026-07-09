import { useEffect, useState, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import type { RoutesSettings, RouteNode } from '@app-types/routes';

import GlobalRoutesPolicy from '@features/routes/GlobalRoutesPolicy';
import RoutesPolicyTree from '@features/routes/RoutesPolicyTree';
import RedirectFront from '@features/routes/RedirectFront';

import { RoutesAPI } from '@services/routes';
import { useDialog, DIALOG_TYPES } from '../contexts/DialogContext';

export default function Routes(): JSX.Element {
	const { openDialog, updateDialog } = useDialog();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [hasChanges, setHasChanges] = useState(false);

	const [tree, setTree] = useState<RouteNode[]>([]);
	const [defaultHiddenRoutes, setDefaultHiddenRoutes] = useState<string[]>([]);
	const [settings, setSettings] = useState<RoutesSettings>({
		routes_policy_enabled:               false,
		routes_policy_default_hidden_routes: false,
		routes_policy_hidden_methods:        [],
		routes_policy_hidden_wp_objects:     [],
		routes_policy_hidden_response_code:  '404',
		redirect_front_enabled: false,
		redirect_front_options: '404',
		redirect_front_user_url: '',
	});

	const update = useCallback(
		<K extends keyof RoutesSettings>(key: K, value: RoutesSettings[K]) => {
			setSettings((prev) => ({ ...prev, [key]: value }));
			setHasChanges(true);
		},
		[]
	);

	const handleTreeChange = useCallback((next: RouteNode[]) => {
		setTree(next);
		setHasChanges(true);
	}, []);

	const loadSettings = useCallback(async () => {
		try {
			const data = await RoutesAPI.getAllSettings();
			setTree(data.tree);
			setSettings(data.settings);
			setDefaultHiddenRoutes(data.default_hidden_routes);
			setHasChanges(false);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { void loadSettings(); }, [loadSettings]);

	const handleSave = useCallback(async () => {
		setSaving(true);
		setSaveError(null);

		openDialog({
			type: DIALOG_TYPES.LOADING,
			title: __('Saving…', 'bromate-security-api-firewall'),
			content: __('Please wait while your settings are saved.', 'bromate-security-api-firewall'),
		});

		try {
			await RoutesAPI.saveAllSettings({ settings, tree });
			setHasChanges(false);
			updateDialog({
				type: DIALOG_TYPES.SUCCESS,
				title: __('Success', 'bromate-security-api-firewall'),
				content: __('Your route policy settings were saved successfully.', 'bromate-security-api-firewall'),
				confirmLabel: __('OK', 'bromate-security-api-firewall'),
			});
		} catch (e) {
			setSaveError('Failed to save changes. Please try again.');
			updateDialog({
				type: DIALOG_TYPES.ERROR,
				title: __('Error', 'bromate-security-api-firewall'),
				content: __('Failed to save your settings. Please try again.', 'bromate-security-api-firewall'),
				confirmLabel: __('OK', 'bromate-security-api-firewall'),
			});
		} finally {
			setSaving(false);
		}
	}, [tree, settings, openDialog, updateDialog]);

	if (loading) {
		return (
			<Stack height="100%" alignItems="center" justifyContent="center">
				<CircularProgress />
			</Stack>
		);
	}

	return (
		<Stack flexGrow={1} spacing={3}>
			<Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={2}>
				{saveError && <Alert severity="error" sx={{ flexGrow: 1 }}>{saveError}</Alert>}
				<Button
					variant="contained"
					disableElevation
					disabled={!hasChanges || saving}
					onClick={handleSave}
				>
					{saving ? __('Saving…', 'bromate-security-api-firewall') : __('Save', 'bromate-security-api-firewall')}
				</Button>
			</Stack>

			<Paper sx={{p:2}} elevation={0}>
				<GlobalRoutesPolicy settings={settings} onChange={update} />
			</Paper>
			<Paper sx={{p:2}} elevation={0}>
				<RoutesPolicyTree
					tree={tree}
					globals={settings}
					onChange={handleTreeChange}
					defaultHiddenRoutes={defaultHiddenRoutes}
				/>
			</Paper>
			<Alert severity="info">
				{__('Route Policy Tree settings take priority over global settings.', 'bromate-security-api-firewall')}
			</Alert>

			<Paper sx={{p:2}} elevation={0}>
				<RedirectFront
					enabled={settings.redirect_front_enabled}
					options={settings.redirect_front_options}
					userUrl={settings.redirect_front_user_url}
					onChange={update}
				/>
			</Paper>
		</Stack>
	);
}