import { useState, useCallback, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { apiRequest } from '@services/api';
import { SettingsAPI } from '@services/settings';
import CopyButton from '@components/CopyButton';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';

type FileStatus = {
	wpconfig_secure: boolean;
	wpconfig_perms?: string;
	uploads_protected: boolean;
	theme_editor_disabled: boolean;
	nginx_snippet?: string;
};

type NoticeSeverity = 'info' | 'success' | 'warning' | 'error';

type Notice = {
	severity: NoticeSeverity;
	message: string;
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
	onApplied: (checked: boolean) => void;
};

function FileActionSwitch({
	checked,
	label,
	helperText,
	ajaxAction,
	confirmMessage,
	pendingMessage,
	protectedMessage,
	isProtected,
	onApplied,
}: FileActionSwitchProps) {
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<{ success: boolean; message: string; severity?: NoticeSeverity; } | null>(null);
	const { openDialog, closeDialog } = useDialog();

	const runAction = useCallback(async () => {
		setBusy(true);
		setResult(null);
		try {
			const response = await apiRequest<{ message?: string; severity?: NoticeSeverity; }>(ajaxAction);
			setResult({
				success: true,
				message: response?.message || __('Done.', 'bromate-security-api-firewall'),
				severity: response?.severity || 'info',
			});
			onApplied(true);
		} catch (err) {
			setResult({
				success: false,
				message: err instanceof Error ? err.message : __('An error occurred.', 'bromate-security-api-firewall'),
				severity: 'error',
			});
		} finally {
			setBusy(false);
		}
	}, [ajaxAction, onApplied]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.checked) {
			openDialog({
				type: DIALOG_TYPES.CONFIRM,
				title: label,
				content: confirmMessage,
				confirmLabel: __('Apply now', 'bromate-security-api-firewall'),
				onConfirm: () => {
					closeDialog();
					runAction();
				},
			});
		} else {
			onApplied(false);
			setResult(null);
		}
	};

	const showDefault = !busy && !result;

	return (
		<FormControl>
			<FormControlLabel
				control={<Switch checked={checked} onChange={handleChange} disabled={busy} />}
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
				<Alert severity={result?.severity as NoticeSeverity || 'info'} sx={{ mt: 1, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
					{result.message}
				</Alert>
			)}

			{showDefault && isProtected === true && (
				<Alert severity="success" sx={{ mt: 1, fontSize: '0.75rem' }}>
					{protectedMessage || __('Currently protected.', 'bromate-security-api-firewall')}
				</Alert>
			)}
		</FormControl>
	);
}

export default function FileHardening() {
	const [hardeningStatus, setHardeningStatus] = useState<FileStatus | null>(null);
	const [wpconfigHardened, setWpconfigHardened] = useState(false);
	const [uploadsHardened, setUploadsHardened] = useState(false);
	const [statusNotice, setStatusNotice] = useState<Notice | null>(null);
	const [optionsNotice, setOptionsNotice] = useState<Notice | null>(null);

	useEffect(() => {
		let cancelled = false;

		const loadFileStatus = async () => {
			try {
				const data = await apiRequest<FileStatus>('get_files_hardening_status');
				if (!cancelled && data) {
					setHardeningStatus(data);
				}
			} catch (err) {
				// A failure here is usually informational (e.g. wp-config.php or
				// .htaccess not readable/writable by the server user), not a real
				// error — the backend message is written to be read as-is.
				if (!cancelled) {
					setStatusNotice({
						severity: 'info',
						message:
							err instanceof Error
								? err.message
								: __('Unable to retrieve file protection status.', 'bromate-security-api-firewall'),
					});
				}
			}
		};

		const loadOptions = async () => {
			try {
				const opts = await SettingsAPI.readOptions();
				if (!cancelled) {
					setWpconfigHardened(!!opts?.harden_wpconfig_file_permissions);
					setUploadsHardened(!!opts?.harden_uploads_dir_permissions);
				}
			} catch (err) {
				if (!cancelled) {
					setOptionsNotice({
						severity: 'info',
						message:
							err instanceof Error
								? err.message
								: __('Unable to retrieve current settings.', 'bromate-security-api-firewall'),
					});
				}
			}
		};

		loadFileStatus();
		loadOptions();

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<Paper sx={{ p: 2 }} elevation={0}>
			<Stack flexDirection="column" gap={2} maxWidth={650}>
				<Typography variant="h6">{__('Files', 'bromate-security-api-firewall')}</Typography>

				{statusNotice && (
					<Alert severity={statusNotice.severity} sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
						{statusNotice.message}
					</Alert>
				)}
				{optionsNotice && (
					<Alert severity={optionsNotice.severity} sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
						{optionsNotice.message}
					</Alert>
				)}

				<FileActionSwitch
					checked={wpconfigHardened}
					label={__('Protect wp-config.php file', 'bromate-security-api-firewall')}
					ajaxAction="update_wpconfig_file_permissions"
					helperText={__(
						'Set wp-config.php file permissions to 440. Server user must owns the file to proceed.',
						'bromate-security-api-firewall'
					)}
					confirmMessage={__('Change wp-config.php file permissions?', 'bromate-security-api-firewall' )}
					pendingMessage={__('Updating file permissions…', 'bromate-security-api-firewall')}
					isProtected={hardeningStatus?.wpconfig_secure ?? null}
					protectedMessage={
						hardeningStatus?.wpconfig_perms
							? __('Protected — permissions: ', 'bromate-security-api-firewall') + hardeningStatus.wpconfig_perms + ' (read-only)'
							: __('Currently protected.', 'bromate-security-api-firewall')
					}
					onApplied={setWpconfigHardened}
				/>

				<FileActionSwitch
					checked={uploadsHardened}
					label={__('Protect Uploads Directory', 'bromate-security-api-firewall')}
					ajaxAction="protect_uploads_dir"
					helperText={__(
						'Write .htaccess file with security rules into the uploads directory to block PHP execution and directory listing.',
						'bromate-security-api-firewall'
					)}
					confirmMessage={__('Protect uploads directory?', 'bromate-security-api-firewall' )}
					pendingMessage={__('Writing protection rules…', 'bromate-security-api-firewall')}
					isProtected={hardeningStatus?.uploads_protected ?? null}
					protectedMessage={__('Protected — Rules are in place.', 'bromate-security-api-firewall')}
					onApplied={setUploadsHardened}
				/>

				{hardeningStatus?.nginx_snippet && (
					<Box>
						<Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
							{__('Nginx — add to your server config:', 'bromate-security-api-firewall')}
						</Typography>
						<Box sx={{ position: 'relative', bgcolor: 'grey.900', borderRadius: 1, p: 1.5 }}>
							<Box sx={{ position: 'absolute', top: 4, right: 4 }}>
								<CopyButton toCopy={hardeningStatus.nginx_snippet} sx={{ color: 'grey.400' }} />
							</Box>
							<Typography
								component="pre"
								variant="caption"
								sx={{ m: 0, color: 'grey.100', fontFamily: 'monospace', whiteSpace: 'pre', overflowX: 'auto', display: 'block' }}
							>
								{hardeningStatus.nginx_snippet}
							</Typography>
						</Box>
					</Box>
				)}

				<Stack flexDirection="column" gap={2}>
					<Stack spacing={0}>
					<Typography variant="body1">
						{__('Disable theme file editor', 'bromate-security-api-firewall')}
					</Typography>
					<FormHelperText>
						{__(
							'Add the following constant to wp-config.php or theme functions.php to disable the file editor in WordPress admin.',
							'bromate-security-api-firewall'
						)}
					</FormHelperText>
					</Stack>
					<Box sx={{ position: 'relative', bgcolor: 'grey.900', borderRadius: 1, p: 1.5 }}>
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
					{hardeningStatus && hardeningStatus.theme_editor_disabled ? (
						<Alert severity="success" sx={{ fontSize: '0.75rem' }}>
							{__('DISALLOW_FILE_EDIT is defined and active.', 'bromate-security-api-firewall')}
						</Alert>
					) : (
						<Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
							{__('Constant not detected — editor is currently accessible.', 'bromate-security-api-firewall')}
						</Alert>
					)}
				</Stack>

			</Stack>
		</Paper>
	);
}