<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication;

defined( 'ABSPATH' ) || exit;

use WP_User;
use WP_Application_Passwords;

class WordPressApplicationPassword {


	public static function user_has_valid_application_password( $user_id ) {
		if ( ! function_exists( 'WP_Application_Passwords' ) ) {
			return false;
		}

		$user_id = absint( $user_id );
		if ( ! $user_id || 0 === $user_id ) {
			return false;
		}

		$user = get_userdata( $user_id );
		if ( ! $user instanceof WP_User ) {
			return false;
		}

		$passwords = WP_Application_Passwords::get_user_application_passwords( $user_id );

		if ( empty( $passwords ) ) {
			return false;
		}

		$has_valid = false;
		foreach ( $passwords as $password ) {
			if ( isset( $password['revoked_at'] ) && null !== $password['revoked_at'] ) {
				continue;
			}

			if ( isset( $password['expires'] ) && null !== $password['expires'] ) {
				if ( $password['expires'] <= time() ) {
					continue;
				}
			}

			$has_valid = true;
			break;
		}

		return $has_valid;
	}

	public static function sync_rest_api_user( int $new_user_id, int $old_user_id = 0 ): void {
		if (
			! empty( $old_user_id )
			&& absint( $old_user_id ) !== absint( $new_user_id )
		) {
			self::remove_cap_from_user( absint( $old_user_id ) );
		}

		if ( empty( $new_user_id ) ) {
			return;
		}

		$user = get_user_by( 'id', absint( $new_user_id ) );
		if ( false === $user instanceof WP_User ) {
			return;
		}

		$user->add_cap( 'rest_firewall_api_access' );
	}

	private static function remove_cap_from_user( int $user_id ): void {
		$user = get_user_by( 'id', $user_id );
		if ( $user instanceof WP_User ) {
			$user->remove_cap( 'rest_firewall_api_access' );
		}
	}

	public static function validate_wp_application_password(): bool {
		$user    = wp_get_current_user();
		$exists  = $user && $user->exists();
		$has_cap = $exists && $user->has_cap( 'rest_firewall_api_access' );

		return $has_cap;
	}
}
