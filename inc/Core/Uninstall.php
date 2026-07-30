<?php namespace Bromate\SecurityApiFirewall\Core;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Core\Schema\SchemaManager;
use Bromate\SecurityApiFirewall\Admin\AdminPage;
use Bromate\SecurityApiFirewall\Cron\CronIpEntries;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\AutoBlacklist;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\GeoIpApi;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\ViolationTracker;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\LoginRateLimiter;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\SaltsRotation;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\TOTPRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiRoutes\RoutesTreeRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAuthorizedUserRepository;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\JwtAuthentication;
use Bromate\SecurityApiFirewall\SecurityModules\RestApiAuthentication\RestAccessCustomCap;

final class Uninstall {

	private function __construct() {}

	public static function delete_data(): void {

		CronIpEntries::unschedule();
		SaltsRotation::unschedule();
		AdminPage::remove_edit_options_custom_cap();
		RestAccessCustomCap::remove_rest_api_access_custom_cap();

		RoutesTreeRepository::delete_routes_list_transient();
		GeoIpApi::delete_all_geoip_transients();
		ViolationTracker::delete_all_violation_transients();
		LoginRateLimiter::delete_all_rate_limit_transients();

		TOTPRepository::revoke_all_users_totp_enrollment();
		RestAuthorizedUserRepository::delete_authorized_users_jwt_subclaim();

		SaltsRotation::delete_salts_rotation_options();
		JwtAuthentication::delete_jwt_settings();

		SchemaManager::drop_tables();
		SchemaManager::delete_schema_version();

		SettingsRepository::delete_all_options();

		flush_rewrite_rules();
	}

	public static function deactivate(): void {

		CronIpEntries::unschedule();
		SaltsRotation::unschedule();
		AdminPage::remove_edit_options_custom_cap();
		RestAccessCustomCap::remove_rest_api_access_custom_cap();

		RoutesTreeRepository::delete_routes_list_transient();
		GeoIpApi::delete_all_geoip_transients();
		ViolationTracker::delete_all_violation_transients();
		LoginRateLimiter::delete_all_rate_limit_transients();

		flush_rewrite_rules();
	}
}
