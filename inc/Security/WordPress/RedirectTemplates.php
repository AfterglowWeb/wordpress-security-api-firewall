<?php namespace Bromate\SecurityApiFirewall\Security\WordPress;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

class RedirectTemplates {

	protected static $instance = null;

	public static function register() {
		if ( null === static::$instance ) {
			static::$instance = new static();
		}
		return static::$instance;
	}

	private function __construct() {
		add_action( 'template_redirect', array( $this, 'redirect_theme_templates' ) );
	}

	public function redirect_theme_templates(): void {

		if ( empty( SettingsRepository::read_option( 'redirect_front_enabled' ) ) ) {
			return;
		}

		if ( $this->is_upload_url_request() || $this->is_rest_api_request() ) {
			return;
		}

		$redirect_front_options  = SettingsRepository::read_option( 'redirect_front_options' );
		$redirect_front_user_url = SettingsRepository::read_option( 'redirect_front_user_url' );

		switch ( $redirect_front_options ) {
			case 'login':
				wp_safe_redirect( wp_login_url() );
				break;
			case 'front':
				if ( is_front_page() ) {
					break;
				}

				wp_safe_redirect( get_bloginfo( 'url' ) );

				break;
			case 'custom':
					wp_safe_redirect( $redirect_front_user_url );
				break;
			case '404':
			default:
				status_header( 404 );
				nocache_headers();
				global $wp_query;
				$wp_query->set_404();
				add_filter( 'pre_handle_404', '__return_true' );
				die( '404 - Page Not Found' );
		}
	}

	private function is_rest_api_request(): bool {
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return true;
		}

		return false;
	}

	private function is_upload_url_request(): bool {

		global $wp;
		$current_url = sanitize_url( home_url( $wp->request ) );
		$upload_dir  = wp_get_upload_dir();

		if ( isset( $upload_dir['url'] ) && strpos( $current_url, $upload_dir['url'] ) !== false ) {
			return true;
		}

		return false;
	}
}
