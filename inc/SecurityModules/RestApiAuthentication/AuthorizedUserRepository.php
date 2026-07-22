<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\WordPressApplicationPassword;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\JwtAuthentication;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use WP_User;

class AuthorizedUserRepository {

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
					'jwt_subclaim'        => JwtAuthentication::create_user_subclaim( $user->ID ),
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

				return self::sanitize_authorized_user(  $user );
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

        $user_status = isset( $user['status'] ) && in_array( $user['status'], array( 'active', 'revoked' ) ) ? sanitize_key($user['status']) : '';

		return array(
			'id'           => absint( $user['id'] ),
			'jwt_subclaim' => isset( $user['jwt_subclaim'] ) ? sanitize_text_field( $user['jwt_subclaim'] ) : '',
			'status'       => $user_status,
			'expires_at'   => isset( $user['expires_at'] ) ? sanitize_text_field( $user['expires_at']) : '',
		);
	}
}