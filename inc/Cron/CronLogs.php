<?php namespace Bromate\SecurityApiFirewall\Cron;

use Bromate\SecurityApiFirewall\Cron\Cron;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Logs\LogsRepository;
use Bromate\SecurityApiFirewall\Logs\Logger;

defined( 'ABSPATH' ) || exit;

final class CronLogs {

	const CRON_HOOK_KEY = 'bromate_security_api_firewall_log_entries_delete_expired';

	public static function register(): void {
		add_action( self::CRON_HOOK_KEY, array( self::class, 'run_scheduled_logs_cleanup' ) );
		add_action( 'init', array( self::class, 'schedule_expired_logs_deletion' ) );
	}

	public static function schedule_expired_logs_deletion(): void {
		if ( wp_next_scheduled( self::CRON_HOOK_KEY ) ) {
			return;
		}

		Cron::schedule(
			self::CRON_HOOK_KEY,
			'daily',
			array( self::class, 'run_scheduled_logs_cleanup' ),
			time()
		);
	}

	public static function run_scheduled_logs_cleanup(): void {
		$result_count = self::maybe_rotate_logs();
		Logger::log(
			'log_entries_delete_expired',
			'info',
			array(
				'reason' => sprintf(
					__( '%d expired log entries deleted by wp_schedule_event runtime.', 'bromate-security-api-firewall' ),
					$result_count
				),
			)
		);
	}

	public static function maybe_rotate_logs(): int {
		$days = SettingsRepository::read_option( 'logs_rotation_time' );
		
		if ( ! is_numeric( $days ) || $days < 1 ) {
			$days = 90;
		}
		
		return self::cleanup( (int) $days );
	}

	private static function cleanup( int $days = 90 ): int {
		return LogsRepository::delete_expired( $days );
	}

	
}