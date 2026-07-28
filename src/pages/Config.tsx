import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

import SaveButton from '@components/SaveButton';
import { apiRequest } from '@services/api';

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
      
    </Stack>
  );
}