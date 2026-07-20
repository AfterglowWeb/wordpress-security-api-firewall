import { apiRequest } from '@services/api';
import { LogQueryArgs, LogPage, LogSettings } from '@app-types/logs';


export const LogAPI = {
  getSettings: () =>
    apiRequest<LogSettings>('bromate_get_log_settings'),

  getEntries: (args: LogQueryArgs = {}) =>
    apiRequest<LogPage>('bromate_get_log_entries', args as Record<string, unknown>),

  deleteEntry: (id: number) =>
    apiRequest<{ deleted: boolean }>('bromate_delete_log_entry', { id }),

  deleteEntries: (ids: number[]) =>
    apiRequest<{ deleted: number }>('bromate_delete_log_entries', {
      ids: JSON.stringify(ids),
    }),
};