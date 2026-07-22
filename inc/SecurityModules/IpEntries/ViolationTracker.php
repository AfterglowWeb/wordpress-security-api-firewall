<?php namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

class ViolationTracker {

	private const VIOLATIONS_KEY_PREFIX = 'rest_firewall_violations_';
	private const VIOLATION_LOCK_PREFIX = 'rest_firewall_violation_lock_';

	public static function record_violation( string $client_ip, int $memory_window, int $lock_window ): int {

		$lock_key = self::VIOLATION_LOCK_PREFIX . md5( $client_ip );

		if ( get_transient( $lock_key ) ) {
			return self::get_violation_count( $client_ip );
		}

		set_transient(
			$lock_key,
			1,
			$lock_window
		);

		$key  = self::VIOLATIONS_KEY_PREFIX . md5( $client_ip );
		$data = get_transient( $key );
		$now  = time();

		if (
			! is_array( $data )
			|| ! isset( $data['count'], $data['window_start'] )
			|| ( $now - (int) $data['window_start'] ) >= $memory_window
		) {
			$data = array(
				'count'        => 1,
				'window_start' => $now,
			);
		} else {
			++$data['count'];
		}

		$remaining = max( 1, $memory_window - ( $now - $data['window_start'] ) );
		set_transient( $key, $data, $remaining );

		return $data['count'];
	}

	public static function get_violation_count( string $client_ip ): int {

		$data = get_transient( self::VIOLATIONS_KEY_PREFIX . md5( $client_ip ) );

		return is_array( $data ) ? (int) ( $data['count'] ?? 0 ) : 0;
	}

	public static function clear_violations( string $client_ip ): void {

		delete_transient(
			self::VIOLATIONS_KEY_PREFIX . md5( $client_ip )
		);

		delete_transient(
			self::VIOLATION_LOCK_PREFIX . md5( $client_ip )
		);
	}
}
