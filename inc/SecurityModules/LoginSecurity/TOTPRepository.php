<?php namespace Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity;

defined( 'ABSPATH' ) || exit;

use PragmaRX\Google2FAQRCode\Google2FA;
use Exception;

final class TOTPRepository {


	private const TOTP_DIGITS       = 6;
	private const TOKEN_EXPIRY_DAYS = 30;
	private const TOTP_ALGORITHM    = 'SHA1';


	private const PENDING_META_KEY       = '_bromate_security_api_firewall_totp_secret_pending';
	private const PENDING_TIME_META_KEY  = '_bromate_security_api_firewall_totp_secret_pending_time';
	private const SECRET_META_KEY        = '_bromate_security_api_firewall_totp_secret';
	private const USER_ENROLLED_META_KEY = '_bromate_security_api_firewall_totp_user_enrolled';
	private const ENABLED_TIME_META_KEY  = '_bromate_security_api_firewall_totp_user_is_enrolled_time';
	private const BACKUP_CODES_META_KEY  = '_bromate_security_api_firewall_backup_codes';
	private const DIGITS_META_KEY        = '_bromate_security_api_firewall_totp_digits';
	private const PERIOD_META_KEY        = '_bromate_security_api_firewall_totp_period';
	private const ALGORITHM_META_KEY     = '_bromate_security_api_firewall_totp_algorithm';

	private const ENABLED_META_KEY            = '_bromate_security_api_firewall_totp_enabled';
	private const USER_SETTINGS_META_KEY      = '_bromate_security_api_firewall_totp_settings';
	private const SESSION_VERIFIED_META_KEY   = '_bromate_security_api_firewall_totp_session_verified';
	private const REMINDER_DISMISSED_META_KEY = '_bromate_security_api_firewall_totp_reminder_dismissed_at';
	private const FAILED_ATTEMPTS_META_KEY    = '_bromate_security_api_firewall_totp_failed_attempts';
	private const TRUSTED_TOKEN_META_KEY      = '_bromate_security_api_firewall_totp_trusted_token';

	private static ?self $instance = null;

	private Google2FA $google2fa;

	public static function get_instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}
	
	public function __construct() {
		$this->google2fa = new Google2FA();
	}

	public function generate_totp_secret( int $user_id, string $issuer, string $account_name ): array {

		$existing_secret = get_user_meta( $user_id, self::SECRET_META_KEY, true );
		if ( $existing_secret ) {
			throw new Exception( '2FA is already enabled for this user' );
		}

		$this->cleanup_expired_pending_secrets( $user_id );

		$digits    = self::TOTP_DIGITS;
		$period    = self::TOKEN_EXPIRY_DAYS;
		$algorithm = self::TOTP_ALGORITHM;

		$secret = $this->google2fa->generateSecretKey( 16 );

		update_user_meta( $user_id, self::PENDING_META_KEY, $secret );
		update_user_meta( $user_id, self::PENDING_TIME_META_KEY, time() );
		update_user_meta( $user_id, self::DIGITS_META_KEY, $digits );
		update_user_meta( $user_id, self::PERIOD_META_KEY, $period );
		update_user_meta( $user_id, self::ALGORITHM_META_KEY, $algorithm );

		$qr_code_svg = $this->google2fa->getQRCodeInline(
			$issuer,
			$account_name,
			$secret,
			200
		);

		$otpauth_url = $this->google2fa->getQRCodeUrl(
			$issuer,
			$account_name,
			$secret
		);

		return array(
			'secret'       => $secret,
			'otpauth_url'  => $otpauth_url,
			'qr_code_svg'  => $qr_code_svg,
			'digits'       => $digits,
			'period'       => $period,
			'algorithm'    => $algorithm,
			'issuer'       => $issuer,
			'account_name' => $account_name,
		);
	}

	public function verify_totp_enrollment( int $user_id, string $code ): array {
		$secret = get_user_meta( $user_id, self::PENDING_META_KEY, true );

		if ( ! $secret ) {
			throw new Exception( 'No pending 2FA enrollment found' );
		}

		$pending_time = get_user_meta( $user_id, self::PENDING_TIME_META_KEY, true );
		if ( $pending_time && ( time() - $pending_time > 3600 ) ) {
			$this->clear_pending_secret( $user_id );
			throw new Exception( 'Enrollment session has expired. Please try again.' );
		}

		try {
			$verified = $this->google2fa->verifyKey( $secret, $code, 2 );

			if ( $verified ) {
				update_user_meta( $user_id, self::SECRET_META_KEY, $secret );
				update_user_meta( $user_id, self::USER_ENROLLED_META_KEY, true );
				update_user_meta( $user_id, self::ENABLED_TIME_META_KEY, time() );

				$this->clear_pending_secret( $user_id );

				$backup_codes = $this->generate_backup_codes( $user_id );

				return array(
					'verified'     => true,
					'backup_codes' => $backup_codes,
					'message'      => '2FA successfully enabled',
				);
			}

			return array(
				'verified' => false,
				'message'  => 'Invalid verification code. Please try again.',
			);

		} catch ( Exception $e ) {
			throw new Exception( 'Failed to verify code: ' . esc_attr( $e->getMessage() ) );
		}
	}

	public function verify_totp_code_for_login( int $user_id, string $code ): bool {
		$secret = get_user_meta( $user_id, self::SECRET_META_KEY, true );

		if ( ! $secret ) {
			return false;
		}

		try {
			return $this->google2fa->verifyKey( $secret, $code, 1 );
		} catch ( Exception $e ) {
			return false;
		}
	}

	public function verify_backup_code( int $user_id, string $code ): bool {
		$hashed_codes = get_user_meta( $user_id, self::BACKUP_CODES_META_KEY, true );

		if ( ! is_array( $hashed_codes ) || empty( $hashed_codes ) ) {
			return false;
		}

		$code = preg_replace( '/[^0-9]/', '', $code );

		foreach ( $hashed_codes as $index => $hashed_code ) {
			if ( wp_check_password( $code, $hashed_code ) ) {
				unset( $hashed_codes[ $index ] );
				update_user_meta( $user_id, self::BACKUP_CODES_META_KEY, array_values( $hashed_codes ) );
				return true;
			}
		}

		return false;
	}

	public function regenerate_backup_codes( int $user_id ): array {
		if ( ! $this->is_user_enrolled( $user_id ) ) {
			throw new Exception( '2FA is not enabled for this user' );
		}

		return $this->generate_backup_codes( $user_id );
	}

	public function is_user_enrolled( int $user_id ): bool {
		return (bool) get_user_meta( $user_id, self::USER_ENROLLED_META_KEY, true );
	}

	public function is_login_enabled( int $user_id ): bool {
		return (bool) get_user_meta( $user_id, self::ENABLED_META_KEY, true );
	}

	public function set_login_enabled( int $user_id, bool $enabled ): void {
		update_user_meta( $user_id, self::ENABLED_META_KEY, $enabled );
	}

	public function get_user_settings( int $user_id ): array {
		$settings = get_user_meta( $user_id, self::USER_SETTINGS_META_KEY, true );

		if ( ! is_array( $settings ) ) {
			return array(
				'require_on_login' => true,
				'remember_device'  => true,
			);
		}

		return $settings;
	}

	public function update_user_settings( int $user_id, array $settings ): void {
		update_user_meta( $user_id, self::USER_SETTINGS_META_KEY, $settings );
	}

	public function is_session_verified( int $user_id ): bool {
		return (bool) get_user_meta( $user_id, self::SESSION_VERIFIED_META_KEY, true );
	}

	public function mark_session_verified( int $user_id ): void {
		update_user_meta( $user_id, self::SESSION_VERIFIED_META_KEY, true );
	}

	public function get_reminder_dismissed_at( int $user_id ): int {
		return (int) get_user_meta( $user_id, self::REMINDER_DISMISSED_META_KEY, true );
	}

	public function dismiss_reminder( int $user_id, int $timestamp ): void {
		update_user_meta( $user_id, self::REMINDER_DISMISSED_META_KEY, $timestamp );
	}

	public function get_failed_attempts( int $user_id ): array {
		$log = get_user_meta( $user_id, self::FAILED_ATTEMPTS_META_KEY, true );
		return is_array( $log ) ? $log : array();
	}

	public function record_failed_attempt( int $user_id, array $entry ): void {
		$log   = $this->get_failed_attempts( $user_id );
		$log[] = $entry;
		if ( count( $log ) > 10 ) {
			$log = array_slice( $log, -10 );
		}
		update_user_meta( $user_id, self::FAILED_ATTEMPTS_META_KEY, $log );
	}

	public function store_trusted_token( int $user_id, string $token, array $token_data ): void {
		$tokens           = $this->get_trusted_tokens( $user_id );
		$tokens[ $token ] = $token_data;

		if ( count( $tokens ) > 10 ) {
			uasort( $tokens, fn( $a, $b ) => $a['created'] - $b['created'] );
			$tokens = array_slice( $tokens, -10, 10, true );
		}

		update_user_meta( $user_id, self::TRUSTED_TOKEN_META_KEY, $tokens );
	}

	public function get_trusted_tokens( int $user_id ): array {
		$tokens = get_user_meta( $user_id, self::TRUSTED_TOKEN_META_KEY, true );
		return is_array( $tokens ) ? $tokens : array();
	}

	public function remove_trusted_token( int $user_id, string $token ): void {
		$tokens = $this->get_trusted_tokens( $user_id );
		unset( $tokens[ $token ] );
		update_user_meta( $user_id, self::TRUSTED_TOKEN_META_KEY, $tokens );
	}

	public function get_totp_user_status( int $user_id ): array {
		$enabled          = $this->is_user_enrolled( $user_id );
		$enabled_time     = get_user_meta( $user_id, self::ENABLED_TIME_META_KEY, true );
		$backup_codes     = get_user_meta( $user_id, self::BACKUP_CODES_META_KEY, true );
		$has_backup_codes = ! empty( $backup_codes );

		return array(
			'enabled'                => $enabled,
			'enabled_time'           => $enabled_time ? date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $enabled_time ) : null,
			'has_backup_codes'       => $has_backup_codes,
			'backup_codes_remaining' => $has_backup_codes && is_array( $backup_codes ) ? count( $backup_codes ) : 0,
		);
	}

	private function generate_backup_codes( int $user_id ): array {
		$codes        = array();
		$hashed_codes = array();

		for ( $i = 0; $i < 10; $i++ ) {
			$code           = sprintf( '%08d', random_int( 0, 99999999 ) );
			$hashed_code    = wp_hash_password( $code );
			$codes[]        = $code;
			$hashed_codes[] = $hashed_code;
		}

		update_user_meta( $user_id, self::BACKUP_CODES_META_KEY, $hashed_codes );

		return $codes;
	}

	private function clear_pending_secret( int $user_id ): void {
		delete_user_meta( $user_id, self::PENDING_META_KEY );
		delete_user_meta( $user_id, self::PENDING_TIME_META_KEY );
	}

	private function cleanup_expired_pending_secrets( int $user_id ): void {
		$pending_time = get_user_meta( $user_id, self::PENDING_TIME_META_KEY, true );
		if ( $pending_time && ( time() - $pending_time > 3600 ) ) {
			$this->clear_pending_secret( $user_id );
		}
	}

	public static function sanitize_totp_policy( $value ): string {
		$allowed = array( 'free', 'grace', 'mandatory' );
		$value   = sanitize_text_field( $value );

		if ( ! in_array( $value, $allowed, true ) ) {
			return 'free';
		}

		return $value;
	}

	public static function sanitize_totp_grace_period( $value ): int {
		$value = absint( $value );

		if ( $value < 1 ) {
			return 1;
		}
		if ( $value > 30 ) {
			return 30;
		}

		return $value;
	}

	public function revoke_user_totp_enrollment( int $user_id ): bool {
		$enabled = get_user_meta( $user_id, self::USER_ENROLLED_META_KEY, true );
		if ( ! $enabled ) {
			throw new Exception( '2FA is not enabled for this user' );
		}

		delete_user_meta( $user_id, self::USER_SETTINGS_META_KEY );
		delete_user_meta( $user_id, self::PENDING_META_KEY );
		delete_user_meta( $user_id, self::PENDING_TIME_META_KEY );
		delete_user_meta( $user_id, self::SECRET_META_KEY );
		delete_user_meta( $user_id, self::USER_ENROLLED_META_KEY );
		delete_user_meta( $user_id, self::ENABLED_TIME_META_KEY );
		delete_user_meta( $user_id, self::BACKUP_CODES_META_KEY );
		delete_user_meta( $user_id, self::DIGITS_META_KEY );
		delete_user_meta( $user_id, self::PERIOD_META_KEY );
		delete_user_meta( $user_id, self::ALGORITHM_META_KEY );
		delete_user_meta( $user_id, self::ENABLED_META_KEY );
		delete_user_meta( $user_id, self::SESSION_VERIFIED_META_KEY );
		delete_user_meta( $user_id, self::REMINDER_DISMISSED_META_KEY );
		delete_user_meta( $user_id, self::TRUSTED_TOKEN_META_KEY );
		delete_user_meta( $user_id, self::FAILED_ATTEMPTS_META_KEY );

		return true;
	}

	public static function revoke_all_users_totp_enrollment(): void {

		delete_metadata( 'user', 0, self::USER_SETTINGS_META_KEY, '', true );
		delete_metadata( 'user', 0, self::PENDING_META_KEY, '', true );
		delete_metadata( 'user', 0, self::PENDING_TIME_META_KEY, '', true );
		delete_metadata( 'user', 0, self::SECRET_META_KEY, '', true );
		delete_metadata( 'user', 0, self::USER_ENROLLED_META_KEY, '', true );
		delete_metadata( 'user', 0, self::ENABLED_TIME_META_KEY, '', true );
		delete_metadata( 'user', 0, self::BACKUP_CODES_META_KEY, '', true );
		delete_metadata( 'user', 0, self::DIGITS_META_KEY, '', true );
		delete_metadata( 'user', 0, self::PERIOD_META_KEY, '', true );
		delete_metadata( 'user', 0, self::ALGORITHM_META_KEY, '', true );
		delete_metadata( 'user', 0, self::ENABLED_META_KEY, '', true );
		delete_metadata( 'user', 0, self::SESSION_VERIFIED_META_KEY, '', true );
		delete_metadata( 'user', 0, self::REMINDER_DISMISSED_META_KEY, '', true );
		delete_metadata( 'user', 0, self::TRUSTED_TOKEN_META_KEY, '', true );
		delete_metadata( 'user', 0, self::FAILED_ATTEMPTS_META_KEY, '', true );

		self::delete_login_session_transients();
	}

	private static function delete_login_session_transients(): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- No API exists to bulk-delete transients by prefix.
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options}
				WHERE option_name LIKE %s
				OR option_name LIKE %s
				OR option_name LIKE %s
				OR option_name LIKE %s
				OR option_name LIKE %s
				OR option_name LIKE %s",
				$wpdb->esc_like( '_transient_bromate_totp_pending' ) . '%',
				$wpdb->esc_like( '_transient_timeout_bromate_totp_pending_' ) . '%',
				$wpdb->esc_like( '_transient_bromate_totp_attempts_' ) . '%',
				$wpdb->esc_like( '_transient_timeout_bromate_totp_attempts_' ) . '%',
				$wpdb->esc_like( '_transient_bromate_totp_verified_' ) . '%',
				$wpdb->esc_like( '_transient_timeout_bromate_totp_verified_' ) . '%'
			)
		);
	}
}
