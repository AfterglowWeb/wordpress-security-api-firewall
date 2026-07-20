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
  { value: 'ip_rate_limited', label: __('IP Rate Limited', 'bromate-security-api-firewall') },
  { value: 'ip_banned', label: __('IP Banned', 'bromate-security-api-firewall') },
  { value: 'ip_whitelisted_bypass', label: __('IP Whitelisted Bypass', 'bromate-security-api-firewall') },
  { value: 'ip_entry_created', label: __('IP Entry Created', 'bromate-security-api-firewall') },
  { value: 'ip_entry_deleted', label: __('IP Entry Deleted', 'bromate-security-api-firewall') },
  { value: 'expired_ip_entry_cleanup', label: __('Expired IP Entry Cleanup', 'bromate-security-api-firewall') },
  
  // Authentication Events
  { value: 'auth_success', label: __('Auth Success', 'bromate-security-api-firewall'), groupLabel: __('Authentication', 'bromate-security-api-firewall') },
  { value: 'auth_failed', label: __('Auth Failed', 'bromate-security-api-firewall') },
  { value: 'auth_revoked', label: __('Auth Revoked', 'bromate-security-api-firewall') },
  
  // Admin Events
  { value: 'admin_login_success', label: __('Admin Login Success', 'bromate-security-api-firewall'), groupLabel: __('Admin', 'bromate-security-api-firewall') },
  { value: 'admin_login_failed', label: __('Admin Login Failed', 'bromate-security-api-firewall') },
  { value: 'admin_login_rate_limited', label: __('Admin Login Rate Limited', 'bromate-security-api-firewall') },
  { value: 'admin_login_banned', label: __('Admin Login Banned', 'bromate-security-api-firewall') },
  
  // System Events
  { value: 'emergency_token_used', label: __('Emergency Token Used', 'bromate-security-api-firewall'), groupLabel: __('System', 'bromate-security-api-firewall') },
  { value: 'plugin_settings_changed', label: __('Plugin Settings Changed', 'bromate-security-api-firewall') },
  { value: 'unknown', label: __('Unknown Event', 'bromate-security-api-firewall') }
];

type Props = {
  settings: LogsSettings;
  onChange: <K extends keyof LogsSettings>(key: K, value: LogsSettings[K]) => void;
};

export default function LogsOptions({ settings, onChange }: Props): JSX.Element {
  const enabled = settings.logs_enabled ?? false;

  const toggleSeverities = (severity: LogSeverity) => {
    const current = settings.logs_keep_severities ?? [];
    onChange(
      'logs_keep_severities',
      current.includes(severity) ? current.filter((m) => m !== severity) : [...current, severity]
    );
  };

  // Now this handler is properly typed with LogEvent
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
            sx={{maxWidth:180}}
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
                      checked={settings.logs_keep_severities?.includes(severity) ?? false}
                      onChange={() => toggleSeverities(severity)}
                      disabled={!enabled}
                    />
                  }
                />
              ))}
            </Stack>
          </Stack>

          <Stack spacing={1} maxWidth={300}>
            <Typography variant="body1">{__('Logs Type', 'bromate-security-api-firewall')}</Typography>
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