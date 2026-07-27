import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Stack, Snackbar, Alert, Skeleton } from '@mui/material';

import type { AuthSettings } from '@app-types/auth';
import { SettingsAPI } from '@services/settings';
import AuthOptions from '@features/authentication/AuthOptions';
import AuthorizedUsersGrid, { AuthorizedUsersInfo } from '@features/authentication/AuthorizedUsersGrid';

const DEFAULT_SETTINGS: AuthSettings = {
  auth_control_enabled: true,
  auth_methods: 'jwt',
  auth_authorized_roles: [],
  auth_jwt_algorithm: 'RS256',
  auth_jwt_public_key: '',
  auth_jwt_audience: '',
  auth_jwt_issuer: '',
  auth_jwt_jwks_url: '',
};

const DEFAULT_AUTHORIZED_USERS_INFO: AuthorizedUsersInfo = { count: 0, loading: true, users: [] };

export default function Authentication(): JSX.Element {
  const [settings, setSettings] = useState<AuthSettings>(DEFAULT_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState<AuthSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authorizedUsersInfo, setAuthorizedUsersInfo] = useState<AuthorizedUsersInfo>(DEFAULT_AUTHORIZED_USERS_INFO);

  useEffect(() => {
    SettingsAPI.readOptions()
      .then((options) => {
        const { auth_users, ...rest } = options as any;
        setSettings(rest);
        setLoadedSettings(rest);
        setLoadingSettings(false);
      })
      .catch(() => setLoadError(__('Failed to load settings', 'bromate-security-api-firewall')));
  }, []);

  return (
    <Stack spacing={3}>

      {loadingSettings ? (
        <Stack spacing={3}>
          <Stack flexDirection={"row"} justifyContent={"flex-end"}>
            <Skeleton variant="rounded" width={65} height={35} />
          </Stack>
          <Skeleton variant="rectangular" width={'100%'} height={800} />
        </Stack>
        ) : (
      <AuthOptions
        settings={settings}
        loadedSettings={loadedSettings}
        onChange={setSettings}
        onSaved={setSettings}
        authorizedUsersCount={authorizedUsersInfo.count}
        authorizedUsersLoading={authorizedUsersInfo.loading}
        authorizedUsers={authorizedUsersInfo.users}
      />)}

      <AuthorizedUsersGrid
        authMethod={settings.auth_methods}
        authEnabled={settings.auth_control_enabled}
        onUsersChange={setAuthorizedUsersInfo}
        authorizedRoles={settings.auth_authorized_roles}
      />

      <Snackbar open={!!loadError} autoHideDuration={4000} onClose={() => setLoadError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="error" variant="filled">{loadError}</Alert>
      </Snackbar>
    </Stack>
  );
}
