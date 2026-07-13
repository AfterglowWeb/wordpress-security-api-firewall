import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import {
  Box, Paper, Typography, Switch,
  Stack, TextField, Button, FormControlLabel,
  Divider
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

export default function Firewall(): JSX.Element {
  const [settings, setSettings] = useState<FirewallSettings>(DEFAULT_FIREWALL_SETTINGS);
  const [settingsLoading, setLoadingSettings] = useState(true);
  const [loadedSettings, setLoadedSettings] = useState<FirewallSettings>(DEFAULT_FIREWALL_SETTINGS);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
    [settings, loadedSettings]
  );

  const handleSave = useCallback(async () => {
    await SettingsAPI.updateOptions(settings);
    setLoadedSettings(settings);
  }, [settings]);

  useEffect(() => {
    SettingsAPI.readOptions()
      .then((opts) => {
        setSettings((prev) => ({ ...prev, ...opts }));
        setLoadedSettings((prev) => ({ ...prev, ...opts }));
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

  return (
    <Stack spacing={3}>
      {!countriesView && (
        <>
          <Stack direction="row" justifyContent="flex-end">
            <SaveButton
              onSave={handleSave}
              disabled={!isDirty}
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

              {/* Rate Limiting Section */}
              <Stack>
                <Typography variant="h6" mb={2}>Rate Limiting</Typography>
                <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">
                  <TextField
                    label={__('Maximum requests', 'bromate-security-api-firewall')}
                    type="number"
                    disabled={!settings.rate_limit_enabled}
                    value={settings.rate_limit_max}
                    onChange={(e) => updateSetting('rate_limit_max', Number(e.target.value))}
                  />
                  <TextField
                    label={__('Time window (seconds)', 'bromate-security-api-firewall')}
                    type="number"
                    disabled={!settings.rate_limit_enabled}
                    value={settings.rate_limit_time}
                    onChange={(e) => updateSetting('rate_limit_time', Number(e.target.value))}
                  />
                  <TextField
                    label={__('Block duration (seconds)', 'bromate-security-api-firewall')}
                    type="number"
                    disabled={!settings.rate_limit_enabled}
                    value={settings.rate_limit_block_duration}
                    onChange={(e) => updateSetting('rate_limit_block_duration', Number(e.target.value))}
                  />
                  <TextField
                    label={__('Blacklist threshold', 'bromate-security-api-firewall')}
                    type="number"
                    disabled={!settings.rate_limit_enabled}
                    value={settings.rate_limit_blacklist_threshold}
                    onChange={(e) => updateSetting('rate_limit_blacklist_threshold', Number(e.target.value))}
                    helperText="Violations before auto-ban"
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

      {/* Country or IP Management */}
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

      {/* Redirect Front Section */}
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