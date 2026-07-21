import { useState, useCallback, useEffect, useMemo } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
  Box, Paper, Typography, Button, Chip, Stack, Tooltip,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  DataGrid, GridColDef, GridRowId,
  GridRowSelectionModel, useGridApiContext, Toolbar
} from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import UpdateIcon from '@mui/icons-material/Update';
import { type LogEntry, type LogSeverity, type LogsSettings } from '@app-types/logs';
import { LogAPI } from '@services/logs';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import { usePortalContainer } from '@contexts/PortalContainerContext';

const SEVERITY_COLOR: Record<LogSeverity, 'info' | 'warning' | 'error'> = {
  info:     'info',
  warning:  'warning',
  error:    'error',
};

function SeverityChip({ value }: { value: LogSeverity }) {
  return (
    <Chip
      label={value}
      size="small"
      color={SEVERITY_COLOR[value]}
      variant={value === 'error' ? 'filled' : 'outlined'}
      sx={{ fontWeight: value === 'error' ? 700 : 400 }}
    />
  );
}

interface LogsToolbarProps {
  onDeleteSelected?: (rows: Map<GridRowId, LogEntry>) => void;
  severityFilter?: LogSeverity | 'all';
  onSeverityChange?: (v: LogSeverity | 'all') => void;
  logsSettings?: LogsSettings;
}

function LogsToolbar({ 
  onDeleteSelected, 
  severityFilter, 
  onSeverityChange, 
  logsSettings
}: LogsToolbarProps) {
  const apiRef = useGridApiContext();
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Map<GridRowId, LogEntry>>(new Map());
  
  const severitiesKept = useMemo(() => {
    const kept = logsSettings?.logs_keep_severities;
    return Array.isArray(kept) ? kept : [];
  }, [logsSettings?.logs_keep_severities]);

  const isSeverityEnabled = (severity: LogSeverity): boolean => {
    return Array.isArray(severitiesKept) && severitiesKept.includes(severity);
  };

  useEffect(() => {
    const update = () => {
      const currentRows = apiRef.current.getSelectedRows() as Map<GridRowId, LogEntry>;
      setSelectedCount(currentRows.size);
      setSelectedRows(currentRows);
    };
    update();
    return apiRef.current.subscribeEvent('rowSelectionChange', update);
  }, [apiRef]);

    const { openDialog }  = useDialog();

    const handleRotateNow = () => {
      openDialog({
        type: DIALOG_TYPES.CONFIRM,
        title: __('Delete expired log entries', 'bromate-security-api-firewall'),
        content: __('Delete expired log entries now? This action cannot be undone.', 'bromate-security-api-firewall'),
        confirmLabel: __('Rotate Now', 'bromate-security-api-firewall'),
        onConfirm: async () => {
          await LogAPI.rotateEntries();
        },
      });
  };

  return (
    <Toolbar style={{ gap: 16 }}>
      <Button
        variant="contained"
        disableElevation
        color="error"
        size="small"
        disabled={selectedCount === 0}
        startIcon={<DeleteIcon />}
        onClick={() => onDeleteSelected?.(selectedRows)}
      >
        { sprintf(__('Delete %d', 'bromate-security-api-firewall'), selectedCount ) }
      </Button>

      <Button
        variant="text"
        disableElevation
        size="small"
        startIcon={<UpdateIcon />}
        onClick={() => handleRotateNow()}
      >
        {__('Delete expired', 'bromate-security-api-firewall')}
      </Button>

      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2" color="text.secondary">Severity:</Typography>
        <ToggleButtonGroup
          value={severityFilter}
          exclusive
          size="small"
          onChange={(_, v) => { if (v !== null && onSeverityChange) onSeverityChange(v); }}
        >
          {severitiesKept.length > 1 && (
          <ToggleButton 
          value="all"
          >
            {__('All', 'bromate-security-api-firewall')}
          </ToggleButton>)}
          <ToggleButton 
            value="info" 
            disabled={!isSeverityEnabled('info')}
          >
            {__('Info', 'bromate-security-api-firewall')}
          </ToggleButton>
          <ToggleButton 
            value="warning" 
            disabled={!isSeverityEnabled('warning')}
          >
            {__('Warning', 'bromate-security-api-firewall')}
          </ToggleButton>
          <ToggleButton 
            value="error" 
            disabled={!isSeverityEnabled('error')}
          >
            {__('Error', 'bromate-security-api-firewall')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Toolbar>
  );
}

const LOG_COLUMNS: GridColDef<LogEntry>[] = [
  {
    field: 'created_at', headerName: 'Date', width: 160,
    valueFormatter: (value: string) => new Date(value).toLocaleString(),
  },
  {
    field: 'severity', headerName: 'Severity', width: 110,
    renderCell: ({ value }) => <SeverityChip value={value as LogSeverity} />,
  },
  { field: 'event', headerName: 'Event', width: 200 },
  { field: 'ip',    headerName: 'IP',    width: 140 },
  {
    field: 'user_id', headerName: 'User', width: 80,
    valueFormatter: (value: number | null) => value ? `#${value}` : '—',
  },
  {
    field: 'method', headerName: 'Method', width: 80,
    valueFormatter: (value: string | null) => value ?? '—',
  },
  {
    field: 'uri', headerName: 'URI', flex: 1,
    renderCell: ({ value }) => value
      ? <Tooltip slotProps={{ popper: { container: usePortalContainer() } }} title={value}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span></Tooltip>
      : '—',
  },
  {
    field: 'context', headerName: 'Context', width: 200,
    renderCell: ({ value }) => {
      if (!value) return '—';
      const text = JSON.stringify(value);
      return (
        <Tooltip slotProps={{ popper: { container: usePortalContainer() } }} title={<pre style={{ margin: 0, fontSize: 11 }}>{JSON.stringify(value, null, 2)}</pre>}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', fontSize: 12 }}>
            {text}
          </span>
        </Tooltip>
      );
    },
  },
];

type LogsDataGridProps = {
  settings?: LogsSettings;
};

export default function LogsDataGrid({settings}:LogsDataGridProps): JSX.Element {

  const { openDialog }  = useDialog();
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [page, setPage]             = useState(0);
  const [pageSize, setPageSize]     = useState(50);
  const [severityFilter, setSeverityFilter] = useState<LogSeverity | 'all'>('all');
  const [selection, setSelection]   = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });

  const load = useCallback(async (p = page, ps = pageSize, sev = severityFilter) => {
    setLoading(true);
    try {
      const result = await LogAPI.getEntries({
        page:     p + 1,
        per_page: ps,
        severity: sev === 'all' ? undefined : sev,
        order_by: 'created_at',
        order:    'DESC',
      });
      setRows(result.entries);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, severityFilter]);

  useEffect(() => { void load(); }, [load]);

  const handleSeverityChange = useCallback((v: LogSeverity | 'all') => {
    setSeverityFilter(v);
    setPage(0);
  }, []);

  const handleDeleteSelected = useCallback((rows: Map<GridRowId, LogEntry>) => {
    if (rows.size === 0) return;
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: `Delete ${rows.size} log entr${rows.size > 1 ? 'ies' : 'y'}?`,
      content: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const ids = Array.from(rows.keys()).map(Number);
        await LogAPI.deleteEntries(ids);
        setSelection({ type: 'include', ids: new Set() });
        await load();
      },
    });
  }, [openDialog, load]);

  const handleRotateNow = useCallback((rows: Map<GridRowId, LogEntry>) => {
    if (rows.size === 0) return;
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: `Rotate log entr${rows.size > 1 ? 'ies' : 'y'} now?`,
      content: 'Rotate log entr older than This action cannot be undone.',
      confirmLabel: 'Rotate Now',
      onConfirm: async () => {
        await LogAPI.rotateEntries();
        await load();
      },
    });
  }, [openDialog, load]);

  const toolbarSlots = useMemo(() => ({ toolbar: LogsToolbar }), []);

  return (
    <Box>
      <Paper sx={{ p: 2 }} elevation={0}>
        <Typography variant="h6" mb={2}>Logs</Typography>
        <DataGrid
          rows={rows}
          columns={LOG_COLUMNS}
          loading={loading}
          rowCount={total}
          paginationMode="server"
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={({ page: p, pageSize: ps }) => {
            setPage(p);
            setPageSize(ps);
          }}
          pageSizeOptions={[25, 50, 100]}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={selection}
          onRowSelectionModelChange={setSelection}
          showToolbar
          slots={toolbarSlots}
          slotProps={{
            toolbar: {
              onDeleteSelected: handleDeleteSelected,
              severityFilter,
              onSeverityChange: handleSeverityChange,
              logsSettings: settings,
              onRotateNow: handleRotateNow,
            } as any,
          }}

        />
      </Paper>
    </Box>
  );
}