export type ExportFormat = 'csv' | 'json';

export interface ConfigSettings {
  config_delete_data_on_uninstall: boolean,
  config_export_include_sensitive_data: boolean,
  config_export_include_routes_tree: boolean,
  config_export_include_ip_entries: boolean,
  config_export_include_log_entries: boolean,
  config_export_ip_entries_format: ExportFormat,
  config_export_log_entries_format: ExportFormat,
}