<?php namespace Bromate\SecurityApiFirewall\Logs;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

class LogEntryAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();
		add_action( 'wp_ajax_bromate_get_log_entries', array( $self, 'ajax_get_log_entries' ) );
		add_action( 'wp_ajax_bromate_delete_log_entry', array( $self, 'ajax_delete_log_entry' ) );
		add_action( 'wp_ajax_bromate_delete_log_entries', array( $self, 'ajax_delete_log_entries' ) );
	}

	public function ajax_get_log_entries(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$args = array(
			'event'     => isset( $_POST['event'] ) ? sanitize_text_field( wp_unslash( $_POST['event'] ) ) : null,
			'severity'  => isset( $_POST['severity'] ) ? sanitize_text_field( wp_unslash( $_POST['severity'] ) ) : null,
			'ip'        => isset( $_POST['ip'] ) ? sanitize_text_field( wp_unslash( $_POST['ip'] ) ) : null,
			'user_id'   => isset( $_POST['user_id'] ) ? absint( $_POST['user_id'] ) : null,
			'date_from' => isset( $_POST['date_from'] ) ? sanitize_text_field( wp_unslash( $_POST['date_from'] ) ) : null,
			'date_to'   => isset( $_POST['date_to'] ) ? sanitize_text_field( wp_unslash( $_POST['date_to'] ) ) : null,
			'search'    => isset( $_POST['search'] ) ? sanitize_text_field( wp_unslash( $_POST['search'] ) ) : null,
			'page'      => isset( $_POST['page'] ) ? absint( $_POST['page'] ) : 1,
			'per_page'  => isset( $_POST['per_page'] ) ? absint( $_POST['per_page'] ) : 50,
			'order_by'  => isset( $_POST['order_by'] ) ? sanitize_text_field( wp_unslash( $_POST['order_by'] ) ) : 'created_at',
			'order'     => isset( $_POST['order'] ) ? sanitize_text_field( wp_unslash( $_POST['order'] ) ) : 'DESC',
		);
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$result = LogRepository::get_entries( $args );

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

		$deleted = LogRepository::delete( $id );

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

		$count = LogRepository::delete_many( $ids );

		wp_send_json_success( array( 'deleted' => $count ), 200 );
	}
}
