import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { UserSessionsAPI, SaltsRotationStatus } from '@services/user-sessions';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';

import {
  Paper,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  Button,
  Alert,
  Divider,
  MenuItem,
  CircularProgress,
  Snackbar
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
      setSuccess(
        __('Salt keys rotated. Every logged-in user, including you, has been signed out.', 'bromate-security-api-firewall')
      );
      await loadRotationStatus();
    } catch (err) {
      setError(__('Failed to rotate salt keys.', 'bromate-security-api-firewall'));
    } finally {
      setRotatingNow(false);
    }
  }, [loadRotationStatus, setError, setSuccess]);

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

            <Select
              MenuProps={{ container: portalContainer }}
              label={__('Recurrence', 'bromate-security-api-firewall')}
              size="small"
              value={recurrence}
              onChange={(e) => onChangeRecurrence(e.target.value as 'daily' | 'weekly' | 'monthly')}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="daily">{__('Every day', 'bromate-security-api-firewall')}</MenuItem>
              <MenuItem value="weekly">{__('Every week', 'bromate-security-api-firewall')}</MenuItem>
              <MenuItem value="monthly">{__('Every month', 'bromate-security-api-firewall')}</MenuItem>
            </Select>

            <TextField
              label={__('Rotation Time', 'bromate-security-api-firewall')}
              type="time"
              size="small"
              value={time}
              onChange={(e) => onChangeTime(e.target.value)}
              sx={{ minWidth: 150 }}
            />
          </Stack>

          <Alert severity="info" elevation={0}>
            {__('Rotation signs out every logged-in user.', 'bromate-security-api-firewall')}
          </Alert>

          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Stack>
              <Typography variant="caption" color="text.secondary">
                {__('Last rotation:', 'bromate-security-api-firewall')} {formatDateTime(rotationStatus?.last_rotation ?? null)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {__('Next rotation:', 'bromate-security-api-firewall')} {formatDateTime(rotationStatus?.next_rotation ?? null)}
              </Typography>
            </Stack>

            <Button
              size="small"
              variant="outlined"
              color="primary"
              disabled={rotatingNow}
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