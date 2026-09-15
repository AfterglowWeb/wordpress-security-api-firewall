<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes;

defined( 'ABSPATH' ) || exit;

class RouteParser {

	public static function build_route_entry( array $route ): array {

		return array(
			'uuid'       => self::route_uuid( $route ),
			'method'     => $route['method'],
			'route'      => $route['route'],
			'params'     => $route['params'],
			'settings'   => array(
				'protect'  => false,
				'disabled' => false,
			),
			'callback'   => $route['callback'],
			'permission' => array(
				'type'     => $route['permission_type'],
				'callback' => $route['permission_callback'],
			),
		);
	}

	public static function route_uuid( array $route ): string {
		return md5( $route['route'] . '|' . $route['method'] );
	}

	public static function describe_permission_callback( $cb ): string {

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
			return 'requires_check';
		}

		return 'custom';
	}

	public static function route_to_segments( string $route, array $known_namespaces ): array {

		$trimmed = trim( $route, '/' );
		if ( '' === $trimmed ) {
			return array();
		}

		$namespace = null;
		$rest      = null;

		foreach ( $known_namespaces as $ns ) {
			$ns = trim( $ns, '/' );
			if ( '' === $ns ) {
				continue;
			}
			if ( $trimmed === $ns || 0 === strpos( $trimmed, $ns . '/' ) ) {
				$namespace = $ns;
				$rest      = trim( substr( $trimmed, strlen( $ns ) ), '/' );
				break;
			}
		}

		if ( null === $namespace ) {
			return array();
		}

		$segments = ( '' === $rest ) ? array() : self::split_respecting_regex_groups( $rest );

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

	private static function split_respecting_regex_groups( string $path ): array {
		$segments = array();
		$buffer   = '';
		$depth    = 0;
		$length   = strlen( $path );

		for ( $i = 0; $i < $length; $i++ ) {
			$char = $path[ $i ];

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

		return $segments;
	}

	public static function extract_route_params( string $route ): array {

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

	public static function normalize_callable( $callback_name ) {

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
}
