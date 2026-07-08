<?php namespace Bromate\SecurityApiFirewall\Security\WordPress;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

defined( 'ABSPATH' ) || exit;

class HttpHeaders {
	private static $instance = null;

	public static function register() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	private function __construct() {
		if ( SettingsRepository::read_option( 'secure_http_headers' ) ) {
			add_filter( 'rest_pre_serve_request', array( $this, 'add_security_headers' ), 10, 0 );
			if ( SettingsRepository::read_option( 'wp_http_headers' ) ) {
				add_filter( 'send_headers', array( $this, 'add_security_headers' ), 10, 0 );
			}
		}
		if ( SettingsRepository::read_option( 'compression_http_headers' ) ) {
			add_filter( 'rest_pre_serve_request', array( $this, 'add_compression_headers' ), 10, 0 );
			if ( SettingsRepository::read_option( 'wp_http_headers' ) ) {
				add_action( 'send_headers', array( $this, 'add_compression_headers' ), 10, 0 );
			}
		}
	}

	public function add_security_headers() {
		header_remove( 'X-Powered-By' );
		header_remove( 'Server' );
		header_remove( 'X-Generator' );

		header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
		header( 'Pragma: no-cache' );

		header( 'Referrer-Policy: no-referrer' );

		header( 'Cross-Origin-Resource-Policy: same-origin' );

		header( 'X-Content-Type-Options: nosniff' );

		header( 'X-Frame-Options: SAMEORIGIN' );

		if ( is_ssl() ) {
			header( 'Strict-Transport-Security: max-age=31536000; includeSubDomains' );
		}
	}

	public function add_compression_headers() {
		header( 'Accept-Encoding: gzip, deflate, br' );
	}
}
