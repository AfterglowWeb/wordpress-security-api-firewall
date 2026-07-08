<?php namespace Bromate\SecurityApiFirewall\Api;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Security\RateLimit\RateLimiter;
use Bromate\SecurityApiFirewall\Security\Ip\IpAccessControl;

final class PublicRequestBootstrap {

	public static function register(): void {
		add_action( 'init', array( self::class, 'inspect_request' ), 1 );
	}

	public static function inspect_request(): void {

		if (
			is_admin() ||
			wp_is_json_request() ||
			( defined( 'REST_REQUEST' ) && REST_REQUEST ) ||
			( defined( 'DOING_CRON' ) && DOING_CRON ) ||
			( defined( 'WP_CLI' ) && WP_CLI )
		) {
			return;
		}

		$blacklist_result = IpAccessControl::inspect();

		if ( is_wp_error( $blacklist_result ) ) {
			self::deny( $blacklist_result );
		}

		$limit_result = RateLimiter::inspect();

		if ( is_wp_error( $limit_result ) ) {
			self::deny( $limit_result );
		}
	}

	private static function deny( \WP_Error $error ): void {
		$status  = (int) ( $error->get_error_data()['status'] ?? 403 );
		$message = $error->get_error_message();

		status_header( $status );
		nocache_headers();

		if ( isset( $_SERVER['HTTP_ACCEPT'] ) && str_contains( sanitize_text_field( wp_unslash( $_SERVER['HTTP_ACCEPT'] ) ), 'application/json' ) ) {
			header( 'Content-Type: application/json; charset=utf-8' );
			echo wp_json_encode(
				array(
					'code'    => $error->get_error_code(),
					'message' => $message,
				)
			);
		} else {
			header( 'Content-Type: text/plain; charset=utf-8' );
			echo esc_html( $message );
		}

		exit;
	}
}
