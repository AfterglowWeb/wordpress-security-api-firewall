<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsConfig;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Logs\Logger;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\Logs\LogsRepository;
use Bromate\SecurityApiFirewall\Utils\FileUtils;
use ZipArchive;

class SettingsMigrate {

	private function __construct() {}

	private static ?self $instance = null;

	public static function get_instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}
	
	private const CONFIG_SETTINGS_KEYS = [
		'config_delete_data_on_uninstall',
		'config_export_include_sensitive_data',
		'config_export_include_routes_tree',
		'config_export_include_ip_entries',
		'config_export_include_log_entries',
		'config_export_ip_entries_format',
		'config_export_log_entries_format',
		'config_import_ip_entries_merge',
		'config_import_log_entries_merge',
	];

	public function read_config_settings():array {
		$config_settings = [];
		foreach( self::CONFIG_SETTINGS_KEYS as $config_key ) {
			$config_settings[ $config_key ] = SettingsRepository::read_option( $config_key );
		}
		return $config_settings;
	}

	public function export_settings() {
		$export_settings = self::read_config_settings();
		$settings_config = SettingsConfig::options_config();
		$settings = SettingsRepository::read_options();

		$include_sensitive_data = isset( $export_settings['config_export_include_sensitive_data'] ) && true === $export_settings['config_export_include_sensitive_data'];
		$include_routes_tree = isset( $export_settings['config_export_include_routes_tree'] ) && true === $export_settings['config_export_include_routes_tree'];
		
		foreach($settings_config as $setting_key => $setting_config) {
			if(isset($setting_config['sensitivity']) && 'high' === $setting_config['sensitivity']) {
				unset($settings[$setting_key]);
			}
		}

		if( ! $include_sensitive_data ) {
			foreach($settings_config as $setting_key => $setting_config) {
				if(isset($setting_config['sensitivity']) && 'medium' === $setting_config['sensitivity']) {
					unset($settings[$setting_key]);
				}
			}
		}

		if( ! $include_routes_tree ) {
			unset($settings['routes_policy_tree']);
		}

		return $settings;
	}

	public function export_tables(): array {
		$export_settings = self::read_config_settings();

		$include_ip_entries = isset( $export_settings['config_export_include_ip_entries'] ) && true === $export_settings['config_export_include_ip_entries'];
		$include_log_entries = isset( $export_settings['config_export_include_log_entries'] ) && true === $export_settings['config_export_include_log_entries'];

		$data = [];
		if( $include_ip_entries ) {
			$data['ip_entries'] = IpEntriesRepository::get_all_entries();
		}
		
		if( $include_log_entries ) {
			$data['log_entries'] = LogsRepository::get_all_entries();
		}

		return $data;
	}

	public function export_table_data(string $table_name, $data, string $format): ?array {
		if (empty($data)) {
			return null;
		}

		$filename = $table_name . '.' . ($format === 'csv' ? 'csv' : 'json');
		
		if ($format === 'csv') {
			$content = $this->table_csv_export($data);
		} else {
			$content = $this->table_json_export($data);
		}

		$file_details = $this->create_export_file($filename, $content);
		if( empty($file_details) ) {
			Logger::log('export_fail', 'warning', [
				/* translators: %s: file name */
				'reason' => esc_html__( 'Could not create export file.', 'bromate-security-api-firewall' )
			]);
		}

		return $file_details;
	}

	public function create_zip_file(array $files): array {
		if (empty($files)) {
			return [];
		}

		if (!class_exists('ZipArchive')) {
			return [];
		}

		$upload_dir = wp_upload_dir();
		$export_dir = $upload_dir['basedir'] . '/bromate-exports/';
		
		if (!FileUtils::exists($export_dir)) {
			FileUtils::mkdir_p($export_dir);
		}

		$zip_filename = 'bromate-export_' . gmdate('Y-m-d_H-i-s') . '.zip';
		$zip_path = $export_dir . $zip_filename;

		$zip = new ZipArchive();
		if ($zip->open($zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
			return [];
		}

		foreach ($files as $file) {
			if (FileUtils::exists($file['path'])) {
				$zip->addFile($file['path'], $file['name']);
			}
		}

		$zip->close();

		if (!FileUtils::exists($zip_path)) {
			return [];
		}

		return [
			'path' => $zip_path,
			'name' => $zip_filename,
			'url' => $upload_dir['baseurl'] . '/bromate-exports/' . $zip_filename,
			'size' => filesize($zip_path),
		];
	}

	public function create_export_file(string $filename, string $content): array {
		$upload_dir = wp_upload_dir();
		$export_dir = $upload_dir['basedir'] . '/bromate-exports/';
		
		if (!FileUtils::exists($export_dir)) {
			FileUtils::mkdir_p($export_dir);
		}
		
		$timestamp = gmdate('Y-m-d_H-i-s');
		$name_parts = pathinfo($filename);
		$unique_filename = $name_parts['filename'] . '_' . $timestamp . '.' . $name_parts['extension'];
		$file_path = $export_dir . $unique_filename;
		
		if (false === FileUtils::write_file($file_path, $content)) {
			return [];
		}
		
		return [
			'path' => $file_path,
			'name' => $unique_filename,
			'url' => $upload_dir['baseurl'] . '/bromate-exports/' . $unique_filename,
			'size' => filesize($file_path),
		];
	}

	public function import_settings_json( string $raw ):bool {
		$decoded = json_decode( $raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
			Logger::log('import_fail', 'warning', [
				'reason' => esc_html__( 'Invalid or corrupted settings file.', 'bromate-security-api-firewall' )
			]);
			return false;
		}

		$settings = isset($decoded['settings']) ? $decoded['settings'] : [];


		if ( ! is_array( $settings ) || empty( $settings ) ) {
			Logger::log('import_fail', 'warning', [
				'reason' => esc_html__( 'No settings found in the uploaded file.', 'bromate-security-api-firewall' )
			]);
			return false;
		}


		$failed = array();
		foreach ( $settings as $key => $value ) {

			if ( false === SettingsRepository::update_option( $key, $value ) ) {
				$failed[] = $key;
			}
		}

		if ( ! empty( $failed ) ) {
			Logger::log('import_fail', 'warning', [
				'reason' => sprintf(
				/* translators: %s: comma-separated list of setting keys that failed to save */
				esc_html__( 'Some settings failed to import: %s', 'bromate-security-api-firewall' ),
				implode( ', ', $failed )
			)]);

			return false;
		}

		Logger::log('import_success', 'warning', [
			'reason' => sprintf(
				esc_html__( 'Settings imported successfully.', 'bromate-security-api-firewall' )
			)
		]);

		return true;
	}

	private function table_json_export($data): string {
		return wp_json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
	}

	public function import_csv_file( string $filename, string $raw_csv ): bool {
		$table = $this->detect_data_type_from_file( $filename );

		if ( '' === $table || 'settings' === $table ) {
			Logger::log('import_fail', 'warning', [
				'reason' => esc_html__( 'Unrecognized CSV file. Expected an ip_entries or log_entries export.', 'bromate-security-api-firewall' )
			]);
			return false;
		}

		$rows = $this->parse_csv_content( $raw_csv );

		if ( empty( $rows ) ) {
			Logger::log('import_fail', 'warning', [
				'reason' => esc_html__( 'The CSV file is empty or malformed.', 'bromate-security-api-firewall' )
			]);
			return false;
		}

		return $this->import_table_rows( $table, $rows );
	}

	private function table_csv_export($data): string {
		if (empty($data)) {
			return '';
		}

		$output = fopen('php://temp', 'r+');
		
		$first_item = (array) reset($data);
		$headers = array_keys($first_item);
		
		fputcsv($output, $headers);
		
		foreach ($data as $row) {
			$row = (array) $row;
			$csv_row = [];
			foreach ($headers as $header) {
				$csv_row[] = isset($row[$header]) ? $row[$header] : '';
			}
			fputcsv($output, $csv_row);
		}
		
		rewind($output);
		$content = stream_get_contents($output);
		fclose($output);
		
		return $content;
	}

	public function import_table_rows( string $table, array $rows ): bool {

		$merge_option = 'ip_entries' === $table
			? 'config_import_ip_entries_merge'
			: ( 'log_entries' === $table ? 'config_import_log_entries_merge' : null );

		$merge = 'update';
		if(null !== $merge_option) {
			$merge = SettingsRepository::read_option( $merge_option );
		}

		if ( 'replace' === $merge ) {
			switch ( $table ) {
				case 'ip_entries':
					IpEntriesRepository::delete_all_entries();
					break;
				case 'log_entries':
					LogsRepository::delete_all_entries();
					break;
			}
		}

		$result_counts = ['add_count' => 0, 'update_count' => 0];
		switch ( $table ) {
			case 'ip_entries':
				$result_counts = IpEntriesRepository::insert_many( $rows );
				break;
			case 'log_entries':
				$result_counts = LogsRepository::insert_many( $rows, $merge );
				break;
			default:
				Logger::log('import_fail', 'warning', [
					'reason' => esc_html__( 'Unknown table.', 'bromate-security-api-firewall' )
				]);
				return false;
		}

		if ( 0 === $result_counts['add_count'] && 0 === $result_counts['update_count'] ) {
			Logger::log('import_fail', 'warning', [
				'reason' => sprintf(
					esc_html__( 'No data imported or updated in %s.', 'bromate-security-api-firewall' ),
					$table
				)
			]);
			return false;
		}

		Logger::log('import_success', 'info', [
			'reason' => sprintf(
				esc_html__( '%d rows imported, %d rows updated in %s.', 'bromate-security-api-firewall' ),
				$result_counts['add_count'],
				$result_counts['update_count'],
				$table
			)
		]);

		return true;
	}

	public function detect_data_type_from_file( string $filename ): string {
		$name = strtolower( pathinfo( $filename, PATHINFO_FILENAME ) );
		$name = str_replace( '-', '_', $name );

		if ( false !== strpos( $name, 'ip_entries' ) ) {
			return 'ip_entries';
		}

		if ( false !== strpos( $name, 'log_entries' ) ) {
			return 'log_entries';
		}

		if ( false !== strpos( $name, 'settings' ) ) {
			return 'settings';
		}

		return '';
	}

	private function parse_csv_content( string $content ): array {
		$stream = fopen( 'php://temp', 'r+' );
		fwrite( $stream, $content );
		rewind( $stream );

		$headers = fgetcsv( $stream );

		if ( false === $headers ) {
			fclose( $stream );
			return array();
		}

		$rows = array();
		while ( false !== ( $values = fgetcsv( $stream ) ) ) {
			if ( 1 === count( $values ) && null === $values[0] ) {
				continue; // blank line
			}

			$row = array();
			foreach ( $headers as $index => $header ) {
				$row[ $header ] = $values[ $index ] ?? '';
			}
			$rows[] = $row;
		}

		fclose( $stream );

		return $rows;
	}

}