<?php namespace Bromate\SecurityApiFirewall\Core;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Schema\SchemaManager;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsConfig;

use Bromate\SecurityApiFirewall\Runtime\RestRequestBootstrap;
use Bromate\SecurityApiFirewall\Runtime\PublicRequestBootstrap;
use Bromate\SecurityApiFirewall\Runtime\LoginBootstrap;

use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\JwksEndpoint;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAuthenticationAjaxController;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\GlobalSecurityBootstrap;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesAjaxController;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes\RoutesTreeRepository;

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
		LoginBootstrap::register();
		PublicRequestBootstrap::register();
		GlobalSecurityBootstrap::register();

		JwksEndpoint::register();

		Cron::register();
		CronLogs::register();
		CronIpEntries::register();

		if ( is_admin() ) {
			AdminPage::register();

			SettingsAjaxController::register();
			RestAuthenticationAjaxController::register();

			IpEntriesAjaxController::register();
			LogsAjaxController::register();
			Documentation::register();

		}
	}

	public static function activate(): void {

		SchemaManager::install();
		AdminPage::add_edit_options_custom_cap();

		if ( false === get_option( SettingsConfig::SETTINGS_OPTION_KEY ) ) {
			update_option(
				SettingsConfig::SETTINGS_OPTION_KEY,
				array( 'version' => BROMATE_SECURITY_API_FIREWALL_VERSION ),
				false
			);
		}

		flush_rewrite_rules();
	}

	public static function deactivate(): void {

		delete_transient( RoutesTreeRepository::ROUTES_LIST_TRANSIENT_KEY );
		wp_unschedule_hook( CronIpEntries::CRON_HOOK_KEY );

		AdminPage::remove_edit_options_custom_cap();
		flush_rewrite_rules();
	}

	public static function uninstall(): void {
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			return;
		}

		Uninstall::delete_data();
	}
}
