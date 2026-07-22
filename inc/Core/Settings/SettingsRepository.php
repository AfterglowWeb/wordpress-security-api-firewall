<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\JwtAuthentication;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\WordPressApplicationPassword;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use WP_User;

class SettingsRepository {

	private function __construct() {}

	public static function read_options(): array {
		return self::sanitize_options( get_option( 'bromate_security_api_firewall_options', array() ) );
	}

	public static function read_option( string $option_key ) {
		$option_key = sanitize_key( $option_key );
		$options    = self::sanitize_options( get_option( 'bromate_security_api_firewall_options', array() ) );
		return isset( $options[ $option_key ] ) ? $options[ $option_key ] : false;
	}

	public static function read_option_settings( string $option_key ): array {
		$option_key     = sanitize_key( $option_key );
		$options_config = SettingsConfig::options_config();
		return isset( $options_config[ $option_key ] ) ? $options_config[ $option_key ] : array();
	}

	public static function update_options( array $new_options ): array {

		$sanitized_options = self::sanitize_options( $new_options, false );

		update_option( 'bromate_security_api_firewall_options', $sanitized_options );

		return $sanitized_options;
	}

	public static function update_option( string $option_key, $new_option ) {

		$options_config = SettingsConfig::options_config();
		if ( ! isset( $options_config[ $option_key ] ) ) {
			return false;
		}

		$sanitized_option       = self::sanitize_option( $option_key, $new_option );
		$options                = self::read_options();
		$options[ $option_key ] = $sanitized_option;

		update_option( 'bromate_security_api_firewall_options', $options );

		return $sanitized_option;
	}

	public static function sanitize_options( array $options, bool $use_defaults = true ): array {
		$options_config = SettingsConfig::options_config();
		$base_values    = $use_defaults ? SettingsConfig::default_options() : get_option( 'bromate_security_api_firewall_options', SettingsConfig::default_options() );

		$options   = wp_parse_args( $options, $base_values );
		$sanitized = array();

		foreach ( $options_config as $option_key => $config ) {
			$sanitized_key = sanitize_key( $option_key );
			$value         = $options[ $option_key ];

			$sanitized[ $sanitized_key ] = self::sanitize_option( $option_key, $value );
		}

		return $sanitized;
	}

	public static function sanitize_option( string $option_key, $option_value ) {
		$options_config = SettingsConfig::options_config();

		if ( ! isset( $options_config[ $option_key ] ) ) {
			return null;
		}

		$config   = $options_config[ $option_key ];
		$callback = $config['sanitize_callback'] ?? null;
		$type     = $config['type'] ?? 'string';

		if ( ! is_callable( $callback ) ) {
			return $config['default_value'] ? $config['default_value'] : null;
		}

		switch ( $type ) {
			case 'boolean':
				return (bool) call_user_func( $callback, $option_value );

			case 'integer':
				return (int) call_user_func( $callback, $option_value );

			case 'float':
				return (float) call_user_func( $callback, $option_value );

			case 'array':
				if ( ! is_array( $option_value ) ) {
					return array();
				}

				return is_callable( $callback )
					? call_user_func( $callback, $option_value )
					: $option_value;

			case 'string':
			default:
				return (string) call_user_func( $callback, $option_value );
		}
	}

}
