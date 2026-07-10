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
			onApplied(true);
		} catch (err) {
			setResult({
				success: false,
				message: err instanceof Error ? err.message : __('An error occurred.', 'security-api-firewall'),
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
				confirmLabel: __('Apply now', 'security-api-firewall'),
				onConfirm: () => {
					closeDialog();
					runAction();
				},
			});
		} else {
			// Turning off is just a local intent flag — nothing destructive to confirm.
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
				<Alert severity={result.success ? 'success' : 'error'} sx={{ mt: 1, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
					{result.message}
				</Alert>
			)}

			{showDefault && isProtected === true && (
				<Alert severity="success" sx={{ mt: 1, fontSize: '0.75rem' }}>
					{protectedMessage || __('Currently protected.', 'security-api-firewall')}
				</Alert>
			)}
		</FormControl>
	);
}

export default function FileHardening() {
	const [fileStatus, setFileStatus] = useState<FileStatus | null>(null);
	const [wpconfigHardened, setWpconfigHardened] = useState(false);
	const [uploadsHardened, setUploadsHardened] = useState(false);
	const [disableThemeEditor, setDisableThemeEditor] = useState(false);

	useEffect(() => {
		let cancelled = false;

		apiRequest<FileStatus>('get_file_status')
			.then((data) => {
				if (!cancelled && data) setFileStatus(data);
			})
			.catch(() => {
				// Silently fail
			});

		SettingsAPI.readOptions()
			.then((opts: any) => {
				if (cancelled) return;
				setWpconfigHardened(!!opts?.harden_wpconfig_file_permissions);
				setUploadsHardened(!!opts?.harden_uploads_dir_permissions);
                setDisableThemeEditor(!!opts?.disable_theme_editor);
			})
			.catch(() => {
				// Silently fail
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<Paper sx={{ p: 2 }} elevation={0}>
			<Stack flexDirection="column" gap={2} maxWidth={650}>
				<Typography variant="h6">{__('Files', 'security-api-firewall')}</Typography>
				
				<FileActionSwitch
					checked={wpconfigHardened}
					label={__('Protect wp-config.php file', 'security-api-firewall')}
					ajaxAction="update_file_permissions"
					helperText={__(
						'Set wp-config.php file permissions to 440. Server user must owns the file to proceed.',
						'security-api-firewall'
					)}
					confirmMessage={__('Change wp-config.php file permissions?', 'security-api-firewall' )}
					pendingMessage={__('Updating file permissions…', 'security-api-firewall')}
					isProtected={fileStatus?.wpconfig_secure ?? null}
					protectedMessage={
						fileStatus?.wpconfig_perms
							? __('Protected — permissions: ', 'security-api-firewall') + fileStatus.wpconfig_perms + ' (read-only)'
							: __('Currently protected.', 'security-api-firewall')
					}
					onApplied={setWpconfigHardened}
				/>

				<FileActionSwitch
					checked={uploadsHardened}
					label={__('Protect Uploads Directory', 'security-api-firewall')}
					ajaxAction="protect_uploads_dir"
					helperText={__(
						'Write security rules (.htaccess / web.config) into the uploads directory to block PHP execution and directory listing.',
						'security-api-firewall'
					)}
					confirmMessage={__('Protect uploads directory?', 'security-api-firewall' )}
					pendingMessage={__('Writing protection rules…', 'security-api-firewall')}
					isProtected={fileStatus?.uploads_protected ?? null}
					protectedMessage={__('Protected — Rules are in place.', 'security-api-firewall')}
					onApplied={setUploadsHardened}
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

				<Stack flexDirection="column" gap={2}>
					<Stack spacing={0}>
					<Typography variant="body1">
						{__('Disable theme file editor', 'security-api-firewall')}
					</Typography>
					<FormHelperText>
						{__(
							'Add the following constant to your wp-config.php to disable the theme editor in WordPress admin.',
							'security-api-firewall'
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
					{disableThemeEditor ? (
						<Alert severity="success" sx={{ fontSize: '0.75rem' }}>
							{__('DISALLOW_FILE_EDIT is defined and active.', 'security-api-firewall')}
						</Alert>
					) : (
						<Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
							{__('Constant not detected — editor is currently accessible.', 'security-api-firewall')}
						</Alert>
					)}
				</Stack>

			</Stack>
		</Paper>
	);
}