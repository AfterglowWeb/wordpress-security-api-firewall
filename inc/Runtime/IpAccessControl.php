<?php namespace Bromate\SecurityApiFirewall\Runtime;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\AutoBlacklist;
use Bromate\SecurityApiFirewall\Logs\Logger;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpUtils;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\GeoIpApi;
use WP_Error;

class IpAccessControl {

	public static function inspect() {

		if ( empty( SettingsRepository::read_option( 'rate_limit_enabled' ) ) ) {
			return true;
		}

		$ip = IpUtils::get_client_ip();

		if ( IpEntriesRepository::ip_in_list( $ip, 'whitelist' ) ) {
			Logger::log( 'ip_whitelist_bypass', 'info', array( 'reason' => esc_html__( 'IP found in whitelist.', 'bromate-security-api-firewall' ) ), $ip );
			return true;
		}

		if ( GeoIpApi::is_country_blocked( $ip ) ) {
			Logger::log( 'ip_country_blocked', 'warning', array( 'reason' => esc_html__( 'IP in blocked countries.', 'bromate-security-api-firewall' ) ), $ip );
			return new WP_Error(
				'bromate_security_api_firewall_country_blocked',
				esc_html__( 'Access from your country is not allowed.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		if ( IpEntriesRepository::ip_in_list( $ip, 'blacklist' ) ) {
			Logger::log( 'ip_blacklisted', 'warning', array( 'reason' => esc_html__( 'IP found in blacklist.', 'bromate-security-api-firewall' ) ), $ip );

			return new WP_Error(
				'bromate_security_api_firewall_ip_in_blacklist',
				esc_html__( 'Your IP address is blocked.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		if ( AutoBlacklist::is_auto_blacklisted( $ip ) ) {
			Logger::log( 'ip_rate_limited', 'warning', array( 'reason' => esc_html__( 'IP temporarly blocked.', 'bromate-security-api-firewall' ) ), $ip );

			return new WP_Error(
				'bromate_security_api_firewall_ip_blacklisted',
				esc_html__( 'Your IP has been temporarily blocked.', 'bromate-security-api-firewall' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}
}
