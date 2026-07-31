<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Logs\Logger;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpUtils;
use WP_Error;

final class RestAuthenticationAttemptsLimiter {

	public const  BLOCK_PREFIX  = 'bromate_security_api_firewall_auth_blocked_';
	public const  STRIKE_PREFIX = 'bromate_security_api_firewall_auth_strikes_';
	private const COUNT_PREFIX  = 'bromate_security_api_firewall_auth_count_';

	public static function check_if_blocked() {
		if ( ! self::is_enabled() ) {
			return true;
		}

		$ip = IpUtils::get_client_ip();
		if ( '' === $ip || self::is_whitelisted( $ip ) ) {
			return true;
		}

		$hash  = self::ip_hash( $ip );
		$block = get_transient( self::BLOCK_PREFIX . $hash );

		if ( false !== $block ) {
			$opts        = self::get_options();
			$window_data = get_transient( self::COUNT_PREFIX . $hash );
			$retry_after = $opts['window'];

			if ( is_array( $window_data ) && isset( $window_data['window_start'] ) ) {
				$retry_after = max( 1, $opts['window'] - ( time() - $window_data['window_start'] ) );
			}

			return new WP_Error(
				'rest_auth_blocked',
				esc_html__( 'Too many failed authentication attempts. Please try again later.', 'bromate-security-api-firewall' ),
				array(
					'status'  => 429,
					'headers' => array( 'Retry-After' => (string) $retry_after ),
				)
			);
		}

		return true;
	}

	/**
	 * Record a failed authentication attempt.
	 */
	public static function record_failure(): void {
		if ( ! self::is_enabled() ) {
			return;
		}

		$ip = IpUtils::get_client_ip();
		if ( '' === $ip || self::is_whitelisted( $ip ) ) {
			return;
		}

		$hash = self::ip_hash( $ip );

		if ( get_transient( self::BLOCK_PREFIX . $hash ) ) {
			return;
		}

		$opts      = self::get_options();
		$count_key = self::COUNT_PREFIX . $hash;
		$data      = get_transient( $count_key );
		$now       = time();

		if ( ! is_array( $data ) || ! isset( $data['count'] ) || ( $now - $data['window_start'] ) >= $opts['window'] ) {
			$data = array(
				'count'        => 0,
				'window_start' => $now,
			);
		}

		++$data['count'];

		if ( $data['count'] >= $opts['attempts'] ) {
			$remaining = max( 1, $opts['window'] - ( $now - $data['window_start'] ) );
			set_transient( self::BLOCK_PREFIX . $hash, $ip, $remaining );

			delete_transient( $count_key );

			if ( $opts['blacklist_after'] > 0 ) {
				$strike_key = self::STRIKE_PREFIX . $hash;
				$strikes    = (int) get_transient( $strike_key ) + 1;

				if ( $strikes >= $opts['blacklist_after'] ) {
					self::auto_blacklist_ip( $ip, $opts['blacklist_time'] );
					delete_transient( $strike_key );
				} else {
					set_transient( $strike_key, $strikes, $opts['blacklist_time'] * ( $opts['blacklist_after'] + 1 ) );
				}
			}
		} else {
			$remaining = max( 1, $opts['window'] - ( $now - $data['window_start'] ) );
			set_transient( $count_key, $data, $remaining );
		}
	}

	private static function is_enabled(): bool {
		return (bool) SettingsRepository::read_option( 'auth_attempts_limit_enabled' );
	}

	private static function get_options(): array {
		$opts = SettingsRepository::read_options();
		return array(
			'attempts'        => max( 1, (int) ( $opts['auth_attempts_limit'] ?? 5 ) ),
			'window'          => max( 1, (int) ( $opts['auth_attempts_limit_window'] ?? 300 ) ),
			'blacklist_time'  => max( 1, (int) ( $opts['auth_attempts_violation_block_time'] ?? 3600 ) ),
			'blacklist_after' => max( 0, (int) ( $opts['auth_attempts_blacklist_after_violations'] ?? 3 ) ),
		);
	}

	public static function ip_hash( string $ip ): string {
		return substr( hash( 'sha256', $ip ), 0, 16 );
	}

	private static function auto_blacklist_ip( string $ip, int $duration ): void {
		if ( ! class_exists( IpEntriesRepository::class ) ) {
			return;
		}

		if ( IpEntriesRepository::ip_in_list( $ip, 'blacklist' ) ) {
			return;
		}

		IpEntriesRepository::insert(
			array(
				'ip'           => $ip,
				'list_type'    => 'blacklist',
				'entry_origin' => 'auth_attempts_limit',
				'entry_type'   => 'ip',
				'expires_at'   => gmdate( 'Y-m-d H:i:s', time() + $duration ),
			)
		);

		Logger::log( 'auth_attempts_limit', 'error', array( 'reason' => esc_html__( 'Auth failure attempts reached.', 'bromate-security-api-firewall' ) ) );
	}

	private static function is_whitelisted( string $ip ): bool {
		$whitelist = array_filter( (array) SettingsRepository::read_option( 'absolute_whitelist' ) );

		foreach ( $whitelist as $entry ) {
			if ( IpUtils::ip_matches( $ip, (string) $entry ) ) {
				Logger::log( 'auth_access_whitelist', 'info', array( 'reason' => esc_html__( 'Whilisted user auth.', 'bromate-security-api-firewall' ) ) );
				return true;
			}
		}

		return false;
	}

	public static function delete_all_auth_attempts_transients(): void {
		global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options}
                WHERE option_name LIKE %s
                OR option_name LIKE %s
                OR option_name LIKE %s
                OR option_name LIKE %s
                OR option_name LIKE %s
                OR option_name LIKE %s",
				$wpdb->esc_like( '_transient_' . self::BLOCK_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_timeout_' . self::BLOCK_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_' . self::STRIKE_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_timeout_' . self::STRIKE_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_' . self::COUNT_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_timeout_' . self::COUNT_PREFIX ) . '%'
			)
		);
	}
}
