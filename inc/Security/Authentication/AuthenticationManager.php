<?php namespace Bromate\SecurityApiFirewall\Security\Authentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Security\Authentication\WordPressApplicationPassword;
use Bromate\SecurityApiFirewall\Security\Authentication\JwtAuthenticator;
use Bromate\SecurityApiFirewall\Logs\FirewallLogger;

class AuthenticationManager {

	public static function authenticate() {

		if ( empty( SettingsRepository::read_option( 'auth_control_enabled' ) ) ) {
			return true;
		}

		$options = SettingsRepository::read_options();

		$method = $options['firewall_auth_method'] ?? 'wp_auth';

		if ( 'jwt' === $method ) {
			$jwks_url = $options['firewall_jwt_jwks_url'] ?? '';

			if ( empty( $jwks_url ) ) {
				$jwks_url = rest_url( 'bromate/v1/.well-known/jwks.json' );
			}

			$auth_config = array(
				'algorithm'      => $options['firewall_jwt_algorithm'] ?? 'RS256',
				'public_key'     => $options['firewall_jwt_public_key'] ?? '',
				'jwks_url'       => $jwks_url,
				'audience'       => $options['firewall_jwt_audience'] ?? '',
				'issuer'         => $options['firewall_jwt_issuer'] ?? '',
				'cache_jwks'     => $options['firewall_jwt_cache_jwks'] ?? true,
				'cache_duration' => $options['firewall_jwt_cache_duration'] ?? 3600,
			);

			$auth_result = JwtAuthenticator::validate_bearer_jwt( $auth_config );

			if ( $auth_result ) {
				FirewallLogger::log( 'auth_success', 'info', array( 'reason' => 'Successfull Authentication with JWT', 'extra' => $auth_result ) );
				return true;
			}

			FirewallLogger::log( 'invalid_jwt', 'warning', [
				'reason' => __( 'Authentication failed because of invalid JWT.', 'bromate-security-api-firewall' ), 
			] );
			return false;
		}

		$auth_result = WordPressApplicationPassword::validate_wp_application_password();

		if ( true === $auth_result ) {
			FirewallLogger::log( 'auth_success', 'info', array( 'reason' => 'Successfull Authentication with WordPress Application Password', 'extra' => $auth_result ) );
		} else {
			FirewallLogger::log( 'invalid_application_password', 'warning', [
				'reason' => __( 'Authentication failed because of invalid application password.', 'bromate-security-api-firewall' ), 
			] );
		}

		return $auth_result;
	}
}
