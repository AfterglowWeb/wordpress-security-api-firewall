import { useState, useEffect, useMemo, useRef } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import type { AuthorizedUser, AuthorizedUserDialogProps, AuthorizedUserMeta } from '@app-types/auth';
import type { IpEntry } from '@services/ip';
import { apiRequest } from '@services/api';
import { computeIpEntriesDiff, syncUserIpEntries } from '@services/ip-entries-sync';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import { usePortalContainer } from '@contexts/PortalContainerContext';

import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';

import CopyButton from '@components/CopyButton';
import AddIpEntriesRepeater, { type IpOriginRow } from '@components/AddIpEntriesRepeater';

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

function serializeIpRows(rows: IpOriginRow[]): string {
  return JSON.stringify(
    rows
      .map((r) => ({ ip: r.ip.trim(), referrer: r.referrer.trim(), expires_at: r.expires_at?.trim() || '' }))
      .filter((r) => r.ip !== '')
      .sort((a, b) => a.ip.localeCompare(b.ip))
  );
}

export default function UserDialog({
  open, user, onSave, onDelete, onClose,
  wpUsers, wpUsersLoading, fetchWordPressUsers, authorizedUserIds, authorizedUsers,
  authMethod,
}: AuthorizedUserDialogProps): JSX.Element {

  const { openDialog } = useDialog();
  const portalContainer = usePortalContainer();
  const isEditing = user !== null;
  const isWpAuth = authMethod === 'wp_auth';
  const [wpUserId, setWpUserId]           = useState<number | ''>('');
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [selectedWpUser, setSelectedWpUser] = useState<AuthorizedUser | null>(null);
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);
  const [subclaimLoading, setSubclaimLoading] = useState(false);
  const noUser = !isEditing && selectedWpUser === null;
  const currentUserId = isEditing ? user!.id : (selectedWpUser?.id ?? null);
  const isValid = wpUserId !== '' && form.display_name.trim() !== '';

  const hasAppPassword = selectedWpUser?.has_wp_app_password ?? user?.has_wp_app_password ?? false;
  const showAppPasswordWarning = isWpAuth && !noUser && !hasAppPassword;

  const [ipEntries, setIpEntries]     = useState<IpEntry[]>([]);
  const [ipError, setIpError]         = useState<string | null>(null);

  const [ipRows, setIpRows] = useState<IpOriginRow[]>([]);
  const [ipRowsHaveErrors, setIpRowsHaveErrors] = useState(false);

  interface DirtySnapshot {
    wpUserId: number | '';
    status: AuthorizedUser['status'];
    expiresAt: string;
    ipRowsSnapshot: string;
  }
  const baselineRef = useRef<DirtySnapshot | null>(null);

  const isDirty = useMemo(() => {
    if (!baselineRef.current) return false;
    const b = baselineRef.current;
    return (
      wpUserId !== b.wpUserId ||
      form.status !== b.status ||
      (form.expires_at || '') !== b.expiresAt ||
      serializeIpRows(ipRows) !== b.ipRowsSnapshot
    );
  }, [wpUserId, form.status, form.expires_at, ipRows]);

  const hasFormatErrors = ipRowsHaveErrors;

  const applyIpEntries = (entries: IpEntry[]) => {
    setIpEntries(entries);
    setIpRows(entries.map((e) => ({ 
      key: `existing-${e.id}`, 
      ip: e.ip, 
      referrer: e.referrer ?? '', 
      expires_at: e.expires_at ?? '' 
    })));
  };

  useEffect(() => {
    if (!open) return;

    if (user) {
      const resolvedIpEntries = user.ip_entries ?? [];
      const resolvedRows: IpOriginRow[] = resolvedIpEntries.map((e) => ({
        key: `existing-${e.id}`,
        ip: e.ip,
        referrer: e.referrer ?? '',
        expires_at: e.expires_at ?? '',
      }));

      setWpUserId(user.id);
      setForm({
        display_name: user.display_name,
        email:        user.email,
        current_user: user.current_user,
        admin_url:    user.admin_url,
        roles:        user.roles,
        jwt_subclaim: user.jwt_subclaim ?? '',
        status:       user.status || 'active',
        expires_at:   user.expires_at ?? '',
        ip_entries:   resolvedIpEntries,
        has_wp_app_password: user.has_wp_app_password ?? false,
      });
      setIpEntries(resolvedIpEntries);
      setIpRows(resolvedRows);
      setSelectedWpUser(user);

      baselineRef.current = {
        wpUserId: user.id,
        status: user.status || 'active',
        expiresAt: user.expires_at ?? '',
        ipRowsSnapshot: serializeIpRows(resolvedRows),
      };
    } else {
      setWpUserId('');
      setForm(EMPTY_FORM);
      setSelectedWpUser(null);
      setIpEntries([]);
      setIpRows([]);

      baselineRef.current = {
        wpUserId: '',
        status: 'active',
        expiresAt: '',
        ipRowsSnapshot: serializeIpRows([]),
      };
    }
    setIpError(null);
    setIpRowsHaveErrors(false);
    setSaveError(null);
    setSaving(false);
  }, [open, user]);

  useEffect(() => {
    if (open && !user) fetchWordPressUsers();
  }, [open]);

  useEffect(() => {
    if (!selectedWpUser) { applyIpEntries([]); return; }
    applyIpEntries(selectedWpUser.ip_entries ?? []);
  }, [selectedWpUser]);

  const handleWpUserSelect = async (_: unknown, value: AuthorizedUser | null) => {
    setSelectedWpUser(value);
    if (!value) { setWpUserId(''); return; }
    setWpUserId(value.id);
    setForm((prev) => ({
      ...prev,
      display_name: value.display_name,
      roles:        value.roles,
      ip_entries:   value.ip_entries || [],
    }));


    if (!isWpAuth) {
      setSubclaimLoading(true);
      try {
        const { subclaim } = await apiRequest<{ subclaim: string }>(
          'bromate_generate_jwt_subclaim',
          { user_id: value.id }
        );
        setForm((prev) => ({ ...prev, jwt_subclaim: subclaim }));
      } catch {
        // Leave jwt_subclaim empty — surfaced by the field itself being blank.
      } finally {
        setSubclaimLoading(false);
      }
    }
  };

  const updateField = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleRevokeUser = () => {
    if (!isEditing) return;

    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Revoke User Access?', 'bromate-security-api-firewall'),
      content: __(
        'This revokes REST API access for this user once saved. It cannot be undone. Continue?',
        'bromate-security-api-firewall'
      ),
      confirmLabel: __('Revoke', 'bromate-security-api-firewall'),
      onConfirm: () => {
        updateField('status', 'revoked');
      },
    });
  };

  const handleDeleteClick = () => {
    if (!isEditing || currentUserId === null) return;
    onDelete(currentUserId, onClose);
  };

  const handleSave = async () => {
    if (wpUserId === '') return;
    setSaving(true);
    setIpError(null);
    setSaveError(null);

    let finalIpEntries = ipEntries;

    
    if (currentUserId) {
      const diff = computeIpEntriesDiff(
        ipEntries,
        ipRows
          .map((r) => ({
            ip: r.ip.trim(),
            referrer: r.referrer.trim() || null,
            expires_at: r.expires_at?.trim() || null,
          }))
          .filter((r) => r.ip !== '')
      );

      if (diff.toDelete.length || diff.toAdd.length) {
        const result = await syncUserIpEntries(currentUserId, diff);

        if (!result.ok) {
          setIpError(result.error ?? __('Failed to sync IP entries', 'bromate-security-api-firewall'));
          setSaving(false);
          return;
        }

        finalIpEntries = result.entries;
        applyIpEntries(result.entries);
      }
    }

    const meta: AuthorizedUserMeta = {
      id: wpUserId as number,
      jwt_subclaim: form.jwt_subclaim || '',
      status: form.status,
      expires_at: form.expires_at || '',
    };
    const exists = authorizedUsers.some((u) => u.id === meta.id);
    const newAuthUsers = exists
      ? authorizedUsers.map((u) => (u.id === meta.id ? meta : u))
      : [...authorizedUsers, meta];

    try {
      await apiRequest<AuthorizedUserMeta[]>('bromate_update_authorized_users', {
        authorized_users: JSON.stringify(newAuthUsers),
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : __('Failed to save user', 'bromate-security-api-firewall'));
      setSaving(false);
      return;
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
    <Stack flexDirection="column" gap={0} sx={{maxWidth:180, overflow:'hidden'}}>
      <Typography  sx={{maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace: 'nowrap'}} variant="caption" color="text.secondary">{label}</Typography>
      <Typography  sx={{maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace: 'nowrap'}} variant="body2" fontWeight={500}>{value || '—'}</Typography>
    </Stack>
  );

  return (
    <Dialog 
    container={portalContainer} 
    open={open} 
    onClose={onClose} 
    fullWidth 
    maxWidth="md"
    >
      <DialogTitle>
        {isEditing ? sprintf(__('Edit Authorized User — %s', 'bromate-security-api-firewall' ), user?.display_name) 
        : __('Add Authorized User', 'bromate-security-api-firewall')}
        <IconButton onClick={onClose} sx={{position:'absolute', right:'8px', top:'8px', zIndex:10}}>
          <CloseIcon fontSize="large" />
        </IconButton>
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
                    <Stack>
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
                    </Stack>
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
              label={form.status === 'active' 
                ? __('User Active', 'bromate-security-api-firewall') 
                :  form.status === 'disabled' ? __('User Disabled', 'bromate-security-api-firewall')
                :  __('User Revoked', 'bromate-security-api-firewall')
              }
              control={
                <Switch
                  checked={form.status === 'active'}
                  disabled={noUser}
                  onChange={(e) => updateField('status', e.target.checked ? 'active' : 'disabled')}
                />
              }
            />
    
            <Stack sx={{color:'text.secondary'}} direction="row" justifyContent="flex-end" gap={2} alignItems="center">
              
             <Button
                color="inherit"
                size="small"
                disabled={!isEditing || form.status === 'revoked'}
                onClick={handleRevokeUser}
              >
                {__('Revoke', 'bromate-security-api-firewall')}
              </Button>

              <Button
                variant="contained"
                color="error"
                size="small"
                disabled={!isEditing}
                onClick={handleDeleteClick}
              >
                {__('Delete', 'bromate-security-api-firewall')}
              </Button>

            </Stack>

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
          <Stack direction="row" gap={3} p={1} flexWrap="wrap" alignItems={"flex-end"}>
            <ReadonlyField label={__('ID', 'bromate-security-api-firewall')}  value={selectedWpUser?.id.toString() ?? '' } />
            <Stack direction="row" alignItems="flex-end" gap={1}>
              <ReadonlyField label={__('Name', 'bromate-security-api-firewall')}  value={selectedWpUser?.display_name ?? form.display_name} />
              {selectedWpUser?.current_user && (
                  <Stack mt={0.5}><Chip label={__('Me', 'bromate-security-api-firewall')} size="small" color="primary" sx={{ height: 18, fontSize: 11 }} /></Stack>
                )}
            </Stack>
            <ReadonlyField label={__('Email', 'bromate-security-api-firewall')} value={selectedWpUser?.email ?? form.email} />
            <ReadonlyField label={__('Roles', 'bromate-security-api-firewall')} value={(selectedWpUser?.roles ?? form.roles).join(', ')} />
            <Button
              size="small"
              variant="outlined"
              disabled={noUser}
              endIcon={<OpenInNewIcon />}
              href={selectedWpUser?.admin_url ?? form.admin_url}
              target="_blank"
            >
              {__('Profile', 'bromate-security-api-firewall')}
            </Button>
          </Stack>

          { !isWpAuth && 
          <Stack sx={{ position: 'relative', maxWidth:400 }}>
            <TextField
              label={__('JWT sub claim', 'bromate-security-api-firewall')} 
              value={form.jwt_subclaim}
              disabled={noUser}
              size="small"
              slotProps={{
                htmlInput: { readOnly: true },
                input: {
                  endAdornment: subclaimLoading ? <CircularProgress size={16} /> : undefined,
                },
              }}
              helperText={ __('Expected value in the incoming token\'s subclaim.', 'bromate-security-api-firewall')}
            />
            {form.jwt_subclaim && !subclaimLoading && <CopyButton toCopy={form.jwt_subclaim} sx={{ position: 'absolute', top: '4px', right: '12px', height: '32px', width: '32px' }} />}
          </Stack>
          }
          <TextField
            label={__('Authorization expires', 'bromate-security-api-firewall')} 
            type="date" 
            value={form.expires_at || ''}
            disabled={noUser} size="small"
            onChange={(e) => updateField('expires_at', e.target.value)}
            helperText={__('Leave empty for no expiration.', 'bromate-security-api-firewall')}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{maxWidth:200}}
          />

          <Stack spacing={2}>
            <Stack sx={{pl:2, opacity: noUser ? 0.5 : 1}}>
            <Typography variant="body2">{__('IPs Whitelist (optional)')}</Typography>
            <Typography variant="caption" color="text.secondary">{__('IPv4, IPv6 and CIDR are supported.')}</Typography>
            </Stack>
              <AddIpEntriesRepeater
                rows={ipRows}
                onChange={setIpRows}
                disabled={noUser}
                onValidityChange={setIpRowsHaveErrors}
                listType="whitelist"
              />
          </Stack>

          {ipError && (
            <Alert severity="error" variant="outlined">
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{ipError}</Typography>
            </Alert>
          )}
          {saveError && (
            <Alert severity="error" variant="outlined">
              <Typography variant="body2">{saveError}</Typography>
            </Alert>
          )}

        </Stack>
      </DialogContent>

      <DialogActions sx={{color:'text.secondary'}}>
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
          disabled={!isValid || saving || subclaimLoading || !isDirty || hasFormatErrors}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {saving ? __('Saving…', 'bromate-security-api-firewall') : isEditing ? __('Save', 'bromate-security-api-firewall') : __('Add user', 'bromate-security-api-firewall') }
        </Button>
      </DialogActions>
    </Dialog>
  );
}