<?php
namespace Bromate\SecurityApiFirewall\Runtime;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\LoginRateLimiter;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\TOTPLoginService;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\TOTPController;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\Recaptcha;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\SameSiteCookies;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\SessionManager;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\SaltsRotation;


final class LoginBootstrap {

	public static function register(): void {

		LoginRateLimiter::get_instance();
		Recaptcha::get_instance();
		TOTPLoginService::register();
		SaltsRotation::register();
		SameSiteCookies::register();
		SessionManager::register();

		if ( is_admin() ) {
			TOTPController::register();
		}
	}
}
