<?php namespace Bromate\SecurityApiFirewall\Cron;

defined( 'ABSPATH' ) || exit;

use DateTime;
use Bromate\SecurityApiFirewall\Logs\Logger;

class Cron {

	private static array $custom_schedules = array();

	public static function register(): void {
		add_filter( 'cron_schedules', array( self::class, 'inject_custom_schedules' ) );
	}

	public static function add_custom_schedule( string $key, int $interval_seconds, string $display ): void {
		self::$custom_schedules[ $key ] = array(
			'interval' => $interval_seconds,
			'display'  => $display,
		);
	}

	public static function inject_custom_schedules( array $schedules ): array {
		foreach ( self::$custom_schedules as $key => $config ) {
			if ( ! isset( $schedules[ $key ] ) ) {
				$schedules[ $key ] = $config;
			}
		}
		return $schedules;
	}

	public static function schedule( string $hook, string $recurrence, callable $callback, int $timestamp ): bool {
		add_action( $hook, $callback );

		self::unschedule( $hook );

		$result = wp_schedule_event( $timestamp, $recurrence, $hook );

		if ( is_wp_error( $result ) || false === $result ) {
			Logger::log(
				'cron_schedule_failed',
				'error',
				array(
					'hook'       => $hook,
					'recurrence' => $recurrence,
					'error'      => is_wp_error( $result ) ? $result->get_error_message() : 'wp_schedule_event returned false',
				)
			);
			return false;
		}

		return true;
	}

	public static function unschedule( string $hook ): void {
		$timestamp = wp_next_scheduled( $hook );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, $hook );
		}
	}

	public static function next_daily_timestamp( string $time ): int {
		$tz = wp_timezone();
		$now = new DateTime( 'now', $tz );

		list( $h, $m ) = array_map( 'intval', explode( ':', $time ) );

		$next = new DateTime( 'now', $tz );
		$next->setTime( $h, $m, 0 );
		if ( $next <= $now ) {
			$next->modify( '+1 day' );
		}

		return $next->getTimestamp();
	}
}