<?php namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

class ViolationTracker {

	private const VIOLATIONS_KEY_PREFIX = 'bromate_security_api_firewall_violations_';
	private const VIOLATION_LOCK_PREFIX = 'bromate_security_api_firewall_violation_lock_';

	public static function record_violation( string $client_ip, int $memory_window, int $lock_window ): int {
		global $wpdb;

		$hash             = md5( $client_ip );
		$lock_window_start = (int) ( floor( time() / $lock_window ) * $lock_window );
		$lock_option      = '_transient_' . self::VIOLATION_LOCK_PREFIX . $hash . '_' . $lock_window_start;

		$claimed = $wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, '1', 'no')",
				$lock_option
			)
		);

		if ( ! $claimed ) {
			return self::get_violation_count( $client_ip );
		}

		$window_start = (int) ( floor( time() / $memory_window ) * $memory_window );
		$count_option = '_transient_' . self::VIOLATIONS_KEY_PREFIX . $hash . '_' . $window_start;

		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$wpdb->options} (option_name, option_value, autoload)
				VALUES (%s, '1', 'no')
				ON DUPLICATE KEY UPDATE option_value = option_value + 1",
				$count_option
			)
		);

		return (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", $count_option )
		);
	}

	public static function get_violation_count( string $client_ip ): int {
		global $wpdb;

		$hash = md5( $client_ip );
		$like = $wpdb->esc_like( '_transient_' . self::VIOLATIONS_KEY_PREFIX . $hash . '_' ) . '%';

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT option_value FROM {$wpdb->options} WHERE option_name LIKE %s ORDER BY option_name DESC LIMIT 1",
				$like
			)
		);
	}

	public static function clear_violations( string $client_ip ): void {
		global $wpdb;

		$hash = md5( $client_ip );

		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
				$wpdb->esc_like( '_transient_' . self::VIOLATIONS_KEY_PREFIX . $hash . '_' ) . '%',
				$wpdb->esc_like( '_transient_' . self::VIOLATION_LOCK_PREFIX . $hash . '_' ) . '%'
			)
		);
	}

	public static function delete_all_violation_transients(): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- No API exists to bulk-delete transients by prefix.
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options}
				WHERE option_name LIKE %s
				OR option_name LIKE %s
				OR option_name LIKE %s
				OR option_name LIKE %s",
				$wpdb->esc_like( '_transient_' . self::VIOLATIONS_KEY_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_timeout_' . self::VIOLATIONS_KEY_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_' . self::VIOLATION_LOCK_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_timeout_' . self::VIOLATION_LOCK_PREFIX ) . '%'
			)
		);
	}
}
