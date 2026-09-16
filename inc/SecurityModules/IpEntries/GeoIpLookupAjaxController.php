<?php namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

final class GeoIpLookupAjaxController {

	public static function register(): void {
		add_action( 'wp_ajax_bromate_get_geoip_refresh_status', array( self::class, 'ajax_get_refresh_status' ) );
	}

	public static function ajax_get_refresh_status(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
            return;
        }

        if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ) ), 'bromate_geoip_refresh_status' ) ) {
            wp_send_json_error( array( 'message' => esc_html__( 'Invalid security token', 'bromate-security-api-firewall' ) ), 403 );
            return;
        }

        wp_send_json_success( GeoIpLookup::get_refresh_status() );
    }
}