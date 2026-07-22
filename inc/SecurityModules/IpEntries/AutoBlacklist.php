<?php namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

class AutoBlacklist {

	private const AUTO_BLACKLIST_KEY_PREFIX = 'bromate_security_api_firewall_auto_blacklist_';

	public static function is_auto_blacklisted( string $ip ): bool {
		return (bool) get_transient(
			self::AUTO_BLACKLIST_KEY_PREFIX . md5( $ip )
		);
	}

	public static function auto_blacklist_ip(
		string $ip,
		int $duration
	): void {

		set_transient(
			self::AUTO_BLACKLIST_KEY_PREFIX . md5( $ip ),
			time(),
			$duration
		);
	}

	public static function remove_auto_blacklist(
		string $ip
	): void {

		delete_transient(
			self::AUTO_BLACKLIST_KEY_PREFIX . md5( $ip )
		);
	}
}
