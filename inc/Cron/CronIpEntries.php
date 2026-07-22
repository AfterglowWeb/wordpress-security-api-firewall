<?php namespace Bromate\SecurityApiFirewall\Cron;

use Bromate\SecurityApiFirewall\Cron\Cron;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\Logs\Logger;

defined( 'ABSPATH' ) || exit;

final class CronIpEntries {

	const CRON_HOOK_KEY = 'bromate_security_api_firewall_ip_entries_delete_expired';

	public static function register(): void {
		add_action( self::CRON_HOOK_KEY, array( self::class, 'run_scheduled_ips_cleanup' ) );
		add_action( 'init', array( self::class, 'schedule_expired_ips_deletion' ) );
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

	public static function run_scheduled_ips_cleanup(): void {
		$result_count = IpEntriesRepository::delete_expired();
		Logger::log(
			'ip_entries_delete_expired',
			'info',
			array(
				'reason' => sprintf(
					__( '%d expired ip entries deleted by wp_schedule_event runtime.', 'bromate-security-api-firewall' ),
					$result_count
				),
			)
		);
	}
	
}