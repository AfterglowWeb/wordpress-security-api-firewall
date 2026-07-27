<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\WordPressApplicationPassword;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use WP_User;

class RestAuthorizedUserRepository {

	private const USER_JWT_SUBCLAIM_METAKEY = 'jwt_subclaim';

	public static function authorized_users_options(): array {
		$users = get_users(
			array(
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

	public static function authorized_roles_options(): array {
		
		$role_names = self::get_roles_names();
		if( empty( $role_names ) ) {
			return [];
		}

		$roles_options = [];
		foreach($role_names as $role_key => $role_label) {
			$roles_options[] = array('name' => $role_key, 'label' => $role_label);
		}
		return $roles_options;
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

	private static function sanitize_authorized_user( array $user ): array {

		if ( ! is_array( $user ) || ! isset( $user['id'] ) ) {
			return array();
		}

		$user_id = is_numeric( $user['id'] ) ? absint( $user['id'] ) : 0;
		if ( ! $user_id ) {
			return array();
		}
		$user_status = isset( $user['status'] ) && in_array( $user['status'], array( 'active', 'revoked', 'disabled' ), true ) ? sanitize_key( $user['status'] ) : '';

		return array(
			'id'           => $user_id,
			'jwt_subclaim' => isset( $user['jwt_subclaim'] ) ? sanitize_text_field( $user['jwt_subclaim'] ) : '',
			'status'       => $user_status,
			'expires_at'   => isset( $user['expires_at'] ) ? sanitize_text_field( $user['expires_at'] ) : '',
		);
	}

	public static function get_roles_names(): array {
		$wp_roles = (array) wp_roles();
	

		if ( empty( $wp_roles )) {
			return array();
		}

		return isset($wp_roles['role_names']) ? $wp_roles['role_names'] : [];
	}

	public static function sanitize_authorized_roles( array $roles ): array {


		if(empty($roles)) {
			return [];
		}

		$role_names = array_map( function( $role_option ) {
			return $role_option['name'];
		} , self::authorized_roles_options() );

		$mapped = array_map( function ( $role ) use ( $role_names ) {
			return in_array( $role,  $role_names) ? sanitize_text_field( $role ) : null;
		}, $roles );

		return array_values(
			array_filter( $mapped, static fn( $u ) => null !== $u )
		);
	}

	public static function update_authorized_users( array $users ): array {

		$existing_users = SettingsRepository::read_option( 'auth_users' );

		if ( empty( $existing_users ) || ! is_array( $existing_users ) ) {
			$existing_users = array();
		}

		$merged = array();

		foreach ( $existing_users as $existing_user ) {
			if ( ! is_array( $existing_user ) || empty( $existing_user['id'] ) ) {
				continue;
			}
			$merged[ (int) $existing_user['id'] ] = $existing_user;
		}

		foreach ( $users as $user ) {
			if ( ! is_array( $user ) || empty( $user['id'] ) ) {
				continue;
			}
			$merged[ (int) $user['id'] ] = $user;
		}

		$merged_users = array_values( $merged );

		return SettingsRepository::update_option( 'auth_users', $merged_users );
	}

	public static function get_authorized_users(): array {
		return SettingsRepository::read_option( 'auth_users' );
	}

	public static function get_authorized_roles(): array {
		return SettingsRepository::read_option( 'auth_authorized_roles' );
	}

	public static function delete_authorized_users( array $users ): int {

		$existing_users = SettingsRepository::read_option( 'auth_users' );

		if ( empty( $existing_users ) || ! is_array( $existing_users ) ) {
			return 0;
		}

		$ids_to_delete = array_map( 'absint', $users );
		$ids_to_delete = array_filter( $ids_to_delete );

		if ( empty( $ids_to_delete ) ) {
			return 0;
		}

		$ids_to_delete_set = array_flip( $ids_to_delete );

		$remaining_users = array_filter(
			$existing_users,
			static function ( $user ) use ( $ids_to_delete_set ): bool {
				if ( ! is_array( $user ) || empty( $user['id'] ) ) {
					return true;
				}
				return ! isset( $ids_to_delete_set[ (int) $user['id'] ] );
			}
		);

		$remaining_users = array_values( $remaining_users );

		$deleted_count = count( $existing_users ) - count( $remaining_users );

		if ( $deleted_count > 0 ) {
			SettingsRepository::update_option( 'auth_users', $remaining_users );
			RestAccessCustomCap::add_api_access_cap_on_authorized_users();
		}

		return $deleted_count;
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


	public static function delete_authorized_users_jwt_subclaim(): void {
		delete_metadata( 'user', 0, self::USER_JWT_SUBCLAIM_METAKEY, '', true );
	}
}
