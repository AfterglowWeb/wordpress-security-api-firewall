<?php namespace Bromate\SecurityApiFirewall\Security\WordPress;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

class DisableEmojiScripts {

	protected static $instance = null;

	public static function register() {
		if ( null === static::$instance ) {
			static::$instance = new static();
		}
		return static::$instance;
	}

	private function __construct() {
		if ( true === SettingsRepository::read_option( 'remove_emoji_scripts' ) ) {
			add_action( 'init', array( $this, 'remove_emoji_scripts' ) );
		}
	}

	public static function remove_emoji_scripts(): void {
		remove_action( 'wp_print_styles', 'print_emoji_styles' );
		remove_action( 'wp_enqueue_scripts', 'wp_enqueue_emoji_styles' );
		remove_action( 'enqueue_embed_scripts', 'wp_enqueue_emoji_styles' );

		remove_action( 'wp_head', 'print_emoji_detection_script', 20 );
		remove_action( 'embed_head', 'print_emoji_detection_script', 20 );

		remove_filter( 'the_content_feed', 'wp_staticize_emoji' );
		remove_filter( 'comment_text_rss', 'wp_staticize_emoji' );
		remove_filter( 'wp_mail', 'wp_staticize_emoji_for_email' );

		if ( is_admin() ) {
			remove_action( 'admin_print_styles', 'print_emoji_styles' );
			remove_action( 'admin_enqueue_scripts', 'wp_enqueue_emoji_styles', 20 );
			remove_action( 'admin_print_scripts', 'print_emoji_detection_script', 20 );
			remove_action( 'admin_print_scripts', 'print_emoji_detection_script', 20 );
		}
	}
}
