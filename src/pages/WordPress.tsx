import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { SettingsAPI } from '@services/settings';
import SaveButton from '@components/SaveButton';
import FileHardening from '@features/wordpress/FileHardening';
import HttpHeaders from '@features/wordpress/HttpHeaders';

type SecuritySettings = {
	disable_xmlrpc: boolean;
	disable_comments: boolean;
	disable_pingbacks: boolean;
	disable_atom_rss: boolean;
	disable_sitemap: boolean;
	http_headers_secure: boolean;
	http_headers_caching: boolean;
	http_headers_compression: boolean;
	http_headers_secure_options?: Record<string, any>;
	http_headers_caching_options?: Record<string, any>;
};

const SECURITY_FIELDS = [
	'disable_xmlrpc',
	'disable_comments',
	'disable_pingbacks',
	'disable_atom_rss',
	'disable_sitemap',
	'http_headers_secure',
	'http_headers_caching',
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
		disable_atom_rss: false,
		disable_sitemap: false,
		http_headers_secure: false,
		http_headers_caching: false,
		http_headers_compression: false
	});

	const [form, setFormState] = useState<SecuritySettings>(() => securitySettings);
	const [savedForm, setSavedForm] = useState<SecuritySettings>(() => securitySettings);
	
	const [headerOptions, setHeaderOptions] = useState<{
		http_headers_secure_options: Record<string, any>;
		http_headers_caching_options: Record<string, any>;
	}>({
		http_headers_secure_options: {},
		http_headers_caching_options: {},
	});

	const loadSettings = useCallback(async () => {
		try {
			const data = await SettingsAPI.readOptions();
			const securityData = pickSecurityFields(data);
			
			// Load headers options
			if (data.http_headers_secure_options) {
				setHeaderOptions(prev => ({
					...prev,
					http_headers_secure_options: data.http_headers_secure_options,
				}));
			}
			if (data.http_headers_caching_options) {
				setHeaderOptions(prev => ({
					...prev,
					http_headers_caching_options: data.http_headers_caching_options,
				}));
			}
			
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

	const handleHeaderSettingsChange = useCallback((settings: {
		http_headers_secure_options: Record<string, any>;
		http_headers_caching_options: Record<string, any>;
	}) => {
		setHeaderOptions(settings);
	}, []);

	const handleSave = useCallback(async () => {
		const options: Record<string, any> = {};
		
		SECURITY_FIELDS.forEach((key) => {
			options[key] = form[key];
		});

		options.http_headers_secure_options = headerOptions.http_headers_secure_options;
		options.http_headers_caching_options = headerOptions.http_headers_caching_options;

		await SettingsAPI.updateOptions(options);
		setSavedForm((prev) => ({ ...prev, ...form }));
	}, [form, headerOptions]);

	const isDirty = useMemo(() => {
		const fieldsDirty = SECURITY_FIELDS.some((key) => {
			return form[key] !== savedForm[key];
		});

		const headersDirty = JSON.stringify(headerOptions) !== JSON.stringify({
			http_headers_secure_options: savedForm.http_headers_secure_options || {},
			http_headers_caching_options: savedForm.http_headers_caching_options || {},
		});

		return fieldsDirty || headersDirty;
	}, [form, savedForm, headerOptions]);

	if (loading) {
		return (
			<Stack spacing={3}>
				<Stack flexDirection={"row"} justifyContent={"flex-end"}>
				  <Skeleton variant="rounded" width={65} height={35} />
        		</Stack>
				<Skeleton variant="rounded" width={'100%'} height={310} />
				<Skeleton variant="rectangular" width={'100%'} height={500} />
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
						confirmContent: __('Save global security settings?', 'security-api-firewall'),
						confirmLabel: __('Save', 'security-api-firewall'),
						successMessage: __('Global security settings saved successfully.', 'security-api-firewall'),
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
								checked={!!form.disable_atom_rss}
								name="disable_atom_rss"
								onChange={setField}
							/>
						}
						label={__('Disable RSS and Atom feeds', 'security-api-firewall')}
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

			{/* HTTP Headers Component */}
			<HttpHeaders
				secureEnabled={!!form.http_headers_secure}
				cachingEnabled={!!form.http_headers_caching}
				compressionEnabled={!!form.http_headers_compression}
				onSecureChange={setField}
				onCachingChange={setField}
				onCompressionChange={setField}
				onSettingsChange={handleHeaderSettingsChange}
			/>

			<FileHardening />
		</Stack>
	);
}