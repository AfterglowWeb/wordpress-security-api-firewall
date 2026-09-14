<?php namespace Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\HttpHeaders;

class HttpHeadersAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();
		add_action( 'wp_ajax_bromate_get_headers_options', array( $self, 'ajax_get_headers_options' ) );
	}

	public function ajax_get_headers_options(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		wp_send_json_success( HttpHeaders::get_all_headers_options() );
	}

}
