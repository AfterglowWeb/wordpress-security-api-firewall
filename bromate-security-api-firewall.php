<?php namespace Bromate\SecurityApiFirewall;

defined( 'ABSPATH' ) || exit;

/**
 * WP Security & API Firewall
 *
 * @package WP Security & API Firewall
 * @author  Sophabed
 *
 * @wordpress-plugin
 * Plugin Name:       WP Security & API Firewall 
 * Version:           0.1.0
 * Description:       Security, firewall, access control and data protection for WordPress and its REST API. Authentication, JWT support, route policies, rate limiting, response hardening and WordPress security tools in a single plugin.
 * Tags:              security, firewall, login, rest api, authentication
 * Author:            Sophabed
 * Author URI:        https://www.moriskelly.com
 * Domain Path:       /languages
 * Requires PHP:      7.4
 * Requires at least: 6.0
 * Tested up to:      7.0
 * License: GNU General Public License v2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 */

define( 'BROMATE_REST_API_FIREWALL_VERSION', '0.1.0' );
define( 'BROMATE_REST_API_FIREWALL_DIR', plugin_dir_path( __FILE__ ) );
define( 'BROMATE_REST_API_FIREWALL_URL', plugin_dir_url( __FILE__ ) );
define( 'BROMATE_REST_API_FIREWALL_FILE', __FILE__ );

require_once BROMATE_REST_API_FIREWALL_DIR . 'vendor/autoload.php';
Core\Bootstrap::register();

register_activation_hook( __FILE__, array( Core\Bootstrap::class, 'activate' ) );

register_deactivation_hook( __FILE__, array( Core\Bootstrap::class, 'deactivate' ) );

add_action(
	'init',
	function (): void {
		load_plugin_textdomain(
			'bromate-security-api-firewall',
			false,
			dirname( plugin_basename( __FILE__ ) ) . '/languages'
		);
	}
);

add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( array $links ): array {
		$settings_link = sprintf(
			'<a href="%s">%s</a>',
			admin_url( 'admin.php?page=bromate-security-api-firewall' ),
			esc_html__( 'Settings', 'bromate-security-api-firewall' )
		);
		array_unshift( $links, $settings_link );
		return $links;
	}
);
