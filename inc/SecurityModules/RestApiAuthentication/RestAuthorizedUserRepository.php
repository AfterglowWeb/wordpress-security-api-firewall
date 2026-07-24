<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\WordPressApplicationPassword;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\JwtAuthentication;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use WP_User;

class RestAuthorizedUserRepository {

	private const REST_API_ACCESS_CUSTOM_CAP = 'bromate_security_api_firewall_rest_api_access';
	private const USER_JWT_SUBCLAIM_METAKEY  = 'jwt_subclaim';

	public static function authorized_users_options(): array {
		$users = get_users(
			array(
				'role__in' => array( 'administrator', 'editor' ),
				'number'   => 500,
				'orderby'  => 'display_name',
				'order'    => 'ASC',
			)
		);

		if ( empty( $users ) ) {
			return array();
		}

		$current_user_id = get_current_user_id();

		return array_map(
			static function ( WP_User $user ) use ( $current_user_id ): array {
				return array(
					'id'                  => absint( $user->ID ),
					'display_name'        => sanitize_text_field( $user->display_name ?? '' ),
					'email'               => sanitize_email( $user->user_email ),
					'current_user'        => $current_user_id === $user->ID ? true : false,
					'admin_url'           => sanitize_url( get_edit_user_link( $user->ID ) ),
					'roles'               => array_map( 'sanitize_key', $user->roles ),
					'jwt_subclaim'        => self::create_user_jwt_subclaim( $user->ID ),
					'status'              => '',
					'expires_at'          => '',
					'ip_entries'          => IpEntriesRepository::find_by_user( $user->ID ),
					'has_wp_app_password' => WordPressApplicationPassword::user_has_valid_application_password( $user->ID ),
				);
			},
			array_filter(
				(array) $users,
				static fn ( $user ) => $user instanceof WP_User
			)
		);
	}

	public static function sanitize_authorized_users( array $users ): array {

		$mapped = array_map(
			static function ( $user ): ?array {
				if ( ! is_array( $user ) || empty( $user['id'] ) ) {
					return null;
				}

				return self::sanitize_authorized_user( $user );
			},
			$users
		);

		return array_values(
			array_filter( $mapped, static fn( $u ) => null !== $u )
		);
	}

	public static function sanitize_authorized_user( array $user ): array {

		if ( ! is_array( $user ) || empty( $user['id'] ) ) {
			return array();
		}

		$user_status = isset( $user['status'] ) && in_array( $user['status'], array( 'active', 'revoked', 'disabled' ), true ) ? sanitize_key( $user['status'] ) : '';
		$user_id     = absint( $user['id'] );
		'active' === $user_status ? self::add_cap_to_user( $user_id ) : self::remove_cap_from_user( $user_id );
		return array(
			'id'           => $user_id,
			'jwt_subclaim' => isset( $user['jwt_subclaim'] ) ? sanitize_text_field( $user['jwt_subclaim'] ) : '',
			'status'       => $user_status,
			'expires_at'   => isset( $user['expires_at'] ) ? sanitize_text_field( $user['expires_at'] ) : '',
		);
	}

	public static function user_has_rest_api_access_cap( $user ): bool {
		if ( $user instanceof WP_User ) {
			return $user->has_cap( self::REST_API_ACCESS_CUSTOM_CAP );
		}
		return false;
	}

	private static function add_cap_to_user( int $user_id ): void {
		$user = get_user_by( 'id', $user_id );
		if ( $user instanceof WP_User ) {
			$user->add_cap( self::REST_API_ACCESS_CUSTOM_CAP );
		}
	}

	private static function remove_cap_from_user( int $user_id ): void {
		$user = get_user_by( 'id', $user_id );
		if ( $user instanceof WP_User ) {
			$user->remove_cap( self::REST_API_ACCESS_CUSTOM_CAP );
		}
	}

	public static function create_user_jwt_subclaim( int $user_id, array $options = array() ): string {
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return '';
		}

		$options = wp_parse_args(
			$options,
			array(
				'force_new'          => false,
				'meta_key'           => self::USER_JWT_SUBCLAIM_METAKEY,
				'prefix'             => 'user',
				'include_user_login' => true,
				'include_user_email' => false,
			)
		);

		if ( ! $options['force_new'] ) {
			$existing_subclaim = get_user_meta( $user_id, $options['meta_key'], true );
			if ( ! empty( $existing_subclaim ) && is_string( $existing_subclaim ) ) {
				return $existing_subclaim;
			}
		}

		$components   = array();
		$components[] = $options['prefix'];
		$components[] = $user_id;
		$components[] = time();
		$components[] = bin2hex( random_bytes( 16 ) );

		if ( $options['include_user_login'] ) {
			$components[] = sanitize_title( $user->user_login );
		}

		if ( $options['include_user_email'] ) {
			$components[] = hash( 'sha256', $user->user_email );
		}

		$subclaim = implode( '_', $components );

		$updated = update_user_meta( $user_id, $options['meta_key'], $subclaim );
		if ( ! $updated ) {
			return '';
		}

		return $subclaim;
	}

	public static function get_user_jwt_subclaim( int $user_id ): string {
		$subclaim = get_user_meta( $user_id, self::USER_JWT_SUBCLAIM_METAKEY, true );
		return is_string( $subclaim ) && ! empty( $subclaim ) ? $subclaim : '';
	}

	public static function delete_user_jwt_subclaim( int $user_id ): bool {
		return delete_user_meta( $user_id, self::USER_JWT_SUBCLAIM_METAKEY );
	}

	public static function get_user_id_from_jwt_subclaim( string $subclaim ): int {
		$parts = explode( '_', $subclaim );

		if ( count( $parts ) >= 2 ) {
			$user_id = filter_var( $parts[1], FILTER_VALIDATE_INT );
			if ( false !== $user_id ) {
				return $user_id;
			}
		}

		$authorized_users = SettingsRepository::read_option( 'auth_users' );
		if ( empty( $authorized_users ) ) {
			return 0;
		}

		$users = array_values(
			array_filter(
				$authorized_users,
				function ( $authorized_user ) use ( $subclaim ) {
					return ( $authorized_user[ self::USER_JWT_SUBCLAIM_METAKEY ] ?? '' ) === $subclaim;
				}
			)
		);

		return 1 === count( $users ) ? (int) $users[0] : 0;
	}

	public static function regenerate_user_subclaim( int $user_id ): string {
		self::delete_user_jwt_subclaim( $user_id );
		return self::create_user_jwt_subclaim( $user_id );
	}


	private static function remove_rest_api_access_custom_cap(): void {
		$wp_roles = wp_roles()->roles;

		foreach ( array_keys( $wp_roles ) as $role_name ) {
			$role = get_role( $role_name );
			if ( $role ) {
				$role->remove_cap( self::REST_API_ACCESS_CUSTOM_CAP );
			}
		}
	}

	public static function delete_authorized_users_meta_and_cap(): void {
		delete_metadata( 'user', 0, self::USER_JWT_SUBCLAIM_METAKEY, '', true );
		self::remove_rest_api_access_custom_cap();
	}
}
