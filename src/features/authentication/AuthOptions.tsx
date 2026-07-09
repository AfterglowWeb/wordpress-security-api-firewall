import { useState, useCallback, useMemo, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  Paper, Typography, Switch, Stack, TextField, Select, MenuItem,
  FormControl, InputLabel, RadioGroup, FormControlLabel, Radio,
} from '@mui/material';

import type { AuthSettings } from '@app-types/auth';
import { SettingsAPI } from '@services/settings';
import { usePortalContainer } from '@contexts/PortalContainerContext';
import SaveButton from '@components/SaveButton';

interface AuthOptionsProps {
  settings: AuthSettings;
  loadedSettings: AuthSettings;
  onChange: (settings: AuthSettings) => void;
  onSaved: (settings: AuthSettings) => void;
}

export default function AuthOptions({
  settings,
  loadedSettings,
  onChange,
  onSaved,
}: AuthOptionsProps): JSX.Element {
  const portalContainer = usePortalContainer();

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
    [settings, loadedSettings]
  );

  const update = <K extends keyof AuthSettings>(key: K, value: AuthSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const handleSave = useCallback(async () => {
    await SettingsAPI.updateOptions(settings);
    onSaved(settings);
  }, [settings, onSaved]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <SaveButton
          onSave={handleSave}
          disabled={!isDirty}
          messages={{
            confirmTitle: __('Save authentication settings', 'bromate-security-api-firewall'),
            confirmContent: __('Apply these REST API authentication settings now?', 'bromate-security-api-firewall'),
            confirmLabel: __('Save', 'bromate-security-api-firewall'),
            successMessage: __('Settings saved successfully.', 'bromate-security-api-firewall'),
            errorMessage: __('Failed to save settings.', 'bromate-security-api-firewall'),
            saveLabel: __('Save', 'bromate-security-api-firewall'),
            savingLabel: __('Saving...', 'bromate-security-api-firewall'),
          }}
        />
      </Stack>

      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2}>
          <FormControlLabel
            label="Enforce Authentication"
            control={
              <Switch
                checked={settings.auth_enforce}
                onChange={(e) => update('auth_enforce', e.target.checked)}
              />
            }
          />

          <FormControl>
            <Typography variant="h6">Authentication method</Typography>
            <RadioGroup
              row
              value={settings.auth_methods}
              onChange={(e) => update('auth_methods', e.target.value as any)}
            >
              <FormControlLabel value="wp_auth" control={<Radio size="small" />} label="WordPress Auth" />
              <FormControlLabel value="jwt" control={<Radio size="small" />} label="JWT" />
            </RadioGroup>
          </FormControl>

          {settings.auth_methods === 'jwt' && (
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>JWT Algorithm</InputLabel>
                <Select
                  MenuProps={{ container: portalContainer }}
                  value={settings.auth_jwt_algorithm}
                  label="JWT Algorithm"
                  onChange={(e) => update('auth_jwt_algorithm', e.target.value as any)}
                >
                  {['RS256', 'RS384', 'RS512', 'HS256', 'HS384', 'HS512', 'ES256'].map((alg) => (
                    <MenuItem key={alg} value={alg}>{alg}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="JWT Public Key"
                multiline
                minRows={4}
                value={settings.auth_jwt_public_key}
                onChange={(e) => update('auth_jwt_public_key', e.target.value)}
              />
              <TextField
                label="JWT Audience"
                value={settings.auth_jwt_audience}
                onChange={(e) => update('auth_jwt_audience', e.target.value)}
              />
              <TextField
                label="JWT Issuer"
                value={settings.auth_jwt_issuer}
                onChange={(e) => update('auth_jwt_issuer', e.target.value)}
              />
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}