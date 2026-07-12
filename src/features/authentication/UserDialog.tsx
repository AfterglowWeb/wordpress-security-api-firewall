import { useState, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Autocomplete, CircularProgress,
  Typography, Box, Alert, Chip
} from '@mui/material';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import type { AuthorizedUser, AuthorizedUserDialogProps } from '@app-types/auth';
import type { IpEntry } from '@services/ip';
import { IpAPI } from '@services/ip';
import { usePortalContainer } from '@contexts/PortalContainerContext';

const EMPTY_FORM: Omit<AuthorizedUser, 'id'> = {
  display_name: '',
  email: '',
  admin_url: '',
  current_user: false,
  roles: [],
  jwt_subclaim: '',
  status: 'active',
  expires_at: '',
  ip_entries: [],
  has_wp_app_password: false,
};

export default function UserDialog({
  open, user, onSave, onClose,
  wpUsers, wpUsersLoading, fetchWordPressUsers, authorizedUserIds, onIpAdded,
  authMethod,
}: AuthorizedUserDialogProps): JSX.Element {

  const isEditing = user !== null;
  const isWpAuth = authMethod === 'wp_auth';
  const [wpUserId, setWpUserId]           = useState<number | ''>('');
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [selectedWpUser, setSelectedWpUser] = useState<AuthorizedUser | null>(null);
  const [saving, setSaving]               = useState(false);

  const [ipEntries, setIpEntries]     = useState<IpEntry[]>([]);
  const [ipListValue, setIpListValue] = useState('');
  const [ipListReferrer, setIpListReferrer] = useState('');
  const [ipError, setIpError]         = useState<string | null>(null);

  const portalContainer = usePortalContainer();
  const noUser = !isEditing && selectedWpUser === null;
  const currentUserId = isEditing ? user!.id : (selectedWpUser?.id ?? null);
  const isValid = wpUserId !== '' && form.display_name.trim() !== '';

  const hasAppPassword = selectedWpUser?.has_wp_app_password ?? user?.has_wp_app_password ?? false;
  const showAppPasswordWarning = isWpAuth && !noUser && !hasAppPassword;

  const applyIpEntries = (entries: IpEntry[]) => {
    setIpEntries(entries);
    setIpListValue(entries.map((e) => e.ip).join('\n'));
    setIpListReferrer(entries.length > 0 ? (entries[0].referrer ?? '') : '');
  };

  useEffect(() => {
  if (!open) return;
  if (user) {
    const freshUser = wpUsers.find(wp => wp.id === user.id);
    const resolvedIpEntries = freshUser?.ip_entries ?? user.ip_entries ?? [];

    setWpUserId(user.id);
    setForm({
      display_name:  user.display_name,
      email:         user.email,
      current_user:  user.current_user,
      admin_url:     user.admin_url,
      roles:         user.roles,
      jwt_subclaim: user.jwt_subclaim ?? '',
      status:        user.status || 'active',
      expires_at:    user.expires_at ?? '',
      ip_entries:    resolvedIpEntries,
      has_wp_app_password: freshUser?.has_wp_app_password ?? user.has_wp_app_password ?? false,
    });
    applyIpEntries(resolvedIpEntries);
    setSelectedWpUser(freshUser || null);
  } else {
    setWpUserId('');
    setForm(EMPTY_FORM);
    setSelectedWpUser(null);
    applyIpEntries([]);
  }
  setIpError(null);
  setSaving(false);
}, [open, user, wpUsers]);

  useEffect(() => {
    if (open && !user) fetchWordPressUsers();
  }, [open]);

  useEffect(() => {
    if (!selectedWpUser) { applyIpEntries([]); return; }
    applyIpEntries(selectedWpUser.ip_entries ?? []);
  }, [selectedWpUser]);

  const handleWpUserSelect = (_: unknown, value: AuthorizedUser | null) => {
    setSelectedWpUser(value);
    if (!value) { setWpUserId(''); return; }
    setWpUserId(value.id);
    setForm((prev) => ({
      ...prev,
      display_name:  value.display_name,
      roles:         value.roles,
      jwt_subclaim: prev.jwt_subclaim || `user_${value.id}`,
      ip_entries:    value.ip_entries || [],
      has_wp_app_password: value.has_wp_app_password ?? false,
    }));
  };

  const updateField = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (wpUserId === '') return;
    setSaving(true);
    setIpError(null);

    let finalIpEntries = ipEntries;

    if (currentUserId) {
      const desiredReferrer = ipListReferrer.trim() || null;
      const desiredLines = Array.from(
        new Set(ipListValue.split('\n').map((l) => l.trim()).filter(Boolean))
      );
      const desiredSet = new Set(desiredLines);

      const toDelete = ipEntries.filter(
        (e) => !desiredSet.has(e.ip) || (e.referrer ?? null) !== desiredReferrer
      );
      const keptIps = new Set(
        ipEntries
          .filter((e) => desiredSet.has(e.ip) && (e.referrer ?? null) === desiredReferrer)
          .map((e) => e.ip)
      );
      const toAdd = desiredLines.filter((ip) => !keptIps.has(ip));

      if (toDelete.length || toAdd.length) {
        const [deleteResults, addResults] = await Promise.all([
          Promise.allSettled(toDelete.map((e) => IpAPI.deleteEntry(e.id))),
          Promise.allSettled(toAdd.map((ip) => IpAPI.addEntry(ip, 'whitelist', currentUserId, desiredReferrer))),
        ]);

        const failures = [
          ...deleteResults
            .map((r, i) => ({ r, ip: toDelete[i].ip }))
            .filter(({ r }) => r.status === 'rejected')
            .map(({ r, ip }) => `${ip}: ${(r as PromiseRejectedResult).reason?.message ?? 'error'}`),
          ...addResults
            .map((r, i) => ({ r, ip: toAdd[i] }))
            .filter(({ r }) => r.status === 'rejected')
            .map(({ r, ip }) => `${ip}: ${(r as PromiseRejectedResult).reason?.message ?? 'error'}`),
        ];

        if (failures.length) {
          setIpError(failures.join('\n'));
          setSaving(false);
          return;
        }

        const fresh = await IpAPI.getUserEntries(currentUserId);
        finalIpEntries = fresh.entries;
        applyIpEntries(fresh.entries);

        if (onIpAdded) onIpAdded();
      }
    }

    onSave({
      id: wpUserId as number,
      ...form,
      jwt_subclaim: form.jwt_subclaim || undefined,
      expires_at:    form.expires_at    || undefined,
      ip_entries:    finalIpEntries,
      ...(selectedWpUser && {
        email: selectedWpUser.email,
        roles: selectedWpUser.roles,
      }),
    });

    setSaving(false);
  };

  const ReadonlyField = ({ label, value }: { label: string; value: string }) => (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
    </Box>
  );

  return (
    <Dialog container={portalContainer} open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isEditing ? sprintf(__('Edit — %s', 'bromate-security-api-firewall' ), user?.display_name) 
        : __('Add authorized user', 'bromate-security-api-firewall')}
      </DialogTitle>

      <DialogContent dividers>
        <Stack direction="column" gap={2}>

          {!isEditing && (
            <Autocomplete<AuthorizedUser>
              options={wpUsers}
              loading={wpUsersLoading}
              getOptionLabel={(o) => o.display_name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={selectedWpUser}
              onChange={handleWpUserSelect}
              getOptionDisabled={(o) => authorizedUserIds.includes(o.id)}
              disablePortal
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight={500}>
                        {option.display_name}
                      </Typography>
                      {option.current_user && (
                        <Chip label={__('Me', 'bromate-security-api-firewall')} size="small" color="primary" sx={{ height: 18, fontSize: 11 }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {option.email} · ID #{option.id} · {option.roles.join(', ')}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={__('Select WordPress user', 'bromate-security-api-firewall')}
                  size="small"
                  slotProps={{ input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {wpUsersLoading && <CircularProgress size={16} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}}
                />
              )}
            />
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <FormControlLabel
              label={__('User Active', 'bromate-security-api-firewall')}
              control={
                <Switch
                  checked={form.status === 'active'}
                  disabled={noUser}
                  onChange={(e) => updateField('status', e.target.checked ? 'active' : 'revoked')}
                />
              }
            />
            <Button
              variant="outlined" size="small" disabled={noUser}
              endIcon={<OpenInNewIcon />}
              href={selectedWpUser?.admin_url ?? form.admin_url}
              target="_blank"
            >{__('Profile', 'bromate-security-api-firewall')}</Button>
          </Stack>

          {showAppPasswordWarning && (
            <Alert severity="info">
              {__(
                'The user has no WordPress application password. Create one from their Profile page.',
                'bromate-security-api-firewall'
              )}
            </Alert>
          )}

          {/* ── Readonly user info ── */}
          <Stack direction="row" gap={3} p={1}>
            <ReadonlyField label={__('ID', 'bromate-security-api-firewall')}  value={selectedWpUser?.id.toString() ?? '' } />
            <Stack >
              <ReadonlyField label={__('Name', 'bromate-security-api-firewall')}  value={selectedWpUser?.display_name ?? form.display_name} />
              {selectedWpUser?.current_user && (
                  <Box mt={0.5}><Chip label={__('Me', 'bromate-security-api-firewall')} size="small" color="primary" sx={{ height: 18, fontSize: 11 }} /></Box>
                )}
            </Stack>
            <ReadonlyField label={__('Email', 'bromate-security-api-firewall')} value={selectedWpUser?.email ?? form.email} />
            <ReadonlyField label={__('Roles', 'bromate-security-api-firewall')} value={(selectedWpUser?.roles ?? form.roles).join(', ')} />
          </Stack>

          { !isWpAuth && <TextField
            label={__('JWT sub claim', 'bromate-security-api-firewall')} 
            value={selectedWpUser?.jwt_subclaim ?? form.jwt_subclaim} 
            disabled={noUser || isWpAuth} 
            size="small"
            slotProps={{htmlInput:{
              readOnly:true
            }}}
            onChange={(e) => updateField('jwt_subclaim', e.target.value)}
            helperText={ __('Expected value in the incoming token\'s `sub` claim', 'bromate-security-api-firewall')}
          />}
          <TextField
            label={__('Authorization expires', 'bromate-security-api-firewall')} type="date" value={form.expires_at || ''}
            disabled={noUser} size="small"
            onChange={(e) => updateField('expires_at', e.target.value)}
            helperText={__('Leave empty for no expiration', 'bromate-security-api-firewall')}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            label={__('Whitelisted IPs (one per line)', 'bromate-security-api-firewall')}
            placeholder={'203.0.113.1\n203.0.113.0/24'}
            value={ipListValue}
            onChange={(e) => setIpListValue(e.target.value)}
            multiline
            minRows={3}
            fullWidth size="small"
            disabled={noUser}
            helperText={__('Add or remove a line to grant or revoke that IP on save', 'bromate-security-api-firewall')}
          />
          <TextField
            label={__('Allowed origin (optional)', 'bromate-security-api-firewall')}
            placeholder="https://app.example.com"
            value={ipListReferrer}
            onChange={(e) => setIpListReferrer(e.target.value)}
            fullWidth size="small"
            disabled={noUser}
            helperText={__('If set, all IPs above are restricted to this origin', 'bromate-security-api-firewall')}
          />
          {ipError && (
            <Alert severity="error" variant="outlined">
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{ipError}</Typography>
            </Alert>
          )}

        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
        onClick={onClose} 
        disableElevation 
        color="inherit" 
        disabled={saving}>
          {__('Cancel', 'bromate-security-api-firewall')}
        </Button>
        <Button
          onClick={handleSave}
          disableElevation
          variant="contained"
          disabled={!isValid || saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {saving ? __('Saving…', 'bromate-security-api-firewall') : isEditing ? __('Save changes', 'bromate-security-api-firewall') : __('Add user', 'bromate-security-api-firewall') }
        </Button>
      </DialogActions>
    </Dialog>
  );
}
