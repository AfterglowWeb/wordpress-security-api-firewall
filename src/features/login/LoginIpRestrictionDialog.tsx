import { useState, useEffect, useCallback, useMemo, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Stack, Typography, Autocomplete, TextField, CircularProgress, Alert, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { apiRequest } from '@services/api';
import { usePortalContainer } from '@contexts/PortalContainerContext';
import type { AuthorizedUser } from '@app-types/auth';
import type { IpEntry } from '@services/ip';
import { computeIpEntriesDiff, syncUserIpEntries } from '@services/ip-entries-sync';
import AddIpEntriesRepeater, { type IpOriginRow } from '@components/AddIpEntriesRepeater';

interface LoginIpRestrictionDialogProps {
  open: boolean;
  userId: number | null; // null = adding a new restriction
  onClose: () => void;
  onSaved: () => void;
}

export default function LoginIpRestrictionDialog({
  open, userId, onClose, onSaved,
}: LoginIpRestrictionDialogProps): JSX.Element {
  const portalContainer = usePortalContainer();
  const isEditing = userId !== null;

  const [selectedUser, setSelectedUser] = useState<AuthorizedUser | null>(null);
  const [pickerOptions, setPickerOptions] = useState<AuthorizedUser[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerInput, setPickerInput] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [existingEntries, setExistingEntries] = useState<IpEntry[]>([]);
  const [ipRows, setIpRows] = useState<IpOriginRow[]>([]);
  const [ipRowsHaveErrors, setIpRowsHaveErrors] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = isEditing ? userId : selectedUser?.id ?? null;

  const runSearch = useCallback((term: string) => {
    setPickerLoading(true);
    apiRequest<{ users: AuthorizedUser[]; total: number }>('bromate_search_wp_users', {
      search: term,
      page: 1,
    })
      .then((res) => setPickerOptions(Array.isArray(res.users) ? res.users : []))
      .catch(() => setPickerOptions([]))
      .finally(() => setPickerLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setIpRowsHaveErrors(false);

    if (isEditing && userId !== null) {
      // Load the user's own details + their existing login-IP entries.
      setPickerLoading(true);
      Promise.all([
        apiRequest<AuthorizedUser[]>('bromate_get_authorized_wp_users', { ids: JSON.stringify([userId]) }),
        apiRequest<{ entries: IpEntry[] }>('bromate_get_ip_entries', {
          user_id: userId,
          entry_origin: 'login_ip_restriction',
        }),
      ])
        .then(([users, entriesRes]) => {
          setSelectedUser(users[0] ?? null);
          const entries = entriesRes.entries ?? [];
          setExistingEntries(entries);
          setIpRows(entries.map((e) => ({
            key: `existing-${e.id}`,
            ip: e.ip,
            referrer: e.referrer ?? '',
            expires_at: e.expires_at ?? '',
          })));
        })
        .finally(() => setPickerLoading(false));
    } else {
      setSelectedUser(null);
      setExistingEntries([]);
      setIpRows([]);
      runSearch('');
    }
  }, [open, isEditing, userId, runSearch]);

  const handlePickerInputChange = (_: unknown, value: string) => {
    setPickerInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => runSearch(value.trim()), 300);
  };

  const hasAnyIp = ipRows.some((r) => r.ip.trim() !== '');
  const canSave = currentUserId !== null && hasAnyIp && !ipRowsHaveErrors && !saving;

  const handleSave = async () => {
    if (currentUserId === null) return;
    setSaving(true);
    setError(null);

    const diff = computeIpEntriesDiff(
      existingEntries,
      ipRows
        .map((r) => ({
          ip: r.ip.trim(),
          referrer: r.referrer.trim() || null,
          expires_at: r.expires_at?.trim() || null,
        }))
        .filter((r) => r.ip !== '')
    );

    if (diff.toDelete.length || diff.toAdd.length) {
      const result = await syncUserIpEntries(currentUserId, diff, {
        list_type: 'whitelist',
        entry_origin: 'login_ip_restriction',
      });

      if (!result.ok) {
        setError(result.error ?? __('Failed to save IP restrictions', 'bromate-security-api-firewall'));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <Dialog container={portalContainer} open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isEditing ? __('Edit Login IP Restriction', 'bromate-security-api-firewall') : __('Add Login IP Restriction', 'bromate-security-api-firewall')}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="large" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {!isEditing && (
            <Autocomplete<AuthorizedUser>
              options={pickerOptions}
              loading={pickerLoading}
              filterOptions={(x) => x}
              inputValue={pickerInput}
              onInputChange={handlePickerInputChange}
              getOptionLabel={(o) => o.display_name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={selectedUser}
              onChange={(_, value) => setSelectedUser(value)}
              disablePortal
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={__('Select WordPress user', 'bromate-security-api-firewall')}
                  size="small"
                  slotProps={{ input: {
                    ...params.InputProps,
                    endAdornment: (<>{pickerLoading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>),
                  }}}
                />
              )}
            />
          )}

          {isEditing && selectedUser && (
            <Typography variant="body2">
              {selectedUser.display_name} ({selectedUser.email})
            </Typography>
          )}

          <Stack sx={{ opacity: currentUserId ? 1 : 0.5 }}>
            <Typography variant="body2">{__('Allowed login IPs', 'bromate-security-api-firewall')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {__('IPv4, IPv6 and CIDR are supported. This user will only be able to log in to wp-admin from these IPs.', 'bromate-security-api-firewall')}
            </Typography>
          </Stack>
          <AddIpEntriesRepeater
            rows={ipRows}
            onChange={setIpRows}
            disabled={!currentUserId}
            onValidityChange={setIpRowsHaveErrors}
            listType="whitelist"
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          {__('Cancel', 'bromate-security-api-firewall')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disableElevation
          disabled={!canSave}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {saving ? __('Saving…', 'bromate-security-api-firewall') : __('Save', 'bromate-security-api-firewall')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}