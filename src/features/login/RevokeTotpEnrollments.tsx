import { useState, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { UserSessionsAPI } from '@services/user-sessions';

import {
  Stack,
  Typography,
  Button,
  Alert,
  Snackbar,
  Box,
  CircularProgress,
} from '@mui/material';

import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';

export default function RevokeTotpEnrollments(): JSX.Element {
  const { openDialog } = useDialog();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const handleRevokeAll = useCallback(async () => {
    setRevokingAll(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await UserSessionsAPI.revokeAllUsersTotpEnrollment();
      setSuccess(
        result.message ||
          __('All 2FA enrollments have been revoked.', 'bromate-security-api-firewall')
      );
    } catch (err) {
      setError(__('Failed to revoke 2FA enrollments.', 'bromate-security-api-firewall'));
    } finally {
      setRevokingAll(false);
    }
  }, []);

  const handleRevokeAllConfirm = useCallback(() => {
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Revoke all 2FA enrollments', 'bromate-security-api-firewall'),
      content: __(
        'Users will need to setup 2FA again on their next visit. Continue?',
        'bromate-security-api-firewall'
      ),
      confirmLabel: __('Revoke', 'bromate-security-api-firewall'),
      onConfirm: handleRevokeAll,
    });
  }, [openDialog, handleRevokeAll]);

  return (
    <>

      <Stack flexDirection="column" gap={2} maxWidth={400}>
        <Stack>
          <Typography variant="body1" >
            {__('Revoke all 2FA enrollments', 'bromate-security-api-firewall')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {__(
              'Ask users to enroll with a new 2FA token. You will need to enroll again too.',
              'bromate-security-api-firewall'
            )}
          </Typography>
        </Stack>
        <Box>
          <Button
            variant="outlined"
            color="error"
            disableElevation
            disabled={revokingAll}
            startIcon={revokingAll ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={handleRevokeAllConfirm}
          >
            {revokingAll
              ? __('Revoking...', 'bromate-security-api-firewall')
              : __('Revoke All', 'bromate-security-api-firewall')}
          </Button>
        </Box>
      </Stack>

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
