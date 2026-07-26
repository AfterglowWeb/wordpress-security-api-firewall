import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { usePortalContainer } from '@contexts/PortalContainerContext';
import { type IpEntry, type ListType, type AddEntryForm, type LineResult } from '@services/ip';
import type { AuthorizedUser } from '@app-types/auth';
import { apiRequest } from '@services/api';
import { findInvalidIpLines, isValidOrigin } from '@app-utils/ipValidation';

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

const EMPTY_FORM: AddEntryForm = {
  value: '',
  list_type: 'blacklist',
  user_id: null,
  referrer: '',
  expires_at: null,
};

interface IpEntryDialogProps {
  open: boolean;
  defaultListType: ListType;
  onSave: (form: AddEntryForm) => Promise<LineResult[]>;
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
  const [form, setForm] = useState<AddEntryForm>({ ...EMPTY_FORM, list_type: defaultListType });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<LineResult[]>([]);
  const portalContainer = usePortalContainer();
  const [currentUserIp, setCurrentUserIp] = useState('');

    const [ipFormatError, setIpFormatError] = useState<string | null>(null);
    const [originFormatError, setOriginFormatError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingEntry) {
        setForm({
          value: editingEntry.ip,
          list_type: editingEntry.list_type,
          user_id: editingEntry.user_id ?? null,
          referrer: editingEntry.referrer ?? '',
          expires_at: editingEntry.expires_at ?? null,
        });
      } else {
        setForm({ ...EMPTY_FORM, list_type: defaultListType });
      }
      setErrors([]);
    }
  }, [open, defaultListType, editingEntry]);

  const update = <K extends keyof AddEntryForm>(key: K, value: AddEntryForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);
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

  const handleAddUserIp = async () => {
    if(currentUserIp) {
      update('value', currentUserIp);
    }
  }

  return (
    <Dialog
      container={portalContainer} 
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth 
      maxWidth="xs"
    >
      <DialogTitle>
        {editingEntry ? __('Edit IP Entry', 'bromate-security-api-firewall') : __('Add IP Entry', 'bromate-security-api-firewall') }
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
              value={form.list_type}
              onChange={(e) => update('list_type', e.target.value as ListType)}
            >
              <FormControlLabel value="blacklist" control={<Radio size="small" />} label="Blacklist" />
              <FormControlLabel value="whitelist" control={<Radio size="small" />} label="Whitelist" />
            </RadioGroup>
          </FormControl>

          {form.list_type === 'whitelist' && (
            <Stack flexDirection={"row"}>
            <Button variant="text" size="small" endIcon={<AddIcon />} onClick={handleAddUserIp} >{__('Add my IP')}</Button>
            </Stack>
          )}

          <TextField
            label="IP / CIDR"
            placeholder={'203.0.113.1'}
            value={form.value}
            onChange={(e) => update('value', e.target.value)}
            fullWidth 
            size="small" 
            disabled={saving}
          />

          <TextField
            label="Referrer (optional)"
            placeholder="https://app.example.com"
            value={form.referrer}
            onChange={(e) => update('referrer', e.target.value)}
            fullWidth 
            size="small" 
            disabled={saving}
            helperText="If set, access is only allowed from this origin"
          />

          <TextField
            label="Expires at (optional)"
            type="datetime-local"
            value={form.expires_at ?? ''}
            onChange={(e) => update('expires_at', e.target.value || null)}
            fullWidth 
            size="small" 
            disabled={saving}
            helperText="Leave empty for no expiration"
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {form.list_type === 'whitelist' && (
            <Autocomplete<AuthorizedUser>
              options={wpUsers}
              loading={wpUsersLoading}
              getOptionLabel={(o) => o.display_name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_, v) => update('user_id', v?.id ?? null)}
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
                  label="Bind to user (optional)"
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
                {errors.length} entr{errors.length > 1 ? 'ies' : 'y'} failed:
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
          Cancel
        </Button>
        <Button
          onClick={handleSave} 
          variant="contained" 
          disableElevation
          disabled={form.value.trim() === '' || saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {saving ? 'Adding…' : 'Add entries'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
