import { useState, useEffect, useMemo, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import { Paper, CircularProgress } from '@mui/material';

import LogEventRow from '@features/logs/LogEventRow';
import { LogAPI } from '@services/logs';
import type {
  LogsSettings,
  LogSeverity,
  LogEvent,
  LogEventOption,
  LogsConfig,
  LogEventNotificationFlags,
} from '@app-types/logs';

const LOGS_SEVERITIES: LogSeverity[] = ['info', 'warning', 'error'];

const DEFAULT_NOTIFICATION_FLAGS: LogEventNotificationFlags = {
  send: false,
  instant: false,
  scheduled: false,
};

type Props = {
  settings: LogsSettings;
  onChange: <K extends keyof LogsSettings>(key: K, value: LogsSettings[K]) => void;
};

type GroupedEvents = {
  key: string;
  label: string;
  events: LogEventOption[];
};

export default function LogsOptions({ settings, onChange }: Props): JSX.Element {
  const [logsConfig, setLogsConfig] = useState<LogsConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const enabled = settings.logs_enabled ?? false;

  const loadConfig = useCallback(async () => {
    try {
      const config = await LogAPI.getConfig();
      setLogsConfig(config);
    } catch (err) {
      setLogsConfig(null);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const groupedEvents: GroupedEvents[] = useMemo(() => {
    if (!logsConfig) return [];

    const { groups, events } = logsConfig;

    return groups.map((group) => ({
      key: group.key,
      label: group.label,
      events: events
        .filter((e) => e.group === group.key)
        .map((event) => ({
          value: event.key,
          label: event.label,
          severity: event.severity,
          groupLabel: group.label,
        })),
    }));
  }, [logsConfig]);

  const severitiesKept = useMemo(() => {
    const kept = settings?.logs_keep_severities;
    return Array.isArray(kept) ? kept : [];
  }, [settings?.logs_keep_severities]);

  const eventsKept = useMemo(() => {
    const kept = settings?.logs_keep_events;
    return Array.isArray(kept) ? kept : [];
  }, [settings?.logs_keep_events]);

  const isSeverityEnabled = (severity: LogSeverity): boolean => {
    return severitiesKept.includes(severity);
  };

  const isEventEnabled = (eventKey: LogEvent): boolean => {
    return eventsKept.includes(eventKey);
  };

  const getNotificationFlags = (eventKey: LogEvent): LogEventNotificationFlags => {
    return settings.logs_event_notifications?.[eventKey] ?? DEFAULT_NOTIFICATION_FLAGS;
  };

  const toggleSeverities = (severity: LogSeverity) => {
    const isEnabled = severitiesKept.includes(severity);
    const newValue = isEnabled
      ? severitiesKept.filter((s) => s !== severity)
      : [...severitiesKept, severity];

    onChange('logs_keep_severities', newValue as LogSeverity[]);
  };

  const toggleEventEnabled = (eventKey: LogEvent) => {
    const isEnabled = eventsKept.includes(eventKey);
    const newValue = isEnabled
      ? eventsKept.filter((e) => e !== eventKey)
      : [...eventsKept, eventKey];

    onChange('logs_keep_events', newValue as LogEvent[]);
  };

  const toggleEventNotification = (
    eventKey: LogEvent,
    field: keyof LogEventNotificationFlags
  ) => {
    const current = getNotificationFlags(eventKey);
    const nextFlags: LogEventNotificationFlags = {
      ...current,
      [field]: !current[field],
    };

    if (field === 'send' && !nextFlags.send) {
      nextFlags.instant = false;
      nextFlags.scheduled = false;
    }

    onChange('logs_event_notifications', {
      ...settings.logs_event_notifications,
      [eventKey]: nextFlags,
    });
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
              disabled={!enabled}
              value={settings.logs_rotation_time}
              onChange={(e) => onChange('logs_rotation_time', Number(e.target.value))}
              sx={{ maxWidth: 100 }}
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
                      checked={isSeverityEnabled(severity)}
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

            {configLoading ? (
              <Stack sx={{ py: 1 }} alignItems="center">
                <CircularProgress size={24} />
              </Stack>
            ) : (
              <Stack spacing={2}>
                {groupedEvents.map((group) => (
                  <Stack key={group.key} spacing={0.5}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {group.label}
                    </Typography>
                    <Stack divider={<Divider flexItem />}>
                      {group.events.map((event) => {
                        const eventKey = event.value as LogEvent;
                        const severity = event.severity as LogSeverity;
                        const severityActive = isSeverityEnabled(severity);

                        return (
                          <LogEventRow
                            key={eventKey}
                            event={event}
                            enabled={isEventEnabled(eventKey)}
                            severityActive={severityActive}
                            notifications={getNotificationFlags(eventKey)}
                            onToggleEnabled={toggleEventEnabled}
                            onToggleNotification={toggleEventNotification}
                          />
                        );
                      })}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>

        </Stack>
      </Stack>
    </Paper>
  );
}