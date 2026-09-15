<?php namespace Bromate\SecurityApiFirewall\Runtime;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Runtime\IpAccessControl;
use Bromate\SecurityApiFirewall\Runtime\RateLimiterBucket;

use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAuthenticationRuntime;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes\RoutesPolicyRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes\RoutesResolver;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\HttpHeaders;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAuthenticationAttemptsLimiter;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

final class RestRequestBootstrap {

	public static function register(): void {

		if ( is_admin() ) {
			return;
		}

		add_action(
			'rest_pre_serve_request',
			array( HttpHeaders::class, 'add_headers_to_rest' ),
			10,
			1
		);

		add_filter(
			'application_password_is_api_request',
			array( self::class, 'maybe_allow_application_passwords' ),
			10,
			1
		);

		add_filter( 'rest_pre_dispatch', array( self::class, 'rate_limit_request' ), 5, 1 );
		add_filter( 'rest_pre_dispatch', array( self::class, 'apply_route_policy' ), 7, 3 );
		add_filter( 'rest_pre_dispatch', array( self::class, 'authenticate_request' ), 10, 3 );
	}

	public static function maybe_allow_application_passwords( $is_api_request ) {

		if ( empty( SettingsRepository::read_option( 'auth_control_enabled' ) ) ) {
			return $is_api_request;
		}

		$method = SettingsRepository::read_option( 'firewall_auth_method' ) ?: 'wp_auth';

		if ( 'jwt' === $method ) {
			return false;
		}

		return $is_api_request;
	}

	public static function authenticate_request( $result, $server = null, $request = null ) {

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( ! $request instanceof WP_REST_Request ) {
			return $result;
		}

		$policy = RoutesResolver::resolve_for_request( $request );

		if ( empty( $policy['protect'] ) ) {
			return $result;
		}

		$block_check = RestAuthenticationAttemptsLimiter::check_if_blocked();
		if ( is_wp_error( $block_check ) ) {
			return $block_check;
		}

		$auth_result = RestAuthenticationRuntime::authenticate();

		if ( is_wp_error( $auth_result ) ) {
			RestAuthenticationAttemptsLimiter::record_failure();
			return $auth_result;
		}

		if ( ! $auth_result ) {
			RestAuthenticationAttemptsLimiter::record_failure();

			return new WP_Error(
				'rest_authentication_failed',
				esc_html__( 'Invalid or missing authentication credentials.', 'bromate-security-api-firewall' ),
				array( 'status' => 401 )
			);
		}

		return $result;
	}

	public static function apply_route_policy( $result, $server = null, $request = null ) {

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( ! $request instanceof WP_REST_Request ) {
			return $result;
		}

		$policy = RoutesResolver::resolve_for_request( $request );
		if ( empty( $policy['disabled'] ) ) {
			return $result;
		}

		return self::disabled_routes_response();
	}

	public static function disabled_routes_response() {

		$response              = RoutesPolicyRepository::disabled_routes_response();
		$redirect_url          = isset( $response['redirect_url'] ) ? $response['redirect_url'] : '';
		$response_code         = isset( $response['redirect_option'] ) && is_numeric( $response['redirect_option'] ) ? (int) $response['redirect_option'] : 403;
		$response_code_message = isset( $response['code_message'] ) ? $response['code_message'] : '';

		if ( ! empty( $redirect_url ) ) {
			return new WP_REST_Response(
				array(),
				302,
				array( 'Location' => $redirect_url )
			);
		}

		return new WP_Error(
			'rest_firewall_route_disabled',
			$response_code_message,
			array( 'status' => $response_code )
		);
	}

	public static function rate_limit_request( $result ) {

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$blacklist_result = IpAccessControl::inspect();

		if ( is_wp_error( $blacklist_result ) ) {
			return $blacklist_result;
		}

		$limit_result = RateLimiterBucket::inspect( 'rest_api_rate_limit' );

		if ( is_wp_error( $limit_result ) ) {
			return $limit_result;
		}

		return $result;
	}
}
