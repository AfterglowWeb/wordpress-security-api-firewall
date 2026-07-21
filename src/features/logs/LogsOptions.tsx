import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import { Paper } from '@mui/material';

import MultipleSelect from '@components/MultipleSelect';
import type { LogsSettings, LogSeverity, LogEvent } from '@app-types/logs';

const LOGS_SEVERITIES: LogSeverity[] = ['info', 'warning', 'error'];

const LOGS_EVENTS_OPTIONS: Array<{
  value: LogEvent;
  label: string;
  groupLabel?: string;
  subGroupLabel?: string;
  secondary?: string;
}> = [
  // IP Management Events
  { value: 'ip_blocked', label: __('IP Blocked', 'bromate-security-api-firewall'), groupLabel: __('IP Management', 'bromate-security-api-firewall') },
  { value: 'ip_blocked', label: __('IP Blocked', 'bromate-security-api-firewall') },
  { value: 'ip_rate_limited', label: __('IP Rate Limited', 'bromate-security-api-firewall') },
  { value: 'ip_banned', label: __('IP Banned', 'bromate-security-api-firewall') },
  { value: 'ip_whitelisted_bypass', label: __('IP Whitelisted Bypass', 'bromate-security-api-firewall') },
  { value: 'ip_entry_created', label: __('IP Entry Manually Created', 'bromate-security-api-firewall') },
  { value: 'ip_entry_deleted', label: __('IP Entry Manually Deleted', 'bromate-security-api-firewall') },
  { value: 'expired_ip_entry_cleanup', label: __('Expired IP Entries Cleanup', 'bromate-security-api-firewall') },
  
  // Authentication Events
  { value: 'auth_success', label: __('Auth Success', 'bromate-security-api-firewall'), groupLabel: __('REST API Auth.', 'bromate-security-api-firewall') },
  { value: 'auth_success', label: __('Auth Success', 'bromate-security-api-firewall') },
  { value: 'auth_failed', label: __('Auth Failed', 'bromate-security-api-firewall') },
  { value: 'auth_revoked', label: __('Auth Revoked', 'bromate-security-api-firewall') },
  
  // Admin Events
  { value: 'admin_login_success', label: __('Login Success', 'bromate-security-api-firewall'), groupLabel: __('WordPress Login', 'bromate-security-api-firewall') },
  { value: 'admin_login_success', label: __('Login Success', 'bromate-security-api-firewall') },
  { value: 'admin_login_failed', label: __('Login Failed', 'bromate-security-api-firewall') },
  { value: 'admin_login_rate_limited', label: __('Login Rate Limited', 'bromate-security-api-firewall') },
  { value: 'admin_login_banned', label: __('Login Banned', 'bromate-security-api-firewall') },
  
  // System Events
  { value: 'emergency_token_used', label: __('Emergency Token Used', 'bromate-security-api-firewall'), groupLabel: __('System', 'bromate-security-api-firewall') },
  { value: 'emergency_token_used', label: __('Emergency Token Used', 'bromate-security-api-firewall') },
  { value: 'plugin_settings_changed', label: __('Plugin Settings Changed', 'bromate-security-api-firewall') },
];

type Props = {
  settings: LogsSettings;
  onChange: <K extends keyof LogsSettings>(key: K, value: LogsSettings[K]) => void;
};

export default function LogsOptions({ settings, onChange }: Props): JSX.Element {
  const enabled = settings.logs_enabled ?? false;
  const severitiesKept = useMemo(() => {
    const kept = settings?.logs_keep_severities;
    return Array.isArray(kept) ? kept : [];
  }, [settings?.logs_keep_severities]);

  const isSeverityEnabled = (severity: LogSeverity): boolean => {
    return Array.isArray(severitiesKept) && severitiesKept.includes(severity);
  };

  const toggleSeverities = (severity: LogSeverity) => {
    const current = Array.isArray(settings.logs_keep_severities) ? settings.logs_keep_severities : [];
    const isEnabled = current.includes(severity);
    const newValue = isEnabled 
      ? current.filter((m: LogSeverity) => m !== severity)
      : [...current, severity];
    
    onChange('logs_keep_severities', newValue as LogSeverity[]);
  };

  const handleEventsChange = (events: LogEvent[]) => {
    onChange('logs_keep_events', events);
  };

  return (
    <Paper sx={{ p: 2 }} elevation={0}>
      <Stack flexDirection="column" gap={3} maxWidth={650}>
        <Stack flexDirection="row" gap={1} alignItems="center">
          <FormControlLabel
            label={__('Enable', 'bromate-security-api-firewall')}
            control={
              <Switch
                checked={enabled}
                onChange={(e) => onChange('logs_enabled', e.target.checked)}
              />
            }
            sx={{ mr: 0, '& .MuiTypography-root': { lineHeight: '2em' } }}
          />
          <Divider orientation="vertical" variant="middle" flexItem />
          <Stack>
            <Typography variant="h6">{__('Save Logs', 'bromate-security-api-firewall')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {__('Save security related events to the database.', 'bromate-security-api-firewall')}
            </Typography>
          </Stack>
        </Stack>

        <Stack flexDirection="column" gap={2} sx={{ opacity: enabled ? 1 : 0.6 }}>
          
          <Stack spacing={2}>
           <Typography variant="body1">
              {__('Logs retention time', 'bromate-security-api-firewall')}
            </Typography>
          <TextField
            label={__('Days', 'bromate-security-api-firewall')}
            type="number"
            disabled={!settings.logs_enabled}
            value={settings.logs_rotation_time}
            onChange={(e) => onChange('logs_rotation_time', Number(e.target.value))}
            sx={{maxWidth:100}}
          />
          </Stack>
          

          <Stack spacing={0}>
            <Typography variant="body1">{__('Logs Severity', 'bromate-security-api-firewall')}</Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {LOGS_SEVERITIES.map((severity) => (
                <FormControlLabel
                  key={severity}
                  label={severity}
                  control={
                    <Switch
                      checked={isSeverityEnabled(severity) ?? false}
                      onChange={() => toggleSeverities(severity)}
                      disabled={!enabled}
                    />
                  }
                />
              ))}
            </Stack>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="body1">{__('Logs Types', 'bromate-security-api-firewall')}</Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <MultipleSelect<LogEvent>
                label={__('Select Logs Types', 'bromate-security-api-firewall')}
                disabled={!enabled}
                value={settings.logs_keep_events}
                options={LOGS_EVENTS_OPTIONS}
                onChange={handleEventsChange}
                name="logs-keep-events"
              />
            </Stack>
          </Stack>

        </Stack>
      </Stack>
    </Paper>
  );
}