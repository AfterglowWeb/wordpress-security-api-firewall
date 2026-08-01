import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { UserSessionsAPI, SaltsRotationStatus } from '@services/user-sessions';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';

import {
  Paper,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  TextField,
  Select,
  Button,
  Alert,
  Divider,
  MenuItem,
  CircularProgress,
  Snackbar,
  useTheme
} from '@mui/material';
import { usePortalContainer } from '@contexts/PortalContainerContext';


interface SaltsRotationSectionProps {
  enabled: boolean;
  recurrence: 'daily' | 'weekly' | 'monthly';
  time: string;
  onChangeEnabled: (value: boolean) => void;
  onChangeRecurrence: (value: 'daily' | 'weekly' | 'monthly') => void;
  onChangeTime: (value: string) => void;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return __('Never', 'bromate-security-api-firewall');
  }
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function calculateNextRunPreview(recurrence: 'daily' | 'weekly' | 'monthly', time: string): Date | null {
  if (!time) return null;

  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();

  switch (recurrence) {
    case 'daily': {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0, 0);
    }
    case 'weekly': {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, hours, minutes, 0, 0);
    }
    case 'monthly': {
      const currentDay = now.getDate();
      const targetMonth = now.getMonth() + 1;
      const targetYear = now.getFullYear();

      const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(currentDay, lastDayOfTargetMonth);

      return new Date(targetYear, targetMonth, targetDay, hours, minutes, 0, 0);
    }
    default:
      return null;
  }
}

export default function SaltsRotationSection({
  enabled,
  recurrence,
  time,
  onChangeEnabled,
  onChangeRecurrence,
  onChangeTime
}: SaltsRotationSectionProps): JSX.Element {
  const { openDialog } = useDialog();

  const [rotationStatus, setRotationStatus] = useState<SaltsRotationStatus | null>(null);
  const [rotatingNow, setRotatingNow] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portalContainer = usePortalContainer();
  const theme = useTheme();

  const previewNextRun = useMemo((): Date | null => {
    if (!enabled || !time) return null;
    return calculateNextRunPreview(recurrence, time);
  }, [enabled, recurrence, time]);

  const showPreview = useMemo(() => {
    if (!previewNextRun) return false;
    if (!rotationStatus?.next_rotation) return true;

    const serverDate = new Date(rotationStatus.next_rotation.replace(' ', 'T'));
    const diffHours = Math.abs(previewNextRun.getTime() - serverDate.getTime()) / (1000 * 60 * 60);

    return diffHours > 12;
  }, [previewNextRun, rotationStatus?.next_rotation]);

  const loadRotationStatus = useCallback(async () => {
    try {
      const status = await UserSessionsAPI.getSaltsRotationStatus();
      setRotationStatus(status);
    } catch (err) {
      setRotationStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    loadRotationStatus();
  }, [loadRotationStatus, enabled]);

  const handleRotateSaltsNow = useCallback(async () => {
    setRotatingNow(true);
    setError('');
    setSuccess('');

    try {
      await UserSessionsAPI.rotateSaltsNow();

      loadRotationStatus().catch(() => {
        // Silent catch.
      });

      setSuccess(
        __('Salt keys rotated. You have been signed out. Reloading...', 'bromate-security-api-firewall')
      );

      setTimeout(() => {
        window.location.reload();
      }, 2500);

    } catch (err) {
      setError(__('Failed to rotate salt keys.', 'bromate-security-api-firewall'));
      setRotatingNow(false);
    }
  }, [loadRotationStatus]);

  const handleRotateSaltsConfirm = useCallback(() => {
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Rotate salt keys now', 'bromate-security-api-firewall'),
      content: __(
        'This immediately signs out every logged-in user on this site, including you. Continue?',
        'bromate-security-api-firewall'
      ),
      confirmLabel: __('Rotate now', 'bromate-security-api-firewall'),
      onConfirm: handleRotateSaltsNow,
    });
  }, [openDialog, handleRotateSaltsNow]);

  const handleRecurrenceChange = useCallback((value: 'daily' | 'weekly' | 'monthly') => {
    onChangeRecurrence(value);
  }, [onChangeRecurrence]);

  const handleTimeChange = useCallback((value: string) => {
    onChangeTime(value);
  }, [onChangeTime]);

  return (
    <>
    <Paper sx={{ p: 2 }} elevation={0}>
      <Stack flexDirection="column" gap={2} maxWidth={500}>

        <Stack flexDirection="row" gap={1} alignItems="center">
          <FormControlLabel
            label={__('Enable', 'bromate-security-api-firewall')}
            control={
              <Switch
                checked={enabled}
                onChange={(e) => onChangeEnabled(e.target.checked)}
              />
            }
            sx={{ mr: 0, '& .MuiTypography-root': { lineHeight: '2em' } }}
          />
          <Divider orientation="vertical" variant="middle" flexItem />
          <Stack>
            <Typography variant="h6">{__('Rotate Salt Keys', 'bromate-security-api-firewall')}</Typography>
            <Typography variant="caption" color="text.secondary">{__('The rotation will be triggered once after saving, this will log you out.', 'bromate-security-api-firewall')}</Typography>
          </Stack>
        </Stack>

        <Stack flexDirection="column" gap={1} sx={{ pl: 4 }}>

          <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">
            <FormControl size="small" disabled={!enabled} sx={{ minWidth: 150 }}>
              <InputLabel id="recurrence-label">{__('Recurrence', 'bromate-security-api-firewall')}</InputLabel>
              <Select
                labelId="recurrence-label"
                id="recurrence-select"
                MenuProps={{ container: portalContainer }}
                label={__('Recurrence', 'bromate-security-api-firewall')}
                value={recurrence || 'weekly'}
                onChange={(e) => handleRecurrenceChange(e.target.value as 'daily' | 'weekly' | 'monthly')}
              >
                <MenuItem value="daily">{__('Every day', 'bromate-security-api-firewall')}</MenuItem>
                <MenuItem value="weekly">{__('Every week', 'bromate-security-api-firewall')}</MenuItem>
                <MenuItem value="monthly">{__('Every month', 'bromate-security-api-firewall')}</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={__('Rotation Time', 'bromate-security-api-firewall')}
              type="time"
              size="small"
              value={time}
              disabled={!enabled}
              onChange={(e) => handleTimeChange(e.target.value)}
              sx={{ minWidth: 150 }}
            />
          </Stack>

          <Alert severity="info" elevation={0}>
            {__('Rotation signs out every logged-in user.', 'bromate-security-api-firewall')}
          </Alert>

          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
            
            <Stack spacing={1}>
              {rotationStatus?.last_rotation && (
                <Typography variant="caption" color="text.secondary" sx={{px:1.5, py:0.5, fontWeight: 500, border:'1px solid', borderColor: theme.palette.divider, borderRadius:'2px' }}>
                  {__('Last rotation:', 'bromate-security-api-firewall')} {formatDateTime(rotationStatus.last_rotation)}
                </Typography>
              )}
              {enabled && rotationStatus?.next_rotation && (
                <Typography variant="caption" color="text.secondary" sx={{px:1.5, py:0.5, fontWeight: 500, border:'1px solid', borderColor: theme.palette.divider, borderRadius:'2px' }}>
                  {__('Next rotation:', 'bromate-security-api-firewall')} {formatDateTime(rotationStatus.next_rotation)}
                </Typography>
              )}
              {enabled && showPreview && previewNextRun && (
                <Typography variant="caption" color="primary.main" sx={{px:1.5, py:0.5, fontWeight: 500, border:'1px solid', borderColor: 'primary.main', borderRadius:'2px' }}>
                  {__('After saving:', 'bromate-security-api-firewall')} {formatDateTime(previewNextRun.toISOString())}
                </Typography>
              )}
            </Stack>

            <Button
              size="small"
              variant="outlined"
              color="primary"
              disabled={rotatingNow || !enabled}
              startIcon={rotatingNow ? <CircularProgress size={16} /> : undefined}
              onClick={handleRotateSaltsConfirm}
            >
              {rotatingNow
                ? __('Rotating...', 'bromate-security-api-firewall')
                : __('Rotate now', 'bromate-security-api-firewall')}
            </Button>
          </Stack>

        </Stack>

      </Stack>
    </Paper>

    {/* Notifications */}
    <Snackbar
      open={!!success}
      autoHideDuration={4000}
      onClose={() => setSuccess(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={() => setSuccess(null)}
        severity="success"
        variant="filled"
      >
        {success}
      </Alert>
    </Snackbar>

    <Snackbar
      open={!!error}
      autoHideDuration={6000}
      onClose={() => setError(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={() => setError(null)}
        severity="error"
        variant="filled"
      >
        {error}
      </Alert>
    </Snackbar>
    </>
  );
}