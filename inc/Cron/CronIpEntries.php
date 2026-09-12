<?php namespace Bromate\SecurityApiFirewall\Cron;

use Bromate\SecurityApiFirewall\Cron\Cron;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\Logs\Logger;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\GeoIpApi;
use Bromate\SecurityApiFirewall\Core\Schema\SchemaManager;

defined( 'ABSPATH' ) || exit;

final class CronIpEntries {

	const CRON_HOOK_KEY        = 'bromate_security_api_firewall_ip_entries_delete_expired';
	const ENRICH_CRON_HOOK_KEY = 'bromate_security_api_firewall_ip_entries_enrich_geoip';
	const ENRICH_INTERVAL_KEY  = 'bromate_security_api_firewall_geoip_enrich_15min';

	public static function register(): void {
		Cron::add_custom_schedule(
			self::ENRICH_INTERVAL_KEY,
			15 * MINUTE_IN_SECONDS,
			esc_html__( 'Every 15 Minutes (Bromate)', 'bromate-security-api-firewall' )
		);

		add_action( self::CRON_HOOK_KEY, array( self::class, 'run_scheduled_ips_cleanup' ) );
		add_action( self::ENRICH_CRON_HOOK_KEY, array( self::class, 'run_scheduled_geoip_enrichment' ) );

		add_action( 'init', array( self::class, 'schedule_expired_ips_deletion' ) );
		add_action( 'init', array( self::class, 'schedule_geoip_enrichment' ) );
	}

	public static function schedule_expired_ips_deletion(): void {
		if ( wp_next_scheduled( self::CRON_HOOK_KEY ) ) {
			return;
		}

		Cron::schedule(
			self::CRON_HOOK_KEY,
			'daily',
			array( self::class, 'run_scheduled_ips_cleanup' ),
			time()
		);
	}

	public static function schedule_geoip_enrichment(): void {
		if ( wp_next_scheduled( self::ENRICH_CRON_HOOK_KEY ) ) {
			return;
		}

		Cron::schedule(
			self::ENRICH_CRON_HOOK_KEY,
			self::ENRICH_INTERVAL_KEY,
			array( self::class, 'run_scheduled_geoip_enrichment' ),
			time()
		);
	}

	public static function run_scheduled_ips_cleanup(): void {
		$result_count = IpEntriesRepository::delete_expired();
		Logger::log(
			'ip_entries_delete_expired',
			'info',
			array(
				'reason' => sprintf(
					/* translators: %d is the number of expired IP entries deleted */
					esc_html__( '%d expired IP entries deleted by wp_schedule_event runtime.', 'bromate-security-api-firewall' ),
					$result_count
				),
			)
		);
	}

	public static function run_scheduled_geoip_enrichment(): void {
		self::enrich_pending_batch( 25 );
	}

	public static function enrich_pending_batch( int $batch_size = 25 ): void {
		global $wpdb;
		$table = SchemaManager::ip_entries_table_name();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, ip FROM {$table} WHERE geoip_enriched_at IS NULL ORDER BY created_at ASC LIMIT %d",
				$batch_size
			),
			ARRAY_A
		);

		foreach ( (array) $rows as $row ) {
			$geoip = GeoIpApi::get_geoip( $row['ip'], true );
			IpEntriesRepository::update_geoip_data( (int) $row['id'], $geoip );
		}
	}

	public static function unschedule() {
		wp_unschedule_hook( self::CRON_HOOK_KEY );
		wp_unschedule_hook( self::ENRICH_CRON_HOOK_KEY );
	}
}
