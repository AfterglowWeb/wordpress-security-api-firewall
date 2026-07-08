import { useState, useEffect } from '@wordpress/element';
import { Stack, Snackbar, Alert } from '@mui/material';

import type { AuthSettings } from '@app-types/auth';
import { SettingsAPI } from '@services/settings';
import ConfirmDialog from '@components/ConfirmDialog';
import AuthOptions from '@features/authentication/AuthOptions';
import AuthorizedUsersGrid from '@features/authentication/AuthorizedUsersGrid';

const DEFAULT_SETTINGS: AuthSettings = {
  auth_enforce: false,
  auth_methods: 'wp_auth',
  auth_jwt_algorithm: 'RS256',
  auth_jwt_public_key: '',
  auth_jwt_audience: '',
  auth_jwt_issuer: '',
};

export default function Authentication(): JSX.Element {
  const [settings, setSettings] = useState<AuthSettings>(DEFAULT_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState<AuthSettings>(DEFAULT_SETTINGS);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    SettingsAPI.readOptions()
      .then((options) => {
        const { auth_users, ...rest } = options as any;
        setSettings(rest);
        setLoadedSettings(rest);
      })
      .catch(() => setLoadError('Failed to load settings'));
  }, []);

  return (
    <Stack spacing={3}>
      <AuthOptions
        settings={settings}
        loadedSettings={loadedSettings}
        onChange={setSettings}
        onSaved={setLoadedSettings}
      />

      <AuthorizedUsersGrid />

      <ConfirmDialog />

      <Snackbar open={!!loadError} autoHideDuration={4000} onClose={() => setLoadError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="error" variant="filled">{loadError}</Alert>
      </Snackbar>
    </Stack>
  );
}