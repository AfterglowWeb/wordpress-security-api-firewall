<?php
namespace Bromate\SecurityApiFirewall\Security\Login;

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

		add_action( 'wp_ajax_bromate_security_api_firewall_revoke_users_sessions', array( self::class, 'ajax_revoke_users_sessions' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_revoke_user_sessions', array( self::class, 'ajax_revoke_user_sessions' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_get_users_sessions', array( self::class, 'ajax_get_users_sessions' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_get_user_sessions', array( self::class, 'ajax_get_user_sessions' ) );
	}

	public static function ajax_revoke_users_sessions(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		$affected = self::revoke_users_sessions();

		wp_send_json_success(
			array(
				'message'  => __( 'All sessions and trusted 2FA devices have been revoked.', 'bromate-security-api-firewall' ),
				'affected' => $affected,
			),
			200
		);
	}

	public static function ajax_revoke_user_sessions(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		if ( ! isset( $_POST['user_id'] ) ) {
			wp_send_json_error( array( 'message' => 'Missing argument' ), 403 );
		}

		$user_id = absint( wp_unslash( $_POST['user_id'] ) );

		self::revoke_user_sessions( $user_id );

		wp_send_json_success(
			array(
				'message' => __( 'All sessions and trusted 2FA devices have been revoked.', 'bromate-security-api-firewall' ),
			),
			200
		);
	}

	public static function ajax_get_users_sessions(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		wp_send_json_success(
			array(
				'users_sessions' => self::get_users_sessions(),
			),
			200
		);
	}

	public static function ajax_get_user_sessions(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		if ( ! isset( $_POST['user_id'] ) ) {
			wp_send_json_error( array( 'message' => 'Missing argument' ), 403 );
		}

		$user_id = absint( wp_unslash( $_POST['user_id'] ) );

		wp_send_json_success(
			array(
				'user_sessions' => self::get_user_sessions( $user_id ),
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

	private static function get_users_sessions(): int {

		$user_ids       = get_users( array( 'fields' => 'ID' ) );
		$users_sessions = 0;

		foreach ( $user_ids as $user_id ) {
			$user_id       = (int) $user_id;
			$user_sessions = WP_Session_Tokens::get_instance( $user_id )->get_all();

			$users_sessions[] = array(
				'user_id'       => $user_id,
				'user_sessions' => $user_sessions,
			);
		}

		return $users_sessions;
	}

	private static function get_user_sessions( int $user_id ): array {
		$manager  = WP_Session_Tokens::get_instance( $user_id );
		$sessions = $manager->get_all();

		$out = array();
		foreach ( $sessions as $verifier => $session ) {
			$out[] = array(
				'verifier'   => $verifier,
				'login'      => $session['login'] ?? null,
				'expiration' => $session['expiration'] ?? null,
				'ip'         => $session['ip'] ?? null,
				'ua'         => $session['ua'] ?? null,
				'is_current' => self::is_current_session( $verifier ),
			);
		}

		usort( $out, static fn( $a, $b ) => ( $b['login'] ?? 0 ) <=> ( $a['login'] ?? 0 ) );

		return $out;
	}

	private static function is_current_session( string $verifier ): bool {
		if ( ! isset( $_COOKIE[ LOGGED_IN_COOKIE ] ) || empty( $_COOKIE[ LOGGED_IN_COOKIE ] ) ) {
			return false;
		}
		$parts            = explode( '|', sanitize_text_field( wp_unslash( $_COOKIE[ LOGGED_IN_COOKIE ] ) ) );
		$current_verifier = $parts[2] ?? '';
		return hash_equals( $verifier, $current_verifier );
	}

	private static function revoke_user_sessions( int $user_id ): void {
		WP_Session_Tokens::get_instance( $user_id )->destroy_all();
		( new TOTPRepository() )->revoke_all_trusted_devices( $user_id );
	}

	private static function revoke_users_sessions(): int {
		( new TOTPRepository() )->revoke_all_trusted_devices_everywhere();

		$user_ids = get_users( array( 'fields' => 'ID' ) );
		$affected = 0;

		foreach ( $user_ids as $user_id ) {
			$user_id  = (int) $user_id;
			$sessions = WP_Session_Tokens::get_instance( $user_id )->get_all();

			if ( ! empty( $sessions ) ) {
				self::revoke_user_sessions( $user_id );
				++$affected;
			}
		}

		return $affected;
	}
}
