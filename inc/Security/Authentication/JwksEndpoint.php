<?php namespace Bromate\SecurityApiFirewall\Security\Authentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Security\Authentication\JwtAuthenticator;
use WP_REST_Request;
use WP_REST_Response;

class JwksEndpoint {

	public static function register(): void {
		add_action('rest_api_init', function() {
			register_rest_route('bromate/v1', '/.well-known/jwks.json', [
				'methods' => 'GET',
				'callback' => [self::class, 'get_jwks'],
				'permission_callback' => '__return_true',
				'args' => [
					'format' => [
						'type' => 'string',
						'enum' => ['json', 'pem'],
						'default' => 'json',
					],
				],
			]);
		});
	}

	public static function get_jwks(WP_REST_Request $request): WP_REST_Response {
		$jwks = JwtAuthenticator::build_jwks(true);

		if (empty($jwks['keys'])) {
			return new WP_REST_Response(['keys' => []], 404);
		}

		if ($request->get_param('format') === 'pem') {
			return new WP_REST_Response([
				'pem' => JwtAuthenticator::get_public_key() ?? '',
				'kid' => JwtAuthenticator::get_active_kid() ?? '',
				'jwks' => $jwks,
			], 200);
		}

		$response = new WP_REST_Response($jwks, 200);
		$response->header('Cache-Control', 'no-cache, no-store, must-revalidate');
		$response->header('Pragma', 'no-cache');
		$response->header('Expires', '0');
		return $response;
	}
}
