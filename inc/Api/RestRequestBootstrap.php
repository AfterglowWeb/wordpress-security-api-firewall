<?php namespace Bromate\SecurityApiFirewall\Api;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Security\Authentication\AuthenticationManager;
use Bromate\SecurityApiFirewall\Security\Firewall\RateLimiter;
use Bromate\SecurityApiFirewall\Security\Firewall\IpAccessControl;
use Bromate\SecurityApiFirewall\Security\Routes\RoutesResolver;
use WP_Error;
use WP_REST_Request;

final class RestRequestBootstrap {

	public static function register(): void {

		if(is_admin()) {
			return;
		}

		add_action(
			'rest_pre_serve_request',
			array( self::class, 'remove_cache_headers' ),
			10,
			1
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

	public static function remove_cache_headers( $served ) {

		header_remove( 'Cache-Control' );
		header_remove( 'Expires' );
		header_remove( 'Pragma' );

		return $served;
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

		return new WP_Error(
			'rest_firewall_route_disabled',
			__( 'This route is disabled by the REST API firewall policy.', 'bromate-security-api-firewall' ),
			array( 'status' => 403 )
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
