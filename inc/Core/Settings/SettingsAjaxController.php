<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

class SettingsAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();

		add_action( 'wp_ajax_bromate_security_api_firewall_read_options', array( $self, 'ajax_read_options' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_update_options', array( $self, 'ajax_update_options' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_update_option', array( $self, 'ajax_update_option' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_flush_rewrite_rules', array( $self, 'ajax_flush_rewrite_rules' ) );
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
}
