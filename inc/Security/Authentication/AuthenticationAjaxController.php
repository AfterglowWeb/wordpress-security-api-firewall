<?php namespace Bromate\SecurityApiFirewall\Security\Authentication;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\Security\Authentication\JwtAuthentication;

class AuthenticationAjaxController {

	private function __construct() {}

	public static function register(): void {
		$self = new self();

		add_action( 'wp_ajax_bromate_authorized_users_options', array( $self, 'ajax_authorized_users_options' ) );
		add_action( 'wp_ajax_bromate_get_jwks_endpoint', array( $self, 'ajax_get_jwks_endpoint' ) );
		add_action( 'wp_ajax_bromate_generate_jwt_key_pair', array( $self, 'ajax_generate_jwt_key_pair' ) );
		add_action( 'wp_ajax_bromate_check_jwt_key', array( $self, 'ajax_check_jwt_key' ) );
		add_action( 'wp_ajax_bromate_delete_jwt_key', array( $self, 'ajax_delete_jwt_key' ) );
		add_action( 'wp_ajax_bromate_generate_jwt_subclaim', array( $self, 'ajax_generate_jwt_subclaim' ) );
	}

	public function ajax_authorized_users_options(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}
		$wordpress_users = SettingsRepository::authorized_users_options();
		wp_send_json_success( $wordpress_users );
	}

	public function ajax_get_jwks_endpoint(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}
		$wordpress_users = JwksEndpoint::get_jwks_endpoint();
		wp_send_json_success( $wordpress_users );
	}

	public function ajax_generate_jwt_key_pair(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		try {
			if ( ! extension_loaded( 'openssl' ) ) {
				throw new \Exception( 'OpenSSL extension is not loaded. Please enable it in your PHP configuration.' );
			}

			$key_pair = JwtAuthentication::create_key_pair( true );

			wp_send_json_success(
				array(
					'kid'                => $key_pair['kid'],
					'public_key'         => $key_pair['public'],
					'private_key_stored' => true,
					'message'            => __( 'Key pair generated and stored securely.', 'bromate-security-api-firewall' ),
					'summary'            => JwtAuthentication::get_key_pair_summary(),
				)
			);
		} catch ( \Throwable $e ) {

			wp_send_json_error(
				array(
					'message' => $e->getMessage(),
					'debug'   => defined( 'WP_DEBUG' ) && WP_DEBUG ? $e->getTraceAsString() : null,
				),
				500
			);
		}
	}

	public function ajax_check_jwt_key(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		wp_send_json_success(
			array(
				'has_key' => JwtAuthentication::has_key_pair(),
				'summary' => JwtAuthentication::get_key_pair_summary(),
			)
		);
	}

	public function ajax_delete_jwt_key(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$deleted = JwtAuthentication::delete_key_pair();

		if ( $deleted ) {
			wp_send_json_success(
				array(
					'message' => __( 'Key pair deleted successfully.', 'bromate-security-api-firewall' ),
				)
			);
		} else {
			wp_send_json_error(
				array(
					'message' => __( 'Failed to delete key pair.', 'bromate-security-api-firewall' ),
				),
				500
			);
		}
	}

	public function ajax_generate_jwt_subclaim(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verified in self::ajax_validate_has_firewall_admin_caps()
		$user_id = isset( $_POST['user_id'] ) ? absint( wp_unslash( $_POST['user_id'] ) ) : 0;
		if ( $user_id <= 0 || ! get_userdata( $user_id ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Invalid user', 'bromate-security-api-firewall' ) ), 400 );
		}

		$subclaim = JwtAuthentication::create_user_subclaim( $user_id );

		if ( empty( $subclaim ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Failed to generate subclaim', 'bromate-security-api-firewall' ) ), 500 );
		}

		wp_send_json_success( array( 'subclaim' => $subclaim ) );
	}
}
