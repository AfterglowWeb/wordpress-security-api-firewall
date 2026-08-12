<?php
namespace Bromate\SecurityApiFirewall\Runtime;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\LoginAttemptsLimiter;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\TOTPLoginService;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\TOTPController;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\Recaptcha;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\SameSiteCookies;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\SessionManager;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\SaltsRotation;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Cron\Cron;
use WP_User;

/**
 * This class is a draft to check login runtime hooks and filters. It is not yet fully implemented and will change.
 */
final class LoginRuntime {
	const KEYS_PREFIX       = 'bromate_security_api_firewall_salts_rotation_hook_';

	private function __construct() {

		add_filter( 'authenticate', array( LoginAttemptsLimiter::class, 'check_before_auth' ), 5, 1 );
		add_action( 'wp_login_failed', array( LoginAttemptsLimiter::class, 'on_login_failed' ), 10 );


		add_action( 'login_enqueue_scripts', array( Recaptcha::class, 'enqueue_recaptcha_script' ) );
		add_action( 'login_form', array( Recaptcha::class, 'render_recaptcha_field' ) );
		add_filter( 'authenticate', array( Recaptcha::class, 'check_before_auth' ), 5, 3 );
		add_action( 'wp_login_failed', array( Recaptcha::class, 'on_login_failed' ), 10 );


		add_action( 'login_form', array( TOTPLoginService::class, 'add_totp_field_to_login' ) );
		add_action( 'woocommerce_login_form', array( TOTPLoginService::class, 'add_totp_field_to_login' ) );
		add_filter( 'wp_authenticate_user', array( TOTPLoginService::class, 'validate_totp' ), 10, 1 );
		add_action( 'wp_login', array( TOTPLoginService::class, 'handle_login_actions' ), 10 );
		add_action( 'wp_logout', array( TOTPLoginService::class, 'clear_trusted_cookie' ) );
		add_action( 'wp_ajax_bromate_verify_totp', array( TOTPLoginService::class, 'ajax_verify_totp' ) );
		add_action( 'wp_ajax_nopriv_bromate_verify_totp', array( TOTPLoginService::class, 'ajax_verify_totp' ) );
		add_action( 'wp_ajax_bromate_finish_login', array( TOTPLoginService::class, 'ajax_finish_login' ) );
		add_action( 'wp_ajax_nopriv_bromate_finish_login', array( TOTPLoginService::class, 'ajax_finish_login' ) );
		add_action( 'login_head', array( TOTPLoginService::class, 'add_custom_styles' ) );
		add_action( 'wp_head', array( TOTPLoginService::class, 'add_custom_styles' ) );
		add_filter( 'login_body_class', array( TOTPLoginService::class, 'add_body_class' ) );
		add_filter( 'body_class', array( TOTPLoginService::class, 'add_body_class' ) );
		add_action( 'login_enqueue_scripts', array( TOTPLoginService::class, 'enqueue_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( TOTPLoginService::class, 'enqueue_scripts' ) );

		add_action( 'admin_enqueue_scripts', array( TOTPController::class, 'enqueue_scripts' ) );
		add_action( 'show_user_profile', array( TOTPController::class, 'render_profile_section' ) );
		add_action( 'edit_user_profile', array( TOTPController::class, 'render_profile_section' ) );
		add_action( 'admin_footer', array( TOTPController::class, 'render_dialog' ) );
		add_action( 'personal_options_update', array( TOTPController::class, 'handle_profile_update' ) );
		add_action( 'edit_user_profile_update', array( TOTPController::class, 'handle_profile_update' ) );
		add_action( 'wp_ajax_bromate_verify_login_code', array( TOTPController::class, 'ajax_verify_login_code' ) );
		add_action( 'wp_ajax_bromate_generate_totp_secret', array( TOTPController::class, 'ajax_generate_secret' ) );
		add_action( 'wp_ajax_bromate_verify_totp_enrollment', array( TOTPController::class, 'ajax_verify_enrollment' ) );
		add_action( 'wp_ajax_bromate_revoke_user_totp_enrollment', array( TOTPController::class, 'ajax_revoke_user_totp_enrollment' ) );
		add_action( 'wp_ajax_bromate_regenerate_backup_codes', array( TOTPController::class, 'ajax_regenerate_backup_codes' ) );
		add_action( 'wp_ajax_bromate_get_totp_user_status', array( TOTPController::class, 'ajax_get_status' ) );
		add_action( 'wp_ajax_bromate_dismiss_totp_reminder', array( TOTPController::class, 'ajax_dismiss_reminder' ) );


		if ( ! empty( SettingsRepository::read_option( 'salts_rotation_enabled' ) ) ) {
			Cron::add_custom_schedule(
				SaltsRotation::KEYS_PREFIX . 'weekly',
				WEEK_IN_SECONDS,
				esc_html__( 'Once Weekly (Bromate)', 'bromate-security-api-firewall' )
			);
			Cron::add_custom_schedule(
				SaltsRotation::KEYS_PREFIX . 'monthly',
				30 * DAY_IN_SECONDS,
				esc_html__( 'Once Monthly (Bromate)', 'bromate-security-api-firewall' )
			);
			add_action( 'init', array( SaltsRotation::class, 'sync_schedule' ), 20 );
			add_filter( 'salt', array( SaltsRotation::class, 'filter_salt' ), 10, 2 );
		}
		add_action( 'wp_ajax_bromate_security_api_firewall_salts_rotation_status', array( SaltsRotation::class, 'ajax_salts_rotation_status' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_rotate_salts_now', array( SaltsRotation::class, 'ajax_rotate_salts_now' ) );

		add_action( 'init', array( SameSiteCookies::class, 'register_cookie_headers' ), 0 );

		add_action(
			'wp_login',
			static function ( $user_login, WP_User $user ) {
				$max = SettingsRepository::read_option( 'cookie_hardening_max_concurrent_sessions' );
				if ( empty( $max ) ) {
					return;
				}
				SessionManager::enforce_session_limit( $user->ID, $max );
			},
			10,
			2
		);

		add_action( 'wp_ajax_bromate_security_api_firewall_revoke_all_users_totp_enrollment', array( SessionManager::class, 'ajax_revoke_all_users_totp_enrollment' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_revoke_user_totp_enrollment', array( SessionManager::class, 'ajax_revoke_user_totp_enrollment' ) );

	}
}
