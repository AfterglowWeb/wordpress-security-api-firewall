<?php
namespace Bromate\SecurityApiFirewall\Api;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Security\Login\LoginRateLimiter;
use Bromate\SecurityApiFirewall\Security\Login\TOTPLoginService;
use Bromate\SecurityApiFirewall\Security\Login\TOTPController;
use Bromate\SecurityApiFirewall\Security\Login\Recaptcha;
use Bromate\SecurityApiFirewall\Security\Login\SameSiteCookies;
use Bromate\SecurityApiFirewall\Security\Login\SessionManager;
use Bromate\SecurityApiFirewall\Security\Login\SaltsRotation;


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
