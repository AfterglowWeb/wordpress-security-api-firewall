<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAuthorizedUserRepository;
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


	public static function validate_wp_application_password(): bool {
		$user    = wp_get_current_user();
		$exists  = $user && $user->exists();
		$has_cap = $exists && RestAuthorizedUserRepository::user_has_rest_api_access_cap( $user );

		return $has_cap;
	}
}
