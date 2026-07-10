import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { SettingsAPI } from '@services/settings';
import SaveButton from '@components/SaveButton';
import FileHardening from '@features/wordpress/FileHardening';

type SecuritySettings = {
	disable_xmlrpc: boolean;
	disable_comments: boolean;
	disable_pingbacks: boolean;
	disable_rss: boolean;
	disable_sitemap: boolean;
	http_headers_secure: boolean;
	http_headers_compression: boolean;
	wp_http_headers: boolean;
};

const SECURITY_FIELDS = [
	'disable_xmlrpc',
	'disable_comments',
	'disable_pingbacks',
	'disable_rss',
	'disable_sitemap',
	'http_headers_secure',
	'http_headers_compression',
] as const;

type SecurityField = typeof SECURITY_FIELDS[number];

function pickSecurityFields(source: Partial<Record<SecurityField, any>>): SecuritySettings {
	return Object.fromEntries(
		SECURITY_FIELDS.map((key) => [
			key,
			source?.[key]
		])
	) as SecuritySettings;
}

export default function WordPress() {
	const [loading, setLoading] = useState(true);
	const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
		disable_xmlrpc: false,
		disable_comments: false,
		disable_pingbacks: false,
		disable_rss: false,
		disable_sitemap: false,
		http_headers_secure: false,
		http_headers_compression: false,
		wp_http_headers: false,
	});

	const [form, setFormState] = useState<SecuritySettings>(() => securitySettings);
	const [savedForm, setSavedForm] = useState<SecuritySettings>(() => securitySettings);
	
	const loadSettings = useCallback(async () => {
		try {
			const data = await SettingsAPI.readOptions();
			const securityData = pickSecurityFields(data);
			setSecuritySettings(securityData);
		} catch (error) {
			console.error('Failed to load settings:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	useEffect(() => {
		setFormState(securitySettings);
		setSavedForm(securitySettings);
	}, [securitySettings]);

	const setField = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		const { name, checked, value, type } = event.target;
		const fieldValue = type === 'checkbox' ? Boolean(checked) : value;
		setFormState((prev) => ({ ...prev, [name]: fieldValue as any }));
	}, []);


	const handleSave = useCallback(async () => {
		const options: Record<string, any> = {};
		SECURITY_FIELDS.forEach((key) => {
			options[key] = form[key];
		});

		await SettingsAPI.updateOptions(options);
		setSavedForm((prev) => ({ ...prev, ...options }));
	}, [form]);

	const isDirty = useMemo(() => {
		return SECURITY_FIELDS.some((key) => {
			return form[key] !== savedForm[key];
		});
	}, [form, savedForm]);

	if (loading) {
		return (
			<Stack height="100%" alignItems="center" justifyContent="center">
				<CircularProgress />
			</Stack>
		);
	}

	return (
		<Stack spacing={3}>
			<Stack direction="row" justifyContent="flex-end">
				<SaveButton
					onSave={handleSave}
					disabled={!isDirty}
					messages={{
						confirmTitle: __('Save Settings', 'security-api-firewall'),
						confirmContent: __('Save exra protection settings?', 'security-api-firewall'),
						confirmLabel: __('Save', 'security-api-firewall'),
						successMessage: __('Exra protection settings saved successfully.', 'security-api-firewall'),
						errorMessage: __('Failed to save settings.', 'security-api-firewall'),
						saveLabel: __('Save', 'security-api-firewall'),
						savingLabel: __('Saving…', 'security-api-firewall'),
					}}
				/>
			</Stack>

			<Paper sx={{p:2}} elevation={0}>
				<Stack flexDirection={"column"} gap={2} maxWidth={650}>
				<Typography variant="h6">
					{__('Data Exposure', 'security-api-firewall')}
				</Typography>

				<FormControl>
					<FormControlLabel
						control={
							<Switch
								checked={!!form.disable_xmlrpc}
								name="disable_xmlrpc"
								onChange={setField}
							/>
						}
						label={__('Disable XML-RPC endpoint', 'security-api-firewall')}
					/>
				</FormControl>

				<FormControl>
					<FormControlLabel
						control={
							<Switch
								checked={!!form.disable_comments}
								name="disable_comments"
								onChange={setField}
							/>
						}
						label={__('Disable Comments', 'security-api-firewall')}
					/>
				</FormControl>

				<FormControl>
					<FormControlLabel
						control={
							<Switch
								checked={!!form.disable_pingbacks}
								name="disable_pingbacks"
								onChange={setField}
							/>
						}
						label={__('Disable Pingbacks', 'security-api-firewall')}
					/>
				</FormControl>

				<FormControl>
					<FormControlLabel
						control={
							<Switch
								checked={!!form.disable_rss}
								name="disable_rss"
								onChange={setField}
							/>
						}
						label={__('Disable RSS feeds', 'security-api-firewall')}
					/>
				</FormControl>

				<FormControl>
					<FormControlLabel
						control={
							<Switch
								checked={!!form.disable_sitemap}
								name="disable_sitemap"
								onChange={setField}
							/>
						}
						label={__('Disable XML Sitemap', 'security-api-firewall')}
					/>
				</FormControl>
				</Stack>
			</Paper>

			<Paper sx={{p:2}} elevation={0}>
				<Stack flexDirection={"column"} gap={2} maxWidth={650}>
					<Typography variant="h6">
						{__('HTTP Headers', 'security-api-firewall')}
					</Typography>

					<FormControl>
						<FormControlLabel
							control={
								<Switch
									checked={!!form.http_headers_secure}
									name="http_headers_secure"
									onChange={setField}
								/>
							}
							label={__('Enforce Secure HTTP Headers', 'security-api-firewall')}
						/>
					</FormControl>

					<FormControl>
						<FormControlLabel
							control={
								<Switch
									checked={!!form.http_headers_compression}
									name="http_headers_compression"
									onChange={setField}
								/>
							}
							label={__('Enforce Compression HTTP Headers', 'security-api-firewall')}
						/>
					</FormControl>

				</Stack>
			</Paper>

			<FileHardening />

		</Stack>
	);
}