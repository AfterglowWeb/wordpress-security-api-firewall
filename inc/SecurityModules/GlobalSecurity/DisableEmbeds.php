<?php namespace Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

class DisableEmbeds {
	private static $instance = null;

	public static function register() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	private function __construct() {

		if ( false === SettingsRepository::read_option( 'hide_oembed_routes' ) ) {
			return;
		}

		global $wp;

		$wp->public_query_vars = array_diff(
			$wp->public_query_vars,
			array(
				'embed',
			)
		);

		add_filter( 'embed_oembed_discover', '__return_false', 10, 1 );
		add_filter( 'rest_endpoints', fn( $endpoints ) => array_diff_key( $endpoints, array( '/oembed/1.0/embed' => true ) ), 10, 1 );
		add_filter( 'oembed_response_data', fn( $data ) => defined( 'REST_REQUEST' ) && REST_REQUEST ? false : $data, 10, 1 );
		add_filter( 'tiny_mce_plugins', fn( $plugins ) => array_diff( $plugins, array( 'wpembed' ) ), 10, 1 );
		add_filter(
			'rewrite_rules_array',
			function ( $rules ) {
				foreach ( $rules as $rule => $rewrite ) {
					if ( false !== strpos( $rewrite, 'embed=true' ) ) {
						unset( $rules[ $rule ] );
					}
				}

				return $rules;
			},
			10,
			1
		);
		add_action(
			'wp_default_scripts',
			function ( $scripts ) {
				if ( ! empty( $scripts->registered['wp-edit-post'] ) ) {
					$scripts->registered['wp-edit-post']->deps = array_diff(
						$scripts->registered['wp-edit-post']->deps,
						array( 'wp-embed' )
					);
				}
			},
			10,
			1
		);

		remove_action( 'wp_head', 'wp_oembed_add_discovery_links', 10 );
		remove_action( 'wp_head', 'wp_oembed_add_host_js', 10 );
		remove_filter( 'pre_oembed_result', 'wp_filter_pre_oembed_result', 10 );
		remove_filter( 'oembed_dataparse', 'wp_filter_oembed_result', 10 );

		add_action( 'wp_ajax_security_api_firewall_flush_rewrite_rules', array( self::class, 'flush_rewrite_rules' ) );
	}

	public static function ajax_flush_rewrite_rules(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
		}

		flush_rewrite_rules( false );
		wp_send_json_success( array( 'message' => 'Rewrite rules flushed' ) );
	}
}
