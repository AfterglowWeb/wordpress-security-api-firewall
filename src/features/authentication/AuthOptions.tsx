import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
  Paper, Typography, Stack, TextField, Select, MenuItem,
  FormControl, InputLabel, RadioGroup, FormControlLabel, Radio, Switch,
  Accordion, AccordionSummary, AccordionDetails,
  IconButton, Alert, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Chip,
  Tooltip, Divider, Collapse, List, ListItem, ListItemText
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import HistoryIcon from '@mui/icons-material/History';

import type { AuthSettings } from '@app-types/auth';
import { SettingsAPI } from '@services/settings';
import { usePortalContainer } from '@contexts/PortalContainerContext';
import { apiRequest } from '@services/api';
import SaveButton from '@components/SaveButton';
import CopyButton from '@components/CopyButton';

interface AuthOptionsProps {
  settings: AuthSettings;
  loadedSettings: AuthSettings;
  onChange: (settings: AuthSettings) => void;
  onSaved: (settings: AuthSettings) => void;
}

interface ActiveKeyInfo {
  kid: string;
  public_key: string;
  created_at: number;
}

interface RotatingKeyInfo {
  kid: string;
  created_at: number;
  expires_at: number;
}

interface KeyPairSummary {
  active: ActiveKeyInfo | null;
  rotating: RotatingKeyInfo[];
}

const EMPTY_SUMMARY: KeyPairSummary = { active: null, rotating: [] };

const formatDate = (unixSeconds: number): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(unixSeconds * 1000));

const formatRelativeToNow = (unixSeconds: number): string => {
  const diffMs = unixSeconds * 1000 - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return __('expiring soon', 'bromate-security-api-firewall');
  if (diffDays === 1) return __('in 1 day', 'bromate-security-api-firewall');
  return sprintf(__('in %d days', 'bromate-security-api-firewall'), diffDays);
};

export default function AuthOptions({
  settings,
  loadedSettings,
  onChange,
  onSaved,
}: AuthOptionsProps): JSX.Element {
  const portalContainer = usePortalContainer();
  const [jwksEndpoint, setJwksEndpoint] = useState<string>('');
  const [loadingEndpoint, setLoadingEndpoint] = useState<boolean>(false);
  const [endpointError, setEndpointError] = useState<string | null>(null);

  const [generatingKey, setGeneratingKey] = useState<boolean>(false);
  const [keyGenError, setKeyGenError] = useState<string | null>(null);
  const [keyGenSuccess, setKeyGenSuccess] = useState<boolean>(false);
  const [keySummary, setKeySummary] = useState<KeyPairSummary>(EMPTY_SUMMARY);
  const [showPublicKey, setShowPublicKey] = useState<boolean>(false);

  const hasStoredKey = keySummary.active !== null;

  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<'generate' | 'regenerate' | 'delete' | null>(null);

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

  const fetchJwksEndpoint = useCallback(async () => {
    setLoadingEndpoint(true);
    setEndpointError(null);
    try {
      const data = await apiRequest<{ endpoint: string }>('bromate_get_jwks_endpoint');
      setJwksEndpoint(data.endpoint || '');
    } catch (error) {
      setEndpointError(error instanceof Error ? error.message : 'Failed to fetch JWKS endpoint');
    } finally {
      setLoadingEndpoint(false);
    }
  }, []);

  const fetchKeySummary = useCallback(async () => {
    try {
      const data = await apiRequest<{ has_key: boolean; summary: KeyPairSummary }>('bromate_check_jwt_key');
      setKeySummary(data.summary ?? EMPTY_SUMMARY);
    } catch (error) {
      // Ignore — key management section just shows the "no key" state.
    }
  }, []);

  useEffect(() => {
    fetchJwksEndpoint();
    fetchKeySummary();
  }, [fetchJwksEndpoint, fetchKeySummary]);

  const handleGenerateKey = useCallback(async () => {
    setGeneratingKey(true);
    setKeyGenError(null);
    setKeyGenSuccess(false);

    try {
      const data = await apiRequest<{
        kid: string;
        public_key: string;
        private_key_stored: boolean;
        message: string;
        summary: KeyPairSummary;
      }>('bromate_generate_jwt_key_pair');

      if (data.public_key) {
        setKeySummary(data.summary ?? EMPTY_SUMMARY);
        setKeyGenSuccess(true);
        setShowPublicKey(true); 

        await fetchJwksEndpoint();
      }
    } catch (error) {
      setKeyGenError(error instanceof Error ? error.message : 'Failed to generate key pair');
    } finally {
      setGeneratingKey(false);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
    }
  }, [fetchJwksEndpoint]);

  const handleDeleteKey = useCallback(async () => {
    try {
      await apiRequest('bromate_delete_jwt_key');
      setKeySummary(EMPTY_SUMMARY);
      setShowPublicKey(false);
      await fetchJwksEndpoint();
      setKeyGenSuccess(false);
    } catch (error) {
      setKeyGenError(error instanceof Error ? error.message : 'Failed to delete key pair');
    } finally {
      setConfirmDialogOpen(false);
      setConfirmAction(null);
    }
  }, [fetchJwksEndpoint]);

  const openConfirmDialog = useCallback((action: 'generate' | 'regenerate' | 'delete') => {
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmAction = useCallback(() => {
    if (confirmAction === 'generate' || confirmAction === 'regenerate') {
      handleGenerateKey();
    } else if (confirmAction === 'delete') {
      handleDeleteKey();
    }
  }, [confirmAction, handleGenerateKey, handleDeleteKey]);

  const getConfirmDialogContent = () => {
    if (confirmAction === 'generate') {
      return {
        title: __('Generate JWT Key Pair', 'bromate-security-api-firewall'),
        content: __(
          'This will generate a new RSA key pair for JWT authentication. ' +
          'The public key will be served via the JWKS endpoint.',
          'bromate-security-api-firewall'
        ),
        confirmLabel: __('Generate', 'bromate-security-api-firewall'),
      };
    } else if (confirmAction === 'regenerate') {
      return {
        title: __('Regenerate JWT Key Pair', 'bromate-security-api-firewall'),
        content: __(
          'A new key becomes active immediately for signing. ' +
          'The current key keeps validating existing tokens for a 7-day grace period, ' +
          'so already-issued tokens won\'t break right away — but any token issued ' +
          'after this point must use the new key. Are you sure you want to continue?',
          'bromate-security-api-firewall'
        ),
        confirmLabel: __('Regenerate', 'bromate-security-api-firewall'),
      };
    } else if (confirmAction === 'delete') {
      return {
        title: __('Delete JWT Key Pair', 'bromate-security-api-firewall'),
        content: __(
          '⚠️ WARNING: Deleting the key pair removes the active key AND any key still ' +
          'in its rotation grace period. Every existing JWT token will immediately fail ' +
          'validation, and no new tokens can be issued until a new key pair is generated. ' +
          'Are you sure you want to continue?',
          'bromate-security-api-firewall'
        ),
        confirmLabel: __('Delete', 'bromate-security-api-firewall'),
      };
    }
    return {
      title: '',
      content: '',
      confirmLabel: '',
    };
  };

  const confirmContent = getConfirmDialogContent();

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
        <Stack flexDirection="column" gap={2} maxWidth={600}>

          <Stack flexDirection="row" gap={1} alignItems="center">
            <FormControlLabel
              label={__('Enable', 'bromate-security-api-firewall')}
              control={
                <Switch
                  checked={settings.auth_control_enabled ?? false}
                  onChange={(e) => update('auth_control_enabled', e.target.checked)}
                />
              }
              sx={{ mr: 0, '& .MuiTypography-root': { lineHeight: '2em' } }}
            />
            <Divider orientation="vertical" variant="middle" flexItem />
            <Stack>
              <Typography variant="h6">{__('REST API Authentication', 'bromate-security-api-firewall')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {__(
                  'When enabled, only the authorized users listed below can authenticate to the REST API.',
                  'bromate-security-api-firewall'
                )}
              </Typography>
            </Stack>
          </Stack>

          <FormControl>
            <Typography variant="h6">{__('Application authentication method', 'bromate-security-api-firewall')}</Typography>
            <RadioGroup
              row
              value={settings.auth_methods}
              onChange={(e) => update('auth_methods', e.target.value as any)}
            >
              <FormControlLabel value="jwt" control={<Radio size="small" />} label={__('JWT', 'bromate-security-api-firewall')} />
              <FormControlLabel value="wp_auth" control={<Radio size="small" />} label={__('WordPress Auth', 'bromate-security-api-firewall')} />
            </RadioGroup>
          </FormControl>

          {settings.auth_methods === 'jwt' && (
            <Stack spacing={2}>

              <FormControl fullWidth>
                <InputLabel>{__('JWT Algorithm', 'bromate-security-api-firewall')}</InputLabel>
                <Select
                  MenuProps={{ container: portalContainer }}
                  value={settings.auth_jwt_algorithm}
                  label={__('JWT Algorithm', 'bromate-security-api-firewall')}
                  onChange={(e) => update('auth_jwt_algorithm', e.target.value as any)}
                >
                  {['RS256', 'RS384', 'RS512'].map((alg) => (
                    <MenuItem key={alg} value={alg}>{alg}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Key Management Section */}
              <Stack spacing={2} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2" fontWeight={500}>
                    {__('JWT Key Pair', 'bromate-security-api-firewall')}
                  </Typography>
                  {hasStoredKey && (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label={__('Key Active', 'bromate-security-api-firewall')}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  {hasStoredKey
                    ? __('Your JWT key pair is securely stored. The public key is served via JWKS.', 'bromate-security-api-firewall')
                    : __('Generate a key pair to enable JWT authentication.', 'bromate-security-api-firewall')
                  }
                </Typography>

                {keyGenError && (
                  <Alert severity="error" onClose={() => setKeyGenError(null)}>
                    {keyGenError}
                  </Alert>
                )}

                {keyGenSuccess && (
                  <Alert severity="success" onClose={() => setKeyGenSuccess(false)}>
                    {__('Key pair generated successfully! The JWKS endpoint has been updated.', 'bromate-security-api-firewall')}
                  </Alert>
                )}

                <Stack direction="row" spacing={2}>
                  {!hasStoredKey ? (
                    <Button
                      variant="contained"
                      startIcon={<VpnKeyIcon />}
                      onClick={() => openConfirmDialog('generate')}
                      disabled={generatingKey}
                    >
                      {__('Generate Key Pair', 'bromate-security-api-firewall')}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => openConfirmDialog('regenerate')}
                        disabled={generatingKey}
                      >
                        {__('Regenerate', 'bromate-security-api-firewall')}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => openConfirmDialog('delete')}
                        disabled={generatingKey}
                      >
                        {__('Delete', 'bromate-security-api-firewall')}
                      </Button>
                    </>
                  )}
                </Stack>

                {hasStoredKey && keySummary.active && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight={500}>
                          {__('Active Public Key', 'bromate-security-api-firewall')}
                        </Typography>
                        <Tooltip title={__('Key ID (kid) — identifies this key in the JWKS document', 'bromate-security-api-firewall')}>
                          <Chip label={`kid: ${keySummary.active.kid}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                        </Tooltip>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={showPublicKey ? __('Hide', 'bromate-security-api-firewall') : __('Show', 'bromate-security-api-firewall')}>
                          <IconButton
                            size="small"
                            onClick={() => setShowPublicKey(!showPublicKey)}
                          >
                            {showPublicKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <CopyButton toCopy={keySummary.active.public_key.trim()} />
                      </Stack>
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      {sprintf(__('Generated on %s', 'bromate-security-api-firewall'), formatDate(keySummary.active.created_at))}
                    </Typography>

                    <Collapse in={showPublicKey}>
                      <TextField
                        multiline
                        minRows={4}
                        maxRows={8}
                        value={keySummary.active.public_key.trim()}
                        fullWidth
                        size="small"
                        slotProps={{
                          htmlInput: {
                            readOnly: true,
                          }
                        }}
                        sx={{
                          '& .MuiInputBase-root': {
                            backgroundColor: (theme) => theme.palette.background.default,
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                          }
                        }}
                      />
                    </Collapse>
                  </Stack>
                )}

                {keySummary.rotating.length > 0 && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <HistoryIcon fontSize="small" color="action" />
                      <Typography variant="body2" fontWeight={500}>
                        {__('Rotating Out', 'bromate-security-api-firewall')}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {__(
                        'These keys no longer sign new tokens but are still accepted for verification until their grace period ends.',
                        'bromate-security-api-firewall'
                      )}
                    </Typography>
                    <List dense disablePadding>
                      {keySummary.rotating.map((key) => (
                        <ListItem key={key.kid} disableGutters sx={{ py: 0.25 }}>
                          <ListItemText
                            primary={
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Chip label={`kid: ${key.kid}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                                <Typography variant="caption" color="text.secondary">
                                  {sprintf(__('expires %s', 'bromate-security-api-firewall'), formatRelativeToNow(key.expires_at))}
                                </Typography>
                              </Stack>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Stack>
                )}

              </Stack>

              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {__('JWKS Endpoint', 'bromate-security-api-firewall')}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title={__('Open in new tab', 'bromate-security-api-firewall')}>
                      <IconButton
                        size="small"
                        component="a"
                        href={jwksEndpoint}
                        target="_blank"
                        disabled={!jwksEndpoint}
                        rel="noopener noreferrer"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
                <Stack sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={jwksEndpoint}
                    placeholder={loadingEndpoint ? __('Loading...', 'bromate-security-api-firewall') : ''}
                    sx={{ userSelect: 'none' }}
                    slotProps={{
                      htmlInput: {
                        readOnly: true,
                      }
                    }}
                    helperText={
                      endpointError ? (
                        <Typography variant="caption" color="error">
                          {endpointError}
                        </Typography>
                      ) : (
                        __('Copy this URL to configure your JWT issuer', 'bromate-security-api-firewall')
                      )
                    }
                  />
                  <CopyButton toCopy={jwksEndpoint} sx={{ position: 'absolute', top: '4px', right: '12px', height: '32px', width: '32px' }} />
                </Stack>
              </Stack>

              <TextField
                label={__('JWT Audience', 'bromate-security-api-firewall')}
                value={settings.auth_jwt_audience}
                onChange={(e) => update('auth_jwt_audience', e.target.value)}
                helperText={__('Expected audience (aud) claim in the token', 'bromate-security-api-firewall')}
                size="small"
              />

              <TextField
                label={__('JWT Issuer', 'bromate-security-api-firewall')}
                value={settings.auth_jwt_issuer}
                onChange={(e) => update('auth_jwt_issuer', e.target.value)}
                helperText={__('Expected issuer (iss) claim in the token', 'bromate-security-api-firewall')}
                size="small"
              />

              <Accordion elevation={0} variant="outlined">
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body1" fontWeight={500}>
                    {__('Advanced Settings', 'bromate-security-api-firewall')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>

                    <Typography variant="body1" fontWeight={500}>
                      {__('External JWKS Provider', 'bromate-security-api-firewall')}
                    </Typography>

                    <TextField
                      label={__('Custom JWKS URL (Optional)', 'bromate-security-api-firewall')}
                      value={settings.auth_jwt_jwks_url}
                      onChange={(e) => update('auth_jwt_jwks_url', e.target.value)}
                      helperText={__(
                        'Leave empty to use the built-in endpoint. Use this to point to an external JWKS provider ' +
                        '(one that exposes its own rotating keys with a matching kid).',
                        'bromate-security-api-firewall'
                      )}
                      placeholder="https://your-auth-server.com/.well-known/jwks.json"
                      size="small"
                    />

                  </Stack>
                </AccordionDetails>
              </Accordion>

            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        container={portalContainer}
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            {confirmAction === 'delete' || confirmAction === 'regenerate' ? (
              <WarningIcon color="warning" />
            ) : (
              <VpnKeyIcon />
            )}
            <Typography variant="h6">
              {confirmContent.title}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert
            severity={confirmAction === 'delete' || confirmAction === 'regenerate' ? 'warning' : 'info'}
            sx={{ mt: 2 }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {confirmContent.content}
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>
            {__('Cancel', 'bromate-security-api-firewall')}
          </Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color={confirmAction === 'delete' ? 'error' : confirmAction === 'regenerate' ? 'warning' : 'primary'}
            disabled={generatingKey}
            startIcon={generatingKey ? <CircularProgress size={20} /> : undefined}
          >
            {generatingKey ? __('Processing...', 'bromate-security-api-firewall') : confirmContent.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
