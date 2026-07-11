<?php namespace Bromate\SecurityApiFirewall\Security\Routes;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Security\Authentication\WordPressApplicationPassword;

use WP_REST_Request;

class RoutesPolicyTest {

	protected static $instance                = null;
	public static ?int $internal_test_user_id = null;

	public static function get_instance() {
		if ( null === static::$instance ) {
			static::$instance = new static();
		}
		return static::$instance;
	}

	private function __construct() {
		add_action( 'wp_ajax_run_policy_test', array( $this, 'ajax_run_policy_test' ) );
	}

	public function ajax_run_policy_test() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 403 );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing -- Nonce verified in SettingsAjaxController::ajax_validate_has_firewall_admin_caps()
		$route           = isset( $_POST['route'] ) ? sanitize_text_field( wp_unslash( $_POST['route'] ) ) : '';
		$method          = isset( $_POST['method'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_POST['method'] ) ) ) : 'GET';
		$test_sub_routes = isset( $_POST['test_sub_routes'] ) ? rest_sanitize_boolean( wp_unslash( $_POST['test_sub_routes'] ) ) : false;
		$bypass_users    = isset( $_POST['bypass_users'] ) ? rest_sanitize_boolean( wp_unslash( $_POST['bypass_users'] ) ) : false;
		$has_users       = isset( $_POST['has_users'] ) ? rest_sanitize_boolean( wp_unslash( $_POST['has_users'] ) ) : false;
		$application_id  = isset( $_POST['application_id'] ) ? sanitize_text_field( wp_unslash( $_POST['application_id'] ) ) : '';
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$this->cleanup_test_app_passwords();

		if ( empty( $route ) ) {
			wp_send_json_error( array( 'message' => 'Route is required' ), 400 );
		}

		$allowed_methods = array( 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' );
		if ( ! in_array( $method, $allowed_methods, true ) ) {
			wp_send_json_error( array( 'message' => 'Invalid HTTP method' ), 400 );
		}

		$routes_to_test = $this->collect_routes_to_test( $route, $method, $test_sub_routes );

		if ( empty( $routes_to_test ) ) {
			wp_send_json_error( array( 'message' => 'No routes found to test' ), 404 );
		}

		$results = $this->run_tests( $routes_to_test, $bypass_users, $has_users );

		wp_send_json_success( $results, 200 );
	}

	protected function collect_routes_to_test( string $route, string $method, bool $include_sub_routes ): array {
		$routes = array();

		$routes[] = array(
			'route'  => $route,
			'method' => $method,
		);

		if ( $include_sub_routes ) {
			$tree       = RoutesPolicyRepository::get_routes_policy_tree();
			$sub_routes = $this->find_sub_routes( $tree, $route );
			$routes     = array_merge( $routes, $sub_routes );
		}

		return $routes;
	}

	protected function find_sub_routes( array $tree, string $parent_route ): array {
		$sub_routes         = array();
		$parent_route_clean = rtrim( $parent_route, '/' );

		foreach ( $tree as $node ) {
			$this->collect_routes_from_node( $node, $parent_route_clean, $sub_routes );
		}

		return $sub_routes;
	}

	protected function collect_routes_from_node( array $node, string $parent_route, array &$routes ): void {
		if ( ! empty( $node['children'] ) ) {
			foreach ( $node['children'] as $child ) {
				$is_method = isset( $child['isMethod'] ) && $child['isMethod'];

				if ( $is_method ) {
					$child_route = $child['route'] ?? '';
					if ( $this->is_sub_route( $child_route, $parent_route ) ) {
						$routes[] = array(
							'route'  => $child_route,
							'method' => $child['method'] ?? 'GET',
						);
					}
				} else {
					$this->collect_routes_from_node( $child, $parent_route, $routes );
				}
			}
		}
	}

	protected function is_sub_route( string $route, string $parent_route ): bool {
		if ( empty( $route ) || empty( $parent_route ) ) {
			return false;
		}

		$route_clean  = rtrim( $route, '/' );
		$parent_clean = rtrim( $parent_route, '/' );

		return strpos( $route_clean, $parent_clean ) === 0 && $route_clean !== $parent_clean;
	}

	protected function run_tests( array $routes, bool $bypass_users, bool $has_users = false ): array {
		$results = array();

		foreach ( $routes as $route_info ) {
			$route  = $route_info['route'];
			$method = $route_info['method'];

			RoutesPolicyRepository::flush_routes_cache();

			$policy = $this->get_policy_for_route( $route, $method );

			$use_auth_for_result = ! $has_users || $bypass_users;

			$result_entry = array(
				'route'        => $route,
				'method'       => $method,
				'policy'       => $policy,
				'bypass_users' => $bypass_users,
				'tests'        => array(
					'disabled' => $this->test_disabled( $route, $method, $policy ),
					'auth'     => $this->test_auth( $route, $method, $policy ),
				),
				'raw_data'     => $this->fetch_data( $route, $method ),
				'result_data'  => $use_auth_for_result
					? $this->fetch_data_internal( $route, $method )
					: $this->fetch_data( $route, $method ),
				'curl_info'    => array(
					'rest_url'  => $this->build_rest_url( $route ),
					'auth_type' => $this->get_auth_hint(),
				),
			);

			$model = $this->get_model_for_route( $route );
			if ( $model ) {
				$result_entry['model'] = array(
					'id'          => $model['id'],
					'title'       => $model['title'],
					'object_type' => $model['object_type'],
				);
			}

			$results[] = $result_entry;
		}

		return $results;
	}

	protected function get_model_for_route( string $route ): ?array {

		$post_type = $this->post_type_from_route( $route );
		if ( ! $post_type ) {
			return null;
		}

		return \cmk\SecurityApiFirewallPro\Models\ModelRepository::find_enabled_by_object_type(
			$post_type
		);
	}

	protected function post_type_from_route( string $route ): ?string {
		if ( ! preg_match( '#^/wp/v2/([^/]+)#', $route, $m ) ) {
			return null;
		}

		$segment = $m[1];

		foreach ( get_post_types( array( 'show_in_rest' => true ), 'objects' ) as $post_type ) {
			$rest_base = ! empty( $post_type->rest_base ) ? $post_type->rest_base : $post_type->name;
			if ( $rest_base === $segment ) {
				return $post_type->name;
			}
		}

		return null;
	}

	protected function fetch_data( string $route, string $method ): array {
		$response    = $this->make_request( $route, $method );
		$status_code = wp_remote_retrieve_response_code( $response );
		$body_raw    = wp_remote_retrieve_body( $response );
		$body        = json_decode( $body_raw, true );

		return array(
			'status' => $status_code,
			'body'   => null !== $body ? $body : $body_raw,
		);
	}

	protected function get_policy_for_route( string $route, string $method ): array {
		$request = new WP_REST_Request( $method, $route );
		return RoutesResolver::resolve_for_request( $request );
	}

	protected function build_rest_url( string $route ): string {
		return rest_url( ltrim( $route, '/' ) );
	}

	protected function get_auth_hint(): array {
		$user_id = (int) SettingsRepository::read_option( 'firewall_user_id' );
		if ( ! $user_id ) {
			return array( 'method' => 'none' );
		}
		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) {
			return array( 'method' => 'none' );
		}
		// Check if WP Application Passwords are available for this user.
		if ( function_exists( 'wp_is_application_passwords_available_for_user' ) &&
			wp_is_application_passwords_available_for_user( $user ) ) {
			return array(
				'method' => 'application_password',
				'login'  => $user->user_login,
			);
		}
		return array(
			'method' => 'basic',
			'login'  => $user->user_login,
		);
	}

	protected function test_disabled( string $route, string $method, array $policy ): array {
		$is_disabled = ! ( $policy['state'] ?? true );

		if ( ! $is_disabled ) {
			return array(
				'skip'   => true,
				'reason' => 'Route is not disabled',
				'pass'   => null,
			);
		}

		$response = $this->make_request( $route, $method, false );

		$status_code = wp_remote_retrieve_response_code( $response );
		$is_redirect = $status_code >= 301 && $status_code <= 308;
		$is_error    = $status_code >= 400 && $status_code < 600;
		$pass        = $is_redirect || $is_error;

		return array(
			'skip'    => false,
			'pass'    => $pass,
			'actual'  => $status_code,
			'message' => $pass
				? ( $is_redirect ? "Disabled route correctly redirects ({$status_code})" : "Disabled route correctly blocked ({$status_code})" )
				: "Disabled route should be blocked or redirect, got {$status_code}",
		);
	}

	protected function test_auth( string $route, string $method, array $policy ): array {
		$enforce_auth_global = (bool) SettingsRepository::read_option( 'enforce_auth' );
		$is_protected        = (bool) ( $policy['protect'] ?? false );

		if ( ! $enforce_auth_global && ! $is_protected ) {
			return array(
				'skip'   => true,
				'reason' => 'Route is public (auth not enforced globally or per-route)',
				'pass'   => null,
			);
		}

		$auth_source = $enforce_auth_global && $is_protected
			? 'global + per-route'
			: ( $enforce_auth_global ? 'global — all routes enforced' : 'per-route policy' );

		$response    = $this->make_request( $route, $method );
		$status_code = wp_remote_retrieve_response_code( $response );
		$expected    = 401;
		$pass        = $status_code === $expected;

		if ( 'GET' !== $method && 400 === $status_code ) {
			return array(
				'skip'    => false,
				'pass'    => null,
				'message' => 'Cannot verify auth: non-GET route returned 400 (body required before auth check)',
			);
		}

		return array(
			'skip'     => false,
			'pass'     => $pass,
			'expected' => $expected,
			'actual'   => $status_code,
			'message'  => $pass
				? "Auth correctly enforced ({$auth_source})"
				: "Expected 401 without auth ({$auth_source}), got {$status_code}",
		);
	}

	protected function make_request( string $route, string $method ) {
		$test_token = wp_generate_password( 32, false );
		$url        = add_query_arg( '_firewall_test', $test_token, $this->build_rest_url( $route ) );

		$args = array(
			'method'      => $method,
			'timeout'     => 10,
			'sslverify'   => false,
			'redirection' => 0,
			'headers'     => array(
				'Content-Type' => 'application/json',
			),
		);

		$response = wp_remote_request( $url, $args );

		return $response;
	}

	protected function fetch_data_internal( string $route, string $method ): array {
		$user_id = (int) SettingsRepository::read_option( 'firewall_user_id' );

		if ( ! $user_id ) {
			return array(
				'status' => null,
				'body'   => null,
			);
		}

		$prev_user_id = get_current_user_id();
		wp_set_current_user( $user_id );
		self::begin_internal_test( $user_id );

		try {
			$request  = new WP_REST_Request( $method, $route );
			$response = rest_do_request( $request );
			$body     = rest_get_server()->response_to_data( $response, false );

			return array(
				'status' => $response->get_status(),
				'body'   => $body,
			);
		} finally {
			self::end_internal_test();
			wp_set_current_user( $prev_user_id );
		}
	}

	public static function begin_internal_test( int $user_id ): void {
		self::$internal_test_user_id = $user_id;
	}

	public static function end_internal_test(): void {
		self::$internal_test_user_id = null;
	}

	public static function is_test_request(): bool {
		if ( null !== self::$internal_test_user_id ) {
			return true;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- test token validated via transient below
		$token = isset( $_GET['_firewall_test'] ) ? sanitize_text_field( wp_unslash( $_GET['_firewall_test'] ) ) : '';

		if ( empty( $token ) ) {
			return false;
		}

		$key = 'rest_firewall_test_ctx_' . md5( $token );
		$ctx = get_transient( $key );

		return ! empty( $ctx );
	}


	public static function result( $result ) {
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$is_test  = self::is_test_request();
		$is_admin = is_user_logged_in() && current_user_can( 'manage_options' );

		if ( $is_admin && ! $is_test ) {
			return $result;
		}

		$auth_check = WordPressApplicationPassword::validate_wp_application_password();
		if ( is_wp_error( $auth_check ) ) {
			return $auth_check;
		}

		return $result;
	}

	private function cleanup_test_app_passwords(): void {
		if ( ! class_exists( 'WP_Application_Passwords' ) ) {
			return;
		}

		$user_id = (int) SettingsRepository::read_option( 'firewall_user_id' );
		if ( ! $user_id ) {
			return;
		}

		delete_transient( 'rest_firewall_test_app_pass_' . $user_id );

		$app_name  = 'Firewall Policy Test';
		$passwords = \WP_Application_Passwords::get_user_application_passwords( $user_id );
		foreach ( $passwords as $pass_data ) {
			if ( $pass_data['name'] === $app_name ) {
				\WP_Application_Passwords::delete_application_password( $user_id, $pass_data['uuid'] );
			}
		}
	}
}
