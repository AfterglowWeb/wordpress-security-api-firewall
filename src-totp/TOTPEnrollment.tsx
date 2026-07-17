import { useReducer, useState, useEffect } from '@wordpress/element';
import { usePortalContainer } from '@totp-contexts/PortalContainerContext';

import { __, sprintf } from '@wordpress/i18n';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Alert,
  Box,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Divider,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { apiRequest } from '@totp-services/api';
import CopyButton from '@totp-components/CopyButton';
import ConfirmDialog from '@totp-components/ConfirmDialog';

interface TOTPEnrollmentProps {
  mode?: 'dialog' | 'inline' | 'verify';
  open?: boolean;
  onClose?: () => void;
  username: string;
  issuer: string;
  sitename: string;
  onSetupComplete?: () => void;
  initialStep?: number;
  policy: 'mandatory' | 'grace' | 'free';
  gracePeriodDays?: number;
  remainingDays?: number | null;
}

interface TOTPData {
  secret: string;
  otpauth_url: string;
  qr_code_svg: string;
  digits: number;
  period: number;
  algorithm: string;
  issuer: string;
  account_name: string;
}

interface TwoFAStatus {
  enabled: boolean;
  enabled_time: string | null;
  has_backup_codes: boolean;
  backup_codes_remaining: number;
}

interface VerifyResult {
  verified: boolean;
  backup_codes?: string[];
  message?: string;
}

type Phase = 'loading' | 'login-verify' | 'not-enrolled' | 'scan-qr' | 'enter-code' | 'enrolled';

interface State {
  phase: Phase;
  status: TwoFAStatus | null;
  totpData: TOTPData | null;
  generating: boolean;
  verifying: boolean;
  backupCodes: string[] | null;
  backupCodesOpen: boolean;
  error: string | null;
  success: string | null;
}

const initialState: State = {
  phase: 'loading',
  status: null,
  totpData: null,
  generating: false,
  verifying: false,
  backupCodes: null,
  backupCodesOpen: false,
  error: null,
  success: null,
};

type Action =
  | { type: 'STATUS_LOADED'; status: TwoFAStatus; isLoginVerify: boolean }
  | { type: 'STATUS_FAILED' }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; totpData: TOTPData }
  | { type: 'GENERATE_ERROR'; message: string }
  | { type: 'ADVANCE_TO_VERIFY' }
  | { type: 'RESET_SETUP' }
  | { type: 'VERIFY_START' }
  | { type: 'VERIFY_SUCCESS'; backupCodes?: string[] }
  | { type: 'VERIFY_ERROR'; message: string }
  | { type: 'DISABLE_SUCCESS' }
  | { type: 'REGENERATE_SUCCESS'; backupCodes: string[] }
  | { type: 'TOGGLE_BACKUP_CODES' }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'DISMISS_ERROR' }
  | { type: 'SET_SUCCESS'; message: string }
  | { type: 'DISMISS_SUCCESS' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'STATUS_LOADED': {
      const { status, isLoginVerify } = action;
      if (isLoginVerify && status.enabled) {
        return { ...state, phase: 'login-verify', status };
      }
      return {
        ...state,
        phase: status.enabled ? 'enrolled' : 'not-enrolled',
        status,
        totpData: null,
      };
    }

    case 'STATUS_FAILED':
      return { ...state, phase: 'not-enrolled' };

    case 'GENERATE_START':
      return { ...state, generating: true, error: null };

    case 'GENERATE_SUCCESS':
      return { ...state, generating: false, totpData: action.totpData, phase: 'scan-qr' };

    case 'GENERATE_ERROR':
      return { ...state, generating: false, error: action.message };

    case 'ADVANCE_TO_VERIFY':
      return state.totpData ? { ...state, phase: 'enter-code' } : state;

    case 'RESET_SETUP':
      return {
        ...state,
        phase: 'not-enrolled',
        totpData: null,
        backupCodes: null,
        backupCodesOpen: false,
        error: null,
        success: null,
      };

    case 'VERIFY_START':
      return { ...state, verifying: true, error: null };

    case 'VERIFY_SUCCESS': {
      const codes = action.backupCodes && action.backupCodes.length > 0 ? action.backupCodes : null;
      return {
        ...state,
        verifying: false,
        phase: 'enrolled',
        totpData: null,
        backupCodes: codes ?? state.backupCodes,
        backupCodesOpen: codes !== null,
        status: state.status
          ? {
              ...state.status,
              enabled: true,
              has_backup_codes: codes !== null ? true : state.status.has_backup_codes,
              backup_codes_remaining: codes?.length ?? state.status.backup_codes_remaining,
            }
          : state.status,
      };
    }

    case 'VERIFY_ERROR':
      return { ...state, verifying: false, error: action.message };

    case 'DISABLE_SUCCESS':
      return { ...initialState, phase: 'not-enrolled' };

    case 'REGENERATE_SUCCESS':
      return {
        ...state,
        backupCodes: action.backupCodes,
        backupCodesOpen: true,
        status: state.status
          ? { ...state.status, has_backup_codes: true, backup_codes_remaining: action.backupCodes.length }
          : state.status,
      };

    case 'TOGGLE_BACKUP_CODES':
      return { ...state, backupCodesOpen: !state.backupCodesOpen };

    case 'SET_ERROR':
      return { ...state, error: action.message };
    case 'DISMISS_ERROR':
      return { ...state, error: null };

    case 'SET_SUCCESS':
      return { ...state, success: action.message };
    case 'DISMISS_SUCCESS':
      return { ...state, success: null };

    default:
      return state;
  }
}

function BackupCodesAccordion({
  codes,
  open,
  onToggle,
}: {
  codes: string[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Accordion expanded={open} onChange={onToggle} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {__('Backup Codes', 'bromate-security-api-firewall')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Alert severity="info">
          <Typography variant="body2" gutterBottom>
            {__(
              'Save these backup codes somewhere safe. Each one can be used once if you lose access to your authenticator app.',
              'bromate-security-api-firewall'
            )}
          </Typography>
          <Box
            sx={{
              position: 'relative',
              bgcolor: 'grey.50',
              p: 2,
              borderRadius: 1,
              my: 2,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
          >
            {codes.map((code, index) => (
              <div key={index}>{code}</div>
            ))}
            <Box sx={{ position: 'absolute', right: 6, top: 6 }}>
              <CopyButton toCopy={codes.join('\n')} />
            </Box>
          </Box>
        </Alert>
      </AccordionDetails>
    </Accordion>
  );
}

export default function TOTPEnrollment({
  mode = 'dialog',
  open = false,
  onClose,
  username,
  issuer,
  sitename,
  onSetupComplete,
  policy = 'grace',
  gracePeriodDays = 7,
  remainingDays = null,
}: TOTPEnrollmentProps): JSX.Element | null {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [verificationCode, setVerificationCode] = useState('');

  const portalContainer = usePortalContainer();

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    title: string;
    message: string | JSX.Element;
    confirmLabel?: string;
    confirmColor?: 'primary' | 'error' | 'success';
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showConfirm = (config: typeof confirmDialogConfig) => {
    setConfirmDialogConfig(config);
    setConfirmDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmDialogConfig) return;
    setConfirmLoading(true);
    try {
      await confirmDialogConfig.onConfirm();
    } catch (error) {
      console.error('Error in confirm action:', error);
    } finally {
      setConfirmLoading(false);
      setConfirmDialogOpen(false);
      setConfirmDialogConfig(null);
    }
  };

  const handleConfirmCancel = () => {
    setConfirmDialogOpen(false);
    setConfirmDialogConfig(null);
    setConfirmLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiRequest<TwoFAStatus>('bromate_get_totp_status');
        if (cancelled) return;
        dispatch({ type: 'STATUS_LOADED', status: result, isLoginVerify: mode === 'verify' });
      } catch (err) {
        console.error('Failed to check 2FA status', err);
        if (!cancelled) dispatch({ type: 'STATUS_FAILED' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, open]);

  const generateTOTPSecret = async () => {
    dispatch({ type: 'GENERATE_START' });
    try {
      const result = await apiRequest<TOTPData>('bromate_generate_totp_secret', {
        issuer,
        account_name: username,
      });
      dispatch({ type: 'GENERATE_SUCCESS', totpData: result });
    } catch (err: any) {
      dispatch({ type: 'GENERATE_ERROR', message: err.message });
    }
  };

  useEffect(() => {
    if (state.phase === 'not-enrolled' && mode !== 'verify') {
      generateTOTPSecret();
    }
  }, [state.phase, mode]);

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      dispatch({
        type: 'SET_ERROR',
        message: __('Please enter a valid 6-digit verification code.', 'bromate-security-api-firewall'),
      });
      return;
    }

    dispatch({ type: 'VERIFY_START' });

    try {
      const action = mode === 'verify' ? 'bromate_verify_login_code' : 'bromate_verify_totp_enrollment';
      const result = await apiRequest<VerifyResult>(action, { code: verificationCode });

      if (!result.verified) {
        dispatch({
          type: 'VERIFY_ERROR',
          message: result.message || __('Invalid verification code. Please try again.', 'bromate-security-api-firewall'),
        });
        return;
      }

      dispatch({ type: 'VERIFY_SUCCESS', backupCodes: result.backup_codes });
      setVerificationCode('');
    } catch (err: any) {
      dispatch({ type: 'VERIFY_ERROR', message: err.message });
    }
  };

  const handleDisable2FA = () => {
    showConfirm({
      title: __('Disable Two-Factor Authentication', 'bromate-security-api-firewall'),
      message: __(
        'Are you sure you want to disable 2FA? This will remove all 2FA protection and make your account less secure.',
        'bromate-security-api-firewall'
      ),
      confirmLabel: __('Disable 2FA', 'bromate-security-api-firewall'),
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          await apiRequest('bromate_disable_totp');
          dispatch({ type: 'DISABLE_SUCCESS' });
          dispatch({ type: 'SET_SUCCESS', message: __('2FA disabled successfully', 'bromate-security-api-firewall') });
          setTimeout(() => {
            onSetupComplete?.();
            if (mode === 'dialog') onClose?.();
          }, 2000);
        } catch (err: any) {
          dispatch({ type: 'SET_ERROR', message: err.message });
        }
      },
    });
  };

  const handleRegenerateBackupCodes = () => {
    showConfirm({
      title: __('Regenerate Backup Codes', 'bromate-security-api-firewall'),
      message: __(
        'This will invalidate all existing backup codes and generate new ones. Make sure to save the new codes securely.',
        'bromate-security-api-firewall'
      ),
      confirmLabel: __('Regenerate', 'bromate-security-api-firewall'),
      confirmColor: 'primary',
      onConfirm: async () => {
        try {
          const result = await apiRequest<{ backup_codes: string[] }>('bromate_regenerate_backup_codes');
          dispatch({ type: 'REGENERATE_SUCCESS', backupCodes: result.backup_codes });
          dispatch({
            type: 'SET_SUCCESS',
            message: __('Backup codes regenerated successfully!', 'bromate-security-api-firewall'),
          });
        } catch (err: any) {
          dispatch({ type: 'SET_ERROR', message: err.message });
        }
      },
    });
  };

  const persistDismissal = async () => {
    if (policy === 'mandatory') return;
    try {
      await apiRequest('bromate_dismiss_totp_reminder');
    } catch (err) {
      console.error('Failed to persist 2FA reminder dismissal', err);
    }
  };

  const handleCloseDialog = () => {
    if (policy === 'mandatory') return;
    persistDismissal();
    onClose?.();
  };

  const handleCancelEnrollment = () => {
    if (policy === 'mandatory') return;

    let message = '';
    if (policy === 'grace' && remainingDays !== null) {
      message = sprintf(
        __('You can always enable 2FA later from your profile. You have %d days remaining to complete setup.', 'bromate-security-api-firewall'),
        remainingDays
      );
    } else {
      message = __('You can always enable 2FA later from your profile.', 'bromate-security-api-firewall');
    }

    showConfirm({
      title: __('Reminder', 'bromate-security-api-firewall'),
      message,
      confirmLabel: __('OK, I understand', 'bromate-security-api-firewall'),
      confirmColor: 'primary',
      onConfirm: async () => {
        await persistDismissal();
        onClose?.();
      },
    });
  };

  const renderQRCode = () => {
    if (!state.totpData?.qr_code_svg) return null;
    return <div dangerouslySetInnerHTML={{ __html: state.totpData.qr_code_svg }} />;
  };

  const renderPolicyBanner = () => {
    if (policy === 'free') return null;

    let message = '';
    let severity: 'info' | 'warning' = 'info';

    if (policy === 'mandatory') {
      message = __(
        'Two-factor authentication is now mandatory for your account. Please complete setup to continue.',
        'bromate-security-api-firewall'
      );
    } else if (policy === 'grace' && remainingDays !== null) {
      message = sprintf(
        __('Two-factor authentication is required. You have %d days remaining to complete setup.', 'bromate-security-api-firewall'),
        remainingDays
      );
      if (remainingDays <= 3) severity = 'warning';
    }

    return (
      <Alert severity={severity} icon={<InfoIcon />}>
        {message}
      </Alert>
    );
  };

  const activeStepIndex = state.phase === 'enter-code' ? 1 : 0;

  const renderSetupSteps = () => (
    <Stepper activeStep={activeStepIndex} orientation="vertical">
      <Step>
        <StepLabel>{__('Scan QR Code', 'bromate-security-api-firewall')}</StepLabel>
        <StepContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              {__('Scan the QR code below with Google Authenticator, Authy, or any TOTP app.', 'bromate-security-api-firewall')}
            </Typography>

            {state.generating ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : state.totpData?.qr_code_svg ? (
              <Box display="flex" flexDirection="column" alignItems="center">
                <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, display: 'inline-block' }}>
                  {renderQRCode()}
                </Box>

                <Box display="flex" flexDirection="column" alignItems="center" mt={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {__('Or enter this secret key manually:', 'bromate-security-api-firewall')}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={state.totpData.secret}
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <CopyButton toCopy={state.totpData.secret} />
                  </Box>
                </Box>

                <Box mt={2}>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={() => dispatch({ type: 'ADVANCE_TO_VERIFY' })}
                    disabled={!state.totpData}
                  >
                    {__("I've scanned the code", 'bromate-security-api-firewall')}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Button disableElevation onClick={generateTOTPSecret} variant="outlined">
                {__('Retry QR Generation', 'bromate-security-api-firewall')}
              </Button>
            )}
          </Stack>
        </StepContent>
      </Step>

      <Step>
        <StepLabel>{__('Verify TOTP Code', 'bromate-security-api-firewall')}</StepLabel>
        <StepContent>
          <Stack spacing={2} maxWidth={500} mx="auto">
            <Typography variant="body2">
              {__('Enter the 6-digit code from your authenticator app to verify setup.', 'bromate-security-api-firewall')}
            </Typography>

            <TextField
              label={__('Verification Code', 'bromate-security-api-firewall')}
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setVerificationCode(value.slice(0, 6));
              }}
              placeholder="123456"
              slotProps={{
                htmlInput: {
                  maxLength: 6,
                  pattern: '\\d{6}',
                  style: { textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.5em' },
                },
              }}
              fullWidth
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerifyCode();
              }}
            />

            <Button
              variant="contained"
              onClick={handleVerifyCode}
              disableElevation
              disabled={state.verifying || verificationCode.length !== 6}
              fullWidth
            >
              {state.verifying ? <CircularProgress size={24} /> : __('Verify', 'bromate-security-api-firewall')}
            </Button>

            <Typography variant="caption" color="text.secondary" align="center">
              {__("Code expires every 30 seconds. If the code doesn't work, wait for the next one.", 'bromate-security-api-firewall')}
            </Typography>
          </Stack>
        </StepContent>
      </Step>
    </Stepper>
  );

  if (mode === 'inline') {
    const isEnabled = state.phase === 'enrolled';
    const isSettingUp = state.phase === 'scan-qr' || state.phase === 'enter-code';

    return (
      <>
        <Stack spacing={3} py={4}>
          <Typography variant="subtitle1">
            {__('Two-Factor Authentication', 'bromate-security-api-firewall')}
          </Typography>

          {state.error && (
            <Alert severity="error" onClose={() => dispatch({ type: 'DISMISS_ERROR' })}>
              {state.error}
            </Alert>
          )}

          {state.success && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              {state.success}
            </Alert>
          )}

          <Table>
            <TableBody>
              <TableRow>
                <TableCell component="th" scope="row" sx={{ width: '30%', fontWeight: 'bold' }}>
                  {__('Status', 'bromate-security-api-firewall')}
                </TableCell>
                <TableCell>
                  {isEnabled ? (
                    <Chip color="success" label={__('Enabled', 'bromate-security-api-firewall')} />
                  ) : isSettingUp ? (
                    <Chip color="warning" label={__('Pending Setup', 'bromate-security-api-firewall')} />
                  ) : (
                    <Chip color="default" label={__('Disabled', 'bromate-security-api-firewall')} />
                  )}
                </TableCell>
              </TableRow>

              {isEnabled && state.status?.enabled_time && (
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                    {__('Enabled Since', 'bromate-security-api-firewall')}
                  </TableCell>
                  <TableCell>{state.status.enabled_time}</TableCell>
                </TableRow>
              )}

              {isEnabled && (
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                    {__('Backup Codes', 'bromate-security-api-firewall')}
                  </TableCell>
                  <TableCell>
                    {state.status?.has_backup_codes && state.status.backup_codes_remaining > 0 ? (
                      <span>
                        {state.status.backup_codes_remaining} {__('remaining', 'bromate-security-api-firewall')}
                      </span>
                    ) : (
                      <span style={{ color: '#dc3232' }}>{__('None available', 'bromate-security-api-firewall')}</span>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Stack direction="row" spacing={2} flexWrap="wrap">
            {!isEnabled && !isSettingUp && (
              <Button variant="contained" onClick={generateTOTPSecret} disabled={state.generating} disableElevation>
                {state.generating ? <CircularProgress size={24} /> : __('Setup', 'bromate-security-api-firewall')}
              </Button>
            )}

            {!isEnabled && isSettingUp && (
              <Button
                variant="outlined"
                disableElevation
                size="small"
                disabled={state.phase !== 'enter-code'}
                onClick={() => {
                  dispatch({ type: 'RESET_SETUP' });
                  setVerificationCode('');
                }}
                startIcon={<RefreshIcon />}
              >
                {__('Reset Setup', 'bromate-security-api-firewall')}
              </Button>
            )}

            {isEnabled && state.status?.has_backup_codes && state.status.backup_codes_remaining > 0 && (
              <Button
                variant="outlined"
                disableElevation
                size="small"
                onClick={handleRegenerateBackupCodes}
                startIcon={<RefreshIcon />}
              >
                {__('Regenerate Backup Codes', 'bromate-security-api-firewall')}
              </Button>
            )}

            {isEnabled && (
              <Button
                variant="outlined"
                size="small"
                disableElevation
                color="error"
                onClick={handleDisable2FA}
                startIcon={<CloseIcon />}
              >
                {__('Disable Two-Factor Authentication', 'bromate-security-api-firewall')}
              </Button>
            )}
          </Stack>

          {isSettingUp && (
            <Box mt={2}>
              <Typography variant="subtitle1" gutterBottom>
                {__('Setup Two-Factor Authentication', 'bromate-security-api-firewall')}
              </Typography>
              {renderSetupSteps()}
            </Box>
          )}

          {isEnabled && state.backupCodes && (
            <Box mt={2}>
              <BackupCodesAccordion
                codes={state.backupCodes}
                open={state.backupCodesOpen}
                onToggle={() => dispatch({ type: 'TOGGLE_BACKUP_CODES' })}
              />
            </Box>
          )}
        </Stack>
        <ConfirmDialog
          open={confirmDialogOpen}
          title={confirmDialogConfig?.title || ''}
          message={confirmDialogConfig?.message || ''}
          confirmLabel={confirmDialogConfig?.confirmLabel}
          confirmColor={confirmDialogConfig?.confirmColor || 'primary'}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onCancel={handleConfirmCancel}
          portalContainer={portalContainer}
        />
      </>
    );
  }

  if (mode === 'verify') {
    return (
      <>
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth container={portalContainer}>
          <DialogTitle>{__('Two-Factor Authentication Required', 'bromate-security-api-firewall')}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {renderPolicyBanner()}

              <Typography variant="body2">
                {__('Enter the 6-digit code from your authenticator app to continue.', 'bromate-security-api-firewall')}
              </Typography>

              {state.error && (
                <Alert severity="error" onClose={() => dispatch({ type: 'DISMISS_ERROR' })}>
                  {state.error}
                </Alert>
              )}

              <TextField
                label={__('Verification Code', 'bromate-security-api-firewall')}
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setVerificationCode(value.slice(0, 6));
                }}
                placeholder="123456"
                slotProps={{
                  htmlInput: {
                    maxLength: 6,
                    pattern: '\\d{6}',
                    style: { textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.5em' },
                  },
                }}
                fullWidth
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifyCode();
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disableElevation onClick={onClose}>
              {__('Cancel', 'bromate-security-api-firewall')}
            </Button>
            <Button
              variant="contained"
              onClick={handleVerifyCode}
              disableElevation
              disabled={state.verifying || verificationCode.length !== 6}
            >
              {state.verifying ? <CircularProgress size={24} /> : __('Verify', 'bromate-security-api-firewall')}
            </Button>
          </DialogActions>
        </Dialog>
        <ConfirmDialog
          open={confirmDialogOpen}
          title={confirmDialogConfig?.title || ''}
          message={confirmDialogConfig?.message || ''}
          confirmLabel={confirmDialogConfig?.confirmLabel}
          confirmColor={confirmDialogConfig?.confirmColor || 'primary'}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onCancel={handleConfirmCancel}
          portalContainer={portalContainer}
        />
      </>
    );
  }

  if (mode === 'dialog') {
    const canCancel = policy !== 'mandatory';

    return (
      <>
        <Dialog
          open={open}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          container={portalContainer}
          disableEscapeKeyDown={policy === 'mandatory'}
        >
          <DialogTitle>
            <Stack spacing={1}>
              <Typography variant="h6">{__('Set Up Two-Factor Authentication', 'bromate-security-api-firewall')}</Typography>
              {renderPolicyBanner()}
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {state.error && (
                <Alert severity="error" onClose={() => dispatch({ type: 'DISMISS_ERROR' })}>
                  {state.error}
                </Alert>
              )}

              {state.success && (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  {state.success}
                </Alert>
              )}

              {renderSetupSteps()}

              {state.backupCodes && (
                <Box mt={2}>
                  <Divider sx={{ my: 2 }} />
                  <BackupCodesAccordion
                    codes={state.backupCodes}
                    open={state.backupCodesOpen}
                    onToggle={() => dispatch({ type: 'TOGGLE_BACKUP_CODES' })}
                  />
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            {canCancel ? (
              <Button disableElevation onClick={handleCancelEnrollment}>
                {__('Cancel', 'bromate-security-api-firewall')}
              </Button>
            ) : null}
          </DialogActions>
        </Dialog>
        <ConfirmDialog
          open={confirmDialogOpen}
          title={confirmDialogConfig?.title || ''}
          message={confirmDialogConfig?.message || ''}
          confirmLabel={confirmDialogConfig?.confirmLabel}
          confirmColor={confirmDialogConfig?.confirmColor || 'primary'}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onCancel={handleConfirmCancel}
          portalContainer={portalContainer}
        />
      </>
    );
  }

  return null;
}