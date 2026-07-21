
export type LogSeverity = 'info' | 'warning' | 'error';

export type LogEvent = 
	'ip_country_blocked' |
	'ip_rate_limited' |
	'ip_blacklisted' |
	'ip_whitelisted_bypass' |
	'ip_entry_created' |
	'ip_entry_deleted' |
	'ip_entries_delete_expired' |
	'auth_success' |
	'auth_failed' |
	'auth_revoked' |
	'admin_login_success' |
	'admin_login_failed' |
	'admin_login_rate_limited' |
	'admin_login_banned' |
	'emergency_token_used' |
	'plugin_settings_changed' |
  'log_entries_delete_expired';

export interface LogEntry {
  id: number;
  event: LogEvent;
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

export interface LogsQueryArgs {
  event?: LogEvent[];
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

export interface LogsPage {
  entries: LogEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface LogsSettings {
    logs_enabled: boolean;
    logs_keep_severities: LogSeverity[];
    logs_keep_events: LogEvent[];
    logs_rotation_time: number;
}