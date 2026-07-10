<?php namespace Bromate\SecurityApiFirewall\Security\Firewall;

defined( 'ABSPATH' ) || exit;

class ViolationTracker {

	private const VIOLATIONS_KEY_PREFIX = 'rest_firewall_violations_';
	private const VIOLATION_LOCK_PREFIX = 'rest_firewall_violation_lock_';

	public static function record_violation( string $client_ip, int $window ): int {

		$lock_key = self::VIOLATION_LOCK_PREFIX . md5( $client_ip );

		if ( get_transient( $lock_key ) ) {
			return self::get_violation_count(
				$client_ip
			);
		}

		set_transient(
			$lock_key,
			1,
			$window
		);

		$key = self::VIOLATIONS_KEY_PREFIX . md5( $client_ip );

		$count = (int) get_transient( $key );

		++$count;

		set_transient(
			$key,
			$count,
			$window
		);

		return $count;
	}

	public static function get_violation_count( string $client_ip ): int {

		return (int) get_transient(
			self::VIOLATIONS_KEY_PREFIX . md5( $client_ip )
		);
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
