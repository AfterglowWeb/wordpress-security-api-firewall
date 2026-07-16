<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Security\IpEntry\CidrMatcher;
use Bromate\SecurityApiFirewall\Security\IpEntry\GeoIpApi;
use Bromate\SecurityApiFirewall\Security\Login\Recaptcha;
use Bromate\SecurityApiFirewall\Security\Login\SaltsRotation;
use Bromate\SecurityApiFirewall\Security\Login\TOTPRepository;
use Bromate\SecurityApiFirewall\Security\Routes\RoutesPolicyRepository;
use Bromate\SecurityApiFirewall\Security\WordPress\HttpHeaders;

final class SettingsConfig {

	private function __construct() {}

	public static function register(): void {
		$self = new self();
		add_action( 'admin_init', array( $self, 'register_settings' ) );
	}

	public function register_settings(): void {
		register_setting(
			'bromate_security_api_firewall_options_group',
			'bromate_security_api_firewall_options',
			array(
				'sanitize_callback' => array( self::class, 'sanitize_options' ),
				'default'           => self::default_options(),
			)
		);
	}

	public static function options_config(): array {

		$options = array(

			'auth_control_enabled'                     => array(
				'default_value'     => 'wp_auth',
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'authentication',
			),

			'auth_methods'                             => array(
				'default_value'     => 'jwt',
				'ui'                => 'select',
				'choices'           => array( 'wp_auth', 'jwt' ),
				'type'              => 'string',
				'sanitize_callback' => static fn( $v ) => in_array( $v, array( 'wp_auth', 'jwt' ), true ) ? $v : 'jwt',
				'group'             => 'authentication',
			),

			'auth_jwt_algorithm'                       => array(
				'default_value'     => 'RS256',
				'ui'                => 'select',
				'choices'           => array( 'HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256' ),
				'type'              => 'string',
				'sanitize_callback' => static fn( $v ) => in_array( $v, array( 'HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256' ), true ) ? $v : 'RS256',
				'group'             => 'authentication',
			),

			'auth_jwt_public_key'                      => array(
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_textarea_field',
				'group'             => 'authentication',
			),

			'auth_jwt_audience'                        => array(
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'authentication',
			),

			'auth_jwt_issuer'                          => array(
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'authentication',
			),

			'auth_users'                               => array(
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( SettingsRepository::class, 'sanitize_authorized_users' ),
				'group'             => 'authentication',
			),

			'rate_limit_enabled'                       => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'firewall',
			),

			'rate_limit_max'                           => array(
				'default_value'     => 30,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'firewall',
			),

			'rate_limit_time'                          => array(
				'label'             => esc_html__( 'Time window (seconds)', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Period used to count requests before the limit resets.', 'bromate-security-api-firewall' ),
				'default_value'     => 60,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'firewall',
			),

			'rate_limit_block_duration'                => array(
				'default_value'     => 300,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'firewall',
			),

			'rate_limit_blacklist_threshold'           => array(
				'default_value'     => 5,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'firewall',
			),

			'rate_limit_whitelist'                     => array(
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( CidrMatcher::class, 'sanitize_ip_array' ),
				'group'             => 'firewall',
			),

			'rate_limit_countries'                     => array(
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( GeoIpApi::class, 'sanitize_country_codes' ),
				'group'             => 'firewall',
			),

			'routes_policy_enabled'                    => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'routes',
			),

			'routes_policy_auth_enforce'               => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'authentication',
			),

			'routes_policy_tree'                       => array(
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( RoutesPolicyRepository::class, 'sanitize_routes_policy_tree' ),
				'group'             => 'routes',
			),

			'routes_policy_default_hidden_routes'      => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'routes',
			),

			'routes_policy_hidden_methods'             => array(
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( RoutesPolicyRepository::class, 'sanitize_hidden_methods' ),
				'group'             => 'routes',
			),

			'routes_policy_hidden_wp_objects'          => array(
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( RoutesPolicyRepository::class, 'sanitize_hidden_wp_objects' ),
				'group'             => 'routes',
			),

			'routes_policy_hidden_routes_redirect_option'       => array(
				'default_value'     => '404',
				'options'           => array('404', '403', '401', 'front', 'login', 'custom'),
				'type'              => 'string',
				'sanitize_callback' => array( RoutesPolicyRepository::class, 'sanitize_hidden_routes_redirect_option' ),
				'group'             => 'routes',
			),

			'routes_policy_hidden_routes_redirect_user_url' => array(
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_url',
				'group'             => 'routes',
			),

			'login_rate_limit_enabled'                 => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'login_rate_limit_attempts'                => array(
				'default_value'     => 5,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_rate_limit_window'                  => array(
				'default_value'     => 300,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_rate_limit_blacklist_time'          => array(
				'default_value'     => 3600,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_rate_limit_promote_after'           => array(
				'default_value'     => 3,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_recaptcha_enabled'                  => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'login_recaptcha_site_key'                 => array(
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'login_recaptcha_secret_key'               => array(
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'login_recaptcha_threshold'                => array(
				'default_value'     => 0.5,
				'type'              => 'float',
				'sanitize_callback' => array( Recaptcha::class, 'sanitize_recaptcha_threshold' ),
				'group'             => 'login-hardening',
			),

			'login_totp_enabled'                        => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'login_totp_enabled_timestamp'              => array(
				'default_value'     => 0,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_totp_issuer'                         => array(
				'default_value'     => sanitize_text_field( get_bloginfo( 'sitename' ) ),
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'login_totp_policy'                         => array(
				'default_value'     => 'grace',
				'type'              => 'string',
				'sanitize_callback' => array( TOTPRepository::class, 'sanitize_totp_policy' ),
				'group'             => 'login-hardening',
			),

			'login_totp_grace_period'                   => array(
				'default_value'     => 7,
				'type'              => 'integer',
				'sanitize_callback' => array( TOTPRepository::class, 'sanitize_totp_grace_period' ),
				'group'             => 'login-hardening',
			),

			'cookie_hardening_samesite_enabled'        => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'cookie_hardening_samesite_mode'           => array(
				'options'           => array(
					'Lax',
					'Strict',
				),
				'default_value'     => 'Lax',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'cookie_hardening_max_concurrent_sessions' => array(
				'default_value'     => 0,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'salts_rotation_enabled'                    => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'salts_rotation_recurrence'                 => array(
				'default_value'     => 'week',
				'type'              => 'select',
				'options'           => array( 'day', 'week', 'month' ),
				'sanitize_callback' => array( SaltsRotation::class, 'sanitize_recurrence' ),
				'group'             => 'login-hardening',
			),

			'salts_rotation_time'                       => array(
				'default_value'     => '03:00',
				'type'              => 'string',
				'sanitize_callback' => array( SaltsRotation::class, 'sanitize_time' ),
				'group'             => 'login-hardening',
			),

			'redirect_front_enabled'                   => array(
				'default_value'     => '',
				'type'              => false,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'redirect_front_options'                   => array(
				'default_value'     => '',
				'options'           => array('404', '403', '401', 'front', 'login', 'custom'),
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_key',
				'group'             => 'wordpress',
			),

			'redirect_front_user_url'                  => array(
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_url',
				'group'             => 'wordpress',
			),

			'disable_xmlrpc'                           => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'disable_comments'                         => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'disable_pingbacks'                        => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'disable_atom_rss'                         => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'disable_sitemap'                          => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'disable_emoji_scripts'                    => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'disable_theme_editor'                     => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'harden_wpconfig_file_permissions'         => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'harden_uploads_dir_permissions'           => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'http_headers_secure'                      => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'http_headers_secure_options' => array(
				'default_value'     => false,
				'type'              => 'array',
				'sanitize_callback' => array(HttpHeaders::class, 'sanitize_secure_headers'),
				'options'           => [
					'x_powered_by' => [
						'type' => 'boolean',
						'label' => __('Remove X-Powered-By', 'bromate-security-api-firewall'),
						'default' => true,
					],
					'server' => [
						'type' => 'boolean',
						'label' => __('Remove Server', 'bromate-security-api-firewall'),
						'default' => true,
					],
					'x_generator' => [
						'type' => 'boolean',
						'label' => __('Remove X-Generator', 'bromate-security-api-firewall'),
						'default' => true,
					],
					'referrer_policy' => [
						'type' => 'string',
						'label' => __('Referrer Policy', 'bromate-security-api-firewall'),
						'default' => 'strict-origin-when-cross-origin',
						'options' => [
							'no-referrer',
							'no-referrer-when-downgrade',
							'origin',
							'origin-when-cross-origin',
							'same-origin',
							'strict-origin',
							'strict-origin-when-cross-origin',
							'unsafe-url',
						],
					],
					'cross_origin_resource_policy' => [
						'type' => 'string',
						'label' => __('Cross-Origin Resource Policy', 'bromate-security-api-firewall'),
						'default' => 'same-site',
						'options' => [
							'same-origin',
							'same-site',
							'cross-origin',
						],
					],
					'x_content_type_options' => [
						'type' => 'boolean',
						'label' => __('Enable X-Content-Type-Options', 'bromate-security-api-firewall'),
						'default' => true,
					],
					'x_frame_options' => [
						'type' => 'boolean',
						'label' => __('Enable X-Frame-Options', 'bromate-security-api-firewall'),
						'default' => true,
					],
					'strict_transport_security' => [
						'type' => 'boolean',
						'label' => __('Enable Strict-Transport-Security', 'bromate-security-api-firewall'),
						'default' => true,
					],
					'content_security_policy' => [
						'type' => 'string',
						'label' => __('Content Security Policy', 'bromate-security-api-firewall'),
						'default' => '',
					],
					'permissions_policy' => [
						'type' => 'string',
						'label' => __('Permissions Policy', 'bromate-security-api-firewall'),
						'default' => '',
					],
				],
				'group'             => 'wordpress',
			),

			'http_headers_caching'                      => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'http_headers_caching_options' => array(
				'default_value'     => false,
				'type'              => 'array',
				'sanitize_callback' => array(HttpHeaders::class, 'sanitize_caching_headers'),
				'options'           => [
					'no_cache' => [
						'type' => 'boolean',
						'label' => __('No-Cache', 'bromate-security-api-firewall'),
						'default' => false,
					],
					'no_store' => [
						'type' => 'boolean',
						'label' => __('No-Store', 'bromate-security-api-firewall'),
						'default' => true,
					],
					'must_revalidate' => [
						'type' => 'boolean',
						'label' => __('Must-Revalidate', 'bromate-security-api-firewall'),
						'default' => false,
					],
					'public' => [
						'type' => 'boolean',
						'label' => __('Public', 'bromate-security-api-firewall'),
						'default' => false,
					],
					'private' => [
						'type' => 'boolean',
						'label' => __('Private', 'bromate-security-api-firewall'),
						'default' => false,
					],
					'max_age' => [
						'type' => 'integer',
						'label' => __('Max Age (seconds)', 'bromate-security-api-firewall'),
						'default' => 0,
						'min' => 0,
						'max' => 31536000,
					],
					'pragma_no_cache' => [
						'type' => 'boolean',
						'label' => __('Pragma: No-Cache', 'bromate-security-api-firewall'),
						'default' => true,
					],
					'expires' => [
						'type' => 'integer',
						'label' => __('Expires (seconds)', 'bromate-security-api-firewall'),
						'default' => 0,
						'min' => 0,
						'max' => 31536000,
					]
				],
				'group'             => 'wordpress',
			),

			'http_headers_compression'                 => array(
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),
		);

		return apply_filters( 'bromate_security_api_firewall_core_options', $options );
	}

	public static function groups_config(): array {
		$groups_config = array(

			'dashboard'       => array(
				'label' => __( 'Dashboard', 'bromate-security-api-firewall' ),
				'icon'  => 'dashboard',
			),

			'firewall'        => array(
				'label' => __( 'Firewall', 'bromate-security-api-firewall' ),
				'icon'  => 'world',
			),

			'login-hardening' => array(
				'label' => __( 'Login Security', 'bromate-security-api-firewall' ),
				'icon'  => 'shield',
			),

			'wordpress'       => array(
				'label' => __( 'Global Security', 'bromate-security-api-firewall' ),
				'icon'  => 'wordpress',
			),

			'authentication'  => array(
				'label' => __( 'REST API Auth.', 'bromate-security-api-firewall' ),
				'icon'  => 'lock',
			),

			'routes'          => array(
				'label' => __( 'REST API Routes', 'bromate-security-api-firewall' ),
				'icon'  => 'route',
			),

			'models'          => array(
				'label' => __( 'REST API Models', 'bromate-security-api-firewall' ),
				'icon'  => 'data_object',
			),

			'logs'            => array(
				'label' => __( 'Logs', 'bromate-security-api-firewall' ),
				'icon'  => 'logs',
			),

		);

		return apply_filters( 'bromate_security_api_firewall_panels', $groups_config );
	}


	public static function default_options(): array {
		$defaults = array();

		foreach ( self::options_config() as $key => $config ) {
			$defaults[ $key ] = $config['default_value'];
		}

		return $defaults;
	}

	public static function to_json(): string {
		return wp_json_encode( self::register(), JSON_PRETTY_PRINT );
	}
}
