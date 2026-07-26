<?php
namespace Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use WP_Session_Tokens;
use WP_User;

class SessionManager {

	public static function register(): void {
		add_action(
			'wp_login',
			static function ( $user_login, WP_User $user ) {
				$max = SettingsRepository::read_option( 'cookie_hardening_max_concurrent_sessions' );
				if ( empty( $max ) ) {
					return;
				}
				self::enforce_session_limit( $user->ID, $max );
			},
			10,
			2
		);

		add_action( 'wp_ajax_bromate_security_api_firewall_revoke_all_users_totp_enrollment', array( self::class, 'ajax_revoke_all_users_totp_enrollment' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_revoke_user_totp_enrollment', array( self::class, 'ajax_revoke_user_totp_enrollment' ) );
	}

	public static function ajax_revoke_all_users_totp_enrollment(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		TOTPRepository::get_instance()->revoke_all_users_totp_enrollment();

		wp_send_json_success(
			array(
				'message' => esc_html__( 'All sessions and trusted 2FA devices have been revoked.', 'bromate-security-api-firewall' ),
			),
			200
		);
	}

	public static function ajax_revoke_user_totp_enrollment(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in SettingsAjaxController::ajax_validate_has_firewall_admin_caps().
		if ( ! isset( $_POST['user_id'] ) ) {
			wp_send_json_error( array( 'message' => 'Missing argument' ), 403 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in SettingsAjaxController::ajax_validate_has_firewall_admin_caps().
		$user_id = absint( wp_unslash( $_POST['user_id'] ) );

		TOTPRepository::get_instance()->revoke_user_totp_enrollment( $user_id );

		wp_send_json_success(
			array(
				'message' => esc_html__( 'All sessions and trusted 2FA devices have been revoked.', 'bromate-security-api-firewall' ),
			),
			200
		);
	}

	public static function enforce_session_limit( int $user_id, int $max ): void {
		$manager = WP_Session_Tokens::get_instance( $user_id );

		$sessions = get_user_meta( $user_id, 'session_tokens', true );
		if ( ! is_array( $sessions ) || count( $sessions ) <= $max ) {
			return;
		}

		uasort( $sessions, static fn( $a, $b ) => ( $a['login'] ?? 0 ) <=> ( $b['login'] ?? 0 ) );

		$excess        = count( $sessions ) - $max;
		$current_token = (string) wp_get_session_token();

		foreach ( $sessions as $verifier => $session ) {
			if ( $excess <= 0 ) {
				break;
			}
			if ( hash_equals( (string) $verifier, $current_token ) ) {
				continue;
			}
			$manager->destroy( (string) $verifier );
			--$excess;
		}
	}
}
