import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

import SaveButton from '@components/SaveButton';
import { apiRequest } from '@services/api';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import ExportImportSettings from '@features/config/ExportImportSettings';

interface ConfigSettings {
  config_delete_data_on_uninstall: boolean,
}

const DEFAULT_CONFIG_SETTINGS:ConfigSettings = {
  config_delete_data_on_uninstall: false,
}

export default function Config(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ConfigSettings>(DEFAULT_CONFIG_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState<ConfigSettings>(DEFAULT_CONFIG_SETTINGS);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const { openDialog } = useDialog();

  const loadConfigSettings = useCallback(async () => {
        try {
          const logSettings:ConfigSettings = await apiRequest('bromate_get_config_settings');
          setSettings(logSettings);
          setLoadedSettings(logSettings);
        } finally {
          setLoading(false);
        }
      }, []);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
    [settings, loadedSettings]
  );

  useEffect(() => { void loadConfigSettings(); }, [loadConfigSettings]);

  const onChange = <K extends keyof ConfigSettings>(
    key: K,
    value: ConfigSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
      const settings:ConfigSettings = await apiRequest('bromate_update_config_settings');
      setLoadedSettings(settings);
    }, [settings]);

  const handleDeleteAllData = useCallback(() => {
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Delete all settings and tables?', 'bromate-security-api-firewall'),
      content: __(
        'This permanently deletes every setting and database table created by this plugin. This cannot be undone. Continue?',
        'bromate-security-api-firewall'
      ),
      confirmLabel: __('Delete everything', 'bromate-security-api-firewall'),
      onConfirm: async () => {
        setDeleting(true);
        try {
          await apiRequest('bromate_delete_all_settings_now');
          setSnackbar({
            open: true,
            message: __('All settings and tables have been deleted.', 'bromate-security-api-firewall'),
            severity: 'success',
          });
          setSettings(DEFAULT_CONFIG_SETTINGS);
          setLoadedSettings(DEFAULT_CONFIG_SETTINGS);
        } catch (error) {
          setSnackbar({
            open: true,
            message: error instanceof Error ? error.message : __('Failed to delete data.', 'bromate-security-api-firewall'),
            severity: 'error',
          });
        } finally {
          setDeleting(false);
        }
      },
    });
  }, [openDialog]);

  if (loading) {
		return (
			<Stack spacing={3}>
				<Stack flexDirection={"row"} justifyContent={"flex-end"}>
				  <Skeleton variant="rounded" width={65} height={35} />
        </Stack>
				<Skeleton variant="rounded" width={'100%'} height={385} />
				<Skeleton variant="rounded" width={'100%'} height={680} />
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
          confirmTitle: __('Save config settings', 'bromate-security-api-firewall'),
          confirmContent: __('Apply these changes now?', 'bromate-security-api-firewall'),
          confirmLabel: __('Save', 'bromate-security-api-firewall'),
          successMessage: __('Logs settings saved successfully.', 'bromate-security-api-firewall'),
          errorMessage: __('Failed to save config settings.', 'bromate-security-api-firewall'),
          saveLabel: __('Save', 'bromate-security-api-firewall'),
          savingLabel: __('Saving…', 'bromate-security-api-firewall'),
        }}
        />
      </Stack>

      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2}>
           <Stack flexDirection="row" gap={1} alignItems="center">
            <FormControlLabel
              label={__('Delete settings and tables on uninstall', 'bromate-security-api-firewall')}
              control={
                <Switch
                checked={settings.config_delete_data_on_uninstall}
                  onChange={(e) =>
                  onChange('config_delete_data_on_uninstall', e.target.checked)
                  }
                />
              }
              sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
            />
          </Stack>
        </Stack>
      </Paper>

      <ExportImportSettings />

      <Paper sx={{ p: 2 }} elevation={0} variant="outlined" style={{ borderColor: 'var(--mui-palette-error-main, #d32f2f)' }}>
        <Stack spacing={2}>
          <Typography variant="h6" color="error">
            {__('Danger Zone', 'bromate-security-api-firewall')}
          </Typography>
          <Divider />
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
            <Stack>
              <Typography variant="body2" fontWeight={500}>
                {__('Delete all plugin data now', 'bromate-security-api-firewall')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {__('Immediately removes every setting and database table. This does not wait for plugin uninstall.', 'bromate-security-api-firewall')}
              </Typography>
            </Stack>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={handleDeleteAllData}
              disabled={deleting}
            >
              {deleting ? __('Deleting…', 'bromate-security-api-firewall') : __('Delete all data', 'bromate-security-api-firewall')}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      
    </Stack>
  );
}