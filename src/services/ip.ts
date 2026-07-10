import { apiRequest } from '@services/api';

export type ListType = 'blacklist' | 'whitelist';
export type EntryType = 'ip' | 'cidr';
export type EntryOrigin = 'manual' | 'auth_user_ip' | 'public_rate_limit' | 'login_rate_limit' | 'country';

export interface LineResult {
  value: string;
  error: string;
}

export interface AddEntryForm {
  value: string;
  list_type: ListType;
  user_id: number | null;
  referrer: string;
  expires_at: string | null;
}

export interface IpEntry {
  id: number;
  ip: string;
  list_type: ListType; 
  entry_origin: EntryOrigin;
  entry_type: EntryType;
  referrer?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  user_id?: number | null;
  created_at: string;
  updated_at: string | null;
  expires_at?: string | null;
}

export const IpAPI = {
  getEntries: (list_type: ListType) =>
    apiRequest<{ entries: IpEntry[] }>('bromate_get_ip_entries', { list_type }),

  addEntry: (ip: string, list_type: ListType, user_id?: number | null, referrer?: string | null, expires_at?: string | null) =>
    apiRequest<{ entry: IpEntry }>('bromate_add_ip_entry', {
      ip,
      list_type,
      ...(user_id ? { user_id } : {}),
      ...(referrer ? { referrer } : {}),
      ...(expires_at ? { expires_at } : {}),
    }),

  updateEntry: (id: number, data: {
    list_type: ListType;
    user_id?: number | null;
    referrer?: string | null;
    expires_at?: string | null;
  }) =>
    apiRequest<{ entry: IpEntry }>('bromate_update_ip_entry', {
      id,
      list_type: data.list_type,
      ...(data.user_id   != null ? { user_id:    data.user_id }   : {}),
      ...(data.referrer  != null ? { referrer:   data.referrer }  : {}),
      ...(data.expires_at != null ? { expires_at: data.expires_at } : {}),
    }),

  deleteEntry: (id: number) =>
    apiRequest<{ deleted: boolean }>('bromate_delete_ip_entry', { id }),

  deleteEntries: (ids: number[]) =>
    apiRequest<{ deleted: number }>('bromate_delete_ip_entries', {
      ids: JSON.stringify(ids),
    }),

  getUserEntries: (user_id: number) =>
    apiRequest<{ entries: IpEntry[] }>('bromate_get_user_ip_entries', { user_id }),

  getCountries: (list_type: ListType) =>
    apiRequest<{
      countries: { country_code: string; country_name: string }[];
      stats: any;
    }>('bromate_get_country_stats', { list_type }),

  getLoginIpEntries: (list_type: ListType) =>
    apiRequest<{ entries: IpEntry[] }>('bromate_get_login_ip_entries', { list_type }),
};