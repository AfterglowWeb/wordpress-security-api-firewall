<?php namespace Bromate\SecurityApiFirewall\Security\Firewall;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Security\IpEntry\ClientIpResolver;
use Bromate\SecurityApiFirewall\Security\IpEntry\IpEntryRepository;
use Bromate\SecurityApiFirewall\Security\Firewall\AutoBlacklist;
use Bromate\SecurityApiFirewall\Security\Firewall\ViolationTracker;
use Bromate\SecurityApiFirewall\Logs\FirewallLogger;

use WP_Error;

class RateLimiter {

	private const REQUEST_KEY_PREFIX = 'bromate_security_api_firewall_requests_';

	public static function inspect() {

		$options = SettingsRepository::read_options();

		if ( empty( $options['rate_limit_enabled'] ) ) {
			return true;
		}

		$client_ip = ClientIpResolver::get_client_ip();
		if ( IpEntryRepository::ip_in_list( $client_ip, 'whitelist' ) ) {
			return true;
		}

		$max_requests     = (int) $options['rate_limit_max'];
		$time_window      = (int) $options['rate_limit_time'];
		$max_violations   = (int) $options['rate_limit_blacklist_threshold'];
		$violation_window = (int) $options['rate_limit_violation_window'];
		$blacklist_time   = (int) $options['rate_limit_block_duration'];

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

			FirewallLogger::log( 'ip_banned', 'warning', [
				'reason' => __( 'Too many violations. IP has been temporarily blocked.', 'bromate-security-api-firewall' ), 
				'extra' => $violations
			], $client_ip );


			return new WP_Error(
				'rest_firewall_ip_blacklisted',
				__( 'Too many violations, your IP has been temporarily blocked.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		FirewallLogger::log( 'ip_rate_limited', 'error', [
				'reason' => __( 'IP rate limited.', 'bromate-security-api-firewall' ), 
				'extra' => $count
			], $client_ip );

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

		$key  = self::REQUEST_KEY_PREFIX . md5( $client_id );
		$data = get_transient( $key );
		$now  = time();

		if (
			! is_array( $data )
			|| ! isset( $data['count'], $data['window_start'] )
			|| ( $now - (int) $data['window_start'] ) >= $window
		) {
			$data = array(
				'count'        => 1,
				'window_start' => $now,
			);
		} else {
			++$data['count'];
		}

		$remaining = max( 1, $window - ( $now - $data['window_start'] ) );
		set_transient( $key, $data, $remaining );

		return $data['count'];
	}
}