import { useState, useCallback, useEffect } from '@wordpress/element';
import Stack from '@mui/material/Stack';

import { type LogSettings } from '@app-types/logs';
import { LogAPI } from '@services/logs';
import LogsOptions from '@features/logs/LogsOptions';
import LogsDataGrid from '@features/logs/LogsDataGrid';

const DEFAULT_LOGS_SETTINGS:LogSettings = {
  logs_enabled: false,
  logs_keep_severities: [],
  logs_keep_events: [],
  logs_rotation_time: 30,
}

export default function Logs(): JSX.Element {

  const [settings, setSettings] = useState<LogSettings>(DEFAULT_LOGS_SETTINGS);
  const loadLogsSettings = useCallback(async () => {
        try {
          const logSettings:LogSettings = await LogAPI.getSettings();
          setSettings(logSettings);
        } catch (err) {
          setSettings(DEFAULT_LOGS_SETTINGS);
        }
      }, []);
    
  useEffect(() => {
    loadLogsSettings();
  }, [loadLogsSettings]);

  const onChange = <K extends keyof LogSettings>(
    key: K,
    value: LogSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };


  return (
    <Stack spacing={3}>
      <LogsOptions settings={settings} onChange={onChange} />
      <LogsDataGrid settings={settings} />
    </Stack>
  );
}