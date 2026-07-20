import { apiRequest } from '@services/api';
import { LogsQueryArgs, LogsPage, LogsSettings } from '@app-types/logs';


export const LogAPI = {
  getSettings: () =>
    apiRequest<LogsSettings>('bromate_get_logs_settings'),

  updateSettings: (args: LogsSettings) =>
    apiRequest<LogsSettings>('bromate_update_logs_settings', args as LogsSettings ),

  getEntries: (args: LogsQueryArgs = {}) =>
    apiRequest<LogsPage>('bromate_get_log_entries', args as Record<string, unknown>),

  deleteEntry: (id: number) =>
    apiRequest<{ deleted: boolean }>('bromate_delete_log_entry', { id }),

  deleteEntries: (ids: number[]) =>
    apiRequest<{ deleted: number }>('bromate_delete_log_entries', {
      ids: JSON.stringify(ids),
    }),
};