<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes\RoutesTreeRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes\RouteParser;
use WP_REST_Request;

class RoutesResolver {

	protected static $cache = array();

	public static function resolve_for_request( WP_REST_Request $request ): array {

		$route  = $request->get_route();
		$method = $request->get_method();

		$cache_key = $method . ':' . $route;

		if ( isset( self::$cache[ $cache_key ] ) ) {
			return self::$cache[ $cache_key ];
		}

		$policy = self::resolve_for_route( $route, $method );

		self::$cache[ $cache_key ] = $policy;

		return $policy;
	}

	protected static function resolve_for_route( string $route, string $method ): array {

		$tree = RoutesTreeRepository::get_routes_policy_tree();

		$node_chain = self::find_node_chain( $tree, $route );

		$node_settings = array();

		foreach ( $node_chain as $node ) {
			if ( ! empty( $node['settings'] ) ) {
				$node_settings[] = $node['settings'];
			}
		}

		$route_settings = self::find_route_settings(
			$node_chain,
			$route,
			$method
		);

		// The root of the chain is the namespace node, which carries the
		// authoritative is_core flag computed in RoutesTreeRepository from
		// WordPress's actual registered namespace list — not re-derived
		// here from the route string.
		$is_core = ! empty( $node_chain[0]['is_core'] );

		$effective = self::resolve_settings(
			$node_settings,
			$route_settings,
			$is_core
		);

		if ( isset( $effective['disabled'] ) ) {

			$opts = SettingsRepository::read_options();

			if ( ! empty( $opts['routes_policy_default_hidden_routes'] ) ) {

				$default_hidden_routes = RoutesTreeRepository::get_default_hidden_routes();

				if ( ! empty( $default_hidden_routes ) ) {

					$match_count = 0;

					foreach ( $default_hidden_routes as $hidden_route ) {
						// $route (from $request->get_route()) always has a
						// leading slash; entries in DEFAULT_HIDDEN_ROUTES do
						// not. Normalize both sides before comparing, or the
						// prefix match never lines up.
						$needle = '/' . ltrim( $hidden_route, '/' );
						if ( 0 === strpos( $route, $needle ) ) {
							++$match_count;
						}
					}

					if ( $match_count > 0 ) {
						$effective['disabled'] = true;
					}
				}
			}

			$dis_methods = isset( $opts['routes_policy_hidden_methods'] )
				? (array) $opts['routes_policy_hidden_methods']
				: array();

			if ( ! empty( $dis_methods ) && in_array( strtolower( $method ), $dis_methods, true ) ) {
				$effective['disabled'] = true;
			}

			$hidden_objects = isset( $opts['routes_policy_hidden_wp_objects'] )
				? (array) $opts['routes_policy_hidden_wp_objects']
				: array();

			if ( ! empty( $hidden_objects ) ) {
				foreach ( $hidden_objects as $hidden_object ) {
					if ( '' !== $hidden_object && false !== strpos( $route, '/' . $hidden_object ) ) {
						$effective['disabled'] = true;
						break;
					}
				}
			}
		}

		return $effective;
	}

	protected static function find_node_chain( array $tree, string $route ): array {

		$known_namespaces = RoutesTreeRepository::get_registered_namespaces();
		$parsed           = RouteParser::route_to_segments( $route, $known_namespaces );

		if ( empty( $parsed ) ) {
			return array();
		}

		$path  = '/' . $parsed['namespace'];
		$chain = array();

		foreach ( $tree as $node ) {
			if ( $node['path'] === $path ) {
				$chain[] = $node;
				self::walk_chain(
					$node,
					$parsed['segments'],
					$chain
				);
				break;
			}
		}

		return $chain;
	}

	protected static function walk_chain( array $node, array $segments, array &$chain ): void {

		if ( empty( $segments ) || empty( $node['children'] ) ) {
			return;
		}

		$next = array_shift( $segments );

		foreach ( $node['children'] as $child ) {
			if ( $child['label'] === $next ) {
				$chain[] = $child;
				self::walk_chain( $child, $segments, $chain );
				return;
			}
		}
	}

	protected static function find_route_settings( array $node_chain, string $route, string $method ): array {

		$uuid = md5( $route . '|' . $method );

		$leaf = end( $node_chain );

		if ( empty( $leaf['routes'] ) ) {
			return array();
		}

		foreach ( $leaf['routes'] as $route_entry ) {
			if ( $route_entry['uuid'] === $uuid ) {
				return $route_entry['settings'] ?? array();
			}
		}

		return array();
	}

	protected static function resolve_settings( array $node_settings_chain, array $route_settings, bool $is_core_route = true ): array {

		$firewall_options    = SettingsRepository::read_options();
		$global_enforce_auth = (bool) ( $firewall_options['routes_policy_auth_enforce'] ?? false );

		$resolved = array(
			'disabled' => false,
			'protect'  => false,
		);

		$overridden = array(
			'disabled' => false,
			'protect'  => false,
		);

		foreach ( $node_settings_chain as $settings ) {
			$resolved = self::merge_settings( $resolved, $settings, $overridden );
		}

		$final = self::merge_settings( $resolved, $route_settings, $overridden );

		if ( $global_enforce_auth && $is_core_route && ! $overridden['protect'] ) {
			$final['protect'] = true;
		}

		return array(
			'disabled' => $final['disabled'],
			'protect'  => $final['protect'],
		);
	}

	private static function merge_settings( array $base, array $override, array &$overridden ): array {

		foreach ( $override as $key => $value ) {

			if ( null === $value ) {
				continue;
			}

			if ( is_array( $value ) && array_key_exists( 'value', $value ) ) {
				$base[ $key ] = (bool) $value['value'];

				if ( in_array( $key, array( 'disabled', 'protect' ), true ) && ! empty( $value['overridden'] ) ) {
					$overridden[ $key ] = true;
				}
			} elseif ( is_array( $value ) && 'tags' === $key ) {
				$base[ $key ] = array_values(
					array_unique(
						array_merge( $base[ $key ] ?? array(), $value )
					)
				);
			} else {
				$base[ $key ] = $value;
			}
		}

		return $base;
	}
}