<?php namespace Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

defined( 'ABSPATH' ) || exit;

class DisableComments {

	protected static $instance = null;

	public static function register() {
		if ( null === static::$instance ) {
			static::$instance = new static();
		}
		return static::$instance;
	}

	private function __construct() {

		add_action(
			'admin_notices',
			function (): void {
				global $pagenow;
				if ( 'options-discussion.php' !== $pagenow ) {
					return;
				}
				if ( empty( SettingsRepository::read_option( 'disable_comments' ) ) ) {
					return;
				}
				$settings_url = admin_url( 'admin.php?page=bromate-security-api-firewall#global_security' );
				printf(
					'<div class="notice notice-error"><p>%s <a href="%s">%s</a>. %s</p></div>',
					esc_html__( 'Comments are globally disabled in the WP Security & API Firewall plugin ', 'bromate-security-api-firewall' ),
					esc_url( $settings_url ),
					esc_html__( 'Global Security tab', 'bromate-security-api-firewall' ),
					esc_html__( 'Changes made on this page will have no effect while that setting is active.', 'bromate-security-api-firewall' )
				);
			}
		);

		if ( true === SettingsRepository::read_option( 'disable_comments' ) ) {
			add_filter( 'comments_open', '__return_false', 20, 2 );
			add_filter( 'pings_open', '__return_false', 20, 2 );
			add_filter( 'comments_array', '__return_empty_array', 10, 2 );
			add_filter(
				'wp_headers',
				function ( array $headers ): array {
					unset( $headers['X-Pingback'] );
					return $headers;
				}
			);
			add_filter(
				'bloginfo_url',
				function ( string $output, string $show ): string {
					return 'pingback_url' === $show ? '' : $output;
				},
				10,
				2
			);
			add_filter(
				'rest_endpoints',
				function ( array $endpoints ): array {
					foreach ( array_keys( $endpoints ) as $route ) {
						if ( 0 === strpos( $route, '/wp/v2/comments' ) ) {
							unset( $endpoints[ $route ] );
						}
					}
					return $endpoints;
				}
			);

			remove_action( 'wp_head', 'rsd_link' );
			remove_action( 'wp_head', 'wp_generator' );

			add_action(
				'wp_enqueue_scripts',
				function (): void {
					wp_dequeue_script( 'comment-reply' );
				}
			);

			add_action(
				'wp_dashboard_setup',
				function (): void {
					remove_meta_box( 'dashboard_recent_comments', 'dashboard', 'normal' );
				}
			);
		}

		add_action(
			'admin_init',
			function (): void {

				if ( empty( SettingsRepository::read_option( 'disable_comments' ) ) ) {
					return;
				}

				if ( ! wp_doing_ajax() ) {
					remove_menu_page( 'edit-comments.php' );
				}
				if ( is_admin_bar_showing() ) {
					remove_action( 'admin_bar_menu', 'wp_admin_bar_comments_menu', 60 );
				}

				global $pagenow;
				if ( 'edit-comments.php' === $pagenow ) {
					wp_safe_redirect( apply_filters( 'allowed_redirect_hosts', admin_url() ) );
					exit;
				}

				foreach ( get_post_types() as $post_type ) {
					if ( post_type_supports( $post_type, 'comments' ) ) {
						remove_post_type_support( $post_type, 'comments' );
						remove_post_type_support( $post_type, 'trackbacks' );
					}
				}

				update_option( 'default_pingback_flag', 0 );
				update_option( 'default_ping_status', 0 );
				update_option( 'default_comment_status', 0 );
				update_option( 'thread_comments', 0 );
				update_option( 'show_comments_cookies_opt_in', 0 );
				update_option( 'page_comments', 0 );

				update_option( 'require_name_email', 1 );
				update_option( 'comment_registration', 1 );
				update_option( 'close_comments_for_old_posts', 1 );
				update_option( 'close_comments_days_old', 0 );

				update_option( 'comments_notify', 1 );
				update_option( 'moderation_notify', 1 );
				update_option( 'wp_notes_notify', 1 );

				update_option( 'comment_moderation', 1 );
				update_option( 'comment_previously_approved', 1 );
				update_option( 'comment_max_links', 0 );
				update_option( 'show_avatars', 0 );
			}
		);

		add_action(
			'init',
			function (): void {

				if ( empty( SettingsRepository::read_option( 'disable_comments' ) ) ) {
					return;
				}

				foreach ( get_post_types() as $post_type ) {
					if ( post_type_supports( $post_type, 'comments' ) ) {
						remove_post_type_support( $post_type, 'comments' );
						remove_post_type_support( $post_type, 'trackbacks' );
					}
				}
			}
		);
	}
}
