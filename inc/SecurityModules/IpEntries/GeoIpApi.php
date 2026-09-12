<?php
namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

use Bromate\SecurityApiFirewall\Core\Schema\SchemaManager;
use League\ISO3166\ISO3166;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\GeoIpLookup;

class GeoIpApi {

	private const CACHE_KEY_PREFIX   = 'bromate_security_api_firewall_fw_geoip_';
	private const CACHE_GROUP_KEY    = 'bromate_security_api_firewall_geoip';
	private const CACHE_TTL          = 86400 * 7;
	private const NEGATIVE_CACHE_TTL = HOUR_IN_SECONDS;
	private const API_ENDPOINT       = 'https://ipapi.co/%s/json/';

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

		if ( '' === $country_code ) {
			return false;
		}

		return IpEntriesRepository::is_country_blocked( $country_code );
	}

	public static function get_country_code( string $ip ): string {
		$ip = IpUtils::cidr_to_ip( $ip );
		if ( ! $ip ) {
			return '';
		}

		$cc = GeoIpLookup::lookup( $ip );

		return is_string( $cc ) ? strtoupper( $cc ) : '';
	}

	public static function get_country_name( string $ip ): string {
		$cc = self::get_country_code( $ip );
		if ( '' === $cc ) {
			return '';
		}

		try {
			$iso3166 = new ISO3166();
			$entry   = $iso3166->alpha2( $cc );
			return $entry['name'] ?? $cc;
		} catch ( \Exception $e ) {
			return $cc;
		}
	}

	public static function get_geoip( string $ip, bool $include_details = false ): array {
		$ip = IpUtils::cidr_to_ip( $ip );
		if ( ! $ip ) {
			return array();
		}

		$country_code = self::get_country_code( $ip );

		$local = array(
			'country'     => '' !== $country_code ? $country_code : null,
			'countryName' => '' !== $country_code ? self::country_name_from_code( $country_code ) : null,
			'city'        => null,
			'latitude'    => null,
			'longitude'   => null,
			'isp'         => null,
		);

		if ( ! $include_details ) {
			return $local;
		}

		$cached = self::get_cached( $ip );
		if ( null !== $cached ) {
			return $cached;
		}

		$geoip = self::fetch_from_api( $ip );

		if ( ! empty( $geoip ) ) {
			if ( '' !== $country_code ) {
				$geoip['country']     = $country_code;
				$geoip['countryName'] = self::country_name_from_code( $country_code );
			}
			self::cache_result( $ip, $geoip, self::CACHE_TTL );
			return $geoip;
		}

		self::cache_result( $ip, $local, self::NEGATIVE_CACHE_TTL );
		return $local;
	}

	public static function sanitize_country_codes( array $country_codes ): array {
		$sanitized = array();
		foreach ( $country_codes as $country_code ) {
			$clean = strtoupper( sanitize_key( $country_code ) );
			if ( preg_match( '/^[A-Z]{2}$/', $clean ) ) {
				$sanitized[] = $clean;
			}
		}
		return array_values( array_unique( $sanitized ) );
	}

	private static function country_name_from_code( string $code ): string {
		$custom_names = array(
			'XC' => 'Northern Cyprus',
			'XO' => 'South Ossetia',
		);

		if ( isset( $custom_names[ $code ] ) ) {
			return $custom_names[ $code ];
		}

		try {
			$iso3166 = new ISO3166();
			$entry   = $iso3166->alpha2( $code );
			return $entry['name'] ?? $code;
		} catch ( \Exception $e ) {
			return $code;
		}
	}

	private static function build_api_url( string $ip ): string {
		$ip = IpUtils::cidr_to_ip( $ip );
		if ( $ip ) {
			return sprintf( self::API_ENDPOINT, rawurlencode( $ip ) );
		}
		return '';
	}

	public static function enrich_pending_batch( int $batch_size = 25 ): void {
		global $wpdb;
		$table = SchemaManager::ip_entries_table_name();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, ip FROM {$table} WHERE geoip_enriched_at IS NULL ORDER BY created_at ASC LIMIT %d",
				$batch_size
			),
			ARRAY_A
		);

		foreach ( (array) $rows as $row ) {
			$geoip = GeoIpApi::get_geoip( $row['ip'], true );
			IpEntriesRepository::update_geoip_data( (int) $row['id'], $geoip );
		}
	}

	private static function fetch_from_api( string $ip ): array {
		$url = self::build_api_url( $ip );

		if ( empty( $url ) ) {
			return array();
		}

		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 5,
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array();
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $response_code ) {
			return array();
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( ! is_array( $data ) ) {
			return array();
		}

		if ( isset( $data['error'] ) && true === $data['error'] ) {
			return array();
		}

		if ( empty( $data['country_code'] ) && empty( $data['country_name'] ) && empty( $data['city'] ) ) {
			return array();
		}

		return array(
			'country'     => isset( $data['country_code'] ) ? sanitize_key( $data['country_code'] ) : null,
			'countryName' => isset( $data['country_name'] ) ? sanitize_text_field( $data['country_name'] ) : null,
			'city'        => isset( $data['city'] ) ? sanitize_text_field( $data['city'] ) : null,
			'latitude'    => isset( $data['latitude'] ) && is_numeric( $data['latitude'] ) ? (float) $data['latitude'] : null,
			'longitude'   => isset( $data['longitude'] ) && is_numeric( $data['longitude'] ) ? (float) $data['longitude'] : null,
			'isp'         => isset( $data['org'] ) ? sanitize_text_field( $data['org'] ) : null,
		);
	}

	private static function get_cached( string $ip ): ?array {
		$key    = self::CACHE_KEY_PREFIX . md5( $ip );
		$cached = wp_cache_get( $key, self::CACHE_GROUP_KEY );
		if ( false !== $cached ) {
			return $cached;
		}

		$from_transient = get_transient( $key );
		if ( false !== $from_transient ) {
			wp_cache_set( $key, $from_transient, self::CACHE_GROUP_KEY, self::CACHE_TTL );
			return $from_transient;
		}

		return null;
	}

	private static function cache_result( string $ip, array $data, int $ttl ): void {
		$key = self::CACHE_KEY_PREFIX . md5( $ip );
		wp_cache_set( $key, $data, self::CACHE_GROUP_KEY, $ttl );
		set_transient( $key, $data, $ttl );
	}

	public static function delete_all_geoip_transients(): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- No API exists to bulk-delete transients by prefix; uninstall-only cleanup.
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options}
				WHERE option_name LIKE %s
				OR option_name LIKE %s",
				$wpdb->esc_like( '_transient_' . self::CACHE_KEY_PREFIX ) . '%',
				$wpdb->esc_like( '_transient_timeout_' . self::CACHE_KEY_PREFIX ) . '%'
			)
		);

		wp_cache_flush_group( self::CACHE_GROUP_KEY );
	}
}