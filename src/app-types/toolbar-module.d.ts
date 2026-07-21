import { GridRowId } from '@mui/x-data-grid';
import type { AuthorizedUser } from '@app-types/auth';
import type { IpEntry } from '@services/ip';
import type { LogEntry, LogSeverity } from '@app-types/logs';

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
    onRotateNow?: (rows: Map<GridRowId, LogEntry>) => void;
  }
}