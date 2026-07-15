<?php
namespace Bromate\SecurityApiFirewall\Security\Login;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

use DateTime;

class SaltRotation {

	const OPTION_KEY        = 'bromate_security_api_firewall_rotating_salts';
	const CONFIG_OPTION_KEY = 'bromate_security_api_firewall_salt_rotation_config';
	const LAST_ROTATION_KEY = 'bromate_security_api_firewall_last_salt_rotation';
	const CRON_HOOK         = 'bromate_security_api_firewall_rotate_salts_event';

	const SCHEDULE_WEEKLY  = 'bromate_security_api_firewall_weekly';
	const SCHEDULE_MONTHLY = 'bromate_security_api_firewall_monthly';

	private static $schemes = array( 'auth', 'secure_auth', 'logged_in', 'nonce' );

	private static $recurrence_map = array(
		'day'   => 'daily',
		'week'  => self::SCHEDULE_WEEKLY,
		'month' => self::SCHEDULE_MONTHLY,
	);

	public static function register(): void {

		add_filter( 'cron_schedules', array( self::class, 'register_custom_schedules' ) );
		add_filter( 'salt', array( self::class, 'filter_salt' ), 10, 2 );
		add_action( self::CRON_HOOK, array( self::class, 'rotate_salt_now' ) );
		add_action( 'init', array( self::class, 'sync_schedule' ), 20 );

		add_action( 'wp_ajax_bromate_security_api_firewall_salt_rotation_status', array( self::class, 'ajax_salt_rotation_status' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_rotate_salt_now', array( self::class, 'ajax_rotate_salt_now' ) );
	}

	public static function register_custom_schedules( array $schedules ): array {

		if ( empty( SettingsRepository::read_option( 'salt_rotation_enabled' ) ) ) {
			return $schedules;
		}

		if ( ! isset( $schedules[ self::SCHEDULE_WEEKLY ] ) ) {
			$schedules[ self::SCHEDULE_WEEKLY ] = array(
				'interval' => WEEK_IN_SECONDS,
				'display'  => __( 'Once Weekly (Bromate)', 'bromate-security-api-firewall' ),
			);
		}
		if ( ! isset( $schedules[ self::SCHEDULE_MONTHLY ] ) ) {
			$schedules[ self::SCHEDULE_MONTHLY ] = array(
				'interval' => 30 * DAY_IN_SECONDS,
				'display'  => __( 'Once Monthly (Bromate)', 'bromate-security-api-firewall' ),
			);
		}
		return $schedules;
	}

	public static function sync_schedule(): void {

		if ( empty( SettingsRepository::read_option( 'salt_rotation_enabled' ) ) ) {
			self::unschedule();
			return;
		}

		$recurrence = self::sanitize_recurrence(
			$settings['salt_rotation_recurrence'] ?? 'week'
		);
		$time       = self::sanitize_time(
			$settings['salt_rotation_time'] ?? '03:00'
		);

		$desired_config = array(
			'recurrence' => $recurrence,
			'time'       => $time,
		);
		$current_config = get_option( self::CONFIG_OPTION_KEY );

		$already_scheduled = (bool) wp_next_scheduled( self::CRON_HOOK );

		if ( $already_scheduled && $current_config === $desired_config ) {
			return;
		}

		self::schedule( $recurrence, $time );
		update_option( self::CONFIG_OPTION_KEY, $desired_config, false );
	}

	public static function filter_salt( $salt, $scheme ) {

		if ( empty( SettingsRepository::read_option( 'salt_rotation_enabled' ) ) ) {
			return $salt;
		}

		$stored = get_option( self::OPTION_KEY );

		if ( empty( $stored[ $scheme ] ) ) {
			$stored[ $scheme ] = self::generate_salt();
			update_option( self::OPTION_KEY, $stored, false );
		}

		return $stored[ $scheme ];
	}

	public static function rotate_salt_now(): void {

		if ( empty( SettingsRepository::read_option( 'salt_rotation_enabled' ) ) ) {
			return;
		}

		$new = array();
		foreach ( self::$schemes as $scheme ) {
			$new[ $scheme ] = self::generate_salt();
		}
		update_option( self::OPTION_KEY, $new, false );
		update_option( self::LAST_ROTATION_KEY, current_time( 'mysql' ), false );
	}

	public static function ajax_salt_rotation_status(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		wp_send_json_success(
			array(
				'last_rotation' => self::get_last_rotation(),
				'next_rotation' => self::get_next_rotation(),
			),
			200
		);
	}

	public static function ajax_rotate_salt_now(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		self::rotate_salt_now();

		wp_send_json_success(
			array(
				'message' => __( 'Salt keys rotated. All sessions have been invalidated.', 'bromate-security-api-firewall' ),
			),
			200
		);
	}

	private static function schedule( string $recurrence, string $time ): void {
		self::unschedule();

		$tz            = wp_timezone();
		$now           = new DateTime( 'now', $tz );
		list( $h, $m ) = array_map( 'intval', explode( ':', $time ) );

		$next = new DateTime( 'now', $tz );
		$next->setTime( $h, $m, 0 );
		if ( $next <= $now ) {
			$next->modify( '+1 day' );
		}

		wp_schedule_event( $next->getTimestamp(), $recurrence, self::CRON_HOOK );
	}

	private static function unschedule(): void {
		$timestamp = wp_next_scheduled( self::CRON_HOOK );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, self::CRON_HOOK );
		}
		delete_option( self::CONFIG_OPTION_KEY );
	}

	private static function get_next_rotation(): ?string {
		$ts = wp_next_scheduled( self::CRON_HOOK );
		return $ts ? get_date_from_gmt( gmdate( 'Y-m-d H:i:s', $ts ), 'Y-m-d H:i:s' ) : null;
	}

	private static function get_last_rotation(): ?string {
		return get_option( self::LAST_ROTATION_KEY, null );
	}

	private static function generate_salt(): string {
		return base64_encode( random_bytes( 64 ) );
	}

	private static function sanitize_recurrence( $value ): string {
		return isset( self::$recurrence_map[ $value ] ) ? self::$recurrence_map[ $value ] : self::SCHEDULE_WEEKLY;
	}

	private static function sanitize_time( $value ): string {
		if ( is_string( $value ) && preg_match( '/^([01]\d|2[0-3]):([0-5]\d)$/', $value ) ) {
			return $value;
		}
		return '03:00';
	}
}
