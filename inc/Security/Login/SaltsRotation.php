<?php
namespace Bromate\SecurityApiFirewall\Security\Login;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

use DateTime;

class SaltsRotation {

	const OPTION_KEY        = 'bromate_security_api_firewall_salts_rotation';
	const CONFIG_OPTION_KEY = 'bromate_security_api_firewall_salts_rotation_config';
	const LAST_ROTATION_KEY = 'bromate_security_api_firewall_last_salts_rotation';
	const CRON_HOOK_KEY     = 'bromate_security_api_firewall_salts_rotation_cron_hook';

	public static function register(): void {

		add_filter( 'cron_schedules', array( self::class, 'register_custom_schedules' ) );
		add_filter( 'salt', array( self::class, 'filter_salt' ), 10, 2 );
		add_action( self::CRON_HOOK_KEY, array( self::class, 'rotate_salts_now' ) );
		add_action( 'init', array( self::class, 'sync_schedule' ), 20 );

		add_action( 'wp_ajax_bromate_security_api_firewall_salts_rotation_status', array( self::class, 'ajax_salts_rotation_status' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_rotate_salts_now', array( self::class, 'ajax_rotate_salts_now' ) );
	}

	public static function register_custom_schedules( array $schedules ): array {

		if ( empty( SettingsRepository::read_option( 'salts_rotation_enabled' ) ) ) {
			return $schedules;
		}

		if ( ! isset( $schedules['bromate_security_api_firewall_weekly'] ) ) {
			$schedules['bromate_security_api_firewall_weekly'] = array(
				'interval' => WEEK_IN_SECONDS,
				'display'  => __( 'Once Weekly (Bromate)', 'bromate-security-api-firewall' ),
			);
		}
		if ( ! isset( $schedules['bromate_security_api_firewall_monthly'] ) ) {
			$schedules['bromate_security_api_firewall_monthly'] = array(
				'interval' => 30 * DAY_IN_SECONDS,
				'display'  => __( 'Once Monthly (Bromate)', 'bromate-security-api-firewall' ),
			);
		}
		return $schedules;
	}

	public static function sync_schedule(): void {

		if ( empty( SettingsRepository::read_option( 'salts_rotation_enabled' ) ) ) {
			self::unschedule();
			return;
		}

		$desired_config = array(
			'recurrence' => SettingsRepository::read_option( 'salts_rotation_recurrence' ),
			'time'       => SettingsRepository::read_option( 'salts_rotation_time' ),
		);
		$current_config = get_option( self::CONFIG_OPTION_KEY );

		$already_scheduled = (bool) wp_next_scheduled( self::CRON_HOOK_KEY );

		if ( $already_scheduled && $current_config === $desired_config ) {
			return;
		}

		self::schedule( $desired_config['recurrence'], $desired_config['time'] );
		update_option( self::CONFIG_OPTION_KEY, $desired_config, false );
	}

	public static function filter_salt( $salt, $scheme ) {

		if ( empty( SettingsRepository::read_option( 'salts_rotation_enabled' ) ) ) {
			return $salt;
		}

		$stored = get_option( self::OPTION_KEY );

		if ( empty( $stored[ $scheme ] ) ) {
			$stored[ $scheme ] = self::generate_salt();
			update_option( self::OPTION_KEY, $stored, false );
		}

		return $stored[ $scheme ];
	}

	public static function rotate_salts_now(): void {

		if ( empty( SettingsRepository::read_option( 'salts_rotation_enabled' ) ) ) {
			return;
		}

		$new = array();
		foreach ( array( 'auth', 'secure_auth', 'logged_in', 'nonce' ) as $scheme ) {
			$new[ $scheme ] = self::generate_salt();
		}
		update_option( self::OPTION_KEY, $new, false );
		update_option( self::LAST_ROTATION_KEY, current_time( 'mysql' ), false );
	}

	public static function ajax_salts_rotation_status(): void {

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

	public static function ajax_rotate_salts_now(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		self::rotate_salts_now();

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

		wp_schedule_event( $next->getTimestamp(), $recurrence, self::CRON_HOOK_KEY );
	}

	private static function unschedule(): void {
		$timestamp = wp_next_scheduled( self::CRON_HOOK_KEY );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, self::CRON_HOOK_KEY );
		}
		delete_option( self::CONFIG_OPTION_KEY );
	}

	private static function get_next_rotation(): ?string {
		$ts = wp_next_scheduled( self::CRON_HOOK_KEY );
		return $ts ? get_date_from_gmt( gmdate( 'Y-m-d H:i:s', $ts ), 'Y-m-d H:i:s' ) : null;
	}

	private static function get_last_rotation(): ?string {
		return get_option( self::LAST_ROTATION_KEY, null );
	}

	private static function generate_salt(): string {
		return base64_encode( random_bytes( 64 ) );
	}

	public static function sanitize_recurrence( $value ): string {
		if ( empty( $value ) ) {
			return '';
		}
		return in_array(
			$value,
			array(
				'day',
				'week',
				'month',
			),
			true
		) ? sanitize_text_field( $value ) : 'weekly';
	}

	public static function sanitize_time( $value ): string {
		if ( empty( $value ) ) {
			return '';
		}
		if ( preg_match( '/^([01]\d|2[0-3]):([0-5]\d)$/', $value ) ) {
			return $value;
		}
		return '03:00';
	}
}
