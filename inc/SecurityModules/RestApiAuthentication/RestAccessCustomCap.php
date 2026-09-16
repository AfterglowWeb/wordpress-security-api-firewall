<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use WP_User;

final class RestAccessCustomCap {

	private const REST_API_ACCESS_CUSTOM_CAP = 'bromate_security_api_firewall_rest_api_access';
	private const REVOKE_SCAN_BATCH_SIZE     = 500;

	private function __construct() {}

	public static function register(): void {
		add_action( 'bromate_security_api_firewall_auth_users_updated', array( self::class, 'add_api_access_cap_on_authorized_users' ) );
		add_action( 'bromate_security_api_firewall_auth_roles_updated', array( self::class, 'add_api_access_cap_on_authorized_users' ) );
	}

	public static function user_has_rest_api_access_cap( $user ): bool {
		if ( empty( $user ) ) {
			return false;
		}

		$user = ( is_numeric( $user ) && (int) $user > 0 ) ? get_userdata( (int) $user ) : $user;

		if ( $user instanceof WP_User ) {
			return $user->has_cap( self::REST_API_ACCESS_CUSTOM_CAP );
		}
		return false;
	}

	public static function add_api_access_cap_on_authorized_users(): void {

		$auth_roles = SettingsRepository::read_option( 'auth_authorized_roles' );
		$auth_roles = is_array( $auth_roles ) ? $auth_roles : array();

		$auth_users = SettingsRepository::read_option( 'auth_users' );
		$auth_users = is_array( $auth_users ) ? $auth_users : array();

		$desired_ids = self::resolve_desired_user_ids( $auth_users, $auth_roles );

		foreach ( array_keys( $desired_ids ) as $user_id ) {
			self::add_cap_to_user( get_userdata( $user_id ) );
		}

		self::revoke_cap_from_unlisted_users( $desired_ids );
	}

	private static function resolve_desired_user_ids( array $auth_users, array $auth_roles ): array {
		$desired_ids = array();

		foreach ( $auth_users as $auth_user ) {
			if ( ! is_array( $auth_user ) || empty( $auth_user['id'] ) ) {
				continue;
			}

			$status = $auth_user['status'] ?? '';
			if ( in_array( $status, array( 'revoked', 'disabled' ), true ) ) {
				continue;
			}

			$user_id = (int) $auth_user['id'];
			$user    = get_userdata( $user_id );
			if ( ! $user instanceof WP_User ) {
				continue;
			}

			if ( ! empty( $auth_roles ) && empty( array_intersect( $auth_roles, $user->roles ) ) ) {
				continue;
			}

			$desired_ids[ $user_id ] = true;
		}

		return $desired_ids;
	}

	private static function revoke_cap_from_unlisted_users( array $desired_ids ): void {
		global $wpdb;

		$capabilities_meta_key = $wpdb->get_blog_prefix() . 'capabilities';
		$paged                 = 1;

		do {
			$users = get_users(
				array(
					'meta_query' => array(
						array(
							'key'     => $capabilities_meta_key,
							'value'   => '"' . self::REST_API_ACCESS_CUSTOM_CAP . '"',
							'compare' => 'LIKE',
						),
					),
					'number' => self::REVOKE_SCAN_BATCH_SIZE,
					'paged'  => $paged,
				)
			);

			foreach ( $users as $user ) {
				if ( ! isset( $desired_ids[ $user->ID ] ) ) {
					self::remove_cap_from_user( $user );
				}
			}

			++$paged;
		} while ( count( $users ) === self::REVOKE_SCAN_BATCH_SIZE );
	}

	private static function add_cap_to_user( $user ): void {
		if ( $user instanceof WP_User && ! $user->has_cap( self::REST_API_ACCESS_CUSTOM_CAP ) ) {
			$user->add_cap( self::REST_API_ACCESS_CUSTOM_CAP );
		}
	}

	private static function remove_cap_from_user( $user ): void {
		if ( $user instanceof WP_User && $user->has_cap( self::REST_API_ACCESS_CUSTOM_CAP ) ) {
			$user->remove_cap( self::REST_API_ACCESS_CUSTOM_CAP );
		}
	}

	public static function remove_rest_api_access_custom_cap(): void {
		$wp_roles = wp_roles()->roles;

		foreach ( array_keys( $wp_roles ) as $role_name ) {
			$role = get_role( $role_name );
			if ( $role ) {
				$role->remove_cap( self::REST_API_ACCESS_CUSTOM_CAP );
			}
		}
	}
}