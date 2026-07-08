import { apiRequest } from '@services/api';

export type LogSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface LogEntry {
  id: number;
  event: string;
  severity: LogSeverity;
  ip: string | null;
  user_agent: string | null;
  referrer: string | null;
  method: string | null;
  uri: string | null;
  user_id: number | null;
  object_type: string | null;
  object_id: number | null;
  context: Record<string, unknown> | null;
  created_at: string;
}

export interface LogQueryArgs {
  event?: string;
  severity?: LogSeverity;
  ip?: string;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
  order_by?: string;
  order?: 'ASC' | 'DESC';
}

export interface LogPage {
  entries: LogEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export const LogAPI = {
  getEntries: (args: LogQueryArgs = {}) =>
    apiRequest<LogPage>('bromate_get_log_entries', args as Record<string, unknown>),

  deleteEntry: (id: number) =>
    apiRequest<{ deleted: boolean }>('bromate_delete_log_entry', { id }),

  deleteEntries: (ids: number[]) =>
    apiRequest<{ deleted: number }>('bromate_delete_log_entries', {
      ids: JSON.stringify(ids),
    }),
};