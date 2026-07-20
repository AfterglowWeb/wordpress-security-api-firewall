<?php namespace Bromate\SecurityApiFirewall\Logs;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

class LogsAjaxController {

	const LOGS_SETTINGS_KEYS = array(
		'logs_enabled',
		'logs_keep_severities',
		'logs_keep_events',
		'logs_rotation_time',
	);

	private function __construct() {}

	public static function register(): void {
		$self = new self();
		add_action( 'wp_ajax_bromate_get_log_entries', array( $self, 'ajax_get_log_entries' ) );
		add_action( 'wp_ajax_bromate_delete_log_entry', array( $self, 'ajax_delete_log_entry' ) );
		add_action( 'wp_ajax_bromate_delete_log_entries', array( $self, 'ajax_delete_log_entries' ) );
		add_action( 'wp_ajax_bromate_get_logs_settings', array( $self, 'ajax_get_logs_settings' ) );
		add_action( 'wp_ajax_bromate_update_logs_settings', array( $self, 'ajax_update_logs_settings' ) );
	}

	public function ajax_get_logs_settings(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		$settings = array();

		foreach ( self::LOGS_SETTINGS_KEYS as $log_settings_key ) {
			$settings[ $log_settings_key ] = SettingsRepository::read_option( $log_settings_key );
		}
		wp_send_json_success( $settings, 200 );
	}


	public function ajax_update_logs_settings(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		$post_args = [];

		foreach ( self::LOGS_SETTINGS_KEYS as $log_settings_key ) {
			if(isset( $_POST[ $log_settings_key ] ) ) {
				
				$log_setting = sanitize_text_field( wp_unslash( $_POST[$log_settings_key] ) );
				if(empty($log_setting)) {
					continue;
				}
				if( in_array( $log_settings_key, ['logs_keep_severities', 'logs_keep_events'], true ) && is_string($log_setting) ) {
					$post_args[ $log_settings_key ] = false !== strpos($log_setting, ',') ? explode(',', $log_setting) : [$log_setting];
				} else {
					$post_args[ $log_settings_key ] = $log_setting;
				}
			}
		}

		if ( empty( $post_args ) ) {
			wp_send_json_error( array( 'message' => __( 'No args.', 'bromate-security-api-firewall' ) ), 400 );
		}

		$settings = array();

		foreach ( $post_args as $key => $value ) {
			$settings[ $key ] = SettingsRepository::update_option( $key, $value );
		}

		if ( empty( array_filter( $settings ) ) ) {
			wp_send_json_error( array( 'message' => __( 'No settings saved.', 'bromate-security-api-firewall' ) ), 400 );
		}

		wp_send_json_success( $settings, 200 );
	}

	public function ajax_get_log_entries(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$args = array(
			'event'     => isset( $_POST['event'] ) && 'undefined' !== $_POST['event'] ? sanitize_text_field( wp_unslash( $_POST['event'] ) ) : null,
			'severity'  => isset( $_POST['severity'] ) && 'undefined' !== $_POST['severity'] ? sanitize_text_field( wp_unslash( $_POST['severity'] ) ) : null,
			'ip'        => isset( $_POST['ip'] ) && 'undefined' !== $_POST['ip'] ? sanitize_text_field( wp_unslash( $_POST['ip'] ) ) : null,
			'user_id'   => isset( $_POST['user_id'] ) && 'undefined' !== $_POST['user_id'] ? absint( $_POST['user_id'] ) : null,
			'date_from' => isset( $_POST['date_from'] ) ? sanitize_text_field( wp_unslash( $_POST['date_from'] ) ) : null,
			'date_to'   => isset( $_POST['date_to'] ) ? sanitize_text_field( wp_unslash( $_POST['date_to'] ) ) : null,
			'search'    => isset( $_POST['search'] ) ? sanitize_text_field( wp_unslash( $_POST['search'] ) ) : null,
			'page'      => isset( $_POST['page'] ) ? absint( $_POST['page'] ) : 1,
			'per_page'  => isset( $_POST['per_page'] ) ? absint( $_POST['per_page'] ) : 50,
			'order_by'  => isset( $_POST['order_by'] ) ? sanitize_text_field( wp_unslash( $_POST['order_by'] ) ) : 'created_at',
			'order'     => isset( $_POST['order'] ) ? sanitize_text_field( wp_unslash( $_POST['order'] ) ) : 'DESC',
		);
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$result = LogsRepository::get_entries( $args );

		wp_send_json_success( $result, 200 );
	}

	public function ajax_delete_log_entry(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$id = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0;

		if ( ! $id ) {
			wp_send_json_error( array( 'message' => __( 'Log ID required', 'bromate-security-api-firewall' ) ), 400 );
		}

		$deleted = LogsRepository::delete( $id );

		if ( ! $deleted ) {
			wp_send_json_error( array( 'message' => __( 'Log entry not found', 'bromate-security-api-firewall' ) ), 404 );
		}

		wp_send_json_success( array( 'deleted' => true ), 200 );
	}

	public function ajax_delete_log_entries(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$ids = isset( $_POST['ids'] ) ? sanitize_text_field( wp_unslash( $_POST['ids'] ) ) : array();
		if ( is_string( $ids ) ) {
			$ids = json_decode( $ids, true );
		}

		if ( ! is_array( $ids ) || empty( $ids ) ) {
			wp_send_json_error( array( 'message' => __( 'No entries selected', 'bromate-security-api-firewall' ) ), 400 );
		}

		$count = LogsRepository::delete_many( $ids );

		wp_send_json_success( array( 'deleted' => $count ), 200 );
	}
}
