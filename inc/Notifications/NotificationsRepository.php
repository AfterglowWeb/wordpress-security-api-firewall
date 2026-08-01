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

	private const NOTIFICATIONS_OPTION_KEYS = array(
		'notifications_digest_enabled',
		'notifications_digest_recurrence',
		'notifications_digest_time',
		'notifications_digest_to',
		'notifications_digest_cc',
		'notifications_digest_cci',
		'notifications_digest_subject',
		'notifications_digest_body',
		'notifications_digest_format',
		'notifications_digest_attachment_logs',
		'notifications_digest_attachment_logs_format',
		'notifications_digest_inline_logs',
		'notifications_instant_to',
		'notifications_instant_cc',
		'notifications_instant_cci',
		'notifications_instant_subject',
		'notifications_instant_body',
		'notifications_instant_format',
		'notifications_instant_attachment_logs',
		'notifications_instant_attachment_logs_format',
		'notifications_instant_inline_logs',
	);

	public function ajax_get_notifications_settings() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		wp_send_json_success( self::read_settings() );
	}

	public function ajax_update_notifications_settings() {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$updated_settings = self::update_settings();

		if ( empty( $updated_settings ) ) {
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

	private function read_settings(): array {
		$settings = array();
		foreach ( self::NOTIFICATIONS_OPTION_KEYS as $notifications_key ) {
			$settings[ $notifications_key ] = SettingsRepository::read_option( $notifications_key );
		}
		return $settings;
	}

	private function update_settings() {
		$updated_count = 0;
		foreach ( self::NOTIFICATIONS_OPTION_KEYS as $notifications_key ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_update_notifications_settings()
			if ( isset( $_POST[ $notifications_key ] ) ) {
				// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_update_notifications_settings()
				if ( SettingsRepository::update_option( $notifications_key, wp_unslash( $_POST[ $notifications_key ] ) ) ) {
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
		if ( empty( $raw_emails ) ) {
			return array();
		}
		return array_map( 'sanitize_email', $raw_emails );
	}
}
