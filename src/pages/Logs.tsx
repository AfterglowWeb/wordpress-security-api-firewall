import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Stack from '@mui/material/Stack';

import { type LogSeverity, type LogsSettings, type LogEvent } from '@app-types/logs';
import { LogAPI } from '@services/logs';
import LogsOptions from '@features/logs/LogsOptions';
import LogsDataGrid from '@features/logs/LogsDataGrid';
import SaveButton from '@components/SaveButton';

const DEFAULT_LOGS_SETTINGS:LogsSettings = {
  logs_enabled: false,
  logs_keep_severities: ['info', 'warning', 'error'] as LogSeverity[],
  logs_keep_events: [] as LogEvent[],
  logs_rotation_time: 30,
}

export default function Logs(): JSX.Element {

  const [settings, setSettings] = useState<LogsSettings>(DEFAULT_LOGS_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState<LogsSettings>(DEFAULT_LOGS_SETTINGS);
  
  const loadLogsSettings = useCallback(async () => {
        try {
          const logSettings:LogsSettings = await LogAPI.getSettings();
          setSettings(logSettings);
        } catch (err) {
          setSettings(DEFAULT_LOGS_SETTINGS);
        }
      }, []);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
    [settings, loadedSettings]
  );
    
  useEffect(() => {
    loadLogsSettings();
  }, [loadLogsSettings]);

  const onChange = <K extends keyof LogsSettings>(
    key: K,
    value: LogsSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
        await LogAPI.updateSettings(settings);
        setLoadedSettings(settings);
    }, [settings]);


  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="flex-end">
      <SaveButton
        onSave={handleSave}
        disabled={!isDirty}
        messages={{
          confirmTitle: __('Save logs settings', 'bromate-security-api-firewall'),
          confirmContent: __('Apply these changes now?', 'bromate-security-api-firewall'),
          confirmLabel: __('Save', 'bromate-security-api-firewall'),
          successMessage: __('Logs settings saved successfully.', 'bromate-security-api-firewall'),
          errorMessage: __('Failed to save logs settings.', 'bromate-security-api-firewall'),
          saveLabel: __('Save', 'bromate-security-api-firewall'),
          savingLabel: __('Saving…', 'bromate-security-api-firewall'),
        }}
        />
      </Stack>
      <LogsOptions settings={settings} onChange={onChange} />
      <LogsDataGrid settings={settings} />
    </Stack>
  );
}