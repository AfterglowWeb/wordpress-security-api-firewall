import { useState, useCallback, useMemo, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Paper, Typography, Button, Snackbar, Alert, Chip, Tooltip, Stack } from '@mui/material';
import {
  DataGrid, GridColDef, GridActionsCellItem, GridRowId,
  GridRowSelectionModel, Toolbar, useGridApiContext,
} from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import type { AuthorizedUser, AuthorizedUserMeta, AuthSettings } from '@app-types/auth';
import type { IpEntry } from '@services/ip';
import type { LogEntry, LogSeverity } from '@services/log';
import UserDialog from '@features/authentication/UserDialog';
import { apiRequest } from '@services/api';
import { SettingsAPI } from '@services/settings';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import { usePortalContainer } from '@contexts/PortalContainerContext';


declare module '@mui/x-data-grid' {
  interface ToolbarPropsOverrides {
    onAddUser?: () => void;
    onAdd?: () => void;
    onDeleteSelectedUser?: (rows: Map<GridRowId, AuthorizedUser>) => void;
    onDeleteSelectedIps?: (rows: Map<GridRowId, IpEntry>) => void;
    onDeleteSelected?: (rows: Map<GridRowId, LogEntry>) => void;
    selectedCount: number;
    severityFilter?: LogSeverity | 'all';
    onSeverityChange?: (v: LogSeverity | 'all') => void;
  }
}

interface AuthenticationToolbarProps {
  onAddUser?: () => void;
  onDeleteSelectedUser?: (rows: Map<GridRowId, AuthorizedUser>) => void;
  selectedCount: number;
}

interface AuthorizedUsersGridProps {
  /** Currently selected/active application auth method — drives JWT-field disabling and the app-password check. */
  authMethod: AuthSettings['auth_methods'];
}

function CustomToolbar({ onAddUser, onDeleteSelectedUser }: AuthenticationToolbarProps) {
  const apiRef = useGridApiContext();
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Map<GridRowId, AuthorizedUser>>(new Map());

  useEffect(() => {
    const update = () => {
      const rows = apiRef.current.getSelectedRows() as Map<GridRowId, AuthorizedUser>;
      setSelectedCount(rows.size);
      setSelectedRows(rows);
    };
    update();
    return apiRef.current.subscribeEvent('rowSelectionChange', update);
  }, [apiRef]);

  return (
    <Toolbar style={{ gap: '16px' }}>
      <Button variant="contained" disableElevation onClick={onAddUser} size="small">
        {__('Add user', 'bromate-security-api-firewall')}
      </Button>
      <Button
        color="error"
        variant="contained"
        disableElevation
        disabled={selectedCount === 0}
        onClick={() => (onDeleteSelectedUser ? onDeleteSelectedUser(selectedRows) : false)}
        size="small"
      >
        {`${__('Delete', 'bromate-security-api-firewall')} (${selectedCount})`}
      </Button>
    </Toolbar>
  );
}

export default function AuthorizedUsersGrid({ authMethod }: AuthorizedUsersGridProps): JSX.Element {
  const [authUsers, setAuthUsers] = useState<AuthorizedUserMeta[]>([]);
  const portalContainer = usePortalContainer();
  const { openDialog } = useDialog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthorizedUser | null>(null);
  const [wpUsers, setWpUsers] = useState<AuthorizedUser[]>([]);
  const [wpUsersLoading, setWpUsersLoading] = useState(false);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const authorizedUsers = useMemo<AuthorizedUser[]>(
    () =>
      authUsers.flatMap((meta) => {
        const wpUser = wpUsers.find((u) => u.id === meta.id);
        if (!wpUser) return [];
        return [{
          ...wpUser,
          jwt_subclaim: meta.jwt_subclaim,
          status: meta.status,
          expires_at: meta.expires_at,
        }];
      }),
    [authUsers, wpUsers]
  );

  const authorizedUserIds = useMemo(() => authUsers.map((u) => u.id), [authUsers]);

  const resolveDisplayStatus = (user: AuthorizedUser): 'active' | 'expiring' | 'revoked' => {
    if (user.status === 'revoked') return 'revoked';
    if (user.expires_at) {
      const days = Math.ceil(
        (new Date(user.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (days <= 0) return 'revoked';
      if (days <= 30) return 'expiring';
    }
    return 'active';
  };

  const statusLabels: Record<'active' | 'expiring' | 'revoked', string> = {
    active: __('active', 'bromate-security-api-firewall'),
    expiring: __('expiring', 'bromate-security-api-firewall'),
    revoked: __('revoked', 'bromate-security-api-firewall'),
  };

  const fetchWordPressUsers = useCallback(async () => {
    setWpUsersLoading(true);
    try {
      const users = await apiRequest<AuthorizedUser[]>('bromate_authorized_users_options');
      setWpUsers(users);
    } catch {
      setSnackbar({
        open: true,
        message: __('Failed to load WordPress users', 'bromate-security-api-firewall'),
        severity: 'error',
      });
    } finally {
      setWpUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWordPressUsers();
  }, [fetchWordPressUsers]);

  useEffect(() => {
    SettingsAPI.readOptions()
      .then((options) => {
        const users = (options as any).auth_users;
        if (Array.isArray(users)) {
          const valid = users.filter(
            (u: any): u is AuthorizedUserMeta =>
              u !== null && typeof u === 'object' && typeof u.id === 'number'
          );
          setAuthUsers(valid);
        }
      })
      .catch(() =>
        setSnackbar({
          open: true,
          message: __('Failed to load authorized users', 'bromate-security-api-firewall'),
          severity: 'error',
        })
      );
  }, []);

  const persistUsers = useCallback((users: AuthorizedUserMeta[]) => {
    setAuthUsers(users);
    SettingsAPI.updateOption('auth_users', users).catch(() =>
      setSnackbar({
        open: true,
        message: __('Failed to save changes', 'bromate-security-api-firewall'),
        severity: 'error',
      })
    );
  }, []);

  const doSaveUser = useCallback((user: AuthorizedUser) => {
    const meta: AuthorizedUserMeta = {
      id: user.id,
      jwt_subclaim: user.jwt_subclaim ?? '',
      status: user.status ?? 'active',
      expires_at: user.expires_at ?? '',
    };
    const exists = authUsers.some((u) => u.id === meta.id);
    const newUsers = exists
      ? authUsers.map((u) => (u.id === meta.id ? meta : u))
      : [...authUsers, meta];
    persistUsers(newUsers);
    setSnackbar({
      open: true,
      message: exists
        ? __('User updated successfully', 'bromate-security-api-firewall')
        : __('User added successfully', 'bromate-security-api-firewall'),
      severity: 'success',
    });
    setDialogOpen(false);
    setEditingUser(null);
  }, [authUsers, persistUsers]);

  const handleSaveUser = useCallback((user: AuthorizedUser) => {
    const exists = authUsers.some((u) => u.id === user.id);
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: exists
        ? __('Save changes?', 'bromate-security-api-firewall')
        : __('Add user?', 'bromate-security-api-firewall'),
      content: exists
        ? `${__('Save changes for', 'bromate-security-api-firewall')} ${user.display_name}?`
        : `${__('Add', 'bromate-security-api-firewall')} ${user.display_name} ${__('to authorized users?', 'bromate-security-api-firewall')}`,
      confirmLabel: exists
        ? __('Save', 'bromate-security-api-firewall')
        : __('Add', 'bromate-security-api-firewall'),
      onConfirm: () => doSaveUser(user),
    });
  }, [authUsers, openDialog, doSaveUser]);

  const handleDeleteUser = useCallback((id: GridRowId) => {
    const user = authorizedUsers.find((u) => u.id === id);
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Remove user?', 'bromate-security-api-firewall'),
      content: `${__('Remove', 'bromate-security-api-firewall')} ${user?.display_name ?? id} ${__('from authorized users?', 'bromate-security-api-firewall')}`,
      confirmLabel: __('Remove', 'bromate-security-api-firewall'),
      onConfirm: () => {
        const newUsers = authUsers.filter((u) => u.id !== id);
        persistUsers(newUsers);
        setSnackbar({
          open: true,
          message: __('User removed', 'bromate-security-api-firewall'),
          severity: 'success',
        });
      },
    });
  }, [authUsers, authorizedUsers, openDialog, persistUsers]);

  const handleDeleteSelected = useCallback((rows: Map<GridRowId, AuthorizedUser>) => {
    if (rows.size === 0) return;
    const ids = new Set(rows.keys());
    const names = Array.from(rows.values()).map((u) => u.display_name).join(', ');

    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: `${__('Remove', 'bromate-security-api-firewall')} ${rows.size} ${__('user(s)?', 'bromate-security-api-firewall')}`,
      content: `${__('This will remove:', 'bromate-security-api-firewall')} ${names}`,
      confirmLabel: __('Remove all', 'bromate-security-api-firewall'),
      onConfirm: () => {
        const newUsers = authUsers.filter((u) => !ids.has(u.id));
        persistUsers(newUsers);
        setSnackbar({
          open: true,
          message: `${__('Removed', 'bromate-security-api-firewall')} ${rows.size} ${__('user(s)', 'bromate-security-api-firewall')}`,
          severity: 'success',
        });
        setRowSelectionModel({ type: 'include', ids: new Set() });
      },
    });
  }, [authUsers, openDialog, persistUsers]);

  const handleAddUser = useCallback(() => {
    setEditingUser(null);
    setDialogOpen(true);
  }, []);

  const handleEditUser = useCallback((user: AuthorizedUser) => {
    setEditingUser(user);
    setDialogOpen(true);
  }, []);

  const toolbarSlots = useMemo(() => ({ toolbar: CustomToolbar }), []);

  const columns: GridColDef<AuthorizedUser>[] = [
    { field: 'id', headerName: __('ID', 'bromate-security-api-firewall'), width: 80 },
    {
      field: 'display_name', headerName: __('User', 'bromate-security-api-firewall'), width: 190,
      valueGetter: (_, row) => row.id ?? null,
      renderCell: ({ row }) => {
        const userId = row.id != null ? Number(row.id) : null;
        if (!userId) return '—';
        const user = wpUsers.find((u) => u.id === userId);
        if (!user) return `${userId}`;
        const missingAppPassword = authMethod === 'wp_auth' && !user.has_wp_app_password;
        return (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <a href={user.admin_url} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {user.display_name}<OpenInNewIcon fontSize="inherit" />
            </a>
            {missingAppPassword && (
              <Tooltip slotProps={{ popper: { container: portalContainer } }} title={__('WordPress Auth is active but this user has no application password — REST API requests will be rejected until one is generated on their profile.', 'bromate-security-api-firewall')}>
                <WarningAmberIcon color="warning" fontSize="small" />
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
    {
      field: 'email', headerName: __('Email', 'bromate-security-api-firewall'), flex: 1,
      valueGetter: (_, row) => row.email || '—',
    },
    {
      field: 'wp_role', headerName: __('Role', 'bromate-security-api-firewall'), width: 120,
      valueGetter: (_, row) => (row.roles?.length > 0 ? row.roles[0] : '—'),
    },
    {
      field: 'jwt_subclaim', headerName: __('JWT sub claim', 'bromate-security-api-firewall'), flex: 1,
      valueGetter: (_, row) => row.jwt_subclaim || '—',
    },
    {
      field: 'status', headerName: __('Status', 'bromate-security-api-firewall'), width: 110,
      renderCell: ({ row }) => {
        const s = resolveDisplayStatus(row);
        return (
          <Chip label={statusLabels[s]} size="small" sx={{
            backgroundColor: { active: '#4caf50', expiring: '#ff9800', revoked: '#f44336' }[s],
            color: 'white',
          }} />
        );
      },
    },
    {
      field: 'expires_at', headerName: __('Expires', 'bromate-security-api-firewall'), width: 120,
      valueFormatter: (value: string | undefined) =>
        value ? new Date(value).toLocaleDateString() : '—',
    },
    {
      field: 'actions', type: 'actions', width: 80,
      getActions: ({ row }) => [
        <GridActionsCellItem
          icon={<EditIcon />}
          label={__('Edit', 'bromate-security-api-firewall')}
          onClick={() => handleEditUser(row)}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label={__('Remove', 'bromate-security-api-firewall')}
          onClick={() => handleDeleteUser(row.id)}
        />,
      ],
    },
  ];

  return (
    <Paper sx={{ p: 2 }} elevation={0}>
      <Typography variant="h6" mb={2}>{__('Application authorized users', 'bromate-security-api-firewall')}</Typography>
      <DataGrid
        rows={authorizedUsers}
        columns={columns}
        autoHeight
        pageSizeOptions={[10, 25]}
        showToolbar
        checkboxSelection
        disableRowSelectionOnClick
        loading={wpUsersLoading}
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={setRowSelectionModel}
        slots={toolbarSlots}
        slotProps={{
          toolbar: {
            onAddUser: handleAddUser,
            onDeleteSelectedUser: handleDeleteSelected,
          },
        }}
      />

      <UserDialog
        open={dialogOpen}
        user={editingUser}
        onSave={handleSaveUser}
        onClose={() => setDialogOpen(false)}
        wpUsers={wpUsers}
        wpUsersLoading={wpUsersLoading}
        fetchWordPressUsers={fetchWordPressUsers}
        authorizedUserIds={authorizedUserIds}
        authMethod={authMethod}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
