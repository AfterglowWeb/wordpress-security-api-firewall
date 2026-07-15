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
		'routes_policy_hidden_routes_redirect_option'  => '404',
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
			$tree_saved   = RoutesTreeRepository::save_routes_policy_tree( $tree );

			return $global_saved && $tree_saved;
		} catch ( \Throwable $e ) {
			return false;
		}
	}

	public static function get_settings_payload(): array {
		return array(
			'settings'              => self::get_global_settings(),
			'tree'                  => RoutesTreeRepository::get_routes_policy_tree(),
			'default_hidden_routes' => RoutesTreeRepository::get_default_hidden_routes(),
		);
	}

	public static function get_default_hidden_routes(): array {
		$default_hidden_routes = apply_filters( 'bromate_security_api_firewall_default_hidden_routes', self::DEFAULT_HIDDEN_ROUTES );
		if ( ! is_array( $default_hidden_routes ) || empty( $default_hidden_routes ) ) {
			return array();
		}
		return array_map( 'sanitize_text_field', $default_hidden_routes );
	}
    
	public static function disabled_routes_response() {
		$redirect_option = SettingsRepository::read_option('routes_policy_hidden_routes_redirect_option');
		$redirect_user_url = SettingsRepository::read_option('routes_policy_hidden_routes_redirect_user_url');
		
		$redirect_url = '';
		
		switch ($redirect_option) {
			case 'login':
				$redirect_url = wp_login_url();
				break;
			case 'front':
				$redirect_url = home_url();
				break;
			case 'custom':
				$redirect_url = $redirect_user_url;
				break;
			default :
				$redirect_url = ''; 
		}

		$code_message = '';
		switch ($redirect_option) {
			case '401':
				$code_message = __('Unauthorized', 'bromate-security-api-firewall');
				break;
			case '404':
				$code_message = __('The ressource doesn\'t exist', 'bromate-security-api-firewall');
				break;
			case '403':
				$code_message = __('Forbidden', 'bromate-security-api-firewall');
				break;
			default :
				$code_message = '';
				break;
		}

		return [
			'redirect_option' => $redirect_option,
			'redirect_url' => $redirect_url,
			'code_message' => $code_message,
		];

		
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

	public static function sanitize_hidden_routes_redirect_option( $value ): string {
		$value = sanitize_text_field( (string) $value );
		return in_array( $value, array( '401', '403', '404', 'login', 'front', 'custom' ), true ) ? $value : '404';
	}

}
