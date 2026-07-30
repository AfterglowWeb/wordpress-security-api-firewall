import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import {
  Box, Paper, Typography, Switch,
  Stack, TextField, Button, FormControlLabel,
  Divider, Skeleton, Select, MenuItem, FormControl, InputLabel, Checkbox, Alert
} from '@mui/material';

import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import type { FirewallSettings } from '@app-types/firewall';
import { DEFAULT_FIREWALL_SETTINGS } from '@app-types/firewall';
import type { AuthorizedUser } from '@app-types/auth';

import { apiRequest } from '@services/api';
import { SettingsAPI } from '@services/settings';
import SaveButton from '@components/SaveButton';

import CountryBlockPanel from '@features/firewall/CountryBlockPanel';
import BlockedCountriesSummary from '@features/firewall/BlockedCountriesSummary';
import RedirectFrontWrapper from '@features/firewall/RedirectFrontWrapper';
import IpManagement from '@features/firewall/IpManagement';
import { usePortalContainer } from '@contexts/PortalContainerContext';

type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export default function Firewall(): JSX.Element {
  const portalContainer = usePortalContainer();
  const [settings, setSettings] = useState<FirewallSettings>(DEFAULT_FIREWALL_SETTINGS);
  const [settingsLoading, setLoadingSettings] = useState(true);
  const [loadedSettings, setLoadedSettings] = useState<FirewallSettings>(DEFAULT_FIREWALL_SETTINGS);
  
  // Track which fields the user has unfocused (blurred)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours');

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
    [settings, loadedSettings]
  );

  // Dynamically compute errors based on touched state and current settings
  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const isEnabled = settings.rate_limit_enabled;
    const isUnlimited = (settings as any).rate_limit_blacklist_duration_unlimited ?? false;
    const isViolationsZero = (settings.rate_limit_blacklist_threshold ?? 0) === 0;

    if (touched['rate_limit_max'] && isEnabled && (settings.rate_limit_max ?? 0) <= 0) {
      errors['rate_limit_max'] = __('Max Requests must be greater than 0 when enabled.', 'bromate-security-api-firewall');
    }

    if (touched['rate_limit_time'] && isEnabled && (settings.rate_limit_time ?? 0) <= 0) {
      errors['rate_limit_time'] = __('Time Window must be greater than 0 when enabled.', 'bromate-security-api-firewall');
    }

    if (
      touched['rate_limit_blacklist_duration'] && 
      isEnabled && 
      !isViolationsZero && 
      !isUnlimited && 
      (settings.rate_limit_blacklist_duration ?? 0) <= 0
    ) {
      errors['rate_limit_blacklist_duration'] = __('Blacklist duration must be greater than 0 or set to Unlimited.', 'bromate-security-api-firewall');
    }

    return errors;
  }, [settings, touched]);

  const hasErrors = Object.keys(fieldErrors).length > 0;

  const handleSave = useCallback(async () => {
    // Prevent save if there are active validation errors
    if (hasErrors) return;

    let durationInSeconds = settings.rate_limit_blacklist_duration || 0;
    const isUnlimited = (settings as any).rate_limit_blacklist_duration_unlimited ?? false;

    if (!isUnlimited) {
      if (durationUnit === 'minutes') durationInSeconds = durationInSeconds * 60;
      else if (durationUnit === 'hours') durationInSeconds = durationInSeconds * 3600;
      else if (durationUnit === 'days') durationInSeconds = durationInSeconds * 86400;
    } else {
      durationInSeconds = 0;
    }

    const payload = {
      ...settings,
      rate_limit_blacklist_duration: durationInSeconds,
    };

    await SettingsAPI.updateOptions(payload);
    
    setLoadedSettings(payload as FirewallSettings);
  }, [settings, durationUnit, hasErrors]);

  useEffect(() => {
    SettingsAPI.readOptions()
      .then((opts) => {
        const merged = { ...DEFAULT_FIREWALL_SETTINGS, ...opts };
        setSettings(merged);
        setLoadedSettings(merged);

        const dur = opts.rate_limit_blacklist_duration || 0;
        if (dur > 0 && dur % 86400 === 0) setDurationUnit('days');
        else if (dur > 0 && dur % 3600 === 0) setDurationUnit('hours');
        else if (dur > 0 && dur % 60 === 0) setDurationUnit('minutes');
        else setDurationUnit('seconds');
      })
      .finally(() => setLoadingSettings(false));
  }, []);

  const [countriesView, setCountriesView] = useState(false);

  const handleSaveBlockedCountries = useCallback(async (codes: string[]) => {
    await SettingsAPI.updateOption('rate_limit_countries', codes);
    setSettings((prev) => ({ ...prev, rate_limit_countries: codes }));
    setCountriesView(false);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof FirewallSettings>(key: K, value: FirewallSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateSettingAny = useCallback((key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const [wpUsers, setWpUsers] = useState<AuthorizedUser[]>([]);
  const [wpUsersLoading, setWpUsersLoading] = useState(false);

  useEffect(() => {
    setWpUsersLoading(true);
    apiRequest<AuthorizedUser[]>('bromate_authorized_users_options')
      .then(setWpUsers)
      .catch(() => {})
      .finally(() => setWpUsersLoading(false));
  }, []);

  const saveMessages = {
    confirmTitle: __('Save firewall settings', 'bromate-security-api-firewall'),
    confirmContent: __('Apply these rate limiting and firewall changes now?', 'bromate-security-api-firewall'),
    confirmLabel: __('Save', 'bromate-security-api-firewall'),
    successMessage: __('Firewall settings saved successfully.', 'bromate-security-api-firewall'),
    errorMessage: __('Failed to save firewall settings.', 'bromate-security-api-firewall'),
    saveLabel: __('Save', 'bromate-security-api-firewall'),
    savingLabel: __('Saving…', 'bromate-security-api-firewall'),
  };

  const isUnlimited = (settings as any).rate_limit_blacklist_duration_unlimited ?? false;
  const isViolationsZero = (settings.rate_limit_blacklist_threshold ?? 0) === 0;
  
  const isBlacklistSectionDisabled = !settings.rate_limit_enabled || isViolationsZero;
  const isViolationsDisabled = !settings.rate_limit_enabled || isViolationsZero;
  
  const isDurationDisabled = isBlacklistSectionDisabled || isUnlimited;

  if (settingsLoading) {
        return (
            <Stack spacing={3}>
        <Stack flexDirection={"row"} justifyContent={"flex-end"}>
                  <Skeleton variant="rounded" width={65} height={35} />
        </Stack>
                <Skeleton variant="rectangular" width={'100%'} height={200} />
        <Skeleton variant="rounded" width={'100%'} height={120} />
                <Skeleton variant="rectangular" width={'100%'} height={600} />
            </Stack>
        );
    }

  return (
    <Stack spacing={3}>
      {!countriesView && (
        <>
          <Stack direction="row" justifyContent="flex-end" alignItems="center">
            {hasErrors && (
              <Alert severity="error" variant="outlined" sx={{ mr: 2 }}>
                {Object.values(fieldErrors).join(' ')}
              </Alert>
            )}

            <SaveButton
              onSave={handleSave}
              disabled={!isDirty || hasErrors}
              messages={saveMessages}
            />
          </Stack>

         
          <Paper sx={{ p: 2 }} elevation={0}>
            <Stack flexDirection="column" gap={2}>
              
              <Stack flexDirection="row" gap={1} alignItems="center">
                <FormControlLabel
                  label={__('Enable', 'bromate-security-api-firewall')}
                  control={
                    <Switch
                      checked={settings.rate_limit_enabled ?? false}
                      onChange={(e) => updateSetting('rate_limit_enabled', e.target.checked)}
                    />
                  }
                  sx={{ mr: 0, '& .MuiTypography-root': { lineHeight: '2em' } }}
                />
                <Divider orientation="vertical" variant="middle" flexItem />
                <Stack>
                  <Typography variant="h6">{__('Firewall', 'bromate-security-api-firewall')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {__(
                      'When enabled, rate limiting, blocked countries and IPs management are applied.',
                      'bromate-security-api-firewall'
                    )}
                  </Typography>
                </Stack>
              </Stack>

              <Stack spacing={2}>
                <Typography variant="h6" mb={2}>{__('Rate Limiting', 'bromate-security-api-firewall')}</Typography>
                
                <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">
                  <TextField
                    label={__('Max Requests', 'bromate-security-api-firewall')}
                    type="number"
                    disabled={!settings.rate_limit_enabled}
                    value={settings.rate_limit_max}
                    required={settings.rate_limit_enabled}
                    onChange={(e) => updateSetting('rate_limit_max', Number(e.target.value))}
                    onBlur={() => setTouched(prev => ({ ...prev, rate_limit_max: true }))}
                    error={!!fieldErrors.rate_limit_max}
                    helperText={fieldErrors.rate_limit_max || __('Number of requests before blocking.', 'bromate-security-api-firewall')}
                  />
                  <TextField
                    label={__('Max Requests Time Window', 'bromate-security-api-firewall')}
                    type="number"
                    disabled={!settings.rate_limit_enabled}
                    value={settings.rate_limit_time}
                    required={settings.rate_limit_enabled}
                    onChange={(e) => updateSetting('rate_limit_time', Number(e.target.value))}
                    onBlur={() => setTouched(prev => ({ ...prev, rate_limit_time: true }))}
                    error={!!fieldErrors.rate_limit_time}
                    helperText={fieldErrors.rate_limit_time || __('Seconds', 'bromate-security-api-firewall')}
                  />
                  
                  <Divider orientation="vertical" variant="middle" flexItem sx={{ my: 1 }} />

                  <TextField
                    label={__('Max Violations', 'bromate-security-api-firewall')}
                    type="number"
                    disabled={isViolationsDisabled}
                    value={settings.rate_limit_blacklist_threshold}
                    onChange={(e) => updateSetting('rate_limit_blacklist_threshold', Number(e.target.value))}
                    helperText={__('0 = never add to the blacklist.', 'bromate-security-api-firewall')}
                  />
                  <TextField
                    label={__('Violations Time Window', 'bromate-security-api-firewall')}
                    type="number"
                    disabled={!settings.rate_limit_enabled}
                    value={settings.rate_limit_violation_window}
                    onChange={(e) => updateSetting('rate_limit_violation_window', Number(e.target.value))}
                    helperText={__('Seconds', 'bromate-security-api-firewall')}
                  />

                </Stack>

                <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">

                  {/* Blacklist Duration Group */}
                  <Stack direction="row" gap={1} alignItems="flex-start">
                    <TextField
                      label={__('Blacklist duration', 'bromate-security-api-firewall')}
                      type="number"
                      disabled={isDurationDisabled}
                      value={isDurationDisabled && isUnlimited ? '' : (settings.rate_limit_blacklist_duration ?? '')}
                      onChange={(e) => updateSetting('rate_limit_blacklist_duration', Number(e.target.value))}
                      onBlur={() => setTouched(prev => ({ ...prev, rate_limit_blacklist_duration: true }))}
                      error={!!fieldErrors.rate_limit_blacklist_duration}
                      helperText={fieldErrors.rate_limit_blacklist_duration || (isUnlimited ? __('Unlimited active', 'bromate-security-api-firewall') : __('Value', 'bromate-security-api-firewall'))}
                      sx={{ minWidth: 120 }}
                    />
                    <FormControl disabled={isDurationDisabled} sx={{ minWidth: 110 }}>
                      <InputLabel>{__('Unit', 'bromate-security-api-firewall')}</InputLabel>
                      <Select
                        value={durationUnit}
                        label={__('Unit', 'bromate-security-api-firewall')}
                        onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                        MenuProps={{ container: portalContainer }}
                      >
                        <MenuItem value="seconds">{__('Seconds', 'bromate-security-api-firewall')}</MenuItem>
                        <MenuItem value="minutes">{__('Minutes', 'bromate-security-api-firewall')}</MenuItem>
                        <MenuItem value="hours">{__('Hours', 'bromate-security-api-firewall')}</MenuItem>
                        <MenuItem value="days">{__('Days', 'bromate-security-api-firewall')}</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isUnlimited}
                        disabled={isBlacklistSectionDisabled}
                        onChange={(e) => updateSettingAny('rate_limit_blacklist_duration_unlimited', e.target.checked)}
                      />
                    }
                    label={__('Unlimited', 'bromate-security-api-firewall')}
                    sx={{ mt: 1.5 }}
                  />
                </Stack>

              </Stack>

            </Stack>
          </Paper>
        </>
      )}

      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2}>
          {!countriesView && (
            <Typography variant="h6">{__('Blocked Countries', 'bromate-security-api-firewall')}</Typography>
          )}
          <Box>
            <Button
              size="small"
              disableElevation
              variant="contained"
              disabled={settingsLoading}
              onClick={() => setCountriesView((v) => !v)}
              startIcon={countriesView ? <KeyboardArrowLeftIcon fontSize="inherit" /> : null}
              endIcon={countriesView ? null : <KeyboardArrowRightIcon fontSize="inherit" />}
            >
              {countriesView ? __('Back to IP management', 'bromate-security-api-firewall') : __('Manage countries', 'bromate-security-api-firewall') }
            </Button>
          </Box>
          {!countriesView && (
            <BlockedCountriesSummary codes={settings.rate_limit_countries || []} />
          )}
        </Stack>
      </Paper>

      {countriesView ? (
        <Paper sx={{ p: 2 }} elevation={0}>
          <CountryBlockPanel
            initialBlocked={settings.rate_limit_countries || []}
            onSave={handleSaveBlockedCountries}
            onClose={() => setCountriesView(false)}
          />
        </Paper>
      ) : (
        <IpManagement 
          wpUsers={wpUsers} 
          wpUsersLoading={wpUsersLoading} 
        />
      )}

      {!countriesView && (
          <Paper sx={{ p: 2 }} elevation={0}>
            <RedirectFrontWrapper
              settings={settings}
              onChange={updateSetting}
            />
          </Paper>)}
      
    </Stack>
  );
}