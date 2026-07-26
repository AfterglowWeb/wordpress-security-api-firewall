import { useState, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { usePortalContainer } from '@contexts/PortalContainerContext';
import { type ListType, type AddIpEntriesForm, type LineResult } from '@services/ip';
import type { AuthorizedUser } from '@app-types/auth';

import {
  Typography,
  Stack, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, List, ListItem, ListItemText,
  FormControlLabel, Radio, RadioGroup, FormLabel, FormControl,
  IconButton
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import AddIpEntriesRepeater, { type IpOriginRow, createEmptyRow } from '@components/AddIpEntriesRepeater';

interface AddIpEntriesDialogProps {
  open: boolean;
  defaultListType: ListType;
  onSave: (form: AddIpEntriesForm) => Promise<LineResult[]>;
  onClose: () => void;
  wpUsers: AuthorizedUser[];
  wpUsersLoading: boolean;
  authorizedUserIds: number[];
}

export default function AddIpEntriesDialog({
  open,
  defaultListType,
  onSave,
  onClose,
  wpUsers,
  wpUsersLoading,
  authorizedUserIds,
}: AddIpEntriesDialogProps) {
  const [ipRows, setIpRows] = useState<IpOriginRow[]>([createEmptyRow()]);
  const [ipRowsHaveErrors, setIpRowsHaveErrors] = useState(false);
  const [listType, setListType] = useState<ListType>(defaultListType);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<LineResult[]>([]);
  const portalContainer = usePortalContainer();

  useEffect(() => {
    if (open) {
      setIpRows([createEmptyRow()]);
      setListType(defaultListType);
      setErrors([]);
      setIpRowsHaveErrors(false);
    }
  }, [open, defaultListType]);

  const hasAnyIp = ipRows.some((r) => r.ip.trim() !== '');
  const canSave = hasAnyIp && !ipRowsHaveErrors && !saving;

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);

    const form: AddIpEntriesForm = {
      entries: ipRows
        .map((r) => ({
          ip: r.ip.trim(),
          referrer: r.referrer.trim(),
          user_id: listType === 'whitelist' ? r.user_id : null,
          expires_at: r.expires_at?.trim() || null,
        }))
        .filter((r) => r.ip !== ''),
      list_type: listType,
    };

    const lineErrors = await onSave(form);
    setSaving(false);
    if (lineErrors.length > 0) setErrors(lineErrors);
  };


  return (
    <Dialog
      container={portalContainer}
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth={'blacklist' === listType ? 'lg' : 'xl'}
      sx={{'& .MuiDialog-paper':{minHeight:500}}}
    >
      <DialogTitle>
        {__('Add IP Entries', 'bromate-security-api-firewall')}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: '8px', top: '8px', zIndex: 10 }}>
          <CloseIcon fontSize="large" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <FormControl>
            <FormLabel>{__('List', 'bromate-security-api-firewall')}</FormLabel>
            <RadioGroup
              row
              value={listType}
              onChange={(e) => setListType(e.target.value as ListType)}
            >
              <FormControlLabel value="blacklist" control={<Radio size="small" />} label={__('Blacklist', 'bromate-security-api-firewall')} />
              <FormControlLabel value="whitelist" control={<Radio size="small" />} label={__('Whitelist', 'bromate-security-api-firewall')} />
            </RadioGroup>
          </FormControl>

         

          <AddIpEntriesRepeater
            rows={ipRows}
            onChange={setIpRows}
            disabled={saving}
            onValidityChange={setIpRowsHaveErrors}
            listType={listType}
            userSelection={{ wpUsers, wpUsersLoading, authorizedUserIds }}
          />


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
      <DialogActions sx={{ color: 'text.secondary' }}>
        <Button onClick={onClose} disableElevation color="inherit" disabled={saving}>
          {__('Cancel', 'bromate-security-api-firewall')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disableElevation
          disabled={!canSave}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {saving ? __('Saving…', 'bromate-security-api-firewall') : __('Add entries', 'bromate-security-api-firewall')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}