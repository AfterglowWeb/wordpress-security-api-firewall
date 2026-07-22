<?php namespace Bromate\SecurityApiFirewall\Core;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Schema\SchemaManager;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

use Bromate\SecurityApiFirewall\Runtime\RestRequestBootstrap;
use Bromate\SecurityApiFirewall\Runtime\PublicRequestBootstrap;
use Bromate\SecurityApiFirewall\Runtime\LoginBootstrap;

use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\JwksEndpoint;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\AuthenticationAjaxController;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\GlobalSecurityBootstrap;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesAjaxController;

use Bromate\SecurityApiFirewall\Admin\AdminPage;
use Bromate\SecurityApiFirewall\Admin\Documentation;

use Bromate\SecurityApiFirewall\Logs\LogsAjaxController;

use Bromate\SecurityApiFirewall\Cron\Cron;
use Bromate\SecurityApiFirewall\Cron\CronIpEntries;
use Bromate\SecurityApiFirewall\Cron\CronLogs;

final class Bootstrap {

	private function __construct() {}

	public static function register(): void {
		add_action( 'plugins_loaded', array( SchemaManager::class, 'install' ) );

		RestRequestBootstrap::register();
		PublicRequestBootstrap::register();
		LoginBootstrap::register();
		GlobalSecurityBootstrap::register();
		JwksEndpoint::register();

		Cron::register();
		CronLogs::register();
		CronIpEntries::register();

		if ( is_admin() ) {
			AdminPage::register();
			SettingsAjaxController::register();
			AuthenticationAjaxController::register();
			IpEntriesAjaxController::register();
			LogsAjaxController::register();
			Documentation::register();
		}
	}

	public static function activate(): void {
		SchemaManager::install();

		$role = get_role( 'administrator' );
		if ( $role ) {
			$role->add_cap( 'bromate_security_api_firewall_edit_options' );
		}

		if ( false === get_option( 'bromate_security_api_firewall_options' ) ) {
			update_option(
				'bromate_security_api_firewall_options',
				array( 'version' => BROMATE_SECURITY_API_FIREWALL_VERSION ),
				false
			);
		}

		flush_rewrite_rules();
	}

	public static function deactivate(): void {
		$role = get_role( 'administrator' );
		if ( $role ) {
			$role->remove_cap( 'bromate_security_api_firewall_edit_options' );
		}

		delete_transient( 'bromate_security_api_firewall_routes_list' );
		flush_rewrite_rules();
	}

	public static function uninstall(): void {
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			return;
		}

		$caps = array( 'bromate_security_api_firewall_edit_options', 'rest_firewall_api_access' );

		foreach ( array_keys( wp_roles()->roles ) as $role_name ) {
			$role = get_role( $role_name );
			if ( $role ) {
				foreach ( $caps as $cap ) {
					$role->remove_cap( $cap );
				}
			}
		}

		delete_option( 'bromate_security_api_firewall_options' );
		delete_option( \Bromate\SecurityApiFirewall\Core\Schema\SchemaManager::OPTION_KEY );
		delete_transient( 'bromate_security_api_firewall_routes_list' );

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}bromate_security_api_firewall_ip_entries" );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}bromate_security_api_firewall_logs" );
	}
}
