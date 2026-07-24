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
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\AutoBlacklist;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\GeoIpApi;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\ViolationTracker;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\LoginRateLimiter;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\SaltsRotation;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\TOTPRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAuthorizedUserRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\JwtAuthentication;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\WordPressApplicationPassword;

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

		CronIpEntries::unschedule();
		SaltsRotation::unschedule();
		SaltsRotation::delete_salts_rotation_options();

		RoutesTreeRepository::delete_routes_list_transient();
		AutoBlacklist::delete_all_auto_blacklist_ip_transients();
		GeoIpApi::delete_all_geoip_transients();
		ViolationTracker::delete_all_violation_transients();
		LoginRateLimiter::delete_all_rate_limit_transients();

		TOTPRepository::revoke_all_users_totp_enrollment();
		RestAuthorizedUserRepository::delete_authorized_users_meta_and_cap();

		SettingsConfig::delete_settings();
		JwtAuthentication::delete_jwt_settings();

		AdminPage::remove_edit_options_custom_cap();

		SchemaManager::drop_tables();
		SchemaManager::delete_schema_version();

		flush_rewrite_rules();
	}
}
