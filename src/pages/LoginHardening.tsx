import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { SettingsAPI } from '@services/settings';
import { UserSessionsAPI, SaltsRotationStatus } from '@services/user-sessions';
import { useNavigation } from '@contexts/NavigationContext';
import { usePortalContainer } from '@contexts/PortalContainerContext';

import {
  Paper,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  Snackbar,
  Box,
  FormControl,
  RadioGroup,
  Radio,
  Divider,
  MenuItem,
  CircularProgress,
  Skeleton
} from '@mui/material';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import ConfirmDialog from '@components/ConfirmDialog';
import SaveButton from '@components/SaveButton';

interface LoginSettings {
  login_rate_limit_enabled: boolean;
  login_rate_limit_attempts: number;
  login_rate_limit_window: number;
  login_rate_limit_blacklist_time: number;
  login_rate_limit_promote_after: number;

  login_recaptcha_enabled: boolean;
  login_recaptcha_site_key: string;
  login_recaptcha_secret_key: string;
  login_recaptcha_threshold: number;

  login_totp_enabled: boolean;
  login_totp_issuer: string;
  login_totp_policy: 'grace' | 'mandatory' | 'free';
  login_totp_grace_period: number;

  cookie_hardening_samesite_enabled: boolean;
  cookie_hardening_samesite_mode: 'Strict' | 'Lax';
  cookie_hardening_max_concurrent_sessions: number;

  salts_rotation_enabled: boolean;
  salts_rotation_recurrence: 'day' | 'week' | 'month';
  salts_rotation_time: string;

}

const DEFAULT_SETTINGS: LoginSettings = {
  login_rate_limit_enabled: false,
  login_rate_limit_attempts: 5,
  login_rate_limit_window: 300,
  login_rate_limit_blacklist_time: 3600,
  login_rate_limit_promote_after: 3,

  login_recaptcha_enabled: false,
  login_recaptcha_site_key: '',
  login_recaptcha_secret_key: '',
  login_recaptcha_threshold: 0.5,

  login_totp_enabled: false,
  login_totp_issuer: 'Bromate REST API',
  login_totp_policy: 'grace',
  login_totp_grace_period: 7,

  cookie_hardening_samesite_enabled: false,
  cookie_hardening_samesite_mode: 'Strict',

  salts_rotation_enabled: false,
  salts_rotation_recurrence: 'week',
  salts_rotation_time: '03:00',

  cookie_hardening_max_concurrent_sessions: 0,
};

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

export default function LoginHardening(): JSX.Element {
  const { openDialog } = useDialog();
  const { navigateGuarded } = useNavigation();
  const portalContainer = usePortalContainer();
  
  const [settings, setSettings] = useState<LoginSettings>(DEFAULT_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState<LoginSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rotationStatus, setRotationStatus] = useState<SaltsRotationStatus | null>(null);
  const [rotatingNow, setRotatingNow] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
    [settings, loadedSettings]
  );

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await SettingsAPI.readOptions();
        const loadedSettings = { ...DEFAULT_SETTINGS };
        Object.keys(loadedSettings).forEach((key) => {
          if (key in response) {
            (loadedSettings as any)[key] = response[key];
          }
        });
        setSettings(loadedSettings);
        setLoadedSettings(loadedSettings);

        setError(null);
      } catch (err) {
        setError(__('Failed to load login settings.', 'bromate-security-api-firewall'));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const loadRotationStatus = useCallback(async () => {
    try {
      const status = await UserSessionsAPI.getSaltsRotationStatus();
      setRotationStatus(status);
    } catch (err) {
      setRotationStatus(null);
    }
  }, []);

  useEffect(() => {
    if(! settings.salts_rotation_enabled) {
      return;
    }
    loadRotationStatus();
  }, [loadRotationStatus, settings]);

  const updateSetting = <K extends keyof LoginSettings>(
    key: K,
    value: LoginSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
      await SettingsAPI.updateOptions(settings);
      setLoadedSettings(settings);
  }, [settings]);

  const handleRotateSaltsNow = useCallback(async () => {
    setRotatingNow(true);
    setError(null);
    setSuccess(null);

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

  const handleRevokeAll = useCallback(async () => {
    setRevokingAll(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await UserSessionsAPI.revokeAllTrustedDevices();
      setSuccess(
        result.message ||
          __('All sessions and trusted 2FA devices have been revoked.', 'bromate-security-api-firewall')
      );
    } catch (err) {
      setError(__('Failed to revoke sessions and trusted devices.', 'bromate-security-api-firewall'));
    } finally {
      setRevokingAll(false);
    }
  }, []);

  const handleRevokeAllConfirm = useCallback(() => {
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Revoke all sessions & trusted devices', 'bromate-security-api-firewall'),
      content: __(
        'This signs out every user on this site and clears every "remember this device" 2FA token. Users will need to log in (and pass 2FA again) on their next visit. Continue?',
        'bromate-security-api-firewall'
      ),
      confirmLabel: __('Revoke everything', 'bromate-security-api-firewall'),
      onConfirm: handleRevokeAll,
    });
  }, [openDialog, handleRevokeAll]);

  if (loading) {
		return (
			<Stack spacing={3}>
				<Stack flexDirection={"row"} justifyContent={"flex-end"}>
				  <Skeleton variant="rounded" width={65} height={35} />
        </Stack>
				<Skeleton variant="rounded" width={'100%'} height={120} />
				<Skeleton variant="rectangular" width={'100%'} height={200} />
				<Skeleton variant="rectangular" width={'100%'} height={600} />
			</Stack>
		);
	}

  return (
    <Stack spacing={3} p={0}>

      <Stack direction="row" justifyContent="flex-end">
      <SaveButton
        onSave={handleSave}
        disabled={!isDirty}
        messages={{
          confirmTitle: __('Save login hardening settings', 'bromate-security-api-firewall'),
          confirmContent: __('Apply these login hardening changes now?', 'bromate-security-api-firewall'),
          confirmLabel: __('Save', 'bromate-security-api-firewall'),
          successMessage: __('Login hardening settings saved successfully.', 'bromate-security-api-firewall'),
          errorMessage: __('Failed to save login hardening settings.', 'bromate-security-api-firewall'),
          saveLabel: __('Save', 'bromate-security-api-firewall'),
          savingLabel: __('Saving…', 'bromate-security-api-firewall'),
        }}
        />
      </Stack>

      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2}>

          <Stack flexDirection="row" gap={1} alignItems="center">
            <FormControlLabel
              label={__('Enable', 'bromate-security-api-firewall')}
              control={
                <Switch
                checked={settings.login_rate_limit_enabled}
                  onChange={(e) =>
                  updateSetting('login_rate_limit_enabled', e.target.checked)
                  }
                />
              }
              sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
            />
            <Divider orientation="vertical" variant="middle" flexItem />
            <Typography variant="h6">{__('Login Rate Limiting', 'bromate-security-api-firewall')}</Typography>
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">
            <TextField
              label={__('Max Attempts', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.login_rate_limit_attempts}
              onChange={(e) =>
                updateSetting('login_rate_limit_attempts', Number(e.target.value))
              }
              helperText={__('Number of failed attempts before blocking', 'bromate-security-api-firewall')}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label={__('Time Window (seconds)', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.login_rate_limit_window}
              onChange={(e) =>
                updateSetting('login_rate_limit_window', Number(e.target.value))
              }
              helperText={__('Time window for counting attempts', 'bromate-security-api-firewall')}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label={__('Block Duration (seconds)', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.login_rate_limit_blacklist_time}
              onChange={(e) =>
                updateSetting('login_rate_limit_blacklist_time', Number(e.target.value))
              }
              helperText={__('How long to block the IP', 'bromate-security-api-firewall')}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label={__('Promote After (blocks)', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.login_rate_limit_promote_after}
              onChange={(e) =>
                updateSetting('login_rate_limit_promote_after', Number(e.target.value))
              }
              helperText={__('0 = never promote to global blacklist', 'bromate-security-api-firewall')}
              sx={{ minWidth: 150 }}
            />
          </Stack>

          {settings.login_rate_limit_enabled && (
            <Box>
              <Button
                size="small"
                disableElevation
                variant="contained"
                onClick={() => navigateGuarded('firewall', { entry_origin: 'login_rate_limit' })}
                endIcon={<KeyboardArrowRightIcon fontSize="inherit" />}
              >
              {__('View blocked login IPs', 'bromate-security-api-firewall')}
              </Button>
            </Box>
          )}

        </Stack>

      </Paper>

      {/* reCAPTCHA Section */}
      <Paper sx={{ p: 2 }} elevation={0}>
          <Stack flexDirection="column" gap={2}>
            <Stack flexDirection="row" gap={1} alignItems="center">
              <FormControlLabel
                label={__('Enable', 'bromate-security-api-firewall')}
                control={
                  <Switch
                    checked={settings.login_recaptcha_enabled}
                    onChange={(e) =>
                      updateSetting('login_recaptcha_enabled', e.target.checked)
                    }
                  />
                }
                sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
              />
              <Divider orientation="vertical" variant="middle" flexItem />
              <Typography variant="h6">{__('reCAPTCHA v3', 'bromate-security-api-firewall')}</Typography>
            </Stack>
            <TextField
              label={__('Site Key', 'bromate-security-api-firewall')}
              size="small"
              value={settings.login_recaptcha_site_key}
              onChange={(e) =>
                updateSetting('login_recaptcha_site_key', e.target.value)
              }
              helperText={__('reCAPTCHA v3 site key', 'bromate-security-api-firewall')}
            />
            <TextField
              label={__('Secret Key', 'bromate-security-api-firewall')}
              size="small"
              type="password"
              value={settings.login_recaptcha_secret_key}
              onChange={(e) =>
                updateSetting('login_recaptcha_secret_key', e.target.value)
              }
              helperText={__('reCAPTCHA v3 secret key', 'bromate-security-api-firewall')}
            />
            <TextField
              label={__('Minimum score', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              slotProps={{ htmlInput:{min: 0, max: 1, step: 0.1} }}
              value={settings.login_recaptcha_threshold}
              onChange={(e) =>
                updateSetting('login_recaptcha_threshold', Number(e.target.value))
              }
              sx={{ maxWidth: 200 }}
            />
          </Stack>
      </Paper>

      {/* TOTP Section */}
      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2}>

           <Stack flexDirection="row" gap={1} alignItems="center">
            <FormControlLabel
              label={__('Enable', 'bromate-security-api-firewall')}
              control={
                <Switch
                checked={settings.login_totp_enabled}
                  onChange={(e) =>
                  updateSetting('login_totp_enabled', e.target.checked)
                  }
                />
              }
              sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
            />
            <Divider orientation="vertical" variant="middle" flexItem />
            <Typography variant="h6">{__('Two-Factor Authentication', 'bromate-security-api-firewall')}</Typography>
          </Stack>

          <Stack spacing={2}>
            <TextField
              label={__('Issuer Name', 'bromate-security-api-firewall')}
              size="small"
              value={settings.login_totp_issuer}
              onChange={(e) =>
                updateSetting('login_totp_issuer', e.target.value)
              }
              sx={{ maxWidth: 400 }}
              helperText={__('Name shown in your authentication app', 'bromate-security-api-firewall')}
            />
          </Stack>

          <FormControl component="fieldset">
            <Typography variant="subtitle1" gutterBottom>
              {__('Enforcement Policy', 'bromate-security-api-firewall')}
            </Typography>
            <RadioGroup
              value={settings.login_totp_policy || 'grace'}
              onChange={(e) =>
                updateSetting('login_totp_policy', e.target.value as 'grace' | 'mandatory' | 'free')
              }
            >
              <FormControlLabel
                value="free"
                control={<Radio />}
                label={
                  <Stack>
                    <Typography>
                      {__('Free', 'bromate-security-api-firewall')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {__('Users can optionally enable 2FA from their profile.', 'bromate-security-api-firewall')}
                    </Typography>
                  </Stack>
                }
              />
              <FormControlLabel
                value="grace"
                control={<Radio />}
                label={
                  <Stack>
                    <Typography>
                      {__('Grace Period', 'bromate-security-api-firewall')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {__('Users have a grace period to enable 2FA before it becomes mandatory.', 'bromate-security-api-firewall')}
                    </Typography>
                  </Stack>
                }
              />
                <Box sx={{ pl: 4, pt: 1 }}>
                  <TextField
                    label={__('Grace Period (days)', 'bromate-security-api-firewall')}
                    type="number"
                    size="small"
                    value={settings.login_totp_grace_period || 7}
                    onChange={(e) =>
                      updateSetting('login_totp_grace_period', Number(e.target.value))
                    }
                    slotProps={{ htmlInput: { min: 1, max: 30 } }}
                    helperText={__('Number of days before 2FA becomes mandatory', 'bromate-security-api-firewall')}
                    sx={{ maxWidth: 200 }}
                  />
                </Box>

              <FormControlLabel
                value="mandatory"
                control={<Radio />}
                label={
                  <Stack>
                    <Typography>
                      {__('Mandatory', 'bromate-security-api-firewall')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {__('All users must enable 2FA. The 2FA enrollement dialog cannot be cancelled.', 'bromate-security-api-firewall')}
                    </Typography>
                  </Stack>
                }
              />
            </RadioGroup>
          </FormControl>

        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack gap={1}>
            
            <FormControlLabel
              label={
                <Stack direction="column" alignItems="center" gap={1}>
                  <Typography>{__('Protect Session Cookie', 'bromate-security-api-firewall')}</Typography>
                </Stack>
              }
              control={
                <Switch
                  checked={settings.cookie_hardening_samesite_enabled}
                  onChange={(e) =>
                    updateSetting('cookie_hardening_samesite_enabled', e.target.checked)
                  }
                />
              }
            />
            
              <Box sx={{ pl: 4 }}>
                <FormControl 
                disabled={!settings.cookie_hardening_samesite_enabled}
                component="fieldset">
                  <RadioGroup
                    row
                    value={settings.cookie_hardening_samesite_mode}
                    onChange={(e) =>
                      updateSetting(
                        'cookie_hardening_samesite_mode',
                        e.target.value as 'Strict' | 'Lax'
                      )
                    }
                  >
                    <FormControlLabel value="Strict" control={<Radio size="small" />} label={__('Strict', 'bromate-security-api-firewall')} />
                    <FormControlLabel value="Lax" control={<Radio size="small" />} label={__('Lax', 'bromate-security-api-firewall')} />
                  </RadioGroup>
                </FormControl>
                
                <Stack gap={1} >
                    <TextField
                      label={__('Limit Sessions Per User', 'bromate-security-api-firewall')}
                      type="number"
                      size="small"
                      value={settings.cookie_hardening_max_concurrent_sessions}
                      onChange={(e) =>
                        updateSetting('cookie_hardening_max_concurrent_sessions', Number(e.target.value))
                      }
                      helperText={__('0 = unlimited. Oldest session is closed automatically beyond this number.', 'bromate-security-api-firewall')}
                      slotProps={{ htmlInput: { min: 0 } }}
                      sx={{ maxWidth: 250 }}
                    />
                  </Stack>
              </Box>
     
          </Stack>
      </Paper>
      {/* Cookie & Session Protection Section */}
      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2} maxWidth={500}>
          
          {/* SameSite */}
          

          {/* Salt Rotation */}
          <Stack gap={1}>
              <FormControlLabel
                label={
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography>{__('Rotate Salt Keys', 'bromate-security-api-firewall')}</Typography>
                  </Stack>
                }
                control={
                  <Switch
                    checked={settings.salts_rotation_enabled}
                    onChange={(e) =>
                      updateSetting('salts_rotation_enabled', e.target.checked)
                    }
                  />
                }
              />

              <Stack flexDirection={"column"} gap={1} sx={{ pl: 4 }}>
                
                <Typography variant="body2" color="text.secondary">
                  {__(
                    'The rotation will be triggered once after saving, this will log you out.',
                    'bromate-security-api-firewall'
                  )}
                </Typography>

                <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">
                  <TextField
                    select
                    slotProps={{select:{MenuProps:{container:portalContainer}}}}
                    label={__('Recurrence', 'bromate-security-api-firewall')}
                    size="small"
                    value={settings.salts_rotation_recurrence}
                    onChange={(e) =>
                      updateSetting(
                        'salts_rotation_recurrence',
                        e.target.value as 'day' | 'week' | 'month'
                      )
                    }
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value="day">{__('Every day', 'bromate-security-api-firewall')}</MenuItem>
                    <MenuItem value="week">{__('Every week', 'bromate-security-api-firewall')}</MenuItem>
                    <MenuItem value="month">{__('Every month', 'bromate-security-api-firewall')}</MenuItem>
                  </TextField>

                  <TextField
                    label={__('Rotation Time', 'bromate-security-api-firewall')}
                    type="time"
                    size="small"
                    value={settings.salts_rotation_time}
                    onChange={(e) =>
                      updateSetting('salts_rotation_time', e.target.value)
                    }
                    sx={{ minWidth: 150 }}
                  />
                </Stack>

                <Alert severity="info" elevation={0}>
                  {__(
                    'Rotation signs out every logged-in user.',
                    'bromate-security-api-firewall'
                  )}
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

        

          
        </Stack>
      </Paper>

      {/* Global revoke */}
      <Paper sx={{p:2}} elevation={0}>
        <Stack flexDirection="column" gap={2} maxWidth={500}>
          <Stack>
            <Typography variant="h6" fontWeight={600}>
              {__('Emergency Action', 'bromate-security-api-firewall')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {__(
                'Immediately signs out every user on this site and clears every "remember this device" 2FA token. Use this if you suspect an account compromise.',
                'bromate-security-api-firewall'
              )}
            </Typography>
          </Stack>
          <Box>
            <Button
              variant="contained"
              color="error"
              disableElevation
              disabled={revokingAll}
              startIcon={revokingAll ? <CircularProgress size={16} color="inherit" /> : undefined}
              onClick={handleRevokeAllConfirm}
            >
              {revokingAll
                ? __('Revoking...', 'bromate-security-api-firewall')
                : __('Revoke all sessions', 'bromate-security-api-firewall')}
            </Button>
          </Box>
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

      <ConfirmDialog />
    </Stack>
  );
}
