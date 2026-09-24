<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsMigrate;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\Core\Uninstall;

class SettingsMigrateAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();

		add_action( 'wp_ajax_bromate_get_config_settings', array( $self, 'ajax_get_config_settings' ) );
		add_action( 'wp_ajax_bromate_update_config_settings', array( $self, 'ajax_update_config_settings' ) );
		add_action( 'wp_ajax_bromate_delete_all_settings_now', array( $self, 'ajax_delete_all_settings_now' ) );
		add_action( 'wp_ajax_bromate_update_and_export_settings', array( $self, 'ajax_update_and_export_settings' ) );
		add_action( 'wp_ajax_bromate_import_settings', array( $self, 'ajax_import_settings' ) );
	}

	private const CONFIG_SETTINGS_KEYS = array(
		'config_delete_data_on_uninstall',
		'config_export_include_sensitive_data',
		'config_export_include_routes_tree',
		'config_export_include_ip_entries',
		'config_export_include_log_entries',
		'config_export_ip_entries_format',
		'config_export_log_entries_format',
	);

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
		$export_files    = array();

		$settings_data = SettingsMigrate::get_instance()->export_settings();
		$settings_file = SettingsMigrate::get_instance()->create_export_file(
			'settings.json',
			wp_json_encode(
				array_merge(
					array(
						'exported_at'    => gmdate( 'c' ),
						'plugin'         => 'bromate-security-api-firewall',
						'plugin_version' => BROMATE_SECURITY_API_FIREWALL_VERSION,
					),
					array( 'settings' => $settings_data )
				),
				JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
			)
		);

		if ( $settings_file ) {
			$export_files[] = $settings_file;
		}

		$table_data = SettingsMigrate::get_instance()->export_tables();

		foreach ( $table_data as $table_name => $data ) {
			$format_key = 'ip_entries' === $table_name ?
				'config_export_ip_entries_format'
				: 'config_export_log_entries_format';

			$format = isset( $export_settings[ $format_key ] )
				? $export_settings[ $format_key ]
				: 'json';

			$file = SettingsMigrate::get_instance()->export_table_data( $table_name, $data, $format );
			if ( $file ) {
				$export_files[] = $file;
			}
		}

		if ( empty( $export_files ) ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'No data to export.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

		if ( count( $export_files ) === 1 ) {
			wp_send_json_success(
				array(
					'message'      => esc_html__( 'Export completed successfully.', 'bromate-security-api-firewall' ),
					'download_url' => $export_files[0]['url'],
					'filename'     => $export_files[0]['name'],
					'size'         => $export_files[0]['size'],
				)
			);
		} else {
			$zip_file = SettingsMigrate::get_instance()->create_zip_file( $export_files );
			if ( $zip_file ) {
				foreach ( $export_files as $file ) {
					wp_delete_file( $file['path'] );
				}

				wp_send_json_success(
					array(
						'message'      => esc_html__( 'Export completed successfully.', 'bromate-security-api-firewall' ),
						'download_url' => $zip_file['url'],
						'filename'     => $zip_file['name'],
						'size'         => $zip_file['size'],
					)
				);
			} else {
				wp_send_json_error(
					array( 'message' => esc_html__( 'Failed to create ZIP archive.', 'bromate-security-api-firewall' ) ),
					500
				);
			}
		}
	}

	public function ajax_import_settings() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
		$import_type = isset( $_POST['type'] ) ? sanitize_key( wp_unslash( $_POST['type'] ) ) : 'json';

		switch ( $import_type ) {
			case 'csv':
				$this->handle_csv_import();
				break;
			case 'zip':
				$this->handle_zip_import();
				break;
			case 'json':
			default:
				$this->handle_json_import();
				break;
		}
	}

	private function read_config_settings(): array {
		$config_settings = array();
		foreach ( self::CONFIG_SETTINGS_KEYS as $config_key ) {
			$config_settings[ $config_key ] = SettingsRepository::read_option( $config_key );
		}
		return $config_settings;
	}

	private function update_config_settings() {
		$updated_count = 0;
		foreach ( self::CONFIG_SETTINGS_KEYS as $config_key ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_update_config_settings()
			if ( isset( $_POST[ $config_key ] ) ) {
				// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_update_config_settings()
				$value = sanitize_text_field( wp_unslash( $_POST[ $config_key ] ) );
				if ( SettingsRepository::update_option( $config_key, $value ) ) {
					++$updated_count;
				}
			}
		}

		return $updated_count;
	}

	private function handle_json_import(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_import_settings()
		if ( ! isset( $_POST['settings'] ) ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'Missing settings payload.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing,WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Nonce verified in self::ajax_import_settings() -- Input sanitized in SettingsMigrate::import_settings_json()
		$raw    = wp_unslash( $_POST['settings'] );
		$result = SettingsMigrate::get_instance()->import_settings_json( $raw );

		if ( false === $result ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Failed importing .json file.', 'bromate-security-api-firewall' ) ), 400 );
		}

		wp_send_json_success(
			array( 'message' => esc_html__( 'Settings imported successfully.', 'bromate-security-api-firewall' ) )
		);
	}

	private function handle_csv_import(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::self::ajax_import_settings()
		if ( ! isset( $_POST['csv'] ) || ! isset( $_POST['filename'] ) ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'Missing CSV payload.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::self::ajax_import_settings()
		$filename = sanitize_file_name( wp_unslash( $_POST['filename'] ) );
		// phpcs:ignore WordPress.Security.NonceVerification.Missing,WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Nonce verified in self::self::ajax_import_settings() -- Input sanitized in SettingsMigrate::import_csv_file()
		$raw_csv = wp_unslash( $_POST['csv'] );

		$result = SettingsMigrate::get_instance()->import_csv_file( $filename, $raw_csv );

		if ( false === $result ) {
			wp_send_json_error(
				array(
					/* translators: %s is the filename */
					'message' => sprintf( esc_html__( 'Error importing %s file.', 'bromate-security-api-firewall' ), $filename ),
				),
				400
			);
		}

		wp_send_json_success(
			array(
				'message' => sprintf(
					/* translators: %s is the filename */
					esc_html__( 'Data from %s imported successfully.', 'bromate-security-api-firewall' ),
					$filename
				),
			)
		);
	}

	private function handle_zip_import(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_import_settings()
		if ( ! isset( $_POST['archive'] ) ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'Missing archive payload.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

		if ( ! class_exists( 'ZipArchive' ) ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'ZIP support is not available on this server.', 'bromate-security-api-firewall' ) ),
				500
			);
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing,WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Nonce verified in ajax_import_settings() -- Input sanitized in SettingsMigrate::zip_import()
		$raw_base64 = wp_unslash( $_POST['archive'] );

		$b64_marker = strpos( $raw_base64, 'base64,' );
		if ( false !== $b64_marker ) {
			$raw_base64 = substr( $raw_base64, $b64_marker + 7 );
		}

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions -- Required by zip encoding;
		$binary = base64_decode( $raw_base64, true );

		if ( false === $binary ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'Invalid archive data.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

		$result = SettingsMigrate::get_instance()->zip_import( $binary );

		if ( false === $result ) {
			wp_send_json_error(
				array( 'message' => esc_html__( 'No recognizable settings or data files were found in the archive.', 'bromate-security-api-firewall' ) ),
				400
			);
		}

		wp_send_json_success(
			array( 'message' => esc_html__( 'Import completed successfully.', 'bromate-security-api-firewall' ) )
		);
	}

	
}
