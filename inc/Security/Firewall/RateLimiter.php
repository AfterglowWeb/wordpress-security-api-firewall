<?php namespace Bromate\SecurityApiFirewall\Security\Firewall;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Security\IpEntry\ClientIpResolver;
use Bromate\SecurityApiFirewall\Security\Firewall\AutoBlacklist;
use Bromate\SecurityApiFirewall\Security\Firewall\ViolationTracker;
use Bromate\SecurityApiFirewall\Logs\FirewallLogger;

use WP_Error;

class RateLimiter {

	private const REQUEST_KEY_PREFIX = 'rest_firewall_requests_';

	public static function inspect() {

		$options = SettingsRepository::read_options();

		if ( empty( $options['rate_limit_enabled'] ) ) {
			return true;
		}

		$client_ip = ClientIpResolver::get_client_ip();

		$max_requests     = (int) $options['rate_limit'];
		$time_window      = (int) $options['rate_limit_time'];
		$max_violations   = (int) $options['rate_limit_blacklist'];
		$violation_window = (int) $options['rate_limit_violation_window'];
		$blacklist_time   = (int) $options['rate_limit_blacklist_time'];

		$count = self::increment_request_count(
			$client_ip,
			$time_window
		);

		if ( $count <= $max_requests ) {
			return true;
		}

		$violations = ViolationTracker::record_violation(
			$client_ip,
			$violation_window
		);

		if ( $violations >= $max_violations ) {

			AutoBlacklist::auto_blacklist_ip(
				$client_ip,
				$blacklist_time
			);

			ViolationTracker::clear_violations(
				$client_ip
			);

			FirewallLogger::ip_banned( $client_ip, $violations );

			return new WP_Error(
				'rest_firewall_ip_blacklisted',
				__( 'Your IP has been temporarily blocked.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		FirewallLogger::ip_rate_limited( $client_ip, $count, $violation_window );

		return new WP_Error(
			'rest_firewall_rate_limited',
			__( 'Too many requests.', 'bromate-security-api-firewall' ),
			array( 'status' => 429 )
		);
	}

	private static function increment_request_count(
		string $client_id,
		int $window
	): int {

		$key = self::REQUEST_KEY_PREFIX . md5( $client_id );

		$count = (int) get_transient( $key );

		++$count;

		set_transient(
			$key,
			$count,
			$window
		);

		return $count;
	}
}
