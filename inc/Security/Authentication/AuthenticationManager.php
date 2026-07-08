<?php namespace Bromate\SecurityApiFirewall\Security\Authentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Security\Authentication\ApplicationPasswordAuthenticator;
use Bromate\SecurityApiFirewall\Security\Authentication\JwtAuthenticator;
use Bromate\SecurityApiFirewall\Logs\FirewallLogger;

class AuthenticationManager {

	public static function authenticate() {

		$options = SettingsRepository::read_options();
		$method  = $options['firewall_auth_method'] ?? 'wp_auth';

		if ( 'jwt' === $method ) {

			$auth_result = JwtAuthenticator::validate_bearer_jwt(
				array(
					'algorithm'  => $options['firewall_jwt_algorithm'] ?? 'RS256',
					'public_key' => $options['firewall_jwt_public_key'] ?? '',
					'audience'   => $options['firewall_jwt_audience'] ?? '',
					'issuer'     => $options['firewall_jwt_issuer'] ?? '',
				)
			);
		}

		$auth_result = ApplicationPasswordAuthenticator::validate_wp_application_password();
		true === $auth_result ? FirewallLogger::auth_success( true ) : FirewallLogger::auth_failed( 'invalid_jwt' );
		return $auth_result;
	}
}
