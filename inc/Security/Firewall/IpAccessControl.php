<?php namespace Bromate\SecurityApiFirewall\Security\Firewall;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Security\Firewall\AutoBlacklist;
use Bromate\SecurityApiFirewall\Logs\FirewallLogger;
use Bromate\SecurityApiFirewall\Security\IpEntry\IpEntryRepository;
use Bromate\SecurityApiFirewall\Security\IpEntry\ClientIpResolver;
use Bromate\SecurityApiFirewall\Security\IpEntry\GeoIpApi;
use WP_Error;

class IpAccessControl {

	public static function inspect() {

		if ( empty( SettingsRepository::read_option( 'rate_limit_enabled' ) ) ) {
			return true;
		}

		$ip = ClientIpResolver::get_client_ip();

		if ( IpEntryRepository::ip_in_list( $ip, 'whitelist' ) ) {
			FirewallLogger::ip_whitelist_bypass( $ip, __( 'IP found in whitelist.', 'bromate-security-api-firewall' ) );
			return true;
		}

		if ( GeoIpApi::is_country_blocked( $ip ) ) {
			FirewallLogger::ip_blocked( $ip, __( 'IP in blocked countries.', 'bromate-security-api-firewall' ) );
			return new WP_Error(
				'bromate_security_api_firewall_country_blocked',
				__( 'Access from your country is not allowed.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		if ( IpEntryRepository::ip_in_list( $ip, 'blacklist' ) ) {
			FirewallLogger::ip_blocked( $ip, __( 'IP found in blacklist.', 'bromate-security-api-firewall' ) );

			return new WP_Error(
				'bromate_security_api_firewall_ip_in_blacklist',
				__( 'Your IP address is blocked.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		if ( AutoBlacklist::is_auto_blacklisted( $ip ) ) {
			FirewallLogger::ip_blocked( $ip, __( 'IP autoblacklisted.', 'bromate-security-api-firewall' ) );

			return new WP_Error(
				'bromate_security_api_firewall_ip_blacklisted',
				__( 'Your IP has been temporarily blocked.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}
}
