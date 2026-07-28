export interface ConfigSettings {
  config_delete_data_on_uninstall: boolean,
  config_export_include_sensitive_data: boolean,
  config_export_include_ip_entries: boolean,
  config_export_include_log_entries: boolean,
  config_export_db_tables_format: 'json' | 'csv',
  config_export_include_routes_tree: boolean,
}