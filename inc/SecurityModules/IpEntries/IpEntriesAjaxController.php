<?php namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpUtils;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\GeoIpApi;

class IpEntriesAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();
		add_action( 'wp_ajax_bromate_get_ip_entries', array( $self, 'ajax_get_ip_entries' ) );
		add_action( 'wp_ajax_bromate_add_ip_entry', array( $self, 'ajax_add_ip_entry' ) );
		add_action( 'wp_ajax_bromate_update_ip_entry', array( $self, 'ajax_update_ip_entry' ) );
		add_action( 'wp_ajax_bromate_delete_ip_entry', array( $self, 'ajax_delete_ip_entry' ) );
		add_action( 'wp_ajax_bromate_delete_ip_entries', array( $self, 'ajax_delete_ip_entries' ) );
		add_action( 'wp_ajax_bromate_get_country_stats', array( $self, 'ajax_get_country_stats' ) );
		add_action( 'wp_ajax_bromate_toggle_country_block', array( $self, 'ajax_toggle_country_block' ) );
		add_action( 'wp_ajax_bromate_get_user_ip_entries', array( $self, 'ajax_get_user_ip_entries' ) );
		add_action( 'wp_ajax_bromate_get_login_ip_entries', array( $self, 'ajax_get_login_ip_entries' ) );
		add_action( 'wp_ajax_bromate_get_current_user_ip', array( $self, 'ajax_get_current_user_ip' ) );
	}

	public function ajax_get_ip_entries(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$list_type = isset( $_POST['list_type'] ) ? sanitize_text_field( wp_unslash( $_POST['list_type'] ) ) : 'blacklist';

		$result = IpEntriesRepository::get_entries( array( 'list_type' => $list_type ) );

		wp_send_json_success( array( 'entries' => isset( $result['entries'] ) ? $result['entries'] : array() ), 200 );
	}

	public function ajax_get_login_ip_entries(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$list_type = isset( $_POST['list_type'] ) ? sanitize_text_field( wp_unslash( $_POST['list_type'] ) ) : 'blacklist';

		$result = IpEntriesRepository::get_login_ip_entries( $list_type );

		wp_send_json_success( array( 'entries' => isset( $result['entries'] ) ? $result['entries'] : array() ), 200 );
	}

	public function ajax_add_ip_entry(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$ip         = isset( $_POST['ip'] ) ? sanitize_text_field( wp_unslash( $_POST['ip'] ) ) : '';
		$list_type  = isset( $_POST['list_type'] ) ? sanitize_text_field( wp_unslash( $_POST['list_type'] ) ) : 'blacklist';
		$user_id    = isset( $_POST['user_id'] ) ? absint( wp_unslash( $_POST['user_id'] ) ) : null;
		$referrer   = isset( $_POST['referrer'] ) ? sanitize_url( wp_unslash( $_POST['referrer'] ) ) : null;
		$expires_at = isset( $_POST['expires_at'] ) ? sanitize_text_field( wp_unslash( $_POST['expires_at'] ) ) : null;
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		if ( empty( $ip ) || ! IpUtils::is_valid_ip_or_cidr( $ip ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Invalid IP address or CIDR', 'bromate-security-api-firewall' ) ), 400 );
		}

		if ( IpEntriesRepository::find_by_ip( $ip, $list_type ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'IP already in list', 'bromate-security-api-firewall' ) ), 400 );
		}

		if ( $user_id && ! get_userdata( $user_id ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Invalid user', 'bromate-security-api-firewall' ) ), 400 );
		}

		$data = array(
			'ip'           => IpUtils::sanitize_ip_or_cidr( $ip ),
			'list_type'    => 'blacklist' === $list_type ? 'blacklist' : 'whitelist',
			'entry_origin' => 'manual',
			'user_id'      => ! empty( $user_id ) ? $user_id : null,
			'referrer'     => ! empty( $referrer ) ? $referrer : null,
			'expires_at'   => ! empty( $expires_at ) ? gmdate( 'Y-m-d H:i:s', $expires_at ) : null,
		);

		$geoip = GeoIpApi::get_geoip( $ip );
		if ( $geoip ) {
			$data['country_code'] = $geoip['country'] ?? null;
			$data['country_name'] = $geoip['countryName'] ?? null;
		}

		$id = IpEntriesRepository::insert( $data );

		if ( ! $id ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Failed to add IP entry', 'bromate-security-api-firewall' ) ), 500 );
		}

		$entry = IpEntriesRepository::find_by_ip( $ip, $list_type );

		wp_send_json_success( array( 'entry' => $entry ), 201 );
	}

	public function ajax_update_ip_entry(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$id         = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0;
		$list_type  = isset( $_POST['list_type'] ) ? sanitize_text_field( wp_unslash( $_POST['list_type'] ) ) : null;
		$user_id    = isset( $_POST['user_id'] ) ? absint( $_POST['user_id'] ) : null;
		$referrer   = isset( $_POST['referrer'] ) ? sanitize_url( wp_unslash( $_POST['referrer'] ) ) : null;
		$expires_at = isset( $_POST['expires_at'] ) ? sanitize_text_field( wp_unslash( $_POST['expires_at'] ) ) : null;
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		if ( ! $id ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Entry ID required', 'bromate-security-api-firewall' ) ), 400 );
		}

		$data = array();

		if ( $list_type ) {
			$data['list_type'] = 'blacklist' === $list_type ? 'blacklist' : 'whitelist';
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing
		if ( array_key_exists( 'user_id', $_POST ) ) {
			$data['user_id'] = ! empty( $user_id ) ? $user_id : null;
		}
		if ( array_key_exists( 'referrer', $_POST ) ) {
			$data['referrer'] = ! empty( $referrer ) ? $referrer : null;
		}
		if ( array_key_exists( 'expires_at', $_POST ) ) {
			$data['expires_at'] = ! empty( $expires_at ) ? gmdate( 'Y-m-d H:i:s', strtotime( $expires_at ) ) : null;
		}
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		if ( empty( $data ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Nothing to update', 'bromate-security-api-firewall' ) ), 400 );
		}

		$updated = IpEntriesRepository::update( $id, $data );

		if ( ! $updated ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Entry not found or unchanged', 'bromate-security-api-firewall' ) ), 404 );
		}

		$entry = IpEntriesRepository::find_by_id( $id );
		if ( null === $entry ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Entry not found', 'bromate-security-api-firewall' ) ), 404 );
		}
		wp_send_json_success( array( 'entry' => $entry ), 200 );
	}

	public function ajax_delete_ip_entry(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$id = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0;

		if ( ! $id ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Entry ID required', 'bromate-security-api-firewall' ) ), 400 );
		}

		$deleted = IpEntriesRepository::delete( $id );

		if ( ! $deleted ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Entry not found', 'bromate-security-api-firewall' ) ), 404 );
		}

		wp_send_json_success( array( 'deleted' => true ), 200 );
	}

	public function ajax_delete_ip_entries(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$ids = isset( $_POST['ids'] ) ? sanitize_text_field( wp_unslash( $_POST['ids'] ) ) : array();
		if ( is_string( $ids ) ) {
			$ids = json_decode( $ids, true );
		}

		if ( ! is_array( $ids ) || empty( $ids ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'No entries selected', 'bromate-security-api-firewall' ) ), 400 );
		}

		$count = IpEntriesRepository::delete_many( $ids );

		wp_send_json_success( array( 'deleted' => $count ), 200 );
	}

	public function ajax_get_user_ip_entries(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$user_id = isset( $_POST['user_id'] ) ? absint( $_POST['user_id'] ) : 0;

		if ( ! $user_id ) {
			wp_send_json_error( array( 'message' => esc_html__( 'User ID required', 'bromate-security-api-firewall' ) ), 400 );
		}

		$entries = IpEntriesRepository::find_by_user( $user_id );
		wp_send_json_success( array( 'entries' => $entries ), 200 );
	}

	public function ajax_get_current_user_ip(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		$current_user_ip = IpUtils::get_client_ip();
		if ( empty( $current_user_ip ) ) {
			wp_send_json_error( array( 'message' => 'Could not resolve your IP.' ), 400 );
		}
		wp_send_json_success( array( 'current_user_ip' => $current_user_ip ), 200 );
	}

	public function ajax_get_country_stats(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$list_type = isset( $_POST['list_type'] ) ? sanitize_text_field( wp_unslash( $_POST['list_type'] ) ) : 'blacklist';

		$stats = IpEntriesRepository::get_country_stats( $list_type );

		wp_send_json_success(
			array(
				'countries' => GeoIpApi::get_all_countries(),
				'stats'     => $stats,
			),
			200
		);
	}

	public function ajax_toggle_country_block(): void {

		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$country_code = isset( $_POST['country_code'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_POST['country_code'] ) ) ) : '';
		$list_type    = isset( $_POST['list_type'] ) ? sanitize_text_field( wp_unslash( $_POST['list_type'] ) ) : 'blacklist';
		$blocked      = isset( $_POST['blocked'] ) ? filter_var( wp_unslash( $_POST['blocked'] ), FILTER_VALIDATE_BOOLEAN ) : false;
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		if ( empty( $country_code ) || 2 !== strlen( $country_code ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Invalid country code', 'bromate-security-api-firewall' ) ), 400 );
		}

		$list_type = 'blacklist' === $list_type ? 'blacklist' : 'whitelist';

		$result = $blocked
			? IpEntriesRepository::block_country( $country_code, $list_type )
			: IpEntriesRepository::unblock_country( $country_code, $list_type );

		if ( false === $result ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Failed to update country block', 'bromate-security-api-firewall' ) ), 500 );
		}

		wp_send_json_success(
			array(
				'country_code' => $country_code,
				'blocked'      => $blocked,
			),
			200
		);
	}
}
