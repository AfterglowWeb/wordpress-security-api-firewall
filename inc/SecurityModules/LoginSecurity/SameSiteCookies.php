<?php
namespace Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

class SameSiteCookies {

	private function __construct() {}

	public static function register(): void {

		if ( empty( SettingsRepository::read_option( 'cookie_hardening_samesite_enabled' ) ) ) {
			return;
		}

		add_action( 'init', array( self::class, 'register_cookie_headers' ), 0 );
	}

	public static function register_cookie_headers(): void {
		if ( headers_sent() ) {
			return;
		}
		header_register_callback( array( self::class, 'rewrite_set_cookie_headers' ) );
	}

	public static function rewrite_set_cookie_headers(): void {
		$headers         = headers_list();
		$cookie_headers  = array();
		$cookie_prefixes = array(
			defined( 'AUTH_COOKIE' ) ? AUTH_COOKIE : 'wordpress_',
			defined( 'SECURE_AUTH_COOKIE' ) ? SECURE_AUTH_COOKIE : 'wordpress_sec_',
			defined( 'LOGGED_IN_COOKIE' ) ? LOGGED_IN_COOKIE : 'wordpress_logged_in_',
			'wordpress_test_cookie',
		);
		$samesite        = SettingsRepository::read_option( 'cookie_hardening_samesite_mode' );

		foreach ( $headers as $header ) {
			if ( stripos( $header, 'Set-Cookie:' ) === 0 ) {
				$cookie_headers[] = substr( $header, strlen( 'Set-Cookie:' ) );
			}
		}

		if ( empty( $cookie_headers ) ) {
			return;
		}

		header_remove( 'Set-Cookie' );

		foreach ( $cookie_headers as $raw ) {
			$name              = trim( strtok( trim( $raw ), '=' ) );
			$is_wp_auth_cookie = false;

			foreach ( $cookie_prefixes as $prefix ) {
				if ( 0 === strpos( $name, $prefix ) ) {
					$is_wp_auth_cookie = true;
					break;
				}
			}

			if ( ! $is_wp_auth_cookie ) {
				header( 'Set-Cookie: ' . trim( $raw ), false );
				continue;
			}

			$raw     = trim( $raw );
			$rewrote = preg_replace( '/;\s*SameSite=[^;]*/i', '; SameSite=' . $samesite, $raw );

			header( 'Set-Cookie: ' . $rewrote, false );
		}
	}
}
