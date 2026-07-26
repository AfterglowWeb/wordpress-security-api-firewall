import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import {
  Paper, Typography,
  Stack, Button,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';

import {
  DataGrid, GridColDef, GridRowId,
  GridRowSelectionModel, useGridApiContext,
  Toolbar, GridFilterModel, GridActionsCellItem
} from '@mui/x-data-grid';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import * as Flags from 'country-flag-icons/react/3x2';

import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import { useNavigation } from '@contexts/NavigationContext';
import { IpAPI, type IpEntry, type ListType, type AddIpEntriesForm, type LineResult } from '@services/ip';
import type { AuthorizedUser, AuthorizedUserMeta } from '@app-types/auth';
import AddIpEntriesDialog from '@features/firewall/AddIpEntriesDialog';
import EditIpEntryDialog, { type EditIpEntryPayload } from '@features/firewall/EditIpEntryDialog';
import { apiRequest } from '@services/api';


function FilterToolbar() {
  const apiRef = useGridApiContext();
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterExcludeHiddenColumns: false,
  });

  const [listFilter, setListFilter] = useState<'all' | 'whitelist' | 'blacklist'>('all');

  const handleListFilterChange = (
    event: React.MouseEvent<HTMLElement>,
    newFilter: 'all' | 'whitelist' | 'blacklist' | null,
  ) => {
    if (newFilter === null) return;
    setListFilter(newFilter);
    
    const newFilterModel: GridFilterModel = {
      items: [],
      quickFilterExcludeHiddenColumns: false,
    };

    if (newFilter !== 'all') {
      newFilterModel.items = [{
        id: 1,
        field: 'list_type',
        operator: 'equals',
        value: newFilter,
      }];
    }

    setFilterModel(newFilterModel);
    apiRef.current.setFilterModel(newFilterModel);
  };

  useEffect(() => {
    const updateFilter = () => {
      const model = filterModel;
      if (model.items.length > 0 && model.items[0].field === 'list_type') {
        const value = model.items[0].value;
        if (value === 'whitelist' || value === 'blacklist') {
          setListFilter(value);
        }
      } else {
        setListFilter('all');
      }
    };
    
    updateFilter();
  }, [filterModel]);

  return (
    <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Filter by list:
      </Typography>
      <ToggleButtonGroup
        value={listFilter}
        exclusive
        onChange={handleListFilterChange}
        size="small"
      >
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="whitelist">Whitelist</ToggleButton>
        <ToggleButton value="blacklist">Blacklist</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

interface FirewallToolbarProps {
  onAdd?: () => void;
  onDeleteSelectedIps?: (rows: Map<GridRowId, IpEntry>) => void;
}

function CustomToolbar({ onAdd, onDeleteSelectedIps }: FirewallToolbarProps) {
  const apiRef = useGridApiContext();
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Map<GridRowId, IpEntry>>(new Map());

  useEffect(() => {
    const update = () => {
      const rows = apiRef.current.getSelectedRows() as Map<GridRowId, IpEntry>;
      setSelectedCount(rows.size);
      setSelectedRows(rows);
    };
    update();
    return apiRef.current.subscribeEvent('rowSelectionChange', update);
  }, [apiRef]);

  return (
    <Toolbar style={{ gap: '16px' }}>
      <Button 
        variant="contained"
        disableElevation 
        onClick={onAdd}
        size="small"
      >
        Add IPs
      </Button>
      <Button
        variant="contained" 
        disableElevation 
        color="error"
        disabled={selectedCount === 0}
        onClick={() => onDeleteSelectedIps ? onDeleteSelectedIps(selectedRows) : false}
        size="small"
      >
        Delete ({selectedCount})
      </Button>
      <FilterToolbar />
    </Toolbar>
  );
}

interface IpManagementProps {
  wpUsers: AuthorizedUser[];
  wpUsersLoading: boolean;
}

interface AddIpEntriesResponse {
  add_count: number;
  update_count: number;
}

export default function IpManagement({ wpUsers, wpUsersLoading }: IpManagementProps) {
  const [listType, setListType] = useState<ListType>('blacklist');
  const [rows, setRows] = useState<IpEntry[]>([]);
  const { openDialog } = useDialog();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selection, setSelection] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });
  const [editingIp, setEditingIp] = useState<IpEntry | null>(null);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterExcludeHiddenColumns: false,
  });

  const [authorizedUserIds, setAuthorizedUserIds] = useState<number[]>([]);

  const { consumePanelParams } = useNavigation();

  useEffect(() => {
    const params = consumePanelParams();
    if (params?.entry_origin) {
      setFilterModel({
        items: [{ id: 1, field: 'entry_origin', operator: 'equals', value: params.entry_origin }],
        quickFilterExcludeHiddenColumns: false,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchAuthorizedUsers = async () => {
      try {
        const users = await apiRequest<AuthorizedUserMeta[]>('bromate_get_authorized_users');
        const valid = Array.isArray(users)
          ? users.filter(
              (u): u is AuthorizedUserMeta =>
                u !== null && typeof u === 'object' && typeof u.id === 'number'
            )
          : [];
        setAuthorizedUserIds(valid.map((u) => u.id));
      } catch {
        setAuthorizedUserIds([]);
      }
    };

    fetchAuthorizedUsers();
  }, []);

  const load = useCallback(async () => {
    const [black, white] = await Promise.all([
      IpAPI.getEntries('blacklist'),
      IpAPI.getEntries('whitelist'),
    ]);
    setRows([...black.entries, ...white.entries]);
  }, []);
  

  const handleAddEntries = async (form: AddIpEntriesForm): Promise<LineResult[]> => {
    if (form.entries.length === 0) {
      return [];
    }

    let result: AddIpEntriesResponse;

    try {
      result = await apiRequest<AddIpEntriesResponse>('bromate_add_ip_entries', {
        ips: JSON.stringify(
          form.entries.map((e) => ({
            ip: e.ip,
            referrer: e.referrer || null,
            expires_at: e.expires_at || null,
            user_id: e.user_id || null,
          }))
        ),
        list_type: form.list_type,
      });
    } catch (error) {
      return form.entries.map((e) => ({
        value: e.ip,
        error: error instanceof Error ? error.message : __('Unknown error', 'bromate-security-api-firewall'),
      }));
    }

    const totalSaved = (result.add_count ?? 0) + (result.update_count ?? 0);

    if (totalSaved > 0) {
      if (form.list_type !== listType) setListType(form.list_type);
      await load();
    }

    if (totalSaved >= form.entries.length) {
      setAddDialogOpen(false);
      return [];
    }

    return [{
      value: __('one or more entries', 'bromate-security-api-firewall'),
      error: __('Some entries were not saved. Check the IP/CIDR format.', 'bromate-security-api-firewall'),
    }];
  };

  const handleEditEntry = async (payload: EditIpEntryPayload): Promise<void> => {
    if (!editingIp) return;
    await IpAPI.updateEntry(editingIp.id, payload);
    await load();
    setEditingIp(null);
  };

  const handleDeleteSelected = useCallback(async (rows: Map<GridRowId, IpEntry>) => {
    if (rows.size === 0) return;
    
    const ipList = Array.from(rows.values()).map(r => r.ip).join(', ');
    const count = rows.size;
    
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Remove selected entries?', 'bromate-security-api-firewall'),
      content: __(`Are you sure you want to remove ${count} IP entr${count > 1 ? 'ies' : 'y'}? ${ipList}`, 'bromate-security-api-firewall'),
      confirmLabel: __('Remove all', 'bromate-security-api-firewall'),
      cancelLabel: __('Cancel', 'bromate-security-api-firewall'),
      onConfirm: async () => {
        const ids = Array.from(rows.keys()).map(Number);
        await IpAPI.deleteEntries(ids);
        setSelection({ type: 'include', ids: new Set() });
        await load();
      },
    });
  }, [openDialog, load]);

  const handleEditIp = useCallback((ip: IpEntry) => {
    setEditingIp(ip);
  }, []);

  const handleDeleteIp = useCallback((id: GridRowId) => {
    const entry = rows.find((r) => r.id === id);
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: 'Remove entry?',
      content: `Remove ${entry?.ip ?? id} from the ${entry?.list_type ?? 'list'}?`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        await IpAPI.deleteEntries([Number(id)]);
        await load();
      },
    });
  }, [rows, openDialog, load]);

  useEffect(() => { void load(); }, [load]);

  const ipColumns = useMemo<GridColDef<IpEntry>[]>(() => [
    { field: 'ip', headerName: 'IP / CIDR', width: 150 },
    { field: 'list_type', headerName: 'List', width: 90 },
    {
      field: 'user_id', headerName: 'User', width: 170,
      valueGetter: (_, row) => row.user_id ?? null,
      renderCell: ({ row }) => {
        const userId = row.user_id != null ? Number(row.user_id) : null;
        if (!userId) return '—';
        const user = wpUsers.find((u) => u.id === userId);
        return user
          ? <a href={user.admin_url} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {user.display_name}<OpenInNewIcon fontSize="inherit" />
            </a>
          : `${userId}`;
      },
    },
    {
      field: 'referrer', headerName: 'Referrer', flex: 1,
      valueGetter: (_, row) => row.referrer || '—',
    },
    {
      field: 'country_name', headerName: 'Country', width: 130,
      valueGetter: (_, row) => row.country_name || '—',
      renderCell: ({ row }) => {
        const countryCode = row.country_code;
        const countryName = row.country_name;
        if (!countryCode) return '—';
        const countryKey = countryCode.toUpperCase()
        const Flag = (Flags as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[countryKey];
        return Flag
          ? <Stack direction="row" alignItems="center" gap={0.75}>
              <Flag style={{ width: 20, borderRadius: 2, boxShadow: '0px 0px 3px rgba(0,0,0,0.3)' }} />
              <span>{countryName || countryCode}</span>
            </Stack>
          : countryName || countryCode;
      },
    },
    {
      field: 'country_code', headerName: 'Code', width: 80,
      renderCell: ({ row }) => {
        const countryCode = row.country_code;
        if (!countryCode) return '—';
        const countryKey = countryCode.toUpperCase()
        return countryKey;
      },
    },
    {
      field: 'created_at', headerName: 'Added', width: 150,
      valueFormatter: (value: string) => new Date(value).toLocaleString(),
    },
    {
      field: 'updated_at', headerName: 'Updated', width: 150,
      valueFormatter: (value: string | null) => value ? new Date(value).toLocaleString() : '—',
    },
    {
      field: 'expires_at', headerName: 'Expires', width: 150,
      valueFormatter: (value: string | null) => value ? new Date(value).toLocaleString() : 'Never',
    },
    { field: 'entry_type', headerName: 'Type', flex: 1 },
    { field: 'entry_origin', headerName: 'Origin', width: 100 },
    {
      field: 'actions', type: 'actions', width: 80,
      getActions: ({ row }) => [
        <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={() => handleEditIp(row)} />,
        <GridActionsCellItem icon={<DeleteIcon />} label="Remove" onClick={() => handleDeleteIp(row.id)} />,
      ],
    },
  ], [wpUsers]);

  const toolbarSlots = useMemo(() => ({ toolbar: CustomToolbar }), []);

  return (
    <>
      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2}>
          <Stack flexDirection="column" gap={0}>
            <Typography variant="h6" mb={2}>{__('IPs Management', 'bromate-security-api-firewall')}</Typography>
          </Stack>
          <DataGrid
            rows={rows}
            getRowId={(row) => row.id}
            columns={ipColumns}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selection}
            onRowSelectionModelChange={setSelection}
            showToolbar
            slots={toolbarSlots}
            slotProps={{
              toolbar: {
                onAdd: () => setAddDialogOpen(true),
                onDeleteSelectedIps: handleDeleteSelected,
              } as any,
            }}
            filterModel={filterModel}
            onFilterModelChange={setFilterModel}
          />
        </Stack>
      </Paper>

      <AddIpEntriesDialog
        open={addDialogOpen}
        defaultListType={listType}
        onSave={handleAddEntries}
        onClose={() => setAddDialogOpen(false)}
        wpUsers={wpUsers}
        wpUsersLoading={wpUsersLoading}
        authorizedUserIds={authorizedUserIds}
      />

      <EditIpEntryDialog
        open={editingIp !== null}
        entry={editingIp}
        onSave={handleEditEntry}
        onClose={() => setEditingIp(null)}
        wpUsers={wpUsers}
        wpUsersLoading={wpUsersLoading}
        authorizedUserIds={authorizedUserIds}
      />

    </>
  );
}