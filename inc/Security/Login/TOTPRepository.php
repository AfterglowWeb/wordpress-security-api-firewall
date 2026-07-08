<?php namespace Bromate\SecurityApiFirewall\Security\Login;

defined( 'ABSPATH' ) || exit;

use PragmaRX\Google2FAQRCode\Google2FA;
use Exception;

final class TOTPRepository {

	private const PENDING_META_KEY      = '_bromate_totp_secret_pending';
	private const PENDING_TIME_META_KEY = '_bromate_totp_secret_pending_time';
	private const SECRET_META_KEY       = '_bromate_totp_secret';
	private const USER_ENROLLED_META_KEY      = '_bromate_security_api_firewall_totp_user_enrolled';
	private const ENABLED_TIME_META_KEY = '_bromate_security_api_firewall_totp_user_is_enrolled_time';
	private const BACKUP_CODES_META_KEY = '_bromate_backup_codes';
	private const DIGITS_META_KEY       = '_bromate_totp_digits';
	private const PERIOD_META_KEY       = '_bromate_totp_period';
	private const ALGORITHM_META_KEY    = '_bromate_totp_algorithm';

	private const TOTP_DIGITS    = 6;
	private const TOKEN_EXPIRY_DAYS    = 30;
	private const TOTP_ALGORITHM = 'SHA1';

	private Google2FA $google2fa;

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

	public function disable_totp( int $user_id ): bool {
		$enabled = get_user_meta( $user_id, self::USER_ENROLLED_META_KEY, true );
		if ( ! $enabled ) {
			throw new Exception( '2FA is not enabled for this user' );
		}

		delete_user_meta( $user_id, self::SECRET_META_KEY );
		delete_user_meta( $user_id, self::USER_ENROLLED_META_KEY );
		delete_user_meta( $user_id, self::ENABLED_TIME_META_KEY );
		delete_user_meta( $user_id, self::BACKUP_CODES_META_KEY );
		delete_user_meta( $user_id, self::DIGITS_META_KEY );
		delete_user_meta( $user_id, self::PERIOD_META_KEY );
		delete_user_meta( $user_id, self::ALGORITHM_META_KEY );

		$this->clear_pending_secret( $user_id );

		return true;
	}

	public function regenerate_backup_codes( int $user_id ): array {
		if ( ! $this->is_totp_enabled( $user_id ) ) {
			throw new Exception( '2FA is not enabled for this user' );
		}

		return $this->generate_backup_codes( $user_id );
	}

	public function is_totp_enabled( int $user_id ): bool {
		return (bool) get_user_meta( $user_id, self::USER_ENROLLED_META_KEY, true );
	}

	public function get_totp_status( int $user_id ): array {
		$enabled          = $this->is_totp_enabled( $user_id );
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

	public function revoke_all_trusted_devices( int $user_id ): void {
		delete_user_meta( $user_id, self::SECRET_META_KEY );
		delete_user_meta( $user_id, self::USER_ENROLLED_META_KEY );
		delete_user_meta( $user_id, self::ENABLED_TIME_META_KEY );
    }

    public function revoke_all_trusted_devices_everywhere(): void {
        global $wpdb;
		$current_user_id = get_current_user_id();

		$wpdb->query(
			$wpdb->prepare(
				"
				DELETE FROM {$wpdb->usermeta}
				WHERE user_id != %d
				AND meta_key IN (%s, %s, %s)
				",
				$current_user_id,
				self::SECRET_META_KEY,
				self::USER_ENROLLED_META_KEY,
				self::ENABLED_TIME_META_KEY
			)
		);
    }
}
