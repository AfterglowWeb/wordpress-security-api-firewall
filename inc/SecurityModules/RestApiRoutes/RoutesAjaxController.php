<?php namespace Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes\RoutesPolicyRepository;
use Bromate\SecurityApiFirewall\Core\Settings\WordPressObjects;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes\RoutesTreeRepository;

class RoutesAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();

		add_action( 'wp_ajax_bromate_get_routes_settings', array( $self, 'ajax_get_routes_settings' ) );
		add_action( 'wp_ajax_bromate_get_routes_policy_tree', array( $self, 'ajax_get_routes_policy_tree' ) );
		add_action( 'wp_ajax_bromate_save_all_routes_settings', array( $self, 'ajax_save_all_routes_settings' ) );
		add_action( 'wp_ajax_bromate_wordpress_objects_options', array( $self, 'ajax_wordpress_objects_options' ) );
	}

	public function ajax_wordpress_objects_options(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}
		$wordpress_objects = WordPressObjects::list_rest_api_object_types();
		wp_send_json_success( $wordpress_objects );
	}

	public function ajax_get_routes_policy_tree(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$routes_tree = RoutesTreeRepository::get_routes_policy_tree();
		wp_send_json_success(
			array(
				'tree' => $routes_tree,
			),
			200
		);
	}

	public function ajax_get_routes_settings(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
			return;
		}

		wp_send_json_success(
			RoutesPolicyRepository::get_settings_payload(),
			200
		);
	}

	public function ajax_save_all_routes_settings(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in SettingsAjaxController::ajax_validate_has_firewall_admin_caps()
		if ( ! isset( $_POST['settings'] ) ) {
			wp_send_json_error(
				array(
					'message' => esc_html__( 'Bad request error', 'bromate-security-api-firewall' ),
				),
				400
			);
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in SettingsAjaxController::ajax_validate_has_firewall_admin_caps()
		$settings_payload = isset( $_POST['settings'] ) ? wp_unslash( $_POST['settings'] ) : '';
		$settings         = json_decode( $settings_payload, true );

		$result = RoutesPolicyRepository::save_all_settings( $settings );
		if ( false === $result ) {
			wp_send_json_error(
				array(
					'message' => esc_html__( 'Failed to save route settings', 'bromate-security-api-firewall' ),
				),
				500
			);
			return;
		}

		wp_send_json_success(
			array(
				'message' => esc_html__( 'Settings saved successfully', 'bromate-security-api-firewall' ),
			),
			200
		);
	}
}
