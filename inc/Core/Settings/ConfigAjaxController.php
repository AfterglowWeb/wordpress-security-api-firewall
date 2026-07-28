<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\Core\Uninstall;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\Logs\LogsRepository;
use Bromate\SecurityApiFirewall\Utils\FileUtils;
use ZipArchive;

class ConfigAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();

		add_action( 'wp_ajax_bromate_get_config_settings', array( $self, 'ajax_get_config_settings' ) );
		add_action( 'wp_ajax_bromate_update_config_settings', array( $self, 'ajax_update_config_settings' ) );
		add_action( 'wp_ajax_bromate_delete_all_settings_now', array( $self, 'ajax_delete_all_settings_now' ) );
		add_action( 'wp_ajax_bromate_update_and_export_settings', array( $self, 'ajax_update_and_export_settings' ) );
		add_action( 'wp_ajax_bromate_import_settings', array( $self, 'ajax_import_settings' ) );
	}

	private const CONFIG_SETTINGS_KEYS = [
		'config_delete_data_on_uninstall',
		'config_export_include_sensitive_data',
		'config_export_include_routes_tree',
		'config_export_include_ip_entries',
		'config_export_include_log_entries',
		'config_export_ip_entries_format',
		'config_export_log_entries_format',
	];

	public function ajax_get_config_settings() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		wp_send_json_success( self::read_config_settings() );
	}

	public function ajax_update_config_settings() {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$updated_config_settings = self::update_config_settings();
		
		if ( empty( $updated_config_settings ) ) {
			wp_send_json_error(
				array(
					'message' => esc_html__( 'Nothing updated', 'bromate-security-api-firewall' ),
				),
				400
			);
		}

		wp_send_json_success(
			array(
				'message' => esc_html__( 'Options saved', 'bromate-security-api-firewall' ),
			)
		);
	}

	private function read_config_settings():array {
		$config_settings = [];
		foreach( self::CONFIG_SETTINGS_KEYS as $config_key ) {
			$config_settings[ $config_key ] = SettingsRepository::read_option( $config_key );
		}
		return $config_settings;
	}

	private function update_config_settings() {
		$updated_count = 0;
		foreach( self::CONFIG_SETTINGS_KEYS as $config_key ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
			if(isset($_POST[$config_key])) {
				$value = sanitize_text_field( wp_unslash( $_POST[$config_key] ) );
				if( SettingsRepository::update_option( $config_key, $value ) ) { 
					$updated_count++; 
				}
			}
		}

		return $updated_count;
	}

	public function ajax_delete_all_settings_now() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		Uninstall::delete_data();

		wp_send_json_success(
			array(
				'message' => esc_html__( 'All the settings and the tables have been deleted.', 'bromate-security-api-firewall' ),
			)
		);
	}

	public function ajax_update_and_export_settings() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		self::update_config_settings();

		$export_settings = self::read_config_settings();
		$export_files = [];
		
		$settings_data = self::export_settings();
		$settings_file = $this->create_export_file(
			'settings.json',
			wp_json_encode(array_merge(
				[
					'exported_at' => gmdate('c'),
					'plugin' => 'bromate-security-api-firewall',
					'plugin_version' => BROMATE_SECURITY_API_FIREWALL_VERSION,
				],
				['settings' => $settings_data]
			), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
		);
		
		if ($settings_file) {
			$export_files[] = $settings_file;
		}

		$table_data = self::export_tables();
		
		foreach ($table_data as $table_name => $data) {
			$format_key = $table_name === 'ip_entries' 
				? 'config_export_ip_entries_format' 
				: 'config_export_log_entries_format';
			
			$format = isset($export_settings[$format_key]) 
				? $export_settings[$format_key] 
				: 'json';
			
			$file = $this->export_table_data($table_name, $data, $format);
			if ($file) {
				$export_files[] = $file;
			}
		}

		if (empty($export_files)) {
			wp_send_json_error(
				array('message' => esc_html__('No data to export.', 'bromate-security-api-firewall')),
				400
			);
		}

		if (count($export_files) === 1) {
			wp_send_json_success([
				'message' => esc_html__('Export completed successfully.', 'bromate-security-api-firewall'),
				'download_url' => $export_files[0]['url'],
				'filename' => $export_files[0]['name'],
				'size' => $export_files[0]['size'],
			]);
		} else {
			$zip_file = $this->create_zip_file($export_files);
			if ($zip_file) {
				foreach ($export_files as $file) {
					wp_delete_file($file['path']);
				}
				
				wp_send_json_success([
					'message' => esc_html__('Export completed successfully.', 'bromate-security-api-firewall'),
					'download_url' => $zip_file['url'],
					'filename' => $zip_file['name'],
					'size' => $zip_file['size'],
				]);
			} else {
				wp_send_json_error(
					array('message' => esc_html__('Failed to create ZIP archive.', 'bromate-security-api-firewall')),
					500
				);
			}
		}
	}

	private function export_settings() {
		$export_settings = self::read_config_settings();
		$settings_config = SettingsConfig::options_config();
		$settings = SettingsRepository::read_options();

		$include_sensitive_data = isset( $export_settings['config_export_include_sensitive_data'] ) && true === $export_settings['config_export_include_sensitive_data'];
		$include_routes_tree = isset( $export_settings['config_export_include_routes_tree'] ) && true === $export_settings['config_export_include_routes_tree'];
		
		if( ! $include_sensitive_data ) {
			foreach($settings_config as $setting_key => $setting_config) {
				if(isset($setting_config['sensitive']) && true === $setting_config['sensitive']) {
					unset($settings[$setting_key]);
				}
			}
		}

		if( ! $include_routes_tree ) {
			unset($settings['routes_policy_tree']);
		}

		return $settings;
	}

	private function export_tables(): array {
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

	private function export_table_data(string $table_name, $data, string $format): ?array {
		if (empty($data)) {
			return null;
		}

		$filename = $table_name . '.' . ($format === 'csv' ? 'csv' : 'json');
		
		if ($format === 'csv') {
			$content = $this->table_csv_export($data);
		} else {
			$content = $this->table_json_export($data);
		}

		return $this->create_export_file($filename, $content);
	}

	private function table_json_export($data): string {
		return wp_json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
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

	private function create_export_file(string $filename, string $content): ?array {
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
			return null;
		}
		
		return [
			'path' => $file_path,
			'name' => $unique_filename,
			'url' => $upload_dir['baseurl'] . '/bromate-exports/' . $unique_filename,
			'size' => filesize($file_path),
		];
	}

	private function create_zip_file(array $files): ?array {
		if (empty($files)) {
			return null;
		}

		if (!class_exists('ZipArchive')) {
			return null;
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
			return null;
		}

		foreach ($files as $file) {
			if (FileUtils::exists($file['path'])) {
				$zip->addFile($file['path'], $file['name']);
			}
		}

		$zip->close();

		if (!FileUtils::exists($zip_path)) {
			return null;
		}

		return [
			'path' => $zip_path,
			'name' => $zip_filename,
			'url' => $upload_dir['baseurl'] . '/bromate-exports/' . $zip_filename,
			'size' => filesize($zip_path),
		];
	}

	public function ajax_import_settings() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
		if ( ! isset( $_POST['settings'] ) ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'Missing settings payload.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
		$raw     = wp_unslash( $_POST['settings'] );
		$decoded = json_decode( $raw, true );

		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'Invalid or corrupted settings file.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

		$settings = $decoded['settings'] ?? $decoded;

		if ( ! is_array( $settings ) || empty( $settings ) ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'No settings found in the uploaded file.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

		$failed = array();
		foreach ( $settings as $key => $value ) {
			if ( ! is_string( $key ) || '' === $key ) {
				continue;
			}
			if ( false === SettingsRepository::update_option( $key, $value ) ) {
				$failed[] = $key;
			}
		}

		if ( ! empty( $failed ) ) {
			wp_send_json_error(
				array(
					/* translators: %s: comma-separated list of setting keys that failed to save */
					'message' => sprintf( esc_html__( 'Some settings failed to import: %s', 'bromate-security-api-firewall' ), implode( ', ', $failed ) ),
				),
				500
			);
		}

		wp_send_json_success(
			array(
				'message' => esc_html__( 'Settings imported successfully.', 'bromate-security-api-firewall' ),
			)
		);
	}
}