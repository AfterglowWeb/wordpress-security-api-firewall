export type LogSeverity = 'info' | 'warning' | 'error';

export type LogEvent = 
  | 'ip_country_blocked'
  | 'ip_rate_limited'
  | 'ip_blacklisted'
  | 'ip_whitelisted_bypass'
  | 'ip_entry_created'
  | 'ip_entry_deleted'
  | 'auth_access_whitelist'
  | 'auth_success'
  | 'auth_failed'
  | 'auth_user_removed'
  | 'auth_attempts_limit'
  | 'admin_login_access_whitelist'
  | 'admin_login_success'
  | 'admin_login_failed'
  | 'admin_login_attempts_limit'
  | 'ip_entries_delete_expired'
  | 'log_entries_delete_expired'
  | 'import_fail'
  | 'export_fail'
  | 'import_success'
  | 'export_success'
  | 'emergency_token_used'
  | 'plugin_settings_changed';

export interface LogsConfigEvent {
  key: LogEvent;
  severity: LogSeverity;
  label: string;
  group: string;
}

export interface LogsConfigGroup {
  key: string;
  label: string;
}

export interface LogsConfig {
  groups: LogsConfigGroup[];
  events: LogsConfigEvent[];
}


export interface LogEventOption {
  value: string;
  label: string;
  groupLabel?: string;
  severity?: LogSeverity;
  disabled?: boolean;
}


export interface LogsConfigEvent {
  key: LogEvent;
  severity: LogSeverity;
  label: string;
  group: string;
}

export interface LogsConfigGroup {
  key: string;
  label: string;
}

export type LogEventNotificationFlags = {
  send: boolean;
  instant: boolean;
  scheduled: boolean;
};

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
    logs_event_notifications: Partial<Record<LogEvent, LogEventNotificationFlags>>;
}