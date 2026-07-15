<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Security\Authentication\JwtAuthenticator;
use Bromate\SecurityApiFirewall\Security\Authentication\WordPressApplicationPassword;
use Bromate\SecurityApiFirewall\Security\IpEntry\IpEntryRepository;
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
		$option_key = sanitize_key( $option_key );
		$options_config = SettingsConfig::options_config();
		return isset( $options_config[ $option_key ] ) ? $options_config[ $option_key ] : [];
	}

	public static function update_options( array $new_options ): array {

		$old_options       = self::read_options();
		$sanitized_options = self::sanitize_options( $new_options, false );

		update_option( 'bromate_security_api_firewall_options', $sanitized_options );

		do_action( 'rest_firewall_admin_options_updated', $sanitized_options, $old_options );

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

	public static function authorized_users_options(): array {
		$users = get_users(
			array(
				'role__in' => array( 'administrator', 'editor' ),
				'number'   => 500,
				'orderby'  => 'display_name',
				'order'    => 'ASC',
			)
		);

		if ( empty( $users ) ) {
			return array();
		}

		$current_user_id = get_current_user_id();

		return array_map(
			static function ( WP_User $user ) use ( $current_user_id ): array {
				return array(
					'id'                  => absint( $user->ID ),
					'display_name'        => sanitize_text_field( $user->display_name ?? '' ),
					'email'               => sanitize_email( $user->user_email ),
					'current_user'        => $current_user_id === $user->ID ? true : false,
					'admin_url'           => sanitize_url( get_edit_user_link( $user->ID ) ),
					'roles'               => array_map( 'sanitize_key', $user->roles ),
					'jwt_subclaim'        => JwtAuthenticator::create_user_subclaim( $user->ID ),
					'status'              => '',
					'expires_at'          => '',
					'ip_entries'          => IpEntryRepository::find_by_user( $user->ID ),
					'has_wp_app_password' => WordPressApplicationPassword::user_has_valid_application_password( $user->ID ),
				);
			},
			array_filter(
				(array) $users,
				static fn ( $user ) => $user instanceof WP_User
			)
		);
	}

	public static function sanitize_authorized_users( array $users ): array {
		$allowed_statuses = array( 'active', 'revoked' );

		$mapped = array_map(
			static function ( $user ) use ( $allowed_statuses ): ?array {
				if ( ! is_array( $user ) || empty( $user['id'] ) ) {
					return null;
				}

				return array(
					'id'           => absint( $user['id'] ),
					'jwt_subclaim' => sanitize_text_field( $user['jwt_subclaim'] ?? '' ),
					'status'       => in_array( $user['status'] ?? '', $allowed_statuses, true )
										? $user['status']
										: 'active',
					'expires_at'   => sanitize_text_field( $user['expires_at'] ?? '' ),
				);
			},
			$users
		);

		return array_values(
			array_filter( $mapped, static fn( $u ) => null !== $u )
		);
	}

	public static function sanitize_authorized_user( array $user ): array {
		$allowed_statuses = array( 'active', 'revoked' );

		if ( ! is_array( $user ) || empty( $user['id'] ) ) {
			return array();
		}

		return array(
			'id'           => absint( $user['id'] ),
			'jwt_subclaim' => sanitize_text_field( $user['jwt_subclaim'] ?? '' ),
			'status'       => in_array( $user['status'] ?? '', $allowed_statuses, true )
								? $user['status']
								: 'active',
			'expires_at'   => sanitize_text_field( $user['expires_at'] ?? '' ),
		);
	}

}
