<?php namespace Bromate\SecurityApiFirewall\Security\WordPress;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

class DisableAPIs {

	protected static $instance = null;

	public static function register() {
		if ( null === static::$instance ) {
			static::$instance = new static();
		}
		return static::$instance;
	}

	private function __construct() {

		if ( true === SettingsRepository::read_option( 'disable_xmlrpc' ) ) {
			add_filter( 'xmlrpc_enabled', '__return_false' );
		}

		if ( true === SettingsRepository::read_option( 'disable_sitemap' ) ) {
			add_filter( 'wp_sitemaps_enabled', '__return_false' );
			remove_action( 'init', 'wp_sitemaps_get_server' );
		}

		if ( true === SettingsRepository::read_option( 'disable_pingbacks' ) ) {
			add_filter(
				'wp_headers',
				function ( $headers ) {
					if ( isset( $headers['X-Pingback'] ) ) {
						unset( $headers['X-Pingback'] );
					}
					return $headers;
				}
			);
			add_filter(
				'xmlrpc_methods',
				function ( $methods ) {
					if ( isset( $methods['pingback.ping'] ) ) {
						unset( $methods['pingback.ping'] );
					}
					return $methods;
				}
			);
		}

		if ( true === SettingsRepository::read_option( 'wordpress_disable_atom_rss' ) ) {
			add_action( 'do_feed', array( $this, 'disable_all_feeds_response' ), 10 );
			add_action( 'do_feed_rdf', array( $this, 'disable_all_feeds_response' ), 10 );
			add_action( 'do_feed_rss', array( $this, 'disable_all_feeds_response' ), 10 );
			add_action( 'do_feed_rss2', array( $this, 'disable_all_feeds_response' ), 10 );
			add_action( 'do_feed_atom', array( $this, 'disable_all_feeds_response' ), 10 );
			add_action( 'do_feed_rss2_comments', array( $this, 'disable_all_feeds_response' ), 10 );
			add_action( 'do_feed_atom_comments', array( $this, 'disable_all_feeds_response' ), 10 );
			remove_action( 'wp_head', 'feed_links_extra', 10 );
			remove_action( 'wp_head', 'feed_links', 10 );
		}
	}

	public function disable_all_feeds_response() {
		wp_die( esc_html__( 'No feed available.', 'bromate-security-api-firewall' ), 404 );
	}
}
