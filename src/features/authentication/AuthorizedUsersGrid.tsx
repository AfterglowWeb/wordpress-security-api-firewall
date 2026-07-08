import { useState, useCallback, useMemo, useEffect } from '@wordpress/element';
import { Paper, Typography, Button, Snackbar, Alert, Chip } from '@mui/material';
import {
  DataGrid, GridColDef, GridActionsCellItem, GridRowId,
  GridRowSelectionModel, Toolbar, useGridApiContext,
} from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import type { AuthorizedUser, AuthorizedUserMeta } from '@app-types/auth';
import type { IpEntry } from '@services/ip';
import type { LogEntry, LogSeverity } from '@services/log';
import UserDialog from '@features/authentication/UserDialog';
import { apiRequest } from '@services/api';
import { SettingsAPI } from '@services/settings';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';

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
        Add user
      </Button>
      <Button
        color="error"
        variant="contained"
        disableElevation
        disabled={selectedCount === 0}
        onClick={() => (onDeleteSelectedUser ? onDeleteSelectedUser(selectedRows) : false)}
        size="small"
      >
        Delete ({selectedCount})
      </Button>
    </Toolbar>
  );
}

export default function AuthorizedUsersGrid(): JSX.Element {
  const [authUsers, setAuthUsers] = useState<AuthorizedUserMeta[]>([]);

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
          jwt_claim_sub: meta.jwt_claim_sub,
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

  const fetchWordPressUsers = useCallback(async () => {
    setWpUsersLoading(true);
    try {
      const users = await apiRequest<AuthorizedUser[]>('bromate_authorized_users_options');
      setWpUsers(users);
    } catch {
      setSnackbar({ open: true, message: 'Failed to load WordPress users', severity: 'error' });
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
        setSnackbar({ open: true, message: 'Failed to load authorized users', severity: 'error' })
      );
  }, []);

  const persistUsers = useCallback((users: AuthorizedUserMeta[]) => {
    setAuthUsers(users);
    SettingsAPI.updateOption('auth_users', users).catch(() =>
      setSnackbar({ open: true, message: 'Failed to save changes', severity: 'error' })
    );
  }, []);

  const doSaveUser = useCallback((user: AuthorizedUser) => {
    const meta: AuthorizedUserMeta = {
      id: user.id,
      jwt_claim_sub: user.jwt_claim_sub ?? '',
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
      message: exists ? 'User updated successfully' : 'User added successfully',
      severity: 'success',
    });
    setDialogOpen(false);
    setEditingUser(null);
  }, [authUsers, persistUsers]);

  const handleSaveUser = useCallback((user: AuthorizedUser) => {
    const exists = authUsers.some((u) => u.id === user.id);
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: exists ? 'Save changes?' : 'Add user?',
      content: exists
        ? `Save changes for ${user.display_name}?`
        : `Add ${user.display_name} to authorized users?`,
      confirmLabel: exists ? 'Save' : 'Add',
      onConfirm: () => doSaveUser(user),
    });
  }, [authUsers, openDialog, doSaveUser]);

  const handleDeleteUser = useCallback((id: GridRowId) => {
    const user = authorizedUsers.find((u) => u.id === id);
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: 'Remove user?',
      content: `Remove ${user?.display_name ?? id} from authorized users?`,
      confirmLabel: 'Remove',
      onConfirm: () => {
        const newUsers = authUsers.filter((u) => u.id !== id);
        persistUsers(newUsers);
        setSnackbar({ open: true, message: 'User removed', severity: 'success' });
      },
    });
  }, [authUsers, authorizedUsers, openDialog, persistUsers]);

  const handleDeleteSelected = useCallback((rows: Map<GridRowId, AuthorizedUser>) => {
    if (rows.size === 0) return;
    const ids = new Set(rows.keys());
    const names = Array.from(rows.values()).map((u) => u.display_name).join(', ');

    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: `Remove ${rows.size} user(s)?`,
      content: `This will remove: ${names}`,
      confirmLabel: 'Remove all',
      onConfirm: () => {
        const newUsers = authUsers.filter((u) => !ids.has(u.id));
        persistUsers(newUsers);
        setSnackbar({ open: true, message: `Removed ${rows.size} user(s)`, severity: 'success' });
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
    { field: 'id', headerName: 'ID', width: 80 },
    {
      field: 'display_name', headerName: 'User', width: 170,
      valueGetter: (_, row) => row.id ?? null,
      renderCell: ({ row }) => {
        const userId = row.id != null ? Number(row.id) : null;
        if (!userId) return '—';
        const user = wpUsers.find((u) => u.id === userId);
        return user
          ? <a href={user.admin_url} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {user.display_name}<OpenInNewIcon fontSize="inherit" />
            </a>
          : `${userId}`;
      },
    },
    { field: 'email', headerName: 'Email', flex: 1, valueGetter: (_, row) => row.email || '—' },
    {
      field: 'wp_role', headerName: 'Role', width: 120,
      valueGetter: (_, row) => (row.roles?.length > 0 ? row.roles[0] : '—'),
    },
    {
      field: 'jwt_claim_sub', headerName: 'JWT sub claim', flex: 1,
      valueGetter: (_, row) => row.jwt_claim_sub || '—',
    },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ row }) => {
        const s = resolveDisplayStatus(row);
        return (
          <Chip label={s} size="small" sx={{
            backgroundColor: { active: '#4caf50', expiring: '#ff9800', revoked: '#f44336' }[s],
            color: 'white',
          }} />
        );
      },
    },
    {
      field: 'expires_at', headerName: 'Expires', width: 120,
      valueFormatter: (value: string | undefined) =>
        value ? new Date(value).toLocaleDateString() : '—',
    },
    {
      field: 'actions', type: 'actions', width: 80,
      getActions: ({ row }) => [
        <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={() => handleEditUser(row)} />,
        <GridActionsCellItem icon={<DeleteIcon />} label="Remove" onClick={() => handleDeleteUser(row.id)} />,
      ],
    },
  ];

  return (
    <Paper sx={{ p: 2 }} elevation={0}>
      <Typography variant="h6" mb={2}>Authorized users</Typography>
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