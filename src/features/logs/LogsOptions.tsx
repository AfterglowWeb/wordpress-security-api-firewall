import { useState, useEffect, useMemo, useCallback, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Chip from '@mui/material/Chip';
import { Paper, CircularProgress } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const hasInitializedExpansion = useRef(false);
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

  useEffect(() => {
    if (groupedEvents.length > 0 && !hasInitializedExpansion.current) {
      hasInitializedExpansion.current = true;
      setExpandedGroups(new Set([groupedEvents[0].key]));
    }
  }, [groupedEvents]);

  const severitiesKept = useMemo(() => {
    const kept = settings?.logs_keep_severities;
    return Array.isArray(kept) ? kept : [];
  }, [settings?.logs_keep_severities]);

  const eventsKept = useMemo(() => {
    const kept = settings?.logs_keep_events;
    return Array.isArray(kept) ? kept : [];
  }, [settings?.logs_keep_events]);

  const eventsKeptSet = useMemo(() => new Set(eventsKept), [eventsKept]);
  const severitiesKeptSet = useMemo(() => new Set(severitiesKept), [severitiesKept]);

  const groupActiveCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of groupedEvents) {
      let count = 0;
      for (const event of group.events) {
        const eventKey = event.value as LogEvent;
        const severity = event.severity as LogSeverity;
        if (eventsKeptSet.has(eventKey) && severitiesKeptSet.has(severity)) {
          count += 1;
        }
      }
      counts.set(group.key, count);
    }
    return counts;
  }, [groupedEvents, eventsKeptSet, severitiesKeptSet]);

  const isSeverityEnabled = (severity: LogSeverity): boolean => {
    return severitiesKeptSet.has(severity);
  };

  const isEventEnabled = (eventKey: LogEvent): boolean => {
    return eventsKeptSet.has(eventKey);
  };

  const getNotificationFlags = (eventKey: LogEvent): LogEventNotificationFlags => {
    return settings.logs_event_notifications?.[eventKey] ?? DEFAULT_NOTIFICATION_FLAGS;
  };

  const toggleSeverities = (severity: LogSeverity) => {
    const isEnabled = severitiesKeptSet.has(severity);
    const newSeverities = isEnabled
      ? severitiesKept.filter((s) => s !== severity)
      : [...severitiesKept, severity];

    onChange('logs_keep_severities', newSeverities as LogSeverity[]);

    if (!logsConfig) return;

    const eventsOfSeverity = logsConfig.events
      .filter((e) => e.severity === severity)
      .map((e) => e.key);

    const newEvents = isEnabled
      ? eventsKept.filter((e) => !eventsOfSeverity.includes(e))
      : Array.from(new Set([...eventsKept, ...eventsOfSeverity]));

    onChange('logs_keep_events', newEvents as LogEvent[]);
  };

  const toggleEventEnabled = (eventKey: LogEvent) => {
    const isEnabled = eventsKeptSet.has(eventKey);
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

  const handleAccordionChange = (groupKey: string) => (_: unknown, isExpanded: boolean) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (isExpanded) {
        next.add(groupKey);
      } else {
        next.delete(groupKey);
      }
      return next;
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
              <Stack spacing={1}>
                {groupedEvents.map((group) => {
                  const activeCount = groupActiveCounts.get(group.key) ?? 0;
                  const totalCount = group.events.length;

                  return (
                    <Accordion
                      key={group.key}
                      expanded={expandedGroups.has(group.key)}
                      onChange={handleAccordionChange(group.key)}
                      disableGutters
                      elevation={0}
                      disabled={!enabled}
                      sx={{
                        '&:before': { display: 'none' },
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                        <Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%', pr: 1 }}>
                          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                            {group.label}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${activeCount}/${totalCount}`}
                            color={activeCount > 0 ? 'primary' : 'default'}
                            variant={activeCount > 0 ? 'filled' : 'outlined'}
                          />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <Stack divider={<Divider flexItem />}>
                          {group.events.map((event) => {
                            const eventKey = event.value as LogEvent;
                            const severity = event.severity as LogSeverity;

                            return (
                              <LogEventRow
                                key={eventKey}
                                event={event}
                                enabled={isEventEnabled(eventKey)}
                                severityActive={isSeverityEnabled(severity)}
                                notifications={getNotificationFlags(eventKey)}
                                onToggleEnabled={toggleEventEnabled}
                                onToggleNotification={toggleEventNotification}
                              />
                            );
                          })}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Stack>
            )}
          </Stack>

        </Stack>
      </Stack>
    </Paper>
  );
}