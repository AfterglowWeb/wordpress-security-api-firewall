<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

use Bromate\SecurityApiFirewall\Security\IpEntry\CidrMatcher;
use Bromate\SecurityApiFirewall\Security\IpEntry\GeoIpApi;
use Bromate\SecurityApiFirewall\Security\Login\Recaptcha;
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
				'label'             => esc_html__( 'Control REST API Authentication', 'bromate-security-api-firewall' ),
				'default_value'     => 'wp_auth',
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'authentication',
			),

			'auth_methods'                             => array(
				'label'             => esc_html__( 'Authentication method', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Choose how API clients authenticate with the REST API.', 'bromate-security-api-firewall' ),
				'default_value'     => 'wp_auth',
				'ui'                => 'select',
				'choices'           => array(
					'wp_auth' => esc_html__( 'WordPress Auth', 'bromate-security-api-firewall' ),
					'jwt'     => esc_html__( 'JWT', 'bromate-security-api-firewall' ),
				),
				'type'              => 'string',
				'sanitize_callback' => static fn( $v ) => in_array( $v, array( 'wp_auth', 'jwt' ), true ) ? $v : 'wp_auth',
				'group'             => 'authentication',
			),

			'auth_jwt_algorithm'                       => array(
				'label'             => esc_html__( 'JWT algorithm', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Cryptographic algorithm used to verify JWT tokens.', 'bromate-security-api-firewall' ),
				'default_value'     => 'RS256',
				'ui'                => 'select',
				'choices'           => array(
					'HS256',
					'HS384',
					'HS512',
					'RS256',
					'RS384',
					'RS512',
					'ES256',
				),
				'type'              => 'string',
				'sanitize_callback' => static fn( $v ) => in_array( $v, array( 'HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256' ), true ) ? $v : 'RS256',
				'group'             => 'authentication',
			),

			'auth_jwt_public_key'                      => array(
				'label'             => esc_html__( 'JWT public key', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Public key used to validate signed JWT tokens.', 'bromate-security-api-firewall' ),
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_textarea_field',
				'group'             => 'authentication',
			),

			'auth_jwt_audience'                        => array(
				'label'             => esc_html__( 'JWT audience', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Expected audience claim for incoming JWT tokens.', 'bromate-security-api-firewall' ),
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'authentication',
			),

			'auth_jwt_issuer'                          => array(
				'label'             => esc_html__( 'JWT issuer', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Expected issuer claim for incoming JWT tokens.', 'bromate-security-api-firewall' ),
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'authentication',
			),

			'auth_users'                               => array(
				'label'             => esc_html__( 'Authorized REST API users', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Restrict REST API access to specific WordPress user accounts.', 'bromate-security-api-firewall' ),
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( SettingsRepository::class, 'sanitize_authorized_users' ),
				'group'             => 'authentication',
			),

			// Firewall.
			'rate_limit_enabled'                       => array(
				'label'             => esc_html__( 'Enable API rate limiting', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Protect the API against excessive requests and abuse.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'firewall',
			),

			'rate_limit_max'                           => array(
				'label'             => esc_html__( 'Maximum requests', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Number of requests allowed during the configured time window.', 'bromate-security-api-firewall' ),
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
				'label'             => esc_html__( 'Temporary block duration (seconds)', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'How long a client remains blocked after exceeding the rate limit.', 'bromate-security-api-firewall' ),
				'default_value'     => 300,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'firewall',
			),

			'rate_limit_blacklist_threshold'           => array(
				'label'             => esc_html__( 'Blacklist threshold', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Number of rate-limit violations before automatic blacklisting.', 'bromate-security-api-firewall' ),
				'default_value'     => 5,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'firewall',
			),

			'rate_limit_whitelist'                     => array(
				'label'             => esc_html__( 'Rate limit whitelist', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'IP addresses or CIDR ranges exempt from rate limiting.', 'bromate-security-api-firewall' ),
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( CidrMatcher::class, 'sanitize_ip_array' ),
				'group'             => 'firewall',
			),

			'rate_limit_countries'                     => array(
				'label'             => esc_html__(
					'Blocked countries',
					'bromate-security-api-firewall'
				),
				'info'              => esc_html__(
					'Requests originating from these countries will be denied access to the REST API.',
					'bromate-security-api-firewall'
				),
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( GeoIpApi::class, 'sanitize_country_codes' ),
				'group'             => 'firewall',
			),

			'routes_policy_enabled'                    => array(
				'label'             => esc_html__( 'Enable route policies', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Control route visibility and authentication requirements on a per-route basis.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'routes',
			),

			'routes_policy_auth_enforce'               => array(
				'label'             => esc_html__( 'Require authentication for all wp/v2/* API routes', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'When enabled, wp/v2/* REST API routes require authentication.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'authentication',
			),

			'routes_policy_tree'                       => array(
				'label'             => esc_html__( 'Per-route policies', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Custom visibility and authentication rules applied to individual routes.', 'bromate-security-api-firewall' ),
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( RoutesPolicyRepository::class, 'sanitize_routes_policy_tree' ),
				'group'             => 'routes',
			),

			'routes_policy_default_hidden_routes'      => array(
				'label'             => esc_html__( 'Hidden routes', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Routes removed from discovery and unavailable to public clients.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'routes',
			),

			'routes_policy_hidden_methods'             => array(
				'label'             => esc_html__( 'Hidden methods', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'HTTP methods that should be hidden from discovery.', 'bromate-security-api-firewall' ),
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( RoutesPolicyRepository::class, 'sanitize_hidden_methods' ),
				'group'             => 'routes',
			),

			'routes_policy_hidden_wp_objects'          => array(
				'label'             => esc_html__( 'Hidden WordPress objects', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'WordPress object types hidden from the REST API surface.', 'bromate-security-api-firewall' ),
				'default_value'     => array(),
				'type'              => 'array',
				'sanitize_callback' => array( RoutesPolicyRepository::class, 'sanitize_hidden_wp_objects' ),
				'group'             => 'routes',
			),

			'routes_policy_hidden_routes_redirect_option'       => array(
				'label'             => esc_html__( 'Hidden ressources response code', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'HTTP response code on hidden ressources.', 'bromate-security-api-firewall' ),
				'default_value'     => '404',
				'options'           => array(
					'401',
					'403',
					'404',
					'login',
					'front',
					'custom'
				),
				'type'              => 'string',
				'sanitize_callback' => array( RoutesPolicyRepository::class, 'sanitize_hidden_routes_redirect_option' ),
				'group'             => 'routes',
			),

			'routes_policy_hidden_routes_redirect_user_url' => array(
				'label'             => esc_html__( 'Custom URL', 'bromate-security-api-firewall' ),
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_url',
				'group'             => 'routes',
			),

			// Login hardening.
			'login_rate_limit_enabled'                 => array(
				'label'             => esc_html__( 'Protect login page', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Limit failed login attempts to reduce brute-force attacks.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'login_rate_limit_attempts'                => array(
				'label'             => esc_html__( 'Maximum login attempts', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Number of failed login attempts allowed before blocking the client.', 'bromate-security-api-firewall' ),
				'default_value'     => 5,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_rate_limit_window'                  => array(
				'label'             => esc_html__( 'Login attempt window (seconds)', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Time period used to count failed login attempts.', 'bromate-security-api-firewall' ),
				'default_value'     => 300,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_rate_limit_blacklist_time'          => array(
				'label'             => esc_html__( 'Login block duration (seconds)', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'How long an IP remains blocked after exceeding login limits.', 'bromate-security-api-firewall' ),
				'default_value'     => 3600,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_rate_limit_promote_after'           => array(
				'label'             => esc_html__( 'Permanent blacklist threshold', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Number of temporary blocks before promoting an IP to the blacklist.', 'bromate-security-api-firewall' ),
				'default_value'     => 3,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_recaptcha_enabled'                  => array(
				'label'             => esc_html__( 'Enable reCAPTCHA v3', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Require Google reCAPTCHA v3 verification on login.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'login_recaptcha_site_key'                 => array(
				'label'             => esc_html__( 'reCAPTCHA site key', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Public site key issued by Google reCAPTCHA.', 'bromate-security-api-firewall' ),
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'login_recaptcha_secret_key'               => array(
				'label'             => esc_html__( 'reCAPTCHA secret key', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Private secret key issued by Google reCAPTCHA.', 'bromate-security-api-firewall' ),
				'default_value'     => '',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'login_recaptcha_threshold'                => array(
				'label'             => esc_html__( 'reCAPTCHA score threshold', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Minimum score (0.0–1.0) required to pass verification.', 'bromate-security-api-firewall' ),
				'default_value'     => 0.5,
				'type'              => 'float',
				'sanitize_callback' => array( Recaptcha::class, 'sanitize_recaptcha_threshold' ),
				'group'             => 'login-hardening',
			),

			'login_totp_enabled'                        => array(
				'label'             => esc_html__( 'Enable Two-Factor Authentication', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Require a TOTP code in addition to the password on login.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'login_totp_enabled_timestamp'              => array(
				'label'             => esc_html__( 'Two-Factor Authentication Activation Timestamp', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Internal: records when 2FA was globally enabled, used to compute the grace period.', 'bromate-security-api-firewall' ),
				'default_value'     => 0,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'login_totp_issuer'                         => array(
				'label'             => esc_html__( '2FA issuer name', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Organization name shown in authenticator apps.', 'bromate-security-api-firewall' ),
				'default_value'     => sanitize_text_field( get_bloginfo( 'sitename' ) ),
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'login_totp_policy'                         => array(
				'label'             => esc_html__( '2FA Enforcement Policy', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Determines how users are required to set up two-factor authentication.', 'bromate-security-api-firewall' ),
				'default_value'     => 'grace',
				'type'              => 'string',
				'sanitize_callback' => array( TOTPRepository::class, 'sanitize_totp_policy' ),
				'group'             => 'login-hardening',
			),

			'login_totp_grace_period'                   => array(
				'label'             => esc_html__( '2FA Grace Period (days)', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Number of days users have to enable 2FA before it becomes mandatory.', 'bromate-security-api-firewall' ),
				'default_value'     => 7,
				'type'              => 'integer',
				'sanitize_callback' => array( TOTPRepository::class, 'sanitize_totp_grace_period' ),
				'group'             => 'login-hardening',
			),

			'cookie_hardening_samesite_enabled'        => array(
				'label'             => esc_html__( 'Protect Authentication Cookie', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Prevent the auth cookie to be exposed.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'cookie_hardening_samesite_mode'           => array(
				'label'             => esc_html__( 'Authentication Cookie Policy', 'bromate-security-api-firewall' ),
				'options'           => array(
					'Lax',
					'Strict',
				),
				'default_value'     => 'Lax',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'salt_rotation_enabled'                    => array(
				'label'             => esc_html__( 'Rotate Salt Keys', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Salt Keys are used to sign authentication cookies and nonces. On rotation, all users are disconnected instantly.', 'bromate-security-api-firewall' ),
				'default_value'     => false,
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'login-hardening',
			),

			'salt_rotation_recurrence'                 => array(
				'label'             => esc_html__( 'Rotation Reccurrence', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'How often salt keys are rotated.', 'bromate-security-api-firewall' ),
				'default_value'     => 'week',
				'type'              => 'select',
				'options'           => array(
					'day'   => esc_html__( 'Daily', 'bromate-security-api-firewall' ),
					'week'  => esc_html__( 'Weekly', 'bromate-security-api-firewall' ),
					'month' => esc_html__( 'Monthly', 'bromate-security-api-firewall' ),
				),
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'salt_rotation_time'                       => array(
				'label'             => esc_html__( 'Rotation Time', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Pick an off-peak time (e.g. 03:00) since rotation disconnects every logged-in user.', 'bromate-security-api-firewall' ),
				'default_value'     => '03:00',
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'group'             => 'login-hardening',
			),

			'cookie_hardening_max_concurrent_sessions' => array(
				'label'             => esc_html__( 'Max Concurrent Sessions', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( '0 = unlimited. If set, the oldest session is automatically closed when a user exceeds this number of simultaneous logins.', 'bromate-security-api-firewall' ),
				'default_value'     => 0,
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'login-hardening',
			),

			'redirect_front_enabled'                   => array(
				'label'             => esc_html__( 'Application-only mode', 'bromate-security-api-firewall' ),
				'info'              => esc_html__( 'Redirect front-end pages and use WordPress primarily as a REST API backend.', 'bromate-security-api-firewall' ),
				'default_value'     => '',
				'type'              => false,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'group'             => 'wordpress',
			),

			'redirect_front_options'                   => array(
				'label'             => esc_html__( 'Redirect Options', 'bromate-security-api-firewall' ),
				'default_value'     => '',
				'options'           => array(
					array(
						'value' => '404',
						'label' => esc_html__( '404 Not Found', 'bromate-security-api-firewall' ),
					),
					array(
						'value' => '403',
						'label' => esc_html__( '403 Forbidden', 'bromate-security-api-firewall' ),
					),
					array(
						'value' => '401',
						'label' => esc_html__( '401 Unauthorized', 'bromate-security-api-firewall' ),
					),
					array(
						'value' => 'front',
						'label' => esc_html__( 'Front Page', 'bromate-security-api-firewall' ),
					),
					array(
						'value' => 'login',
						'label' => esc_html__( 'Login Page', 'bromate-security-api-firewall' ),
					),
					array(
						'value' => 'custom',
						'label' => esc_html__( 'Custom Url', 'bromate-security-api-firewall' ),
					),
				),
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_key',
				'group'             => 'wordpress',
			),

			'redirect_front_user_url'                  => array(
				'label'             => esc_html__( 'Custom URL', 'bromate-security-api-firewall' ),
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

			'max_upload_weight'                        => array(
				'default_value'     => 1024, // KB.
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'group'             => 'wordpress',
			),

			'max_upload_weight_enabled'                => array(
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
