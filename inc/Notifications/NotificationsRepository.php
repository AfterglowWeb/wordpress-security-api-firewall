<?php namespace Bromate\SecurityApiFirewall\Logs;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

defined( 'ABSPATH' ) || exit;

final class NotificationsRepository {
	private function __construct() {}

	public static function register(): void {
		$self = new self();

		add_action( 'wp_ajax_bromate_get_notifications_settings', array( $self, 'ajax_get_notifications_settings' ) );
		add_action( 'wp_ajax_bromate_update_notifications_settings', array( $self, 'ajax_update_notifications_settings' ) );
	}

	private const NOTIFICATIONS_OPTION_KEYS = [
		'notifications_digest_enabled',
		'notifications_digest_recurrence',
		'notifications_digest_time',
		'notifications_digest_to',
		'notifications_digest_cc',
		'notifications_digest_cci',
		'notifications_digest_subject',
		'notifications_digest_body',
		'notifications_digest_format',
		'notifications_instant_to',
		'notifications_instant_cc',
		'notifications_instant_cci',
		'notifications_instant_subject',
		'notifications_instant_body',
		'notifications_instant_format',
	];

	public function ajax_get_notifications_settings() {
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

	private function read_config_settings(): array {
		$config_settings = array();
		foreach ( self::NOTIFICATIONS_OPTION_KEYS as $config_key ) {
			$config_settings[ $config_key ] = SettingsRepository::read_option( $config_key );
		}
		return $config_settings;
	}

	private function update_config_settings() {
		$updated_count = 0;
		foreach ( self::NOTIFICATIONS_OPTION_KEYS as $config_key ) {
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

    public static function sanitize_time( $value ): string {
		if ( empty( $value ) ) {
			return '';
		}
		if ( preg_match( '/^([01]\d|2[0-3]):([0-5]\d)$/', $value ) ) {
			return $value;
		}
		return '03:00';
	}

	public static function sanitize_emails( array $raw_emails ): array {
		if( empty( $raw_emails ) ) {
			return [];
		}
		return array_map('sanitize_email', $raw_emails );
	}
}