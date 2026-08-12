<?php namespace Bromate\SecurityApiFirewall\Runtime;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpUtils;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\AutoBlacklist;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\ViolationTracker;
use Bromate\SecurityApiFirewall\Logs\Logger;

use WP_Error;

class RateLimiterBucket {

	private const REQUEST_KEY_PREFIX = 'bromate_security_api_firewall_bucket_';
	private const MAX_BUCKET_TTL = DAY_IN_SECONDS;

	public static function inspect( $origin = 'public_rate_limit' ) {

		$options = SettingsRepository::read_options();

		if ( empty( $options['rate_limit_enabled'] ) ) {
			return true;
		}

		$client_ip = IpUtils::get_client_ip();

		if ( IpEntriesRepository::ip_in_list( $client_ip, 'whitelist' ) ) {
			return true;
		}

		$max_requests        = (int) $options['rate_limit_max'];
		$time_window         = (int) $options['rate_limit_time'];
		$violation_window    = (int) $options['rate_limit_violation_window'];
		$max_violations      = (int) $options['rate_limit_blacklist_threshold'];
		$blacklist_time      = (int) $options['rate_limit_blacklist_duration'];
		$blacklist_unlimited = (bool) $options['rate_limit_blacklist_duration_unlimited'];

		$result = self::consume_token( $client_ip, $max_requests, $time_window );

		if ( $result['allowed'] ) {
			return true;
		}

		$retry_after = $result['retry_after'];

		$violations = ViolationTracker::record_violation(
			$client_ip,
			$violation_window,
			$time_window
		);

		if ( $violations >= $max_violations ) {

			AutoBlacklist::auto_blacklist_ip(
				$client_ip,
				$blacklist_time,
				$blacklist_unlimited,
				$origin
			);

			ViolationTracker::clear_violations( $client_ip );

			Logger::log(
				'ip_blacklisted',
				'warning',
				array(
					'reason' => esc_html__( 'Too many violations. IP has been blacklisted.', 'bromate-security-api-firewall' ),
					'extra'  => $violations,
				),
				$client_ip
			);

			return new WP_Error(
				'bromate_security_api_firewall_ip_blacklisted',
				esc_html__( 'Too many violations, IP has been blacklisted.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		Logger::log(
			'ip_rate_limited',
			'error',
			array(
				'reason' => esc_html__( 'Too many requests. IP has been temporaly blocked.', 'bromate-security-api-firewall' ),
				'extra'  => $result['tokens_remaining'],
			),
			$client_ip
		);

		return new WP_Error(
			'bromate_security_api_firewall_ip_rate_limited',
			esc_html__( 'Too many requests. IP has been temporaly blocked.', 'bromate-security-api-firewall' ),
			array(
				'status'  => 429,
				'headers' => array( 'Retry-After' => (string) $retry_after ),
			)
		);
	}

	private static function consume_token(
		string $client_id,
		int $capacity,
		int $window
	): array {

		if ( $capacity <= 0 || $window <= 0 ) {
			return array(
				'allowed'          => true,
				'retry_after'      => 0,
				'tokens_remaining' => $capacity,
			);
		}

		$key         = self::REQUEST_KEY_PREFIX . md5( $client_id );
		$refill_rate = $capacity / $window;
		$now         = microtime( true );

		$bucket = get_transient( $key );

		if ( ! is_array( $bucket ) || ! isset( $bucket['tokens'], $bucket['last_refill'] ) ) {
			$bucket = array(
				'tokens'      => (float) $capacity,
				'last_refill' => $now,
			);
		}

		$elapsed = max( 0, $now - (float) $bucket['last_refill'] );

		$bucket['tokens']      = min( $capacity, (float) $bucket['tokens'] + $elapsed * $refill_rate );
		$bucket['last_refill'] = $now;

		if ( $bucket['tokens'] >= 1 ) {
			$bucket['tokens'] -= 1;
			set_transient( $key, $bucket, self::MAX_BUCKET_TTL );

			return array(
				'allowed'          => true,
				'retry_after'      => 0,
				'tokens_remaining' => $bucket['tokens'],
			);
		}

		$deficit     = 1 - $bucket['tokens'];
		$retry_after = (int) ceil( $deficit / $refill_rate );

		set_transient( $key, $bucket, self::MAX_BUCKET_TTL );

		return array(
			'allowed'          => false,
			'retry_after'      => max( 1, $retry_after ),
			'tokens_remaining' => $bucket['tokens'],
		);
	}
}