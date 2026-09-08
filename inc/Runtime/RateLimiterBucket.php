<?php namespace Bromate\SecurityApiFirewall\Runtime;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Schema\SchemaManager;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpUtils;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\AutoBlacklist;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\ViolationTracker;
use Bromate\SecurityApiFirewall\Logs\Logger;
use Bromate\SecurityApiFirewall\Cron\Cron;

use WP_Error;

class RateLimiterBucket {

	private const STALE_ROW_TTL = DAY_IN_SECONDS;

	public static function register(): void {
		add_action( 'init', array( self::class, 'schedule_cleanup' ) );
		add_action( 'bromate_rate_buckets_cleanup', array( self::class, 'cleanup_stale_buckets' ) );
	}

	public static function schedule_cleanup(): void {
		if ( wp_next_scheduled( 'bromate_rate_buckets_cleanup' ) ) {
			return;
		}

		Cron::schedule(
			'bromate_rate_buckets_cleanup',
			'daily',
			array( self::class, 'cleanup_stale_buckets' ),
			time() + DAY_IN_SECONDS
		);
	}

	public static function inspect( $origin = 'public_rate_limit' ) {

		$options = SettingsRepository::read_options();

		if ( empty( $options['rate_limit_enabled'] ) ) {
			return true;
		}

		$client_ip = IpUtils::get_client_ip();

		if ( '' === $client_ip ) {
			return true;
		}

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

		$violations = ViolationTracker::record_violation( $client_ip, $violation_window, $time_window );

		if ( $violations >= $max_violations ) {

			AutoBlacklist::auto_blacklist_ip( $client_ip, $blacklist_time, $blacklist_unlimited, $origin );
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

	private static function consume_token( string $client_id, int $capacity, int $window ): array {

		if ( $capacity <= 0 || $window <= 0 ) {
			return array(
				'allowed'          => true,
				'retry_after'      => 0,
				'tokens_remaining' => $capacity,
			);
		}

		global $wpdb;

		$table       = SchemaManager::rate_buckets_table_name();
		$hash        = md5( $client_id );
		$now         = microtime( true );
		$refill_rate = $capacity / $window;

		$updated = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table}
				 SET tokens = LEAST(%f, tokens + (%f - last_refill) * %f) - 1,
				     last_refill = %f,
				     updated_at = %d
				 WHERE client_hash = %s
				   AND LEAST(%f, tokens + (%f - last_refill) * %f) >= 1",
				$capacity, $now, $refill_rate,
				$now,
				(int) $now,
				$hash,
				$capacity, $now, $refill_rate
			)
		);

		if ( 1 === $updated ) {
			$tokens_remaining = (float) $wpdb->get_var(
				$wpdb->prepare( "SELECT tokens FROM {$table} WHERE client_hash = %s", $hash )
			);

			return array(
				'allowed'          => true,
				'retry_after'      => 0,
				'tokens_remaining' => $tokens_remaining,
			);
		}

		$inserted = $wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$table} (client_hash, tokens, last_refill, updated_at)
				 VALUES (%s, %f, %f, %d)",
				$hash, (float) ( $capacity - 1 ), $now, (int) $now
			)
		);

		if ( $inserted ) {
			return array(
				'allowed'          => true,
				'retry_after'      => 0,
				'tokens_remaining' => (float) ( $capacity - 1 ),
			);
		}

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT tokens, last_refill FROM {$table} WHERE client_hash = %s", $hash ),
			ARRAY_A
		);

		if ( ! $row ) {
			return array(
				'allowed'          => false,
				'retry_after'      => $window,
				'tokens_remaining' => 0,
			);
		}

		$current_tokens = min( $capacity, (float) $row['tokens'] + ( $now - (float) $row['last_refill'] ) * $refill_rate );
		$deficit        = max( 0, 1 - $current_tokens );
		$retry_after    = (int) ceil( $deficit / $refill_rate );

		return array(
			'allowed'          => false,
			'retry_after'      => max( 1, $retry_after ),
			'tokens_remaining' => max( 0, $current_tokens ),
		);
	}

	public static function cleanup_stale_buckets(): void {
		global $wpdb;
		$table  = SchemaManager::rate_buckets_table_name();
		$cutoff = time() - self::STALE_ROW_TTL;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- No API exists for bulk deletes on a custom table.
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE updated_at < %d", $cutoff ) );
	}
}