import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  Paper, Typography, Stack, Button, IconButton,
  List, ListItem, ListItemText, ListItemSecondaryAction, Chip, Skeleton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { apiRequest } from '@services/api';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import type { AuthorizedUser } from '@app-types/auth';
import LoginIpRestrictionDialog from '@features/login/LoginIpRestrictionDialog';

interface RestrictedUserRow {
  user_id: number;
  entry_count: number;
}

export default function LoginIpRestrictions(): JSX.Element {
  const [rows, setRows] = useState<RestrictedUserRow[]>([]);
  const [userDetails, setUserDetails] = useState<Record<number, AuthorizedUser>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const { openDialog } = useDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const restricted = await apiRequest<RestrictedUserRow[]>('bromate_get_login_ip_restricted_users');
      setRows(Array.isArray(restricted) ? restricted : []);

      const ids = (Array.isArray(restricted) ? restricted : []).map((r) => r.user_id);
      if (ids.length > 0) {
        const users = await apiRequest<AuthorizedUser[]>('bromate_get_authorized_wp_users', {
          ids: JSON.stringify(ids),
        });
        const map: Record<number, AuthorizedUser> = {};
        (Array.isArray(users) ? users : []).forEach((u) => { map[u.id] = u; });
        setUserDetails(map);
      } else {
        setUserDetails({});
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = () => {
    setEditingUserId(null);
    setDialogOpen(true);
  };

  const handleEdit = (userId: number) => {
    setEditingUserId(userId);
    setDialogOpen(true);
  };

  const handleRemove = (userId: number) => {
    const user = userDetails[userId];
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Remove IP restriction?', 'bromate-security-api-firewall'),
      content: __('This removes all login IP restrictions for', 'bromate-security-api-firewall') + ` ${user?.display_name ?? userId}.`,
      confirmLabel: __('Remove', 'bromate-security-api-firewall'),
      onConfirm: async () => {
        await apiRequest('bromate_clear_login_ip_restriction', { user_id: userId });
        await load();
      },
    });
  };

  const handleDialogSaved = () => {
    setDialogOpen(false);
    setEditingUserId(null);
    void load();
  };

  if (loading) {
    return <Skeleton variant="rounded" width="100%" height={180} />;
  }

  return (
    <Paper sx={{ p: 2 }} elevation={0}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack>
          <Typography variant="h6">{__('Login IP Restrictions', 'bromate-security-api-firewall')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {__('Restrict which IPs can log in to wp-admin for specific users.', 'bromate-security-api-firewall')}
          </Typography>
        </Stack>
        <Button variant="contained" disableElevation size="small" onClick={handleAdd}>
          {__('Add restriction', 'bromate-security-api-firewall')}
        </Button>
      </Stack>

      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {__('No login IP restrictions configured.', 'bromate-security-api-firewall')}
        </Typography>
      ) : (
        <List dense disablePadding>
          {rows.map((row) => {
            const user = userDetails[row.user_id];
            return (
              <ListItem key={row.user_id} divider>
                <ListItemText
                  primary={
                    user ? (
                      <a href={user.admin_url} target="_blank" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} rel="noreferrer">
                        {user.display_name}<OpenInNewIcon fontSize="inherit" />
                      </a>
                    ) : `#${row.user_id}`
                  }
                  secondary={`${row.entry_count} ${row.entry_count === 1 ? __('IP', 'bromate-security-api-firewall') : __('IPs', 'bromate-security-api-firewall')}`}
                />
                <ListItemSecondaryAction>
                  <IconButton size="small" onClick={() => handleEdit(row.user_id)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleRemove(row.user_id)}><DeleteIcon fontSize="small" /></IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      )}

      <LoginIpRestrictionDialog
        open={dialogOpen}
        userId={editingUserId}
        onClose={() => setDialogOpen(false)}
        onSaved={handleDialogSaved}
      />
    </Paper>
  );
}