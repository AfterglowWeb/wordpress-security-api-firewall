import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { useNavigation } from '@contexts/NavigationContext';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import { usePortalContainer } from '@contexts/PortalContainerContext';

import {
  Box, Paper, Typography, Switch,
  Stack, TextField, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, List, ListItem, ListItemText,
  FormControlLabel, Radio, RadioGroup, FormLabel, FormControl,
  ToggleButton, ToggleButtonGroup, Autocomplete
} from '@mui/material';

import {
  DataGrid, GridColDef, GridRowId,
  GridRowSelectionModel, useGridApiContext,
  Toolbar, GridFilterModel, GridActionsCellItem
} from '@mui/x-data-grid';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import * as Flags from 'country-flag-icons/react/3x2'

import type { RateLimitSettings } from '@app-types/rate-limiting';
import type { AuthorizedUser } from '@app-types/auth';

import { IpAPI, type IpEntry, type ListType } from '@services/ip';
import { apiRequest } from '@services/api';
import { SettingsAPI } from '@services/settings';
import ConfirmDialog from '@components/ConfirmDialog';
import CountryBlockPanel from '@features/firewall/CountryBlockPanel';
import BlockedCountriesSummary from '@features/firewall/BlockedCountriesSummary';
import { __ } from '@wordpress/i18n';
import SaveButton from '@components/SaveButton';

interface LineResult {
  value: string;
  error: string;
}

interface AddEntryForm {
  value: string;
  list_type: ListType;
  user_id: number | null;
  referrer: string;
  expires_at: string | null;
}

const EMPTY_FORM: AddEntryForm = {
  value: '',
  list_type: 'blacklist',
  user_id: null,
  referrer: '',
  expires_at: null,
};

interface AddEntryDialogProps {
  open: boolean;
  defaultListType: ListType;
  onSave: (form: AddEntryForm) => Promise<LineResult[]>;
  onClose: () => void;
  wpUsers: AuthorizedUser[];
  wpUsersLoading: boolean;
  editingEntry: IpEntry | null;

}

function AddEntryDialog({ open, defaultListType, onSave, onClose, wpUsers, wpUsersLoading, editingEntry }: AddEntryDialogProps) {
  const [form, setForm] = useState<AddEntryForm>({ ...EMPTY_FORM, list_type: defaultListType });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<LineResult[]>([]);
  const portalContainer = usePortalContainer();

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

  return (
    <Dialog
      container={portalContainer} open={open}
      onClose={saving ? undefined : onClose}
      fullWidth maxWidth="xs"
    >
      <DialogTitle>{editingEntry ? 'Edit entry' : 'Add access control entries'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>

          <FormControl>
            <FormLabel>List</FormLabel>
            <RadioGroup row value={form.list_type}
              onChange={(e) => update('list_type', e.target.value as ListType)}>
              <FormControlLabel value="blacklist" control={<Radio size="small" />} label="Blacklist" />
              <FormControlLabel value="whitelist" control={<Radio size="small" />} label="Whitelist" />
            </RadioGroup>
          </FormControl>

          <TextField
            label="IPs / CIDRs (one per line)"
            placeholder={'203.0.113.1\n203.0.113.2\n203.0.113.0/24'}
            value={form.value}
            onChange={(e) => update('value', e.target.value)}
            multiline minRows={4} maxRows={10}
            fullWidth size="small" disabled={saving}
          />

          {/* Referrer — always available, useful on both lists */}
          <TextField
            label="Referrer (optional)"
            placeholder="https://app.example.com"
            value={form.referrer}
            onChange={(e) => update('referrer', e.target.value)}
            fullWidth size="small" disabled={saving}
            helperText="If set, access is only allowed from this origin"
          />

          <TextField
            label="Expires at (optional)"
            type="datetime-local"
            value={form.expires_at ?? ''}
            onChange={(e) => update('expires_at', e.target.value || null)}
            fullWidth size="small" disabled={saving}
            helperText="Leave empty for no expiration"
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {/* User binding — only meaningful for whitelist */}
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

          {errors.length > 0 && (
            <Alert severity="error" variant="outlined">
              <Typography variant="body2" fontWeight={600} mb={0.5}>
                {errors.length} entr{errors.length > 1 ? 'ies' : 'y'} failed:
              </Typography>
              <List dense disablePadding>
                {errors.map((e) => (
                  <ListItem key={e.value} disablePadding>
                    <ListItemText primary={
                      <Typography variant="body2" fontFamily="monospace">
                        {e.value} — {e.error}
                      </Typography>
                    } />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" disableElevation color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave} variant="contained" disableElevation
          disabled={form.value.trim() === '' || saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {saving ? 'Adding…' : 'Add entries'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
    
    // Update the filter model
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

  // Subscribe to filter model changes from the grid
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
        <ToggleButton value="whitelist">
          Whitelist
        </ToggleButton>
        <ToggleButton value="blacklist">
          Blacklist
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

interface FirewallToolbarProps {
  onAdd?: () => void;
  onDeleteSelectedIps?: (rows: Map<GridRowId, IpEntry>) => void;
  selectedCount: number;
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
    <Toolbar style={{gap:'16px'}}>
      <Button 
      variant="contained"
      disableElevation 
      onClick={onAdd}
      size="small"
      >Add IPs</Button>
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

export default function Firewall(): JSX.Element {

  const [settings, setSettings] = useState<RateLimitSettings>({
    rate_limit_enabled: false,
    rate_limit_max: 120,
    rate_limit_time: 60,
    rate_limit_block_duration: 60,
    rate_limit_blacklist_threshold: 5,
    rate_limit_emergency_token_hash: '',
    rate_limit_countries: []
  });
  const [settingsLoading, setLoadingSettings] = useState(true);
  const [loadedSettings, setLoadedSettings] = useState({});

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(loadedSettings),
    [settings, loadedSettings]
  );

  const handleSave = useCallback(async () => {
    await SettingsAPI.updateOptions(settings);
    setLoadedSettings(settings);
  }, [settings]);

  useEffect(() => {
    SettingsAPI.readOptions()
      .then((opts) => {
        setSettings((prev) => ({ ...prev, ...opts }));
        setLoadedSettings(opts);
      })
      .finally(() => setLoadingSettings(false));
  }, []);

  const [countriesView, setCountriesView] = useState(false);

  const handleSaveBlockedCountries = useCallback(async (codes: string[]) => {
    await SettingsAPI.updateOption('rate_limit_countries', codes);
    setSettings((prev) => ({ ...prev, rate_limit_countries: codes }));
    setCountriesView(false);
  }, []);

  const updateSetting = <K extends keyof RateLimitSettings>(key: K, value: RateLimitSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const [listType, setListType]     = useState<ListType>('blacklist');
  const [rows, setRows]             = useState<IpEntry[]>([]);
  const { openDialog } = useDialog();
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [selection, setSelection]   = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });

  const [editingIp, setEditingIp] = useState<IpEntry | null>(null);

  const load = useCallback(async () => {
    const [black, white] = await Promise.all([
      IpAPI.getEntries('blacklist'),
      IpAPI.getEntries('whitelist'),
    ]);
    setRows([...black.entries, ...white.entries]);
  }, []);

  const handleAddEntries = async (form: AddEntryForm): Promise<LineResult[]> => {
    if (editingIp) {
      await IpAPI.updateEntry(editingIp.id, {
        list_type:  form.list_type,
        user_id:    form.user_id,
        referrer:   form.referrer || null,
        expires_at: form.expires_at || null,
      });
      await load();
      setEntryDialogOpen(false);
      setEditingIp(null);
      return [];
    }

    const lines = form.value.split('\n').map((l) => l.trim()).filter(Boolean);

    const results = await Promise.allSettled(
      lines.map((val) => IpAPI.addEntry(val, form.list_type, form.user_id, form.referrer || null, form.expires_at || null))
    );

    const errors: LineResult[] = results
      .map((result, i) => ({ result, val: lines[i] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, val }) => ({
        value: val,
        error: (result as PromiseRejectedResult).reason?.message ?? 'Unknown error',
      }));

    const anySuccess = results.some((r) => r.status === 'fulfilled');
    if (anySuccess) {
      if (form.list_type !== listType) setListType(form.list_type);
      else await load();
    }

    if (errors.length === 0) setEntryDialogOpen(false);
    return errors;
  };

  const handleDeleteSelected = useCallback(async (rows: Map<GridRowId, IpEntry>) => {
    if (rows.size === 0) return;
    const ids = Array.from(rows.keys()).map(Number);
    await IpAPI.deleteEntries(ids);
    setSelection({ type: 'include', ids: new Set() });
    await load();
  }, [load]);

  const handleEditIp = useCallback((ip: IpEntry) => {
    setEditingIp(ip);
    setEntryDialogOpen(true);
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

  const toolbarSlots = useMemo(() => ({ toolbar: CustomToolbar }), []);

  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterExcludeHiddenColumns: false,
  });

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

  const [wpUsers, setWpUsers] = useState<AuthorizedUser[]>([]);
  const [wpUsersLoading, setWpUsersLoading] = useState(false);

  useEffect(() => {
    setWpUsersLoading(true);
    apiRequest<AuthorizedUser[]>('bromate_authorized_users_options')
      .then(setWpUsers)
      .catch(() => {/* optionally show snackbar */})
      .finally(() => setWpUsersLoading(false));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ipColumns = useMemo<GridColDef<IpEntry>[]>(() => [
    { field: 'ip', headerName: 'IP / CIDR', width: 150},
    { field: 'list_type', headerName: 'List', width: 90 },
    {
      field: 'user_id', headerName: 'User', width: 170,
      valueGetter: (_, row) => row.user_id ?? null,
      renderCell: ({ row }) => {
        const userId = row.user_id != null ? Number(row.user_id) : null;
        if (!userId) return '—';
        const user = wpUsers.find((u) => u.id === userId);
        return user
          ? <a href={user.admin_url} target="_blank" style={{display:'flex',alignItems:'center',gap:'4px'}}>
            {user.display_name}<OpenInNewIcon fontSize="inherit"/>
            </a>
          : `${userId}`;
      },
    },
    {
      field: 'referrer', headerName: 'Referrer', flex: 1,
      valueGetter: (_, row) => row.referrer || '—',
    },
    { field: 'country_name', headerName: 'Country', width: 130,
      valueGetter: (_, row) => row.country_name || '—',
    },
    { field: 'country_code', headerName: 'Code', width: 80,
      renderCell: ({ row }) => {
        const countryCode = row.country_code;
        if (!countryCode) return '—';
        const Flag = (Flags as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[countryCode];
        return Flag
          ? <Stack direction="row" alignItems="center" gap={0.75}>
              <Flag style={{ width: 20, borderRadius: 2, boxShadow: '0px 0px 3px rgba(0,0,0,0.3)' }} />
              <span>{countryCode}</span>
            </Stack>
          : countryCode;
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
        <GridActionsCellItem icon={<EditIcon />}   label="Edit"   onClick={() => handleEditIp(row)} />,
        <GridActionsCellItem icon={<DeleteIcon />} label="Remove" onClick={() => handleDeleteIp(row.id)} />,
      ],
    },
  ], [wpUsers]);


  return (
    <Stack spacing={3}>
      {!countriesView && (
        <>
         <Stack direction="row" justifyContent="flex-end">
          <SaveButton
            onSave={handleSave}
            disabled={!isDirty}
            messages={{
              confirmTitle: __('Save firewall settings', 'bromate-security-api-firewall'),
              confirmContent: __('Apply these rate limiting and firewall changes now?', 'bromate-security-api-firewall'),
              confirmLabel: __('Save', 'bromate-security-api-firewall'),
              successMessage: __('Firewall settings saved successfully.', 'bromate-security-api-firewall'),
              errorMessage: __('Failed to save firewall settings.', 'bromate-security-api-firewall'),
              saveLabel: __('Save', 'bromate-security-api-firewall'),
              savingLabel: __('Saving…', 'bromate-security-api-firewall'),
            }}
            />
          </Stack>
          <Paper sx={{ p: 2 }} elevation={0}>
            <Stack flexDirection="column" gap={2}>
              <FormControlLabel
                label="Enable Firewall"
                control={
                  <Switch
                    checked={settings.rate_limit_enabled}
                    onChange={(e) => updateSetting('rate_limit_enabled', e.target.checked)}
                  />
                }
              />

              <Stack>
                <Typography variant="h6" mb={2}>Rate Limiting</Typography>
                <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">
                  <TextField
                    label="Maximum requests"
                    type="number"
                    value={settings.rate_limit_max}
                    onChange={(e) => updateSetting('rate_limit_max', Number(e.target.value))}
                  />
                  <TextField
                    label="Time window (seconds)"
                    type="number"
                    value={settings.rate_limit_time}
                    onChange={(e) => updateSetting('rate_limit_time', Number(e.target.value))}
                  />
                  <TextField
                    label="Block duration (seconds)"
                    type="number"
                    value={settings.rate_limit_block_duration}
                    onChange={(e) => updateSetting('rate_limit_block_duration', Number(e.target.value))}
                  />
                  <TextField
                    label="Blacklist threshold"
                    type="number"
                    value={settings.rate_limit_blacklist_threshold}
                    onChange={(e) => updateSetting('rate_limit_blacklist_threshold', Number(e.target.value))}
                    helperText="Violations before auto-ban"
                  />
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        </>
      )}

      <Paper sx={{ p: 2 }} elevation={0}>
        <Stack flexDirection="column" gap={2}>
          {!countriesView && (
            <Typography variant="h6">Blocked Countries</Typography>
          )}
          <Box>
          <Button
            size="small"
            disableElevation
            variant="contained"
            disabled={settingsLoading}
            onClick={() => setCountriesView((v) => !v)}
            startIcon={countriesView ? <KeyboardArrowLeftIcon fontSize="inherit" /> : null}
            endIcon={countriesView ? null : <KeyboardArrowRightIcon fontSize="inherit" />}
          >
            {countriesView ? 'Back to IP management' : 'Manage countries'}
          </Button>
          </Box>
          {!countriesView && (
          <BlockedCountriesSummary codes={settings.rate_limit_countries || []} />
          )}
        </Stack>
      </Paper>

      {countriesView ? (
        <Paper sx={{ p: 2 }} elevation={0}>
          <CountryBlockPanel
            initialBlocked={settings.rate_limit_countries || []}
            onSave={handleSaveBlockedCountries}
            onClose={() => setCountriesView(false)}
          />
        </Paper>
      ) : (
        <Paper sx={{ p: 2 }} elevation={0}>
          <Stack flexDirection="column" gap={2}>
            <Stack flexDirection="column" gap={0}>
              <Typography variant="h6" mb={2}>IPs Management</Typography>
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
                  onAdd: () => setEntryDialogOpen(true),
                  onDeleteSelectedIps: handleDeleteSelected,
                } as any,
              }}
              filterModel={filterModel}
              onFilterModelChange={setFilterModel}
            />
          </Stack>
        </Paper>
      )}

      {!countriesView && (
        <Paper sx={{ p: 2 }} elevation={0}>
          <Typography variant="h6" mb={2}>Emergency Access</Typography>
          <TextField
            label="Emergency bypass token hash"
            value={settings.rate_limit_emergency_token_hash}
            onChange={(e) => updateSetting('rate_limit_emergency_token_hash', e.target.value)}
            fullWidth
            helperText="Stored as hash — never expose the raw token"
          />
        </Paper>
      )}

      <AddEntryDialog
        open={entryDialogOpen}
        defaultListType={listType}
        editingEntry={editingIp}
        onSave={handleAddEntries}
        onClose={() => {
          setEntryDialogOpen(false);
          setEditingIp(null);
        }}
        wpUsers={wpUsers}
        wpUsersLoading={wpUsersLoading}
      />

      <ConfirmDialog />
    </Stack>
  );
}
