import { useState, useCallback, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import LinearProgress from '@mui/material/LinearProgress';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { apiRequest } from '@services/api';
import { SettingsAPI } from '@services/settings';

import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import ConfirmDialog from '@components/ConfirmDialog';
import CopyButton from '@components/CopyButton';

type SecuritySettings = {
	disable_xmlrpc: boolean;
	disable_comments: boolean;
	disable_pingbacks: boolean;
	disable_rss: boolean;
	disable_sitemap: boolean;
	enforce_wpconfig_permissions: boolean;
	secure_uploads_dir: boolean;
	secure_http_headers: boolean;
	compression_http_headers: boolean;
	wp_http_headers: boolean;
	redirect_front_enabled: boolean;
	redirect_front_preset_option: string;
	redirect_front_custom_url: string;
	disallow_file_edit: boolean;
};

type FileStatus = {
	wpconfig_secure: boolean;
	wpconfig_perms?: string;
	uploads_protected: boolean;
	nginx_snippet?: string;
};

type FileActionSwitchProps = {
	checked: boolean;
	label: string;
	helperText?: string;
	ajaxAction: string;
	confirmMessage: string;
	pendingMessage: string;
	protectedMessage: string;
	isProtected: boolean | null;
	onToggle: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

type RedirectOption = '404' | 'login' | 'custom';

const SECURITY_FIELDS = [
	'disable_xmlrpc',
	'disable_comments',
	'disable_pingbacks',
	'disable_rss',
	'disable_sitemap',
	'enforce_wpconfig_permissions',
	'secure_uploads_dir',
	'secure_http_headers',
	'compression_http_headers',
	'wp_http_headers',
	'redirect_front_enabled',
	'redirect_front_preset_option',
	'redirect_front_custom_url',
	'disallow_file_edit',
] as const;

type SecurityField = typeof SECURITY_FIELDS[number];

const STRING_FIELDS = new Set<SecurityField>([
	'redirect_front_preset_option',
	'redirect_front_custom_url',
]);

function pickSecurityFields(source: Partial<Record<SecurityField, any>>): SecuritySettings {
	return Object.fromEntries(
		SECURITY_FIELDS.map((key) => [
			key,
			STRING_FIELDS.has(key) 
				? (source?.[key] ?? '') 
				: !!source?.[key],
		])
	) as SecuritySettings;
}

function FileActionSwitch({
	checked,
	label,
	helperText,
	ajaxAction,
	confirmMessage,
	pendingMessage,
	protectedMessage,
	isProtected,
	onToggle,
}: FileActionSwitchProps) {
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
	
	const { openDialog, closeDialog } = useDialog();

	const runAction = useCallback(async () => {
		setBusy(true);
		setResult(null);

		try {
			const response = await apiRequest<{ message?: string }>(ajaxAction);
			
			setResult({
				success: true,
				message: response?.message || __('Done.', 'security-api-firewall'),
			});
		} catch (err) {
			setResult({ 
				success: false, 
				message: err instanceof Error ? err.message : __('An error occurred.', 'security-api-firewall') 
			});
		} finally {
			setBusy(false);
		}
	}, [ajaxAction]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.checked) {
			openDialog({
				type: DIALOG_TYPES.CONFIRM,
				title: label,
				content: confirmMessage,
				confirmLabel: __('Apply now', 'security-api-firewall'),
				onConfirm: () => {
					closeDialog();
					onToggle(event);
					runAction();
				},
			});
		} else {
			onToggle(event);
			setResult(null);
		}
	};

	const showDefault = !busy && !result;

	return (
		<FormControl>
			<FormControlLabel
				control={
					<Switch
						size="small"
						checked={checked}
						onChange={handleChange}
						disabled={busy}
					/>
				}
				label={label}
			/>
			{helperText && <FormHelperText>{helperText}</FormHelperText>}

			{busy && (
				<Box sx={{ mt: 1 }}>
					<Typography variant="caption" color="text.secondary">
						{pendingMessage}
					</Typography>
					<LinearProgress sx={{ mt: 0.5 }} />
				</Box>
			)}

			{!busy && result && (
				<Alert
					severity={result.success ? 'success' : 'error'}
					sx={{ mt: 1, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}
				>
					{result.message}
				</Alert>
			)}

			{showDefault && isProtected === true && (
				<Alert severity="success" sx={{ mt: 1, fontSize: '0.75rem' }}>
					{protectedMessage || __('Currently protected.', 'security-api-firewall')}
				</Alert>
			)}

			{showDefault && isProtected !== true && (
				<Alert
					severity="info"
					sx={{ 
						mt: 1, 
						fontSize: '0.75rem', 
					}}
				>
					{confirmMessage}
				</Alert>
			)}
		</FormControl>
	);
}

export default function WordPress() {
	const [loading, setLoading] = useState(true);
	const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
		disable_xmlrpc: false,
		disable_comments: false,
		disable_pingbacks: false,
		disable_rss: false,
		disable_sitemap: false,
		enforce_wpconfig_permissions: false,
		secure_uploads_dir: false,
		secure_http_headers: false,
		compression_http_headers: false,
		wp_http_headers: false,
		redirect_front_enabled: false,
		redirect_front_preset_option: '404',
		redirect_front_custom_url: '',
		disallow_file_edit: false,
	});
	const [fileStatus, setFileStatus] = useState<FileStatus | null>(null);
	
	const { openDialog, closeDialog } = useDialog();

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
		apiRequest<FileStatus>('get_file_status')
			.then((data) => {
				if (data) {
					setFileStatus(data);
				}
			})
			.catch(() => {
				// Silently fail
			});
	}, []);

	const [form, setFormState] = useState<SecuritySettings>(() => securitySettings);
	const [savedForm, setSavedForm] = useState<SecuritySettings>(() => securitySettings);

	useEffect(() => {
		setFormState(securitySettings);
		setSavedForm(securitySettings);
	}, [securitySettings]);

	const setField = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		const { name, checked, value, type } = event.target;
		const fieldValue = type === 'checkbox' ? Boolean(checked) : value;
		setFormState((prev) => ({ ...prev, [name]: fieldValue as any }));
	}, []);

	const handleRedirectChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value as RedirectOption;
		
		setFormState((prev) => ({
			...prev,
			redirect_front_preset_option: value === 'custom' ? '' : value,
			// Clear custom URL if switching away from custom
			redirect_front_custom_url: value === 'custom' ? prev.redirect_front_custom_url : '',
		}));
	}, []);

	const getSelectedRedirectOption = useCallback((): RedirectOption => {
		if (form.redirect_front_custom_url && form.redirect_front_preset_option === '') {
			return 'custom';
		}
		return (form.redirect_front_preset_option as RedirectOption) || '404';
	}, [form.redirect_front_preset_option, form.redirect_front_custom_url]);

	const handleSave = useCallback(async () => {
		const confirmed = await new Promise<boolean>((resolve) => {
			openDialog({
				type: DIALOG_TYPES.CONFIRM,
				title: __('Save Security Settings', 'security-api-firewall'),
				content: __('Save global security settings?', 'security-api-firewall'),
				confirmLabel: __('Save', 'security-api-firewall'),
				onConfirm: () => {
					closeDialog();
					resolve(true);
				},
				onCancel: () => {
					closeDialog();
					resolve(false);
				},
			});
		});

		if (!confirmed) return;

		try {
			const options: Record<string, any> = {};
			SECURITY_FIELDS.forEach((key) => {
				options[key] = form[key];
			});

			await SettingsAPI.updateOptions(options);
			
			setSavedForm({ ...form });

			openDialog({
				type: DIALOG_TYPES.SUCCESS,
				title: __('Global Security Saved', 'security-api-firewall'),
				content: __('Global security settings saved successfully.', 'security-api-firewall'),
				confirmLabel: __('OK', 'security-api-firewall'),
				onConfirm: closeDialog,
			});
		} catch (error) {
			openDialog({
				type: DIALOG_TYPES.ERROR,
				title: __('Error', 'security-api-firewall'),
				content: error instanceof Error ? error.message : __('Failed to save settings.', 'security-api-firewall'),
				confirmLabel: __('OK', 'security-api-firewall'),
				onConfirm: closeDialog,
			});
		}
	}, [form, openDialog, closeDialog]);

	if (loading) {
		return (
			<Stack height="100%" alignItems="center" justifyContent="center">
				<CircularProgress />
			</Stack>
		);
	}

	return (
		<Stack>
			<Stack maxWidth={650} spacing={3}>
				
				<Paper sx={{p:2}} elevation={0}>
					<Stack flexDirection={"column"} gap={2}>
                    <Stack>
                        <Typography variant="h6">
                            {__('Redirect Front', 'security-api-firewall')}
                        </Typography>

                        <Typography variant="caption" color="text.secondary">
                            {__('Turn WordPress into an Application resource only', 'security-api-firewall')}
                        </Typography>
                    </Stack>
					<FormControl>
						<FormControlLabel
							control={
								<Switch
									size="small"
									checked={!!form.redirect_front_enabled}
									name="redirect_front_enabled"
									onChange={setField}
								/>
							}
							label={__('Enable', 'security-api-firewall')}
						/>
					</FormControl>

					<FormControl 
						component="fieldset" 
						disabled={!form.redirect_front_enabled}
						sx={{ display: 'block' }}
					>
						<RadioGroup
							value={getSelectedRedirectOption()}
							onChange={handleRedirectChange}
						>
							<FormControlLabel
								value="404"
								control={<Radio size="small" />}
								label={__('404 Not Found Response', 'security-api-firewall')}
							/>
							<FormControlLabel
								value="login"
								control={<Radio size="small" />}
								label={__('WordPress Login URL', 'security-api-firewall')}
							/>
							<FormControlLabel
								value="custom"
								control={<Radio size="small" />}
								label={__('Custom URL', 'security-api-firewall')}
							/>
							
							<Box sx={{ pl: 4, mt: 1 }}>
								<TextField
									label={__('Custom URL', 'security-api-firewall')}
									type="url"
									size="small"
									name="redirect_front_custom_url"
									placeholder="https://example.com"
									value={form.redirect_front_custom_url}
									onChange={setField as any}
									disabled={
										!form.redirect_front_enabled ||
										getSelectedRedirectOption() !== 'custom'
									}
									fullWidth
									helperText={__('Full URL with protocol and domain', 'security-api-firewall')}
								/>
							</Box>
						</RadioGroup>
					</FormControl>
                    </Stack>
				</Paper>

				<Paper sx={{p:2}} elevation={0}>
                    <Stack flexDirection={"column"} gap={2}>
					<Typography variant="h6">
						{__('Data Exposure', 'security-api-firewall')}
					</Typography>

					<FormControl>
						<FormControlLabel
							control={
								<Switch
									size="small"
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
									size="small"
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
									size="small"
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
									size="small"
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
									size="small"
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
                    <Stack flexDirection={"column"} gap={2}>

					<Typography variant="h6">
						{__('Files', 'security-api-firewall')}
					</Typography>

					<Box>
						<Typography variant="subtitle1" fontWeight={400} gutterBottom>
							{__('Disable theme file editor', 'security-api-firewall')}
						</Typography>
						<FormHelperText sx={{ mt: 0, mb: 1 }}>
							{__('Add the following constant to your wp-config.php to disable the theme editor in WordPress admin.', 'security-api-firewall')}
						</FormHelperText>
						<Box sx={{ position: 'relative', bgcolor: 'grey.900', borderRadius: 1, p: 1.5, mb: 1 }}>
							<Box sx={{ position: 'absolute', top: 4, right: 4 }}>
								<CopyButton toCopy="define('DISALLOW_FILE_EDIT', true);" sx={{ color: 'grey.400' }} />
							</Box>
							<Typography
								component="pre"
								variant="caption"
								sx={{ m: 0, color: 'grey.100', fontFamily: 'monospace', whiteSpace: 'pre', display: 'block' }}
							>
								{"define('DISALLOW_FILE_EDIT', true);"}
							</Typography>
						</Box>
						{securitySettings?.disallow_file_edit ? (
							<Alert severity="success" sx={{ fontSize: '0.75rem' }}>
								{__('DISALLOW_FILE_EDIT is defined and active.', 'security-api-firewall')}
							</Alert>
						) : (
							<Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
								{__('Constant not detected — editor is currently accessible.', 'security-api-firewall')}
							</Alert>
						)}
					</Box>

					<FileActionSwitch
						checked={!!form.enforce_wpconfig_permissions}
						label={__('Secure wp-config.php file', 'security-api-firewall')}
						helperText={__('Set wp-config.php file permissions to 440.', 'security-api-firewall')}
						ajaxAction="update_file_permissions"
						confirmMessage={__(
							'This will set wp-config.php to read-only (chmod 440). Make sure your server user owns the file before proceeding.',
							'security-api-firewall'
						)}
						pendingMessage={__('Updating file permissions…', 'security-api-firewall')}
						isProtected={fileStatus?.wpconfig_secure ?? null}
						protectedMessage={
							fileStatus?.wpconfig_perms
								? __('Protected — permissions: ', 'security-api-firewall') + fileStatus.wpconfig_perms + ' (read-only)'
								: __('Currently protected.', 'security-api-firewall')
						}
						onToggle={setField}
					/>

					<FileActionSwitch
						checked={!!form.secure_uploads_dir}
						label={__('Protect Uploads Directory', 'security-api-firewall')}
						helperText={__('Protect the uploads directory from file execution and directory listing.', 'security-api-firewall')}
						ajaxAction="protect_uploads_dir"
						confirmMessage={__(
							'This will write security rules (.htaccess / web.config) into the uploads directory to block PHP execution and directory listing.',
							'security-api-firewall'
						)}
						pendingMessage={__('Writing protection rules…', 'security-api-firewall')}
						isProtected={fileStatus?.uploads_protected ?? null}
						protectedMessage={__('Protected — .htaccess and web.config rules are in place.', 'security-api-firewall')}
						onToggle={setField}
					/>

					{fileStatus?.nginx_snippet && (
						<Box>
							<Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
								{__('Nginx — add to your server config:', 'security-api-firewall')}
							</Typography>
							<Box sx={{ position: 'relative', bgcolor: 'grey.900', borderRadius: 1, p: 1.5 }}>
								<Box sx={{ position: 'absolute', top: 4, right: 4 }}>
									<CopyButton toCopy={fileStatus.nginx_snippet} sx={{ color: 'grey.400' }} />
								</Box>
								<Typography
									component="pre"
									variant="caption"
									sx={{ m: 0, color: 'grey.100', fontFamily: 'monospace', whiteSpace: 'pre', overflowX: 'auto', display: 'block' }}
								>
									{fileStatus.nginx_snippet}
								</Typography>
							</Box>
						</Box>
					)}
                    </Stack>
				</Paper>

				<Paper sx={{p:2}} elevation={0}>
					<Stack flexDirection={"column"} gap={2}>
                    <Typography variant="h6" mb={2}>
						{__('HTTP Headers', 'security-api-firewall')}
					</Typography>

					<FormControl>
						<FormControlLabel
							control={
								<Switch
									size="small"
									checked={!!form.secure_http_headers}
									name="secure_http_headers"
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
									size="small"
									checked={!!form.compression_http_headers}
									name="compression_http_headers"
									onChange={setField}
								/>
							}
							label={__('Enforce Compression HTTP Headers', 'security-api-firewall')}
						/>
					</FormControl>

					<FormControl>
						<FormControlLabel
							control={
								<Switch
									size="small"
									checked={!!form.wp_http_headers}
									name="wp_http_headers"
									onChange={setField}
								/>
							}
							label={__('Enforce HTTP Headers site-wide', 'security-api-firewall')}
						/>
					</FormControl>
                    </Stack>
				</Paper>
			</Stack>
			<ConfirmDialog />
		</Stack>
	);
}