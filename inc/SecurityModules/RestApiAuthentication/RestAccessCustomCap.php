<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAuthorizedUserRepository;
use WP_User;

final class RestAccessCustomCap {

	private const REST_API_ACCESS_CUSTOM_CAP = 'bromate_security_api_firewall_rest_api_access';

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
		$users      = get_users(
			array(
				'role__in' => empty( $auth_roles ) ? RestAuthorizedUserRepository::get_roles_names() : $auth_roles,
				'number'   => 500,
				'orderby'  => 'display_name',
				'order'    => 'ASC',
			)
		);

		$auth_users = SettingsRepository::read_option( 'auth_users' );

		if ( empty( $auth_users ) || ! is_array( $auth_users ) ) {
			foreach ( $users as $user ) {
				self::remove_cap_from_user( $user );
			}
			return;
		}

		$active_user_ids = array_filter(
			array_map(
				static function ( $auth_user ) {
					if ( ! is_array( $auth_user ) || empty( $auth_user['id'] ) ) {
						return null;
					}
					$status = $auth_user['status'] ?? '';
					if ( in_array( $status, array( 'revoked', 'disabled' ), true ) ) {
						return null;
					}
					return (int) $auth_user['id'];
				},
				$auth_users
			),
			static fn( $id ) => null !== $id
		);

		foreach ( $users as $user ) {
			if ( in_array( $user->ID, $active_user_ids, true ) ) {
				self::add_cap_to_user( $user );
			} else {
				self::remove_cap_from_user( $user );
			}
		}
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