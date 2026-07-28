<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\Core\Uninstall;

class ConfigAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();

		add_action( 'wp_ajax_bromate_get_config_settings', array( $self, 'ajax_get_config_settings' ) );
		add_action( 'wp_ajax_bromate_update_config_settings', array( $self, 'ajax_update_config_settings' ) );
		add_action( 'wp_ajax_bromate_delete_all_settings_now', array( $self, 'ajax_delete_all_settings_now' ) );
		add_action( 'wp_ajax_bromate_export_settings', array( $self, 'ajax_export_settings' ) );
		add_action( 'wp_ajax_bromate_import_settings', array( $self, 'ajax_import_settings' ) );
	}

	public function ajax_get_config_settings() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		wp_send_json_success( [
            'config_delete_data_on_uninstall' => SettingsRepository::read_option('config_delete_data_on_uninstall'),
        ] );
	}

	public function ajax_update_config_settings() {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
        if ( ! isset( $_POST['config_delete_data_on_uninstall'] ) ) {
            wp_send_json_error(
				array(
					'message' => esc_html__( 'Missing args.', 'bromate-security-api-firewall' ),
				), 400
			);
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
        $delete_data_on_uninstall = rest_sanitize_boolean( wp_unslash( $_POST['config_delete_data_on_uninstall'] ) );
        SettingsRepository::update_option( 'config_delete_data_on_uninstall', $delete_data_on_uninstall );

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

    public function ajax_export_settings() {
        if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

        $options = SettingsRepository::read_options();

        wp_send_json_success(
            array(
                'exported_at' => gmdate( 'c' ),
                'plugin'      => 'bromate-security-api-firewall',
                'settings'    => $options,
            )
        );
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