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

use Bromate\SecurityApiFirewall\Admin\AdminPage;
use Bromate\SecurityApiFirewall\Admin\Documentation;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsMigrateAjaxController;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Logs\LogsAjaxController;

use Bromate\SecurityApiFirewall\Cron\Cron;
use Bromate\SecurityApiFirewall\Cron\CronIpEntries;
use Bromate\SecurityApiFirewall\Cron\CronLogs;
use Bromate\SecurityApiFirewall\Cron\CronTemporaryFiles;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAccessCustomCap;

final class Bootstrap {

	private function __construct() {}

	public static function register(): void {
		add_action( 'plugins_loaded', array( SchemaManager::class, 'install' ) );

		RestRequestBootstrap::register();
		RestAccessCustomCap::register();
		LoginBootstrap::register();
		PublicRequestBootstrap::register();
		GlobalSecurityBootstrap::register();

		JwksEndpoint::register();

		Cron::register();
		CronLogs::register();
		CronIpEntries::register();
		CronTemporaryFiles::register();

		if ( is_admin() ) {
			AdminPage::register();
			SettingsAjaxController::register();
			RestAuthenticationAjaxController::register();
			IpEntriesAjaxController::register();
			LogsAjaxController::register();
			SettingsMigrateAjaxController::register();
			Documentation::register();

		}
	}

	public static function activate(): void {

		SchemaManager::install();

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
		Uninstall::deactivate();
	}

	public static function uninstall(): void {
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			return;
		}

		if ( SettingsRepository::read_option( 'config_delete_data_on_uninstall' ) ) {
			Uninstall::delete_data();
		}
	}
}
