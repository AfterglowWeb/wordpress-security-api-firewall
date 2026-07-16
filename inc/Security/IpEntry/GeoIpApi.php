<?php namespace Bromate\SecurityApiFirewall\Security\IpEntry;

use League\ISO3166\ISO3166;

class GeoIpApi {

	private const CACHE_KEY_PREFIX = 'rest_api_fw_geoip_';
	private const CACHE_TTL        = 86400 * 7;
	private const API_ENDPOINT     = 'https://ipapi.co/%s/json/';

	public static function get_all_countries(): array {
		$custom_names = array(
			'XC' => 'Northern Cyprus',
			'XO' => 'South Ossetia',
		);

		$iso3166   = new ISO3166();
		$countries = array();

		foreach ( $iso3166->all() as $entry ) {
			$code        = $entry['alpha2'];
			$countries[] = array(
				'country_code' => $code,
				'country_name' => $custom_names[ $code ] ?? $entry['name'],
			);
		}

		// XC and XO are not in the ISO standard — append them.
		foreach ( $custom_names as $code => $name ) {
			if ( ! in_array( $code, array_column( $countries, 'country_code' ), true ) ) {
				$countries[] = array(
					'country_code' => $code,
					'country_name' => $name,
				);
			}
		}

		usort( $countries, fn( $a, $b ) => strcmp( $a['country_name'], $b['country_name'] ) );

		return $countries;
	}

	public static function is_country_blocked( string $ip ): bool {

		$country_code = self::get_country_code( $ip );

		if ( empty( $country_code ) ) {
			return false;
		}

		return IpEntryRepository::country_in_list(
			$country_code,
			'global_blacklist'
		);
	}

	public static function get_country_code( string $ip ): string {

		$geoip = self::get_geoip( $ip );

		return isset( $geoip['country'] ) ? $geoip['country'] : '';
	}

	public static function get_geoip( string $ip ): array {

		$cached = self::get_cached( $ip );
		if ( $cached ) {
			return $cached;
		}

		$geoip = self::fetch_from_api( $ip );

		if ( ! empty( $geoip ) ) {
			self::cache_result( $ip, $geoip );
			return $geoip;
		}

		return array();
	}

	public static function sanitize_country_codes( array $country_codes ): array {
		$country_codes = array_filter($country_codes, function($country_code){
			preg_match('/^[A-Z]{2}$/i', sanitize_key($country_code), $matches);
			return !empty( $matches );
		});
		return $country_codes;
	}

	private static function build_api_url( string $ip ): string {
		$ip = CidrMatcher::cidr_to_ip($ip);
		if($ip) {
			return sprintf(
				self::API_ENDPOINT,
				rawurlencode( $ip )
			);
		}
		return '';
	}

	private static function fetch_from_api( string $ip ): array {
		$url = self::build_api_url( $ip );

		if ( empty( $url ) ) {
			return [];
		}

		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 5,
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $response ) ) {
			return [];
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		if ( $response_code !== 200 ) {
			return [];
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( ! is_array( $data ) ) {
			return [];
		}

		if ( isset( $data['error'] ) && $data['error'] === true ) {
			return [];
		}

		if ( empty( $data['country_code'] ) && empty( $data['country_name'] ) && empty( $data['city'] ) ) {
			return [];
		}

		return array(
			'country'     => $data['country_code'] ?? null,
			'countryName' => $data['country_name'] ?? null,
			'city'        => $data['city'] ?? null,
			'latitude'    => $data['latitude'] ?? null,
			'longitude'   => $data['longitude'] ?? null,
			'isp'         => $data['org'] ?? null,
		);
	}

	private static function get_cached( string $ip ): ?array {
		$key    = self::CACHE_KEY_PREFIX . md5( $ip );
		$cached = wp_cache_get( $key, 'security_api_firewall' );
		if ( false !== $cached ) {
			return $cached;
		}

		$from_transient = get_transient( $key );
		if ( false !== $from_transient ) {
			wp_cache_set( $key, $from_transient, 'security_api_firewall', self::CACHE_TTL );
			return $from_transient;
		}

		return null;
	}

	private static function cache_result( string $ip, array $data ): void {
		$key = self::CACHE_KEY_PREFIX . md5( $ip );
		wp_cache_set( $key, $data, 'security_api_firewall', self::CACHE_TTL );

		if ( wp_using_ext_object_cache() || is_admin() ) {
			set_transient( $key, $data, self::CACHE_TTL );
		}
	}
}
