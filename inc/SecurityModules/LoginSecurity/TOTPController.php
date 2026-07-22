<?php namespace Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Utils\FileUtils;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\TOTPRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

final class TOTPController {

	private const ENABLED_META_KEY            = '_bromate_totp_enabled';
	private const USER_SETTINGS_META_KEY      = '_bromate_totp_settings';
	private const SESSION_VERIFIED_META_KEY   = '_bromate_totp_session_verified';
	private const ACTIVATION_OPTION_KEY       = 'bromate_login_totp_activated_at';
	private const REMINDER_DISMISSED_META_KEY = '_bromate_totp_reminder_dismissed_at';

	public function __construct() {}

	public static function register() {

		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue_scripts' ) );
		add_action( 'show_user_profile', array( self::class, 'render_profile_section' ) );
		add_action( 'edit_user_profile', array( self::class, 'render_profile_section' ) );
		add_action( 'admin_footer', array( self::class, 'render_dialog' ) );

		add_action( 'personal_options_update', array( self::class, 'handle_profile_update' ) );
		add_action( 'edit_user_profile_update', array( self::class, 'handle_profile_update' ) );

		add_action( 'wp_ajax_bromate_verify_login_code', array( self::class, 'ajax_verify_login_code' ) );
		add_action( 'wp_ajax_bromate_generate_totp_secret', array( self::class, 'ajax_generate_secret' ) );
		add_action( 'wp_ajax_bromate_verify_totp_enrollment', array( self::class, 'ajax_verify_enrollment' ) );
		add_action( 'wp_ajax_bromate_disable_totp', array( self::class, 'ajax_disable_totp' ) );
		add_action( 'wp_ajax_bromate_regenerate_backup_codes', array( self::class, 'ajax_regenerate_backup_codes' ) );
		add_action( 'wp_ajax_bromate_get_totp_status', array( self::class, 'ajax_get_status' ) );
		add_action( 'wp_ajax_bromate_dismiss_totp_reminder', array( self::class, 'ajax_dismiss_reminder' ) );
	}

	public static function ajax_get_status(): void {
		if ( ! self::validate_ajax_nonce() ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			wp_send_json_error( array( 'message' => 'User not logged in' ), 401 );
			return;
		}

		try {
			$enrollment = new TOTPRepository();
			$status     = $enrollment->get_totp_status( $user_id );
			wp_send_json_success( $status );
		} catch ( \Exception $e ) {
			wp_send_json_error( array( 'message' => $e->getMessage() ), 500 );
		}
	}

	public static function ajax_generate_secret(): void {
		if ( ! self::validate_ajax_nonce() ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
			return;
		}

		if ( ! self::is_module_enabled() ) {
			wp_send_json_error( array( 'message' => '2FA module is not enabled' ), 403 );
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::validate_ajax_nonce()
		if ( ! isset( $_POST['issuer'] ) || ! isset( $_POST['account_name'] ) ) {
			wp_send_json_error( array( 'message' => 'Missing required parameters' ), 400 );
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			wp_send_json_error( array( 'message' => 'Invalid user or permission denied' ), 401 );
			return;
		}
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- Nonce verified in self::validate_ajax_nonce()
		$issuer       = sanitize_text_field( wp_unslash( $_POST['issuer'] ) );
		$account_name = sanitize_text_field( wp_unslash( $_POST['account_name'] ) );
		// phpcs:enable WordPress.Security.NonceVerification.Missing -- Nonce verified in self::validate_ajax_nonce()

		try {
			$enrollment = new TOTPRepository();
			$result     = $enrollment->generate_totp_secret( $user_id, $issuer, $account_name );
			wp_send_json_success( $result );
		} catch ( \Exception $e ) {
			wp_send_json_error( array( 'message' => $e->getMessage() ), 500 );
		}
	}

	public static function ajax_verify_login_code(): void {
		if ( ! self::validate_ajax_nonce() ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			wp_send_json_error( array( 'message' => 'User not logged in' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::validate_ajax_nonce()
		if ( ! isset( $_POST['code'] ) ) {
			wp_send_json_error( array( 'message' => 'Missing verification code' ), 400 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::validate_ajax_nonce()
		$code = preg_replace( '/[^0-9]/', '', sanitize_text_field( wp_unslash( $_POST['code'] ) ) );

		$enrollment = new TOTPRepository();
		$valid      = $enrollment->verify_totp_code_for_login( $user_id, $code );

		if ( ! $valid ) {
			$valid = $enrollment->verify_backup_code( $user_id, $code );
		}

		if ( ! $valid ) {
			wp_send_json_error( array( 'message' => 'Invalid verification code' ), 400 );
		}

		update_user_meta( $user_id, self::SESSION_VERIFIED_META_KEY, true );

		$settings = get_user_meta( $user_id, self::USER_SETTINGS_META_KEY, true );
		if ( is_array( $settings ) && ! empty( $settings['remember_device'] ) ) {
			setcookie(
				'bromate_totp_trusted',
				wp_hash( $user_id . ':' . wp_salt() ),
				time() + 30 * DAY_IN_SECONDS,
				COOKIEPATH,
				COOKIE_DOMAIN,
				is_ssl(),
				true
			);
		}

		wp_send_json_success( array( 'verified' => true ) );
	}

	public static function ajax_verify_enrollment(): void {
		if ( ! self::validate_ajax_nonce() ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			wp_send_json_error( array( 'message' => 'Invalid user or permission denied' ), 401 );
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::validate_ajax_nonce()
		if ( ! isset( $_POST['code'] ) ) {
			wp_send_json_error( array( 'message' => 'Missing code' ), 403 );
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::validate_ajax_nonce()
		$code = sanitize_text_field( wp_unslash( $_POST['code'] ) );
		$code = preg_replace( '/[^0-9]/', '', $code );

		if ( ! $code || strlen( $code ) < 6 || strlen( $code ) > 8 ) {
			wp_send_json_error( array( 'message' => 'Invalid verification code format' ), 400 );
			return;
		}

		try {
			$enrollment = new TOTPRepository();
			$result     = $enrollment->verify_totp_enrollment( $user_id, $code );
			wp_send_json_success( $result );
		} catch ( \Exception $e ) {
			wp_send_json_error( array( 'message' => $e->getMessage() ), 500 );
		}
	}

	public static function ajax_disable_totp(): void {
		if ( ! self::validate_ajax_nonce() ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			wp_send_json_error( array( 'message' => 'Invalid user or permission denied' ), 401 );
			return;
		}

		try {
			$enrollment = new TOTPRepository();
			$result     = $enrollment->disable_totp( $user_id );
			if ( $result ) {
				wp_send_json_success( array( 'message' => '2FA disabled successfully' ) );
			} else {
				wp_send_json_error( array( 'message' => 'Failed to disable 2FA' ), 500 );
			}
		} catch ( \Exception $e ) {
			wp_send_json_error( array( 'message' => $e->getMessage() ), 500 );
		}
	}

	public static function ajax_regenerate_backup_codes(): void {
		if ( ! self::validate_ajax_nonce() ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			wp_send_json_error( array( 'message' => 'Invalid user or permission denied' ), 401 );
			return;
		}

		try {
			$enrollment   = new TOTPRepository();
			$backup_codes = $enrollment->regenerate_backup_codes( $user_id );
			wp_send_json_success( array( 'backup_codes' => $backup_codes ) );
		} catch ( \Exception $e ) {
			wp_send_json_error( array( 'message' => $e->getMessage() ), 500 );
		}
	}

	public static function ajax_dismiss_reminder(): void {
		if ( ! self::validate_ajax_nonce() ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			wp_send_json_error( array( 'message' => 'User not logged in' ), 401 );
			return;
		}

		$settings = self::get_global_settings();

		if ( 'mandatory' === $settings['policy'] ) {
			wp_send_json_error( array( 'message' => 'Reminder cannot be dismissed under mandatory policy' ), 403 );
			return;
		}

		$dismissed_at = time();
		update_user_meta( $user_id, self::REMINDER_DISMISSED_META_KEY, $dismissed_at );

		wp_send_json_success( array( 'dismissed_at' => $dismissed_at ) );
	}

	private static function validate_ajax_nonce(): bool {
		if ( ! isset( $_POST['nonce'] ) ) {
			return false;
		}
		return wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ) ), 'bromate_totp_enrollment' );
	}

	public static function enqueue_scripts(): void {
		if ( ! is_user_logged_in() ) {
			return;
		}

		if ( ! self::is_module_enabled() ) {
			return;
		}

		global $pagenow;

		$settings        = self::get_global_settings();
		$current_user    = wp_get_current_user();
		$user_id         = absint( $current_user->ID );
		$is_user_enabled = (bool) get_user_meta( $user_id, self::ENABLED_META_KEY, true );
		$is_profile_page = 'profile.php' === $pagenow;
		$show_dialog     = self::should_show_dialog( $user_id, $settings, $is_user_enabled );

		$mui_script_config = FileUtils::load_script_config( BROMATE_SECURITY_API_FIREWALL_DIR . 'build/mui.asset.php' );
		$mui_dependencies  = ! empty( $mui_script_config ) && isset( $mui_script_config['dependencies'] ) ? $mui_script_config['dependencies'] : array();

		wp_enqueue_script(
			'bromate-security-api-firewall-totp-mui',
			BROMATE_SECURITY_API_FIREWALL_URL . 'build/mui.js',
			$mui_dependencies,
			$mui_script_config['version'],
			true
		);

		$totp_script_config = FileUtils::load_script_config( BROMATE_SECURITY_API_FIREWALL_DIR . 'build/index.asset.php' );
		$totp_dependencies  = ! empty( $totp_script_config ) && isset( $totp_script_config['dependencies'] ) ? $totp_script_config['dependencies'] : array();

		wp_enqueue_script(
			'bromate-security-api-firewall-totp',
			BROMATE_SECURITY_API_FIREWALL_URL . 'build/totp.js',
			array_merge( $totp_dependencies, array( 'bromate-security-api-firewall-totp-mui' ) ),
			$totp_script_config['version'],
			true
		);

		wp_localize_script(
			'bromate-security-api-firewall-totp',
			'bromate_totp_data',
			array(
				'nonce'           => wp_create_nonce( 'bromate_totp_enrollment' ),
				'ajaxurl'         => admin_url( 'admin-ajax.php' ),
				'sitename'        => sanitize_text_field( get_bloginfo( 'sitename' ) ),
				'username'        => $current_user->user_login,
				'enabled'         => $settings['enabled'],
				'issuer'          => $settings['issuer'],
				'show_dialog'     => $show_dialog,
				'is_profile_page' => $is_profile_page,
				'is_user_enabled' => $is_user_enabled,
				'policy'          => $settings['policy'],
				'grace_period'    => $settings['grace_period'],
				'remaining_days'  => self::calculate_remaining_days( $settings ),
			)
		);
	}

	private static function calculate_remaining_days( array $settings ): ?int {
		if ( 'grace' !== $settings['policy'] ) {
			return null;
		}

		$activated_at = (int) SettingsRepository::read_option( 'login_totp_enabled_timestamp' );
		if ( ! $activated_at ) {
			return (int) $settings['grace_period'];
		}

		$elapsed_days = floor( ( time() - $activated_at ) / DAY_IN_SECONDS );
		return max( 0, (int) $settings['grace_period'] - $elapsed_days );
	}

	private static function should_show_dialog( int $user_id, array $settings, bool $is_user_enabled ): bool {
		if ( $is_user_enabled ) {
			return false;
		}

		if ( 'mandatory' === $settings['policy'] ) {
			return true;
		}

		$dismissed_at = get_user_meta( $user_id, self::REMINDER_DISMISSED_META_KEY, true );
		if ( ! $dismissed_at ) {
			return true;
		}

		return ( time() - (int) $dismissed_at ) >= DAY_IN_SECONDS;
	}

	public static function render_profile_section(): void {
		if ( ! self::is_module_enabled() ) {
			return;
		}
		global $pagenow;
		if ( 'profile.php' !== $pagenow || ! get_current_user_id() ) {
			return;
		}
		echo '<div id="bromate-security-api-firewall-totp-shadow-host"></div>';
	}

	public static function render_dialog(): void {

		if ( ! self::is_module_enabled() ) {
			return;
		}

		global $pagenow;

		if ( 'profile.php' === $pagenow ) {
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return;
		}

		$is_enrolled = (bool) get_user_meta( $user_id, self::ENABLED_META_KEY, true );

		if ( ! $is_enrolled ) {
			echo '<div id="bromate-security-api-firewall-totp-shadow-host" data-mode="enroll"></div>';
			return;
		}

		if ( get_user_meta( $user_id, self::SESSION_VERIFIED_META_KEY, true ) ) {
			return;
		}

		$settings = get_user_meta( $user_id, self::USER_SETTINGS_META_KEY, true );
		if ( ! is_array( $settings ) ) {
			$settings = array(
				'require_on_login' => true,
				'remember_device'  => true,
			);
		}

		if ( empty( $settings['require_on_login'] ) ) {
			return;
		}

		echo '<div id="bromate-security-api-firewall-totp-shadow-host" data-mode="verify"></div>';
	}

	private static function get_global_settings(): array {
		$defaults = array(
			'enabled'      => false,
			'issuer'       => sanitize_text_field( get_bloginfo( 'sitename' ) ),
			'policy'       => 'grace',
			'grace_period' => 7,
		);

		$settings = array(
			'enabled'      => SettingsRepository::read_option( 'login_totp_enabled' ),
			'issuer'       => SettingsRepository::read_option( 'login_totp_issuer' ),
			'policy'       => SettingsRepository::read_option( 'login_totp_policy' ),
			'grace_period' => SettingsRepository::read_option( 'login_totp_grace_period' ),
		);

		return wp_parse_args( $settings, $defaults );
	}

	private static function is_module_enabled(): bool {
		$settings = self::get_global_settings();
		return ! empty( $settings['enabled'] );
	}

	public static function handle_profile_update( int $user_id ): void {
		if ( ! current_user_can( 'edit_user', $user_id ) ) {
			return;
		}

		$user_2fa_settings = get_user_meta( $user_id, self::USER_SETTINGS_META_KEY, true );
		if ( ! is_array( $user_2fa_settings ) ) {
			$user_2fa_settings = array();
		}

		$user_2fa_settings['require_on_login'] = isset( $_POST['bromate_totp_require_login'] );
		$user_2fa_settings['remember_device']  = isset( $_POST['bromate_totp_remember_device'] );
		update_user_meta( $user_id, self::USER_SETTINGS_META_KEY, $user_2fa_settings );
	}
}
