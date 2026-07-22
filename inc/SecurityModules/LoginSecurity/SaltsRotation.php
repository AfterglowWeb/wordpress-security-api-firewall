<?php
namespace Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Cron\Cron;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

class SaltsRotation {

	const KEYS_PREFIX       = 'bromate_security_api_firewall_salts_rotation_hook_';
	const SALTS_KEY         = self::KEYS_PREFIX . 'salts';
	const RECURRENCE_KEY    = self::KEYS_PREFIX . 'recurrence';
	const LAST_RUN_KEY      = self::KEYS_PREFIX . 'last_run';
	const SCHEDULE_KEY      = self::KEYS_PREFIX . 'cron_schedule_key';
	const SALT_API_ENDPOINT = 'https://api.wordpress.org/secret-key/1.1/salt/';

	public static function register(): void {
		if ( ! empty( SettingsRepository::read_option( 'salts_rotation_enabled' ) ) ) {
			
			Cron::add_custom_schedule(
				self::KEYS_PREFIX . 'weekly',
				WEEK_IN_SECONDS,
				esc_html__( 'Once Weekly (Bromate)', 'bromate-security-api-firewall' )
			);
			Cron::add_custom_schedule(
				self::KEYS_PREFIX . 'monthly',
				30 * DAY_IN_SECONDS,
				esc_html__( 'Once Monthly (Bromate)', 'bromate-security-api-firewall' )
			);

			add_action( 'init', array( self::class, 'sync_schedule' ), 20 );
			add_filter( 'salt', array( self::class, 'filter_salt' ), 10, 2 );
		}

		
		add_action( 'wp_ajax_bromate_security_api_firewall_salts_rotation_status', array( self::class, 'ajax_salts_rotation_status' ) );
		add_action( 'wp_ajax_bromate_security_api_firewall_rotate_salts_now', array( self::class, 'ajax_rotate_salts_now' ) );
	}

	public static function sync_schedule(): void {

		if ( empty( SettingsRepository::read_option( 'salts_rotation_enabled' ) ) ) {
			Cron::unschedule( self::SCHEDULE_KEY );
			delete_option( self::RECURRENCE_KEY );
			return;
		}

		$desired_config = array(
			'recurrence' => SettingsRepository::read_option( 'salts_rotation_recurrence' ),
			'time'       => SettingsRepository::read_option( 'salts_rotation_time' ),
		);
		$current_config = get_option( self::RECURRENCE_KEY );
		if ( wp_next_scheduled( self::SCHEDULE_KEY ) && $current_config === $desired_config ) {
			return;
		}

		$schedule_key = self::resolve_schedule_key( $desired_config['recurrence'] );
		$timestamp    = Cron::next_daily_timestamp( $desired_config['time'] );

		Cron::schedule( self::SCHEDULE_KEY, $schedule_key, array( self::class, 'rotate_salts_now' ), $timestamp );

		update_option( self::RECURRENCE_KEY, $desired_config, false );
	}

	private static function resolve_schedule_key( string $recurrence ): string {
		if ( 'daily' === $recurrence ) {
			return 'daily';
		}

		$valid = array( 'weekly', 'monthly' );
		if ( ! in_array( $recurrence, $valid, true ) ) {
			$recurrence = 'weekly';
		}
		return self::KEYS_PREFIX . $recurrence;
	}

	public static function filter_salt( $salt, $scheme ) {

		if ( empty( SettingsRepository::read_option( 'salts_rotation_enabled' ) ) ) {
			return $salt;
		}

		$stored = get_option(  self::SALTS_KEY  );

		if ( empty( $stored[ $scheme ] ) ) {
			$stored[ $scheme ] = self::generate_salt();
			update_option(  self::SALTS_KEY , $stored, false );
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
		update_option(  self::SALTS_KEY , $new, false );
		update_option(  self::LAST_RUN_KEY , current_time( 'mysql' ), false );
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
				'message' => esc_html__( 'Salt keys rotated. All sessions have been invalidated.', 'bromate-security-api-firewall' ),
			),
			200
		);
	}

	private static function get_next_rotation(): ?string {
		$ts = wp_next_scheduled( self::SCHEDULE_KEY );
		return $ts ? get_date_from_gmt( gmdate( 'Y-m-d H:i:s', $ts ), 'Y-m-d H:i:s' ) : null;
	}

	private static function get_last_rotation(): ?string {
		return get_option(  self::LAST_RUN_KEY , null );
	}

	private static function generate_salt(): string {
		return wp_generate_password( 64, true, true );
	}

	public static function sanitize_recurrence( $value ): string {
		if ( empty( $value ) ) {
			return '';
		}
		return in_array(
			$value,
			array(
				'daily',
				'weekly',
				'monthly',
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
