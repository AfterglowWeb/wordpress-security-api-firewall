<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Security\Routes\RoutesPolicyRepository;
use Bromate\SecurityApiFirewall\Core\Settings\WordPressObjects;
use Bromate\SecurityApiFirewall\Security\Routes\RoutesTreeRepository;
use Bromate\SecurityApiFirewall\Security\WordPress\HttpHeaders;

class SettingsAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();

		add_action( 'wp_ajax_bromate_security_api_firewall_read_options', array( $self, 'ajax_read_options' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_update_options', array( $self, 'ajax_update_options' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_update_option', array( $self, 'ajax_update_option' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_flush_rewrite_rules', array( $self, 'ajax_flush_rewrite_rules' ) );
		add_action( 'wp_ajax_bromate_get_routes_settings', array( $self, 'ajax_get_routes_settings' ) );
		add_action( 'wp_ajax_bromate_get_routes_policy_tree', array( $self, 'ajax_get_routes_policy_tree' ) );
		add_action( 'wp_ajax_bromate_save_all_routes_settings', array( $self, 'ajax_save_all_routes_settings' ) );
		add_action( 'wp_ajax_bromate_wordpress_objects_options', array( $self, 'ajax_wordpress_objects_options' ) );
		add_action( 'wp_ajax_bromate_get_headers_options', array( $self, 'ajax_get_headers_options' ) );
	}

	public function ajax_read_options() {
		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$options = SettingsRepository::read_options();
		wp_send_json_success( $options );
	}

	public function ajax_update_options() {

		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
		if ( isset( $_POST['options'] ) ) {

			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
			$options = json_decode( sanitize_text_field( wp_unslash( $_POST['options'] ) ), true );
			if ( ! is_array( $options ) ) {
				wp_send_json_error( array( 'error' => esc_html__( 'Invalid options data', 'bromate-security-api-firewall' ) ), 400 );
			}

			$options = SettingsRepository::update_options( $options );

			wp_send_json_success(
				array(
					'message' => esc_html__( 'Options saved', 'bromate-security-api-firewall' ),
					'options' => $options,
				)
			);
		} else {
			$options = SettingsRepository::read_options();
			wp_send_json_success( $options );
		}
	}

	public function ajax_update_option() {

		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
		if ( isset( $_POST['option'] ) ) {

			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
			$option = json_decode( sanitize_text_field( wp_unslash( $_POST['option'] ) ), true );
			if ( ! is_array( $option ) ) {
				wp_send_json_error( array( 'error' => esc_html__( 'Invalid option data', 'bromate-security-api-firewall' ) ), 422 );
			}

			$key   = isset( $option['key'] ) && ! empty( $option['key'] ) ? $option['key'] : '';
			$value = array_key_exists( 'value', $option ) ? $option['value'] : null;

			if ( '' === $key || null === $value ) {
				wp_send_json_error( array( 'error' => esc_html__( 'Invalid option data', 'bromate-security-api-firewall' ) ), 422 );
			}

			$option = SettingsRepository::update_option( $key, $value );

			wp_send_json_success(
				array(
					'message' => esc_html__( 'Option saved', 'bromate-security-api-firewall' ),
					'option'  => $option,
				)
			);
		} else {
			wp_send_json_error( 'Unknown parameter', 422 );
		}
	}

	public function ajax_wordpress_objects_options(): void {
		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}
		$wordpress_objects = WordPressObjects::list_rest_api_object_types();
		wp_send_json_success( $wordpress_objects );
	}

	public function ajax_get_headers_options(): void {
		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		wp_send_json_success( HttpHeaders::get_all_headers_options() );
	}

	public static function ajax_validate_has_firewall_admin_caps(): bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- verified below via wp_verify_nonce
		$nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';

		$valid = wp_verify_nonce( $nonce, 'bromate_security_api_firewall_update_options_nonce' );

		return (bool) $valid
			&& is_user_logged_in()
			&& current_user_can( 'bromate_security_api_firewall_edit_options' );
	}

	public function ajax_flush_rewrite_rules(): void {
		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		flush_rewrite_rules( false );
		wp_send_json_success( array( 'message' => esc_html__( 'Rewrite rules flushed successfully.', 'bromate-security-api-firewall' ) ) );
	}

	public function ajax_get_routes_policy_tree(): void {
		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$routes_tree = RoutesTreeRepository::get_routes_policy_tree();
		wp_send_json_success(
			array(
				'tree' => $routes_tree,
			),
			200
		);
	}

	public function ajax_get_routes_settings(): void {
		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		wp_send_json_success(
			RoutesPolicyRepository::get_settings_payload(),
			200
		);
	}

	public function ajax_save_all_routes_settings(): void {
		if ( false === self::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in SettingsAjaxController::ajax_validate_has_firewall_admin_caps()
		if ( ! isset( $_POST['settings'] ) ) {
			wp_send_json_error(
				array(
					'message' => esc_html__( 'Bad request error', 'bromate-security-api-firewall' ),
				),
				400
			);
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in SettingsAjaxController::ajax_validate_has_firewall_admin_caps()
		$settings_payload = isset( $_POST['settings'] ) ? sanitize_text_field( wp_unslash( $_POST['settings'] ) ) : '';
		$settings         = json_decode( $settings_payload, true );

		$result = RoutesPolicyRepository::save_all_settings( $settings );
		if ( false === $result ) {
			wp_send_json_error(
				array(
					'message' => esc_html__( 'Failed to save route settings', 'bromate-security-api-firewall' ),
				),
				500
			);
		}

		wp_send_json_success(
			array(
				'message' => esc_html__( 'Settings saved successfully', 'bromate-security-api-firewall' ),
			),
			200
		);
	}
}
