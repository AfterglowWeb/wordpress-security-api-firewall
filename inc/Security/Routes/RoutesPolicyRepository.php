<?php namespace Bromate\SecurityApiFirewall\Security\Routes;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

class RoutesPolicyRepository {

	protected static $instance     = null;
	const DEFAULT_HIDDEN_ROUTES    = array( 'wp/v2/users', 'oembed/1.0', 'batch/v1', 'wp-site-health/v1', 'wp-abilities/v1' );
	const GLOBAL_SETTINGS_DEFAULTS = array(
		'routes_policy_enabled'               => false,
		'routes_policy_default_hidden_routes' => false,
		'routes_policy_hidden_methods'        => array(),
		'routes_policy_hidden_wp_objects'     => array(),
		'routes_policy_hidden_response_code'  => '404',
		'redirect_front_enabled'              => false,
		'redirect_front_options'              => '404',
		'redirect_front_user_url'             => '',
	);

	public static function get_instance() {
		if ( null === static::$instance ) {
			static::$instance = new static();
		}
		return static::$instance;
	}

	public static function get_global_settings(): array {
		$saved = SettingsRepository::read_options();

		if ( ! is_array( $saved ) ) {
			return self::GLOBAL_SETTINGS_DEFAULTS;
		}

		$global_settings = array();
		foreach ( self::GLOBAL_SETTINGS_DEFAULTS as $key => $default ) {
			$global_settings[ $key ] = $saved[ $key ] ?? $default;
		}

		return $global_settings;
	}

	public static function save_global_settings( array $settings ): bool {
		$sanitized = array_intersect_key( $settings, self::GLOBAL_SETTINGS_DEFAULTS );
		if ( empty( $sanitized ) ) {
			return true;
		}

		foreach ( $sanitized as $key => $value ) {
			$result = SettingsRepository::update_option( $key, $value );
			if ( false === $result ) {
				return false;
			}
		}

		return true;
	}

	public static function save_all_settings( array $settings ): bool {
		$global_settings = isset( $settings['settings'] ) ? $settings['settings'] : array();
		$tree            = isset( $settings['tree'] ) ? $settings['tree'] : array();

		try {
			$global_saved = self::save_global_settings( $global_settings );
			$tree_saved   = self::save_routes_policy_tree( $tree );

			return $global_saved && $tree_saved;
		} catch ( \Throwable $e ) {
			return false;
		}
	}

	public static function get_settings_payload(): array {
		return array(
			'tree'                  => self::get_routes_policy_tree(),
			'settings'              => self::get_global_settings(),
			'default_hidden_routes' => self::get_default_hidden_routes(),
		);
	}

	public static function get_default_hidden_routes(): array {
		$default_hidden_routes = apply_filters( 'bromate_security_api_firewall_default_hidden_routes', self::DEFAULT_HIDDEN_ROUTES );
		if ( ! is_array( $default_hidden_routes ) || empty( $default_hidden_routes ) ) {
			return array();
		}
		return array_map( 'sanitize_text_field', $default_hidden_routes );
	}


	public static function sanitize_hidden_methods( $value ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}

		return array_values(
			array_unique(
				array_filter(
					array_map(
						static function ( $method ) {
							$method = sanitize_key( (string) $method );
							return '' !== $method ? $method : null;
						},
						$value
					)
				)
			)
		);
	}

	public static function sanitize_hidden_wp_objects( $value ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}

		return array_values(
			array_unique(
				array_filter(
					array_map(
						static function ( $wp_object ) {
							$wp_object = sanitize_key( (string) $wp_object );
							return '' !== $wp_object ? $wp_object : null;
						},
						$value
					)
				)
			)
		);
	}

	public static function sanitize_hidden_response_code( $value ): string {
		$value = sanitize_text_field( (string) $value );
		return in_array( $value, array( '401', '403', '404' ), true ) ? $value : '404';
	}

	public static function get_routes_policy_tree(): array {
		$flat       = self::list_all_rest_routes();
		$tree       = self::build_policy_tree( $flat );
		$saved_tree = self::get_saved_rest_routes();

		return self::merge_saved_tree_into_current_tree( $tree, $saved_tree );
	}

	public static function save_routes_policy_tree( array $tree ): bool {
		try {
			$sanitized_tree = self::sanitize_routes_policy_tree( $tree );
			$result         = SettingsRepository::update_option( 'routes_policy_tree', $sanitized_tree );

			return false !== $result;
		} catch ( \Throwable $e ) {
			return false;
		}
	}

	public static function list_all_rest_routes(): array {

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
				if ( empty( $methods ) ) {
					continue;
				}

				foreach ( $methods as $method ) {

					$permission_cb = $endpoint['permission_callback'] ?? null;
					$route_params  = self::extract_route_params( $route );

					$output[] = array(
						'route'               => $route,
						'params'              => $route_params,
						'method'              => $method,
						'callback'            => self::normalize_callable(
							$endpoint['callback'] ?? null
						),
						'permission_callback' => self::normalize_callable(
							$permission_cb
						),
						'permission_type'     => self::describe_permission_callback(
							$permission_cb
						),
						'show_in_index'       => (bool) ( $endpoint['show_in_index'] ?? false ),
						'namespace'           => explode( '/', trim( $route, '/' ) )[0] ?? '',
					);

				}
			}
		}

		set_transient( 'rest_firewall_routes_list', $output, HOUR_IN_SECONDS );

		return $output;
	}

	public static function flush_routes_cache(): void {
		delete_transient( 'rest_firewall_routes_list' );
	}

	public static function sanitize_routes_policy_tree( $tree ): array {
		if ( ! is_array( $tree ) ) {
			return array();
		}

		if ( isset( $tree['id'] ) || isset( $tree['label'] ) || isset( $tree['path'] ) || isset( $tree['settings'] ) || isset( $tree['children'] ) ) {
			return self::sanitize_route_node( $tree );
		}

		return array_values(
			array_filter(
				array_map( array( self::class, 'sanitize_route_node' ), $tree ),
				static fn( $node ) => is_array( $node )
			)
		);
	}

	private static function build_policy_tree( array $flat_routes ): array {

		$tree = array();

		foreach ( $flat_routes as $route ) {

			$parsed = self::route_to_segments( $route['route'] );

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
				$already_exists = false;
				foreach ( $tree[ $namespace ]['routes'] as $existing ) {
					if ( $existing['method'] === $route['method'] && $existing['route'] === $route['route'] ) {
						$already_exists = true;
						break;
					}
				}
				if ( ! $already_exists ) {
					$tree[ $namespace ]['routes'][] = self::build_route_entry( $route );
				}
				continue;
			}

			self::insert_route(
				$tree[ $namespace ]['children'],
				$segments,
				$route,
				'/' . $namespace
			);

		}

		return self::normalize_tree( $tree );
	}

	private static function get_saved_rest_routes(): array {
		$saved = SettingsRepository::read_option( 'routes_policy_tree' );
		if ( ! is_array( $saved ) ) {
			return array();
		}

		return self::sanitize_routes_policy_tree( $saved );
	}

	private static function merge_saved_tree_into_current_tree( array $tree, array $saved_tree ): array {
		$saved_index = self::build_saved_tree_index( $saved_tree );

		$result = array();
		$seen   = array();
		foreach ( $tree as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}

			$identity = self::node_identity( $node );
			if ( '' !== $identity ) {
				$seen[ $identity ] = true;
			}

			$matching_saved = null;
			foreach ( self::node_identity_candidates( $node ) as $candidate ) {
				if ( isset( $saved_index[ $candidate ] ) ) {
					$matching_saved = $saved_index[ $candidate ];
					break;
				}
			}

			$result[] = self::merge_node_with_saved( $node, $matching_saved );
		}

		foreach ( $saved_tree as $saved_node ) {
			if ( ! is_array( $saved_node ) ) {
				continue;
			}

			$identity = self::node_identity( $saved_node );
			if ( '' === $identity || isset( $seen[ $identity ] ) ) {
				continue;
			}

			$result[] = $saved_node;
		}

		return $result;
	}

	private static function sanitize_route_node( array $node ): array {
		$sanitized = array();

		foreach ( $node as $key => $value ) {
			if ( 'id' === $key || 'uuid' === $key || 'label' === $key || 'path' === $key || 'method' === $key || 'route' === $key || 'callback' === $key ) {
				$sanitized[ $key ] = sanitize_text_field( (string) $value );
			} elseif ( 'params' === $key && is_array( $value ) ) {
				$sanitized[ $key ] = array_map(
					static function ( $param ) {
						if ( ! is_array( $param ) ) {
							return array();
						}

						return array(
							'name'  => sanitize_text_field( (string) ( $param['name'] ?? '' ) ),
							'regex' => sanitize_text_field( (string) ( $param['regex'] ?? '' ) ),
						);
					},
					$value
				);
			} elseif ( 'settings' === $key && is_array( $value ) ) {
				$sanitized[ $key ] = self::sanitize_settings( $value );
			} elseif ( 'permission' === $key && is_array( $value ) ) {
				$sanitized[ $key ] = array(
					'type'     => sanitize_text_field( (string) ( $value['type'] ?? '' ) ),
					'callback' => is_string( $value['callback'] ?? null ) ? sanitize_text_field( (string) $value['callback'] ) : null,
				);
			} elseif ( 'children' === $key && is_array( $value ) ) {
				$sanitized[ $key ] = array_values(
					array_filter(
						array_map( array( self::class, 'sanitize_route_node' ), $value ),
						static fn( $child ) => is_array( $child )
					)
				);
			} elseif ( 'isMethod' === $key ) {
				$sanitized[ $key ] = (bool) $value;
			} else {
				$sanitized[ $key ] = $value;
			}
		}

		return $sanitized;
	}

	private static function sanitize_settings( array $settings ): array {
		$sanitized = array();

		foreach ( $settings as $key => $value ) {
			if ( in_array( $key, array( 'disabled', 'protect' ), true ) && is_array( $value ) ) {
				$sanitized[ $key ] = array(
					'value'      => (bool) ( $value['value'] ?? false ),
					'inherited'  => (bool) ( $value['inherited'] ?? false ),
					'overridden' => (bool) ( $value['overridden'] ?? false ),
				);
			} elseif ( 'tags' === $key && is_array( $value ) ) {
				$sanitized[ $key ] = array_values( array_filter( array_map( 'sanitize_text_field', $value ) ) );
			} elseif ( is_bool( $value ) ) {
				$sanitized[ $key ] = (bool) $value;
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

	private static function build_saved_tree_index( array $saved_tree ): array {
		$saved_index = array();
		foreach ( $saved_tree as $saved_node ) {
			if ( ! is_array( $saved_node ) ) {
				continue;
			}

			$identity = self::node_identity( $saved_node );
			if ( '' === $identity ) {
				continue;
			}

			$saved_index[ $identity ] = $saved_node;
		}

		return $saved_index;
	}

	private static function node_identity( array $node ): string {
		if ( ! empty( $node['id'] ) ) {
			return 'id:' . (string) $node['id'];
		}

		if ( ! empty( $node['uuid'] ) ) {
			return 'uuid:' . (string) $node['uuid'];
		}

		if ( ! empty( $node['route'] ) && ! empty( $node['method'] ) ) {
			return 'route:' . (string) $node['route'] . '|' . (string) $node['method'];
		}

		if ( ! empty( $node['path'] ) ) {
			return 'path:' . (string) $node['path'];
		}

		if ( ! empty( $node['label'] ) ) {
			return 'label:' . (string) $node['label'];
		}

		return '';
	}

	private static function node_identity_candidates( array $node ): array {
		$candidates = array();

		if ( ! empty( $node['id'] ) ) {
			$candidates[] = 'id:' . (string) $node['id'];
		}

		if ( ! empty( $node['uuid'] ) ) {
			$candidates[] = 'uuid:' . (string) $node['uuid'];
		}

		if ( ! empty( $node['route'] ) && ! empty( $node['method'] ) ) {
			$candidates[] = 'route:' . (string) $node['route'] . '|' . (string) $node['method'];
		}

		if ( ! empty( $node['path'] ) ) {
			$candidates[] = 'path:' . (string) $node['path'];
		}

		if ( ! empty( $node['label'] ) ) {
			$candidates[] = 'label:' . (string) $node['label'];
		}

		return array_values( array_unique( $candidates ) );
	}

	private static function merge_node_with_saved( array $node, ?array $saved_node ): array {
		$merged = $node;

		if ( ! is_array( $saved_node ) ) {
			return $merged;
		}

		foreach ( $saved_node as $key => $value ) {
			if ( in_array( $key, array( 'settings', 'children', 'permission' ), true ) ) {
				continue;
			}

			$merged[ $key ] = $value;
		}

		if ( isset( $saved_node['permission'] ) && is_array( $saved_node['permission'] ) ) {
			$merged['permission'] = self::merge_settings( $merged['permission'] ?? array(), $saved_node['permission'] );
		}

		if ( isset( $saved_node['settings'] ) && is_array( $saved_node['settings'] ) ) {
			$merged['settings'] = self::merge_settings( $node['settings'] ?? array(), $saved_node['settings'] );
		}

		if ( isset( $saved_node['children'] ) && is_array( $saved_node['children'] ) ) {
			$merged['children'] = self::merge_children_with_saved( $node['children'] ?? array(), $saved_node['children'] );
		}

		return $merged;
	}

	private static function merge_children_with_saved( array $current_children, array $saved_children ): array {
		$saved_index = self::build_saved_tree_index( $saved_children );

		$result = array();
		$seen   = array();
		foreach ( $current_children as $child ) {
			if ( ! is_array( $child ) ) {
				continue;
			}

			$identity = self::node_identity( $child );
			if ( '' !== $identity ) {
				$seen[ $identity ] = true;
			}

			$matching_saved = null;
			foreach ( self::node_identity_candidates( $child ) as $candidate ) {
				if ( isset( $saved_index[ $candidate ] ) ) {
					$matching_saved = $saved_index[ $candidate ];
					break;
				}
			}

			$result[] = self::merge_node_with_saved( $child, $matching_saved );
		}

		foreach ( $saved_children as $saved_child ) {
			if ( ! is_array( $saved_child ) ) {
				continue;
			}

			$identity = self::node_identity( $saved_child );
			if ( '' === $identity || isset( $seen[ $identity ] ) ) {
				continue;
			}

			$result[] = $saved_child;
		}

		return $result;
	}

	private static function merge_settings( array $current_settings, array $saved_settings ): array {
		$merged = $current_settings;

		foreach ( $saved_settings as $key => $value ) {
			if ( is_array( $value ) && isset( $merged[ $key ] ) && is_array( $merged[ $key ] ) ) {
				$merged[ $key ] = array_replace_recursive( $merged[ $key ], $value );
			} else {
				$merged[ $key ] = $value;
			}
		}

		return $merged;
	}

	private static function normalize_tree( array $tree ): array {
		$out = array();

		foreach ( $tree as $node ) {
			if ( ! isset( $node['id'] ) || ! $node['id'] ) {
				$node['id'] = self::node_id( $node['path'] ?? uniqid() );
			}

			$all_children = array();

			if ( ! empty( $node['routes'] ) ) {
				foreach ( $node['routes'] as $route ) {
					$all_children[] = array(
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
				unset( $node['routes'] );
			}

			if ( ! empty( $node['children'] ) ) {
				$all_children = array_merge(
					$all_children,
					self::normalize_tree( $node['children'] )
				);
			}

			if ( ! empty( $all_children ) ) {
				$node['children'] = $all_children;
			} else {
				unset( $node['children'] );
			}

			if ( empty( $node['meta'] ) ) {
				unset( $node['meta'] );
			}

			$out[] = $node;
		}

		return $out;
	}

	private static function node_id( string $path ): string {
		return md5( $path );
	}

	private static function route_to_segments( string $route ): array {

		$route = trim( $route, '/' );
		if ( '' === $route ) {
			return array();
		}

		$segments = array();
		$buffer   = '';
		$depth    = 0;
		$length   = strlen( $route );

		for ( $i = 0; $i < $length; $i++ ) {
			$char = $route[ $i ];

			if ( '(' === $char ) {
				++$depth;
			} elseif ( ')' === $char ) {
				--$depth;
			}

			if ( '/' === $char && 0 === $depth ) {
				$segments[] = $buffer;
				$buffer     = '';
				continue;
			}

			$buffer .= $char;
		}

		if ( '' !== $buffer ) {
			$segments[] = $buffer;
		}

		if ( count( $segments ) < 2 ) {
			return array();
		}

		$namespace = $segments[0] . '/' . $segments[1];
		$segments  = array_slice( $segments, 2 );

		$segments = array_map(
			static function ( $segment ) {

				if ( preg_match( '#^\(\?P<([^>]+)>#', $segment, $m ) ) {
					return '{' . $m[1] . '}';
				}

				return $segment;
			},
			$segments
		);

		return array(
			'namespace' => $namespace,
			'segments'  => $segments,
		);
	}

	private static function insert_route( array &$tree, array $segments, array $route, string $base_path = '' ): void {

		$current =& $tree;
		$path    = $base_path;

		foreach ( $segments as $index => $segment ) {

			$path .= '/' . $segment;

			if ( ! isset( $current[ $segment ] ) ) {
				$current[ $segment ] = array(
					'id'       => self::node_id( $path ),
					'label'    => $segment,
					'path'     => $path,
					'children' => array(),
					'routes'   => array(),
				);
			}

			$current_node =& $current[ $segment ];

			if ( count( $segments ) - 1 === $index ) {

				$existing_index = null;
				foreach ( $current_node['routes'] as $i => $r ) {
					if ( $r['method'] === $route['method'] && $r['route'] === $route['route'] ) {
						$existing_index = $i;
						break;
					}
				}

				if ( null !== $existing_index ) {
					$current_node['routes'][ $existing_index ]['settings'] = array_merge(
						$current_node['routes'][ $existing_index ]['settings'] ?? array(),
						array(
							'protect'  => false,
							'disabled' => false,
							'tags'     => array(),
						)
					);
				} else {
					$current_node['routes'][] = self::build_route_entry( $route );
				}
			}

			$current =& $current_node['children'];
		}
	}

	private static function build_route_entry( array $route ): array {

		return array(
			'uuid'       => self::route_uuid( $route ),
			'method'     => $route['method'],
			'route'      => $route['route'],
			'params'     => $route['params'],
			'settings'   => array(
				'protect'  => false,
				'disabled' => false,
				'tags'     => array(),
			),
			'callback'   => $route['callback'],
			'permission' => array(
				'type'     => $route['permission_type'],
				'callback' => $route['permission_callback'],
			),
		);
	}

	private static function route_uuid( array $route ): string {
		return md5( $route['route'] . '|' . $route['method'] );
	}

	private static function normalize_callable( $callback_name ) {

		if ( is_string( $callback_name ) ) {
			return $callback_name;
		}

		if ( is_array( $callback_name ) && isset( $callback_name[0], $callback_name[1] ) ) {
			if ( is_object( $callback_name[0] ) ) {
				return get_class( $callback_name[0] ) . '::' . $callback_name[1];
			}

			if ( is_string( $callback_name[0] ) ) {
				return $callback_name[0] . '::' . $callback_name[1];
			}
		}

		if ( $callback_name instanceof \Closure ) {
			return 'closure';
		}

		return null;
	}

	private static function describe_permission_callback( $cb ): string {

		if ( empty( $cb ) ) {
			return 'public';
		}

		if ( '__return_true' === $cb ) {
			return 'public';
		}

		if ( '__return_false' === $cb ) {
			return 'forbidden';
		}

		if ( $cb instanceof \Closure ) {
			return 'custom';
		}

		if ( is_array( $cb ) ) {
			return 'protected';
		}

		return 'custom';
	}

	private static function extract_route_params( string $route ): array {

		preg_match_all(
			'#\(\?P<([^>]+)>([^)]+)\)#',
			$route,
			$matches,
			PREG_SET_ORDER
		);

		$params = array();

		foreach ( $matches as $match ) {
			$params[] = array(
				'name'  => $match[1],
				'regex' => $match[2],
			);
		}

		return $params;
	}
}
