<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Throwable;

class RoutesTreeRepository {

	const DEFAULT_HIDDEN_ROUTES = array( 'wp/v2/users', 'oembed/1.0', 'batch/v1', 'wp-site-health/v1', 'wp-abilities/v1' );

	public static function get_routes_policy_tree(): array {
		$tree       = self::build_policy_tree();
		$saved_tree = self::get_saved_rest_routes();
		return self::merge_saved_tree_into_current_tree( $tree, $saved_tree );
	}

	public static function get_default_hidden_routes(): array {
		$default_hidden_routes = apply_filters(
			'bromate_security_api_firewall_default_hidden_routes',
			self::DEFAULT_HIDDEN_ROUTES
		);

		if ( ! is_array( $default_hidden_routes ) || empty( $default_hidden_routes ) ) {
			return array();
		}

		return array_map( 'sanitize_text_field', $default_hidden_routes );
	}

	public static function save_routes_policy_tree( array $tree ): bool {
		try {
			return false !== SettingsRepository::update_option( 'routes_policy_tree', $tree );
		} catch ( Throwable $e ) {
			return false;
		}
	}


	public static function flush_cache(): void {
		delete_transient( 'rest_firewall_routes_list' );
	}

	private static function list_all_rest_routes(): array {
		$cached = get_transient( 'rest_firewall_routes_list' );
		if ( false !== $cached && is_array( $cached ) ) {
			return $cached;
		}

		$server = rest_get_server();
		$routes = $server->get_routes();
		$output = array();

		foreach ( $routes as $route => $endpoints ) {
			foreach ( $endpoints as $endpoint ) {
				$methods = array_keys( $endpoint['methods'] ?? array() );
				foreach ( $methods as $method ) {
					$permission_cb = $endpoint['permission_callback'] ?? null;
					$output[]      = array(
						'route'               => $route,
						'params'              => RouteParser::extract_route_params( $route ),
						'method'              => $method,
						'callback'            => RouteParser::normalize_callable( $endpoint['callback'] ?? null ),
						'permission_callback' => RouteParser::normalize_callable( $permission_cb ),
						'permission_type'     => RouteParser::describe_permission_callback( $permission_cb ),
						'show_in_index'       => (bool) ( $endpoint['show_in_index'] ?? false ),
						'namespace'           => explode( '/', trim( $route, '/' ) )[0] ?? '',
					);
				}
			}
		}

		set_transient( 'rest_firewall_routes_list', $output, HOUR_IN_SECONDS );
		return $output;
	}

	private static function build_policy_tree(): array {
		$flat_routes = self::list_all_rest_routes();
		$tree        = array();

		foreach ( $flat_routes as $route ) {
			$parsed = RouteParser::route_to_segments( $route['route'] );
			if ( empty( $parsed ) ) {
				continue;
			}

			$namespace = $parsed['namespace'];
			$segments  = $parsed['segments'];

			if ( ! isset( $tree[ $namespace ] ) ) {
				$tree[ $namespace ] = array(
					'id'       => self::node_id( '/' . $namespace ),
					'label'    => $namespace,
					'path'     => '/' . $namespace,
					'children' => array(),
					'routes'   => array(),
				);
			}

			if ( empty( $segments ) ) {
				self::add_route_to_collection( $tree[ $namespace ]['routes'], $route );
			} else {
				self::insert_route_into_tree( $tree[ $namespace ]['children'], $segments, $route, '/' . $namespace );
			}
		}

		return self::normalize_tree( $tree );
	}

	private static function add_route_to_collection( array &$collection, array $route ): void {
		foreach ( $collection as $existing ) {
			if ( $existing['method'] === $route['method'] && $existing['route'] === $route['route'] ) {
				return;
			}
		}
		$collection[] = RouteParser::build_route_entry( $route );
	}

	private static function insert_route_into_tree( array &$tree, array $segments, array $route, string $base_path = '' ): void {
		if ( empty( $segments ) ) {
			return;
		}

		$segment = array_shift( $segments );
		$path    = $base_path . '/' . $segment;

		if ( ! isset( $tree[ $segment ] ) ) {
			$tree[ $segment ] = array(
				'id'       => self::node_id( $path ),
				'label'    => $segment,
				'path'     => $path,
				'children' => array(),
				'routes'   => array(),
			);
		}

		if ( empty( $segments ) ) {
			self::add_route_to_collection( $tree[ $segment ]['routes'], $route );
			return;
		}

		self::insert_route_into_tree( $tree[ $segment ]['children'], $segments, $route, $path );
	}

	private static function merge_saved_tree_into_current_tree( array $tree, array $saved_tree ): array {
		$saved_index = self::build_saved_index( $saved_tree );
		$result      = array();
		$seen        = array();

		foreach ( $tree as $node ) {
			$identity = self::get_node_identity( $node );
			if ( $identity ) {
				$seen[] = $identity;
			}

			$matching = $identity && isset( $saved_index[ $identity ] ) ? $saved_index[ $identity ] : null;
			$result[] = self::merge_node_with_saved( $node, $matching );
		}

		foreach ( $saved_tree as $saved_node ) {
			$identity = self::get_node_identity( $saved_node );
			if ( $identity && ! in_array( $identity, $seen, true ) ) {
				$result[] = $saved_node;
			}
		}

		return $result;
	}

	private static function build_saved_index( array $saved_tree ): array {
		$index = array();
		foreach ( $saved_tree as $node ) {
			$identity = self::get_node_identity( $node );
			if ( $identity ) {
				$index[ $identity ] = $node;
			}
		}
		return $index;
	}

	private static function get_node_identity( array $node ): string {
		$priorities = array( 'id', 'uuid', 'path', 'label' );

		foreach ( $priorities as $key ) {
			if ( ! empty( $node[ $key ] ) ) {
				return $key . ':' . $node[ $key ];
			}
		}

		if ( ! empty( $node['route'] ) && ! empty( $node['method'] ) ) {
			return 'route:' . $node['route'] . '|' . $node['method'];
		}

		return '';
	}

	private static function merge_node_with_saved( array $node, ?array $saved_node ): array {
		if ( ! $saved_node ) {
			return $node;
		}

		$merged = $node;

		foreach ( $saved_node as $key => $value ) {
			if ( ! in_array( $key, array( 'settings', 'children', 'permission' ), true ) ) {
				$merged[ $key ] = $value;
			}
		}

		foreach ( array( 'settings', 'permission' ) as $key ) {
			if ( isset( $saved_node[ $key ] ) ) {
				$merged[ $key ] = self::merge_recursive( $merged[ $key ] ?? array(), $saved_node[ $key ] );
			}
		}

		if ( isset( $saved_node['children'] ) ) {
			$merged['children'] = self::merge_saved_tree_into_current_tree(
				$merged['children'] ?? array(),
				$saved_node['children']
			);
		}

		return $merged;
	}

	private static function merge_recursive( array $current, array $saved ): array {
		$merged = $current;
		foreach ( $saved as $key => $value ) {
			if ( is_array( $value ) && isset( $merged[ $key ] ) && is_array( $merged[ $key ] ) ) {
				$merged[ $key ] = array_replace_recursive( $merged[ $key ], $value );
			} else {
				$merged[ $key ] = $value;
			}
		}
		return $merged;
	}

	private static function normalize_tree( array $tree ): array {
		$result = array();

		foreach ( $tree as $node ) {
			$children = array();

			if ( ! empty( $node['routes'] ) ) {
				foreach ( $node['routes'] as $route ) {
					$children[] = array(
						'id'         => $route['uuid'],
						'label'      => $route['method'],
						'path'       => $node['path'],
						'method'     => $route['method'],
						'route'      => $route['route'],
						'params'     => $route['params'],
						'isMethod'   => true,
						'callback'   => $route['callback'],
						'permission' => $route['permission'],
						'settings'   => $route['settings'],
						'children'   => array(),
					);
				}
			}

			if ( ! empty( $node['children'] ) ) {
				$children = array_merge( $children, self::normalize_tree( $node['children'] ) );
			}

			$node['children'] = $children;
			unset( $node['routes'], $node['meta'] );

			if ( empty( $node['id'] ) ) {
				$node['id'] = self::node_id( $node['path'] ?? uniqid() );
			}

			$result[] = $node;
		}

		return $result;
	}

	private static function node_id( string $path ): string {
		return md5( $path );
	}

	public static function sanitize_routes_policy_tree( $tree ): array {
		if ( ! is_array( $tree ) ) {
			return array();
		}

		if ( isset( $tree['id'] ) || isset( $tree['label'] ) || isset( $tree['path'] ) || isset( $tree['settings'] ) || isset( $tree['children'] ) ) {
			return self::sanitize_node( $tree );
		}

		return array_values( array_filter( array_map( array( self::class, 'sanitize_node' ), $tree ) ) );
	}

	private static function sanitize_node( array $node ): array {
		$sanitized = array();

		foreach ( $node as $key => $value ) {
			switch ( $key ) {
				case 'id':
				case 'uuid':
				case 'label':
				case 'path':
				case 'method':
				case 'route':
				case 'callback':
					$sanitized[ $key ] = sanitize_text_field( (string) $value );
					break;

				case 'params':
					$sanitized[ $key ] = is_array( $value ) ? self::sanitize_params( $value ) : array();
					break;

				case 'settings':
					$sanitized[ $key ] = is_array( $value ) ? self::sanitize_settings( $value ) : array();
					break;

				case 'permission':
					$sanitized[ $key ] = self::sanitize_permission( $value );
					break;

				case 'children':
					$sanitized[ $key ] = is_array( $value ) ? self::sanitize_routes_policy_tree( $value ) : array();
					break;

				case 'isMethod':
					$sanitized[ $key ] = (bool) $value;
					break;

				default:
					$sanitized[ $key ] = $value;
			}
		}

		return $sanitized;
	}

	private static function sanitize_params( array $params ): array {
		return array_map(
			function ( $param ) {
				if ( ! is_array( $param ) ) {
					return array();
				}
				return array(
					'name'  => sanitize_text_field( (string) ( $param['name'] ?? '' ) ),
					'regex' => sanitize_text_field( (string) ( $param['regex'] ?? '' ) ),
				);
			},
			$params
		);
	}

	private static function sanitize_permission( $permission ): array {
		if ( ! is_array( $permission ) ) {
			return array(
				'type'     => '',
				'callback' => null,
			);
		}
		return array(
			'type'     => sanitize_text_field( (string) ( $permission['type'] ?? '' ) ),
			'callback' => is_string( $permission['callback'] ?? null )
				? sanitize_text_field( (string) $permission['callback'] )
				: null,
		);
	}

	private static function sanitize_settings( array $settings ): array {
		$sanitized = array();

		foreach ( $settings as $key => $value ) {
			if ( in_array( $key, array( 'disabled', 'protect' ), true ) ) {

				if ( is_array( $value ) ) {
					$sanitized[ $key ] = array(
						'value'      => (bool) ( $value['value'] ?? false ),
						'inherited'  => (bool) ( $value['inherited'] ?? false ),
						'overridden' => (bool) ( $value['overridden'] ?? false ),
					);
				} else {
					$sanitized[ $key ] = array(
						'value'      => (bool) $value,
						'inherited'  => false,
						'overridden' => false,
					);
				}
			} elseif ( is_bool( $value ) ) {
				$sanitized[ $key ] = $value;
			} elseif ( is_string( $value ) ) {
				$sanitized[ $key ] = sanitize_text_field( $value );
			} elseif ( is_array( $value ) ) {
				$sanitized[ $key ] = self::sanitize_settings( $value );
			} else {
				$sanitized[ $key ] = $value;
			}
		}

		return $sanitized;
	}

	private static function get_saved_rest_routes(): array {
		$saved = SettingsRepository::read_option( 'routes_policy_tree' );
		return is_array( $saved ) ? self::sanitize_routes_policy_tree( $saved ) : array();
	}
}
