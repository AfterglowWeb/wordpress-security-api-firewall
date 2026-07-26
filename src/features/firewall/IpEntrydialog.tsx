import { useState, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { usePortalContainer } from '@contexts/PortalContainerContext';
import { type IpEntry, type ListType, type AddIpEntriesForm, type LineResult } from '@services/ip';
import type { AuthorizedUser } from '@app-types/auth';
import { apiRequest } from '@services/api';

import {
  Box, Typography,
  Stack, TextField, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, List, ListItem, ListItemText,
  FormControlLabel, Radio, RadioGroup, FormLabel, FormControl,
   Autocomplete, IconButton
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import IpOriginRepeater, { type IpOriginRow, createEmptyRow } from '@components/IpOriginRepeater';

interface IpEntryDialogProps {
  open: boolean;
  defaultListType: ListType;
  onSave: (form: AddIpEntriesForm) => Promise<LineResult[]>;
  onClose: () => void;
  wpUsers: AuthorizedUser[];
  wpUsersLoading: boolean;
  editingEntry: IpEntry | null;
}

export default function IpEntryDialog({ 
  open, 
  defaultListType, 
  onSave, 
  onClose, 
  wpUsers, 
  wpUsersLoading, 
  editingEntry 
}: IpEntryDialogProps) {
  const isEditing = editingEntry !== null;

  const [ipRows, setIpRows] = useState<IpOriginRow[]>([createEmptyRow()]);
  const [ipRowsHaveErrors, setIpRowsHaveErrors] = useState(false);
  const [listType, setListType] = useState<ListType>(defaultListType);
  const [userId, setUserId] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<LineResult[]>([]);
  const portalContainer = usePortalContainer();
  const [currentUserIp, setCurrentUserIp] = useState('');

  useEffect(() => {
    if (open) {
      if (editingEntry) {
        setIpRows([{ 
          key: `existing-${editingEntry.id}`, 
          ip: editingEntry.ip, 
          referrer: editingEntry.referrer ?? '', 
          expires_at: editingEntry.expires_at ?? '' }]);
        setListType(editingEntry.list_type);
        setUserId(editingEntry.user_id ?? null);
        setExpiresAt(editingEntry.expires_at ?? null);
      } else {
        setIpRows([createEmptyRow()]);
        setListType(defaultListType);
        setUserId(null);
        setExpiresAt(null);
      }
      setErrors([]);
      setIpRowsHaveErrors(false);
    }
  }, [open, defaultListType, editingEntry]);

  const hasAnyIp = ipRows.some((r) => r.ip.trim() !== '');
  const canSave = hasAnyIp && !ipRowsHaveErrors && !saving;

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);

    const form: AddIpEntriesForm = {
      entries: ipRows
        .map((r) => ({ ip: r.ip.trim(), referrer: r.referrer.trim(), expires_at: r.expires_at.trim() }))
        .filter((r) => r.ip !== ''),
      list_type: listType,
      user_id: listType === 'whitelist' ? userId : null,
    };

    const lineErrors = await onSave(form);
    setSaving(false);
    if (lineErrors.length > 0) setErrors(lineErrors);
  };

  const fetchUserIp = async () => {
    const data = await apiRequest<{ current_user_ip: string }>('bromate_get_current_user_ip');
    if(data?.current_user_ip) {
      setCurrentUserIp(data?.current_user_ip);
    }
  }

  useEffect(() => {
    fetchUserIp();
  }, [fetchUserIp]);

  const handleAddUserIp = () => {
    if (!currentUserIp) return;

    setIpRows((prev) => {
      const emptyIndex = prev.findIndex((r) => r.ip.trim() === '');
      if (emptyIndex !== -1) {
        return prev.map((r, i) => (i === emptyIndex ? { ...r, ip: currentUserIp } : r));
      }
      return [...prev, { ...createEmptyRow(), ip: currentUserIp }];
    });
  };

  return (
    <Dialog
      container={portalContainer} 
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth 
      maxWidth="md"
    >
      <DialogTitle>
        {isEditing ? __('Edit IP Entry', 'bromate-security-api-firewall') : __('Add IP Entries', 'bromate-security-api-firewall') }
         <IconButton onClick={onClose} sx={{position:'absolute', right:'8px', top:'8px', zIndex:10}}>
          <CloseIcon fontSize="large" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <FormControl>
            <FormLabel>List</FormLabel>
            <RadioGroup 
              row 
              value={listType}
              onChange={(e) => setListType(e.target.value as ListType)}
            >
              <FormControlLabel value="blacklist" control={<Radio size="small" />} label="Blacklist" disabled={isEditing} />
              <FormControlLabel value="whitelist" control={<Radio size="small" />} label="Whitelist" disabled={isEditing} />
            </RadioGroup>
          </FormControl>

          {listType === 'whitelist' && !isEditing && (
            <Stack flexDirection={"row"}>
            <Button variant="text" size="small" endIcon={<AddIcon />} onClick={handleAddUserIp} >{__('Add my IP', 'bromate-security-api-firewall')}</Button>
            </Stack>
          )}

          <IpOriginRepeater
            rows={ipRows}
            onChange={setIpRows}
            disabled={saving || isEditing}
            onValidityChange={setIpRowsHaveErrors}
          />

         
          {listType === 'whitelist' && (
            <Autocomplete<AuthorizedUser>
              options={wpUsers}
              loading={wpUsersLoading}
              getOptionLabel={(o) => o.display_name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={wpUsers.find((u) => u.id === userId) ?? null}
              onChange={(_, v) => setUserId(v?.id ?? null)}
              disabled={saving}
              disablePortal
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {option.display_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email} · {option.roles.join(', ')}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={__('Bind to user (optional)', 'bromate-security-api-firewall')}
                  size="small"
                  slotProps={{ 
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {wpUsersLoading && <CircularProgress size={16} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }
                  }}
                />
              )}
            />
          )}

          {errors.length > 0 && (
            <Alert severity="error" variant="outlined">
              <Typography variant="body2" fontWeight={600} mb={0.5}>
                {sprintf(
                  errors.length > 1
                    ? __('%d entries failed:', 'bromate-security-api-firewall')
                    : __('%d entry failed:', 'bromate-security-api-firewall'),
                  errors.length
                )}
              </Typography>
              <List dense disablePadding>
                {errors.map((e) => (
                  <ListItem key={e.value} disablePadding>
                    <ListItemText 
                      primary={
                        <Typography variant="body2" fontFamily="monospace">
                          {e.value} — {e.error}
                        </Typography>
                      } 
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{color:'text.secondary'}}>
        <Button 
          onClick={onClose} 
          disableElevation 
          color="inherit" 
          disabled={saving}
        >
          {__('Cancel', 'bromate-security-api-firewall')}
        </Button>
        <Button
          onClick={handleSave} 
          variant="contained" 
          disableElevation
          disabled={!canSave}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {saving ? __('Saving…', 'bromate-security-api-firewall') : isEditing ? __('Save', 'bromate-security-api-firewall') : __('Add entries', 'bromate-security-api-firewall')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}