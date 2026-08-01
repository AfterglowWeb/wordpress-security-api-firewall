import { __ } from '@wordpress/i18n';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import type { LogEvent, LogEventOption, LogEventNotificationFlags } from '@app-types/logs';

type LogEventRowProps = {
  event: LogEventOption;
  enabled: boolean;
  severityActive: boolean;
  notifications: LogEventNotificationFlags;
  onToggleEnabled: (key: LogEvent) => void;
  onToggleNotification: (key: LogEvent, field: keyof LogEventNotificationFlags) => void;
};

export default function LogEventRow({
  event, enabled, severityActive, notifications, onToggleEnabled, onToggleNotification
}: LogEventRowProps) {
  const rowActive = enabled && severityActive;

  return (
    <Stack direction="row" alignItems="center" gap={1.5} sx={{ opacity: severityActive ? 1 : 0.5, py: 0.5 }}>
      
       <FormControlLabel
        control={<Switch
          size="small"
          checked={enabled}
          disabled={!severityActive}
          onChange={() => onToggleEnabled(event.value as LogEvent)}
          />
        }
        label={event.label}
        sx={{ flexGrow: 1, '& .MuiFormControlLabel-label':{fontSize:'13px'}, gap:1 }}
       />

      <Chip label={event.severity} color={event.severity} variant="outlined" size="small" />

      <Divider orientation="vertical" flexItem />

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={notifications.send}
            disabled={!rowActive}
            onChange={() => onToggleNotification(event.value as LogEvent, 'send')}
          />
        }
        sx={{ '& .MuiFormControlLabel-label':{fontSize:'13px'} }}
        label={__('Notify', 'bromate-security-api-firewall')}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={notifications.instant}
            disabled={!rowActive || !notifications.send}
            onChange={() => onToggleNotification(event.value as LogEvent, 'instant')}
          />
        }
        sx={{ '& .MuiFormControlLabel-label':{fontSize:'13px'} }}
        label={__('Instant', 'bromate-security-api-firewall')}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={notifications.scheduled}
            disabled={!rowActive || !notifications.send}
            onChange={() => onToggleNotification(event.value as LogEvent, 'scheduled')}
          />
        }
        sx={{ '& .MuiFormControlLabel-label':{fontSize:'13px'} }}
        label={__('Digest', 'bromate-security-api-firewall')}
      />
    </Stack>
  );
}