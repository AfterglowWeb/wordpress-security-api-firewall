import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { SettingsAPI } from '@services/settings';
import { useNavigation } from '@contexts/NavigationContext';

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
  Skeleton
} from '@mui/material';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import SaveButton from '@components/SaveButton';
import SaltsRotationSection from '@features/login/SaltsRotationSection';
import RevokeTotpEnrollments from '@features/login/RevokeTotpEnrollments';

interface LoginSettings {
  login_attempts_limit_enabled: boolean;
  login_attempts_limit: number;
  login_attempts_limit_window: number;
  login_attempts_violation_block_time: number;
  login_attempts_blacklist_after_violations: number;

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
  salts_rotation_recurrence: 'daily' | 'weekly' | 'monthly';
  salts_rotation_time: string;
}

const DEFAULT_SETTINGS: LoginSettings = {
  login_attempts_limit_enabled: false,
  login_attempts_limit: 5,
  login_attempts_limit_window: 300,
  login_attempts_violation_block_time: 3600,
  login_attempts_blacklist_after_violations: 3,

  login_recaptcha_enabled: false,
  login_recaptcha_site_key: '',
  login_recaptcha_secret_key: '',
  login_recaptcha_threshold: 0.5,

  login_totp_enabled: false,
  login_totp_issuer: 'Bromate Security API Firewall',
  login_totp_policy: 'grace',
  login_totp_grace_period: 7,

  cookie_hardening_samesite_enabled: false,
  cookie_hardening_samesite_mode: 'Strict',

  salts_rotation_enabled: false,
  salts_rotation_recurrence: 'weekly',
  salts_rotation_time: '03:00',

  cookie_hardening_max_concurrent_sessions: 0,
};

export default function LoginHardening(): JSX.Element {
  const { navigateGuarded } = useNavigation();
  
  const [settings, setSettings] = useState<LoginSettings>(DEFAULT_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState<LoginSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      {/* login attempts limit Section */}
      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2}>

          <Stack flexDirection="row" gap={1} alignItems="center">
            <FormControlLabel
              label={__('Enable', 'bromate-security-api-firewall')}
              control={
                <Switch
                checked={settings.login_attempts_limit_enabled}
                  onChange={(e) =>
                  updateSetting('login_attempts_limit_enabled', e.target.checked)
                  }
                />
              }
              sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
            />
            <Divider orientation="vertical" variant="middle" flexItem />
            <Typography variant="h6">{__('Login Attempts Limiting', 'bromate-security-api-firewall')}</Typography>
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">
            <TextField
              label={__('Maximum attempts', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.login_attempts_limit}
              onChange={(e) =>
                updateSetting('login_attempts_limit', Number(e.target.value))
              }
              helperText={__('Number of failed attempts before blocking.', 'bromate-security-api-firewall')}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label={__('Time window (seconds)', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.login_attempts_limit_window}
              onChange={(e) =>
                updateSetting('login_attempts_limit_window', Number(e.target.value))
              }
              helperText={__('Time window for counting attempts.', 'bromate-security-api-firewall')}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label={__('Block duration (seconds)', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.login_attempts_violation_block_time}
              onChange={(e) =>
                updateSetting('login_attempts_violation_block_time', Number(e.target.value))
              }
              helperText={__('How long to block the user?', 'bromate-security-api-firewall')}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label={__('Blacklist after (num. of blocks)', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.login_attempts_blacklist_after_violations}
              onChange={(e) =>
                updateSetting('login_attempts_blacklist_after_violations', Number(e.target.value))
              }
              helperText={__('0 = never add to the blacklist.', 'bromate-security-api-firewall')}
              sx={{ minWidth: 160 }}
            />
          </Stack>

          {settings.login_attempts_limit_enabled && (
            <Box>
              <Button
                size="small"
                disableElevation
                variant="outlined"
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
              helperText={__('Name shown in your authentication app.', 'bromate-security-api-firewall')}
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
              sx={{gap:2}}
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

              <Stack gap={1} flexDirection={"column"}>
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
                <Stack sx={{ pl: 4, pt: 1 }}>
                  <TextField
                    label={__('Grace Period (days)', 'bromate-security-api-firewall')}
                    type="number"
                    size="small"
                    value={settings.login_totp_grace_period || 7}
                    onChange={(e) =>
                      updateSetting('login_totp_grace_period', Number(e.target.value))
                    }
                    slotProps={{ htmlInput: { min: 1, max: 30 } }}
                    sx={{ width: 140 }}
                  />
                </Stack>
              </Stack>

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
          

          {/* Global revoke */}
          <RevokeTotpEnrollments />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack gap={0}>
          
          <Stack flexDirection="row" gap={1} alignItems="center">
            <FormControlLabel
              label={__('Enable', 'bromate-security-api-firewall')}
              control={
                <Switch
                checked={settings.cookie_hardening_samesite_enabled}
                  onChange={(e) =>
                    updateSetting('cookie_hardening_samesite_enabled', e.target.checked)
                  }
                />
              }
              sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
            />
            <Divider orientation="vertical" variant="middle" flexItem />
            <Typography variant="h6">{__('Protect Session Cookie', 'bromate-security-api-firewall')}</Typography>
          </Stack>
            
          <Stack gap={1} sx={{ pl: 4 }}>
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
            
            <TextField
              label={__('Limit Sessions Per User', 'bromate-security-api-firewall')}
              type="number"
              size="small"
              value={settings.cookie_hardening_max_concurrent_sessions}
              onChange={(e) =>
                updateSetting('cookie_hardening_max_concurrent_sessions', Number(e.target.value))
              }
              helperText={__('Oldest session is closed automatically beyond this number. 0 = unlimited.', 'bromate-security-api-firewall')}
              slotProps={{ htmlInput: { min: 0 } }}
              sx={{ maxWidth: 250 }}
            />
          </Stack>
     
        </Stack>
      </Paper>

      {/* Salt Rotation Section */}
     <SaltsRotationSection
      enabled={settings.salts_rotation_enabled}
      recurrence={settings.salts_rotation_recurrence}
      time={settings.salts_rotation_time}
      onChangeEnabled={(value) => updateSetting('salts_rotation_enabled', value)}
      onChangeRecurrence={(value) => updateSetting('salts_rotation_recurrence', value)}
      onChangeTime={(value) => updateSetting('salts_rotation_time', value)}
      />


      {/* Notifications */}
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

    </Stack>
  );
}
