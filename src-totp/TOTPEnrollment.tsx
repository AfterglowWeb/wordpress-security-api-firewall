import { useState, useEffect } from '@wordpress/element';
import { usePortalContainer } from '@totp-contexts/PortalContainerContext';

import { __, sprintf} from '@wordpress/i18n';
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
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';

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
  backup_codes?: string[];
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

export default function TOTPEnrollment({
  mode = 'dialog',
  open = false,
  onClose,
  username,
  issuer,
  sitename,
  onSetupComplete,
  initialStep = 0,
  policy = 'grace',
  gracePeriodDays = 7,
  remainingDays = null,
}: TOTPEnrollmentProps): JSX.Element | null {
  const [activeStep, setActiveStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [totpData, setTotpData] = useState<TOTPData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);

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

  const resetSetupState = () => {
    setActiveStep(0);
    setTotpData(null);
    setVerificationCode('');
    setShowBackupCodes(false);
    setBackupCodes(null);
    setError(null);
    setSuccess(null);
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await apiRequest<TwoFAStatus>('bromate_get_totp_status');
        setStatus(result);
        setIsEnabled(result.enabled);

        if (!result.enabled) {
          resetSetupState();
        }

        if (result.enabled && mode === 'verify') {
          setActiveStep(2);
        }

        if (mode === 'inline' && result.enabled) {
          setActiveStep(-1);
        }
      } catch (err) {
        console.error('Failed to check 2FA status', err);
      } finally {
        setStatusChecked(true);
      }
    };

    if (mode === 'inline' || open) {
      checkStatus();
    } else {
      setStatusChecked(true);
    }
  }, [mode, open]);

  useEffect(() => {
    if (!statusChecked) return;
    if (activeStep === 0 && !isEnabled && mode !== 'verify') {
      generateTOTPSecret();
    }
  }, [statusChecked, activeStep, isEnabled, mode]);

  const generateTOTPSecret = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<TOTPData>('bromate_generate_totp_secret', {
        issuer,
        account_name: username,
      });
      setTotpData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const action = mode === 'verify' ? 'bromate_verify_login_code' : 'bromate_verify_totp_enrollment';
      const result = await apiRequest<VerifyResult>(action, { code: verificationCode });

      if (!result.verified) {
        setError(result.message || 'Invalid verification code. Please try again.');
        return;
      }

      if (mode === 'verify') {
        setSuccess('Verified!');
        setTimeout(() => {
          onSetupComplete?.();
          onClose?.();
        }, 800);
        return;
      }

      // Enrollment successful
      setSuccess('2FA successfully enabled!');
      setIsEnabled(true);

      if (result.backup_codes) {
        setBackupCodes(result.backup_codes);
        setTotpData((prev) => (prev ? { ...prev, backup_codes: result.backup_codes } : null));
        setShowBackupCodes(true);
        
        const backupCodesRemaining = result?.backup_codes ? result.backup_codes.length : 0;
        setStatus((prev) => ({
          enabled: true,
          enabled_time: prev?.enabled_time || null,
          has_backup_codes: true,
          backup_codes_remaining: backupCodesRemaining,
        }));
      }

      // Show success confirm dialog
      const successMessage = (
        <Stack spacing={2}>
          <Typography variant="body1">
            {__('Your account is now protected with two-factor authentication.', 'bromate-security-api-firewall')}
          </Typography>
          
          {backupCodes && backupCodes.length > 0 && (
            <Alert severity="info">
              <Typography variant="subtitle2" gutterBottom>
                {__('Save your backup codes', 'bromate-security-api-firewall')}
              </Typography>
              <Typography variant="body2" gutterBottom>
                {__('These codes can be used to access your account if you lose your authenticator device. Store them securely.', 'bromate-security-api-firewall')}
              </Typography>
              <Box 
                sx={{ 
                  bgcolor: 'grey.50', 
                  p: 2, 
                  borderRadius: 1, 
                  my: 2,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  position: 'relative'
                }}
              >
                {backupCodes.map((code, index) => (
                  <div key={index}>{code}</div>
                ))}
                <Box sx={{ position: 'absolute', right: 6, top: 6, zIndex: 10 }}>
                  <CopyButton toCopy={backupCodes.join('\n')} sx={{ fontSize: '18px' }} />
                </Box>
              </Box>
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" align="center">
            {__('You can manage your 2FA settings anytime from your profile page.', 'bromate-security-api-firewall')}
          </Typography>
        </Stack>
      );

      showConfirm({
        title: __('Two-Factor Authentication Enabled!', 'bromate-security-api-firewall'),
        message: successMessage,
        confirmLabel: __('Done', 'bromate-security-api-firewall'),
        confirmColor: 'success',
        onConfirm: () => {
          onSetupComplete?.();
          if (mode === 'dialog') {
            onClose?.();
          }
        },
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable2FA = () => {
    showConfirm({
      title: __('Disable Two-Factor Authentication', 'bromate-security-api-firewall'),
      message: __('Are you sure you want to disable 2FA? This will remove all 2FA protection and make your account less secure.', 'bromate-security-api-firewall'),
      confirmLabel: __('Disable 2FA', 'bromate-security-api-firewall'),
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          await apiRequest('bromate_disable_totp');
          setSuccess('2FA disabled successfully');
          setIsEnabled(false);
          resetSetupState();
          
          setTimeout(() => {
            onSetupComplete?.();
            if (mode === 'dialog') onClose?.();
          }, 2000);
        } catch (err: any) {
          setError(err.message);
        }
      },
    });
  };

  const handleRegenerateBackupCodes = () => {
    showConfirm({
      title: __('Regenerate Backup Codes', 'bromate-security-api-firewall'),
      message: __('This will invalidate all existing backup codes and generate new ones. Make sure to save the new codes securely.', 'bromate-security-api-firewall'),
      confirmLabel: __('Regenerate', 'bromate-security-api-firewall'),
      confirmColor: 'primary',
      onConfirm: async () => {
        try {
          const result = await apiRequest<{ backup_codes: string[] }>('bromate_regenerate_backup_codes');
          setBackupCodes(result.backup_codes);
          
          setStatus((prev) => ({
            enabled: prev?.enabled || false,
            enabled_time: prev?.enabled_time || null,
            has_backup_codes: true,
            backup_codes_remaining: result.backup_codes.length,
          }));
          
          setSuccess('Backup codes regenerated successfully!');
          setShowBackupCodes(true);
        } catch (err: any) {
          setError(err.message);
        }
      },
    });
  };

  const handleStepChange = (step: number) => {
    if (step === 1 && totpData) {
      setActiveStep(step);
    }
  };

  const persistDismissal = async () => {
    if (policy === 'mandatory') {
      return;
    }
    try {
      await apiRequest('bromate_dismiss_totp_reminder');
    } catch (err) {
      console.error('Failed to persist 2FA reminder dismissal', err);
    }
  };

  const handleCloseDialog = () => {
    if (policy === 'mandatory') {
      return;
    }
    persistDismissal();
    onClose?.();
  };

  const handleCancelEnrollment = () => {
    if (policy === 'mandatory') {
      return;
    }

    let message = '';
    if (policy === 'grace' && remainingDays !== null) {
      message = sprintf(
        __('You can always enable 2FA later from your profile. You have %d days remaining to complete setup.', 'bromate-security-api-firewall'),
        remainingDays
      );
    } else if (policy === 'grace') {
      message = __('You can always enable 2FA later from your profile.', 'bromate-security-api-firewall');
    } else {
      message = __('You can always enable 2FA later from your profile.', 'bromate-security-api-firewall');
    }

    showConfirm({
      title: __('Reminder', 'bromate-security-api-firewall'),
      message: message,
      confirmLabel: __('OK, I understand', 'bromate-security-api-firewall'),
      confirmColor: 'primary',
      onConfirm: async () => {
        await persistDismissal();
        onClose?.();
      },
    });
  };

  const renderQRCode = () => {
    if (!totpData?.qr_code_svg) return null;
    return <div dangerouslySetInnerHTML={{ __html: totpData.qr_code_svg }} />;
  };

  const renderPolicyBanner = () => {
    if (policy === 'free') return null;

    let message = '';
    let severity: 'info' | 'warning' = 'info';

    if (policy === 'mandatory') {
      message = __('Two-factor authentication is now mandatory for your account. Please complete setup to continue.', 'bromate-security-api-firewall');
    } else if (policy === 'grace' && remainingDays !== null) {
      message = sprintf(
        __('Two-factor authentication is required. You have %d days remaining to complete setup.', 'bromate-security-api-firewall'),
        remainingDays
      );
      if (remainingDays <= 3) {
        severity = 'warning';
      }
    }

    return (
      <Alert severity={severity} icon={<InfoIcon />}>
        {message}
      </Alert>
    );
  };

  const renderSetupSteps = () => (
    <Stepper activeStep={activeStep} orientation="vertical">
      <Step>
        <StepLabel>
          {__('Scan QR Code', 'bromate-security-api-firewall')}
        </StepLabel>
        <StepContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              {__('Scan the QR code below with Google Authenticator, Authy, or any TOTP app.', 'bromate-security-api-firewall')}
            </Typography>

            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : totpData?.qr_code_svg ? (
              <Box display="flex" flexDirection="column" alignItems="center">
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'white', 
                    borderRadius: 1,
                    display: 'inline-block'
                  }}
                >
                  {renderQRCode()}
                </Box>
                
                <Box display="flex" flexDirection="column" alignItems="center" mt={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {__('Or enter this secret key manually:', 'bromate-security-api-firewall')}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip 
                      label={totpData.secret}
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <CopyButton toCopy={totpData.secret} />
                  </Box>
                </Box>

                <Box mt={2}>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={() => handleStepChange(1)}
                    disabled={!totpData}
                  >
                    {__('I\'ve scanned the code', 'bromate-security-api-firewall')}
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
        <StepLabel>
          {__('Verify TOTP Code', 'bromate-security-api-firewall')}
        </StepLabel>
        <StepContent>
          <Stack spacing={2} maxWidth={500} mx={'auto'}>
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
                  style: { textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.5em' }
                }
              }}
              fullWidth
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleVerifyCode();
                }
              }}
            />
            
            <Button
              variant="contained"
              onClick={handleVerifyCode}
              disableElevation
              disabled={verifying || verificationCode.length !== 6}
              fullWidth
            >
              {verifying ? <CircularProgress size={24} /> : __('Verify', 'bromate-security-api-firewall')}
            </Button>

            <Typography variant="caption" color="text.secondary" align="center">
              {__('Code expires every 30 seconds. If the code doesn\'t work, wait for the next one.', 'bromate-security-api-firewall')}
            </Typography>
          </Stack>
        </StepContent>
      </Step>
    </Stepper>
  );

  if (mode === 'inline') {
    return (
      <>
        <Stack spacing={3} py={4}>
          <Typography variant="subtitle1">
            {__('Two-Factor Authentication', 'bromate-security-api-firewall')}
          </Typography>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              {success}
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
                    <Chip color="success" label={__('Enabled', 'bromate-security-api-firewall')}/>
                  ) : totpData ? (
                    <Chip color="warning" label={__('Pending Setup', 'bromate-security-api-firewall')}/>
                  ) : (
                    <Chip color="default" label={__('Disabled', 'bromate-security-api-firewall')}/>
                  )}
                </TableCell>
              </TableRow>

              {isEnabled && status?.enabled_time && (
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                    {__('Enabled Since', 'bromate-security-api-firewall')}
                  </TableCell>
                  <TableCell>{status.enabled_time}</TableCell>
                </TableRow>
              )}

              {isEnabled && (
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                    {__('Backup Codes', 'bromate-security-api-firewall')}
                  </TableCell>
                  <TableCell>
                    {status?.has_backup_codes && status.backup_codes_remaining > 0 ? (
                      <span>
                        {status.backup_codes_remaining} {__('remaining', 'bromate-security-api-firewall')}
                      </span>
                    ) : (
                      <span style={{ color: '#dc3232' }}>{__('None available', 'bromate-security-api-firewall')}</span>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Actions */}
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {!isEnabled && !totpData && (
              <Button
                variant="contained"
                onClick={() => generateTOTPSecret()}
                disabled={loading}
                disableElevation
              >
                {loading ? <CircularProgress size={24} /> : __('Setup', 'bromate-security-api-firewall')}
              </Button>
            )}

            {!isEnabled && totpData && (
              <Stack flexDirection={"row"} gap={1} alignItems={"center"}>
                <Button
                  variant="outlined"
                  disableElevation
                  size="small"
                  disabled={activeStep <= 0}
                  onClick={() => {
                    setActiveStep(0);
                    setVerificationCode('');
                  }}
                  startIcon={<RefreshIcon />}
                >
                  {__('Reset Setup', 'bromate-security-api-firewall')}
                </Button>
              </Stack>
            )}

            {isEnabled && status?.has_backup_codes && status.backup_codes_remaining > 0 && (
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

          {/* Setup Flow (shown inline when setting up) */}
          {totpData && !isEnabled && (
            <Box mt={2}>
              <Typography variant="subtitle1" gutterBottom>
                {__('Setup Two-Factor Authentication', 'bromate-security-api-firewall')}
              </Typography>
              {renderSetupSteps()}
            </Box>
          )}

          {/* Show backup codes only if 2FA is enabled and backup codes exist */}
          {isEnabled && showBackupCodes && backupCodes && backupCodes.length > 0 && (
            <Box mt={2}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  {__('Save your backup codes.', 'bromate-security-api-firewall')}
                </Typography>
                <Box sx={{ position: 'relative', bgcolor: 'grey.50', p: 2, borderRadius: 1, my: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {backupCodes.map((code, index) => (
                    <div key={index}>{code}</div>
                  ))}
                  <Box sx={{ position: 'absolute', right: 6, top: 6, zIndex: 10 }}>
                    <CopyButton toCopy={backupCodes.join('\n')} sx={{ fontSize: '18px' }} />
                  </Box>
                </Box>
              </Alert>
            </Box>
          )}
        </Stack>
        <ConfirmDialog
          open={confirmDialogOpen}
          title={confirmDialogConfig?.title || ''}
          message={ confirmDialogConfig?.message || ''}
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
          <DialogTitle>
            {__('Two-Factor Authentication Required', 'bromate-security-api-firewall')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {renderPolicyBanner()}
              
              <Typography variant="body2">
                {__('Enter the 6-digit code from your authenticator app to continue.', 'bromate-security-api-firewall')}
              </Typography>
              
              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
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
                    style: { textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.5em' }
                  }
                }}
                fullWidth
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVerifyCode();
                  }
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
              disabled={verifying || verificationCode.length !== 6}
            >
              {verifying ? <CircularProgress size={24} /> : __('Verify', 'bromate-security-api-firewall')}
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
              <Typography variant="h6">
                {__('Set Up Two-Factor Authentication', 'bromate-security-api-firewall')}
              </Typography>
              {renderPolicyBanner()}
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  {success}
                </Alert>
              )}

              {renderSetupSteps()}

              {showBackupCodes && totpData?.backup_codes && (
                <Box mt={2}>
                  <Divider sx={{ my: 2 }} />
                  <Alert severity="info">
                    <Typography variant="subtitle2" gutterBottom>
                      {__('Save your backup codes!', 'bromate-security-api-firewall')}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      {__('These backup codes can be used to access your account if you lose your authenticator device. Store them securely.', 'bromate-security-api-firewall')}
                    </Typography>
                    <Box 
                      sx={{ 
                        bgcolor: 'grey.50', 
                        p: 2, 
                        borderRadius: 1, 
                        my: 2,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem'
                      }}
                    >
                      {totpData.backup_codes.map((code, index) => (
                        <div key={index}>{code}</div>
                      ))}
                    </Box>
                    <CopyButton toCopy={totpData.backup_codes.join('\n')} />
                  </Alert>
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
          message={ confirmDialogConfig?.message || ''}
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