<?php namespace Bromate\SecurityApiFirewall\Api;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Security\Authentication\AuthenticationManager;
use Bromate\SecurityApiFirewall\Security\Firewall\RateLimiter;
use Bromate\SecurityApiFirewall\Security\Firewall\IpAccessControl;
use Bromate\SecurityApiFirewall\Security\Routes\RoutesPolicyRepository;
use Bromate\SecurityApiFirewall\Security\Routes\RoutesResolver;
use Bromate\SecurityApiFirewall\Security\WordPress\HttpHeaders;
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
			3
		);

		add_filter(
			'application_password_is_api_request',
			'__return_true',
			10,
			1
		);

		add_filter(
			'rest_authentication_errors',
			array( self::class, 'authenticate_request' ),
			10,
			100
		);

		add_filter(
			'rest_pre_dispatch',
			array( self::class, 'apply_route_policy' ),
			5,
			3
		);

		add_filter(
			'rest_pre_dispatch',
			array( self::class, 'rate_limit_request' ),
			10,
			1
		);
	}

	public static function authenticate_request( $result, $request = null ) {

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

		$auth_result = AuthenticationManager::authenticate();

		if ( is_wp_error( $auth_result ) ) {
			return $auth_result;
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

		$limit_result = RateLimiter::inspect();

		if ( is_wp_error( $limit_result ) ) {
			return $limit_result;
		}

		return $result;
	}
}
