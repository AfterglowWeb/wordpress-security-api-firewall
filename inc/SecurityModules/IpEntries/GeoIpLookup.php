<?php

namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

use League\ISO3166\ISO3166;

final class GeoIpLookup {

	private const CRON_HOOK           = 'bromate_security_api_firewall_refresh_country_ips';
	private const LAST_REFRESH_OPTION = 'bromate_security_api_firewall_country_ips_last_refresh';
	private const SOURCE_BASE         = 'https://raw.githubusercontent.com/ipverse/country-ip-blocks/master/country';
	private const CACHE_GROUP         = 'bromate_security_api_firewall_country_lookup';

	public static function register(): void {
		add_action( self::CRON_HOOK, array( __CLASS__, 'refresh_data' ) );

		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_HOOK );
		}
	}

	public static function schedule(): void {
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_HOOK );
		}
	}

	public static function unschedule(): void {
		$timestamp = wp_next_scheduled( self::CRON_HOOK );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, self::CRON_HOOK );
		}
	}

	public static function refresh_data(): bool {
		$countries = self::get_iso_country_codes();

		$ipv4_ranges = array();
		$ipv6_ranges = array();

		$all_ok = true;

		foreach ( $countries as $cc ) {
			$url = self::SOURCE_BASE . '/' . strtolower( $cc ) . '/aggregated.json';

			$response = wp_remote_get(
				$url,
				array(
					'timeout' => 15,
					'headers' => array( 'Accept' => 'application/json' ),
				)
			);

			if ( is_wp_error( $response ) ) {
				$all_ok = false;
				continue;
			}

			$response_code = wp_remote_retrieve_response_code( $response );
			if ( 200 !== $response_code ) {
				if ( 404 !== $response_code ) {
					$all_ok = false;
				}
				continue;
			}

			$body = wp_remote_retrieve_body( $response );
			$data = json_decode( $body, true );

			if ( ! is_array( $data ) || empty( $data['prefixes'] ) ) {
				continue;
			}

			foreach ( $data['prefixes']['ipv4'] ?? array() as $cidr ) {
				$range = self::cidr_to_range_ipv4( $cidr, $cc );
				if ( $range ) {
					$ipv4_ranges[] = $range;
				}
			}

			foreach ( $data['prefixes']['ipv6'] ?? array() as $cidr ) {
				$range = self::cidr_to_range_ipv6( $cidr, $cc );
				if ( $range ) {
					$ipv6_ranges[] = $range;
				}
			}
		}

		if ( empty( $ipv4_ranges ) && empty( $ipv6_ranges ) ) {
			return false;
		}

		usort( $ipv4_ranges, fn( $a, $b ) => $a['start'] <=> $b['start'] );
		usort( $ipv6_ranges, fn( $a, $b ) => strcmp( $a['start'], $b['start'] ) );

		$ipv4_ranges = self::merge_ranges_ipv4( $ipv4_ranges );
		$ipv6_ranges = self::merge_ranges_ipv6( $ipv6_ranges );

		if ( ! self::write_ranges( $ipv4_ranges, $ipv6_ranges ) ) {
			return false;
		}

		update_option( self::LAST_REFRESH_OPTION, time(), false );
		wp_cache_flush_group( self::CACHE_GROUP );

		return $all_ok;
	}

	private static function write_ranges( array $ipv4_ranges, array $ipv6_ranges ): bool {
		global $wpdb;

		$live   = self::table_name();
		$shadow = $live . '_shadow';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Shadow-table swap for atomic bulk refresh; no wpdb/dbDelta helper covers this.
		$wpdb->query( "DROP TABLE IF EXISTS {$shadow}" );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
		$wpdb->query( "CREATE TABLE {$shadow} LIKE {$live}" );

		$ok = self::bulk_insert( $shadow, 4, $ipv4_ranges )
			&& self::bulk_insert( $shadow, 6, $ipv6_ranges );

		if ( ! $ok ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
			$wpdb->query( "DROP TABLE IF EXISTS {$shadow}" );
			return false;
		}

		$tmp = $live . '_old_' . time();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Atomic RENAME TABLE swap.
		$renamed = $wpdb->query( "RENAME TABLE {$live} TO {$tmp}, {$shadow} TO {$live}" );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
		$wpdb->query( "DROP TABLE IF EXISTS {$tmp}" );

		return (bool) $renamed;
	}

	private static function bulk_insert( string $table, int $ip_version, array $ranges ): bool {
		global $wpdb;

		if ( empty( $ranges ) ) {
			return true;
		}

		foreach ( array_chunk( $ranges, 500 ) as $chunk ) {
			$placeholders = array();
			$values       = array();

			foreach ( $chunk as $range ) {
				$placeholders[] = '(%d, %s, %s, %s)';
				$values[]       = $ip_version;
				$values[]       = self::to_binary( $range['start'], $ip_version );
				$values[]       = self::to_binary( $range['end'], $ip_version );
				$values[]       = $range['cc'];
			}

			$sql = "INSERT INTO {$table} (ip_version, range_start, range_end, country_code) VALUES "
				. implode( ', ', $placeholders );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- placeholders bound via $wpdb->prepare below
			$result = $wpdb->query( $wpdb->prepare( $sql, $values ) );

			if ( false === $result ) {
				return false;
			}
		}

		return true;
	}

	private static function to_binary( $value, int $ip_version ): string {
		if ( 6 === $ip_version ) {
			return $value;
		}
		return pack( 'N', $value );
	}

	private static function cidr_to_range_ipv4( string $cidr, string $cc ): ?array {
		$parts = explode( '/', $cidr );
		if ( count( $parts ) !== 2 ) {
			return null;
		}

		$start = ip2long( $parts[0] );
		$bits  = (int) $parts[1];

		if ( $start === false || $bits < 0 || $bits > 32 ) {
			return null;
		}

		$host_bits = 32 - $bits;
		$end       = $start | ( ( 1 << $host_bits ) - 1 );

		return array(
			'start' => $start,
			'end'   => $end,
			'cc'    => $cc,
		);
	}

	private static function cidr_to_range_ipv6( string $cidr, string $cc ): ?array {
		$parts = explode( '/', $cidr );
		if ( count( $parts ) !== 2 ) {
			return null;
		}

		$start_bin = inet_pton( $parts[0] );
		$bits      = (int) $parts[1];

		if ( $start_bin === false || strlen( $start_bin ) !== 16 || $bits < 0 || $bits > 128 ) {
			return null;
		}

		$end_bin    = $start_bin;
		$full_bytes = intdiv( $bits, 8 );
		$remaining  = $bits % 8;

		for ( $i = $full_bytes; $i < 16; $i++ ) {
			$end_bin[ $i ] = chr( 0xFF );
		}

		if ( $remaining > 0 ) {
			$mask                   = ~( ( 1 << ( 8 - $remaining ) ) - 1 ) & 0xFF;
			$end_bin[ $full_bytes ] = chr( ord( $end_bin[ $full_bytes ] ) | $mask );
		}

		return array(
			'start' => $start_bin,
			'end'   => $end_bin,
			'cc'    => $cc,
		);
	}

	private static function merge_ranges_ipv4( array $ranges ): array {
		if ( empty( $ranges ) ) {
			return array();
		}

		$merged = array( $ranges[0] );

		for ( $i = 1, $n = count( $ranges ); $i < $n; $i++ ) {
			$last = &$merged[ count( $merged ) - 1 ];
			$cur  = $ranges[ $i ];

			if ( $cur['start'] <= $last['end'] + 1 && $cur['cc'] === $last['cc'] ) {
				$last['end'] = max( $last['end'], $cur['end'] );
			} else {
				$merged[] = $cur;
			}
		}

		return $merged;
	}

	private static function merge_ranges_ipv6( array $ranges ): array {
		if ( empty( $ranges ) ) {
			return array();
		}

		$merged = array( $ranges[0] );

		for ( $i = 1, $n = count( $ranges ); $i < $n; $i++ ) {
			$last = &$merged[ count( $merged ) - 1 ];
			$cur  = $ranges[ $i ];

			$last_end_plus_one = self::ipv6_increment( $last['end'] );

			if ( $last_end_plus_one !== null && strcmp( $cur['start'], $last_end_plus_one ) <= 0 && $cur['cc'] === $last['cc'] ) {
				$last['end'] = strcmp( $cur['end'], $last['end'] ) > 0 ? $cur['end'] : $last['end'];
			} else {
				$merged[] = $cur;
			}
		}

		return $merged;
	}

	private static function ipv6_increment( string $bin ): ?string {
		for ( $i = 15; $i >= 0; $i-- ) {
			$byte = ord( $bin[ $i ] );
			if ( $byte < 0xFF ) {
				$bin[ $i ] = chr( $byte + 1 );
				return $bin;
			}
			$bin[ $i ] = "\0";
		}
		return null;
	}

	public static function lookup( string $ip ): ?string {
		$cache_key = md5( $ip );
		$cached    = wp_cache_get( $cache_key, self::CACHE_GROUP );
		if ( false !== $cached ) {
			return '' === $cached ? null : $cached;
		}

		$result = self::lookup_uncached( $ip );

		wp_cache_set( $cache_key, $result ?? '', self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $result;
	}

	private static function lookup_uncached( string $ip ): ?string {
		global $wpdb;

		$table = self::table_name();

		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
			$bin        = pack( 'N', ip2long( $ip ) );
			$ip_version = 4;
		} elseif ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
			$bin = inet_pton( $ip );
			if ( false === $bin ) {
				return null;
			}
			$ip_version = 6;
		} else {
			return null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$country_code = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT country_code FROM {$table}
				 WHERE ip_version = %d AND range_start <= %s AND range_end >= %s
				 ORDER BY range_start DESC LIMIT 1",
				$ip_version,
				$bin,
				$bin
			)
		);

		return $country_code ?: null;
	}

	public static function table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'bromate_country_ip_ranges';
	}

	public static function get_last_refresh(): ?int {
		$ts = get_option( self::LAST_REFRESH_OPTION );
		return $ts ? (int) $ts : null;
	}

	public static function get_iso_country_codes(): array {
		return array_column( self::get_all_countries(), 'country_code' );
	}

	public static function get_all_countries(): array {
		static $cache = null;
		if ( null !== $cache ) {
			return $cache;
		}

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

		$known_codes = array_column( $countries, 'country_code' );
		foreach ( $custom_names as $code => $name ) {
			if ( ! in_array( $code, $known_codes, true ) ) {
				$countries[] = array(
					'country_code' => $code,
					'country_name' => $name,
				);
			}
		}

		usort( $countries, fn( $a, $b ) => strcmp( $a['country_name'], $b['country_name'] ) );

		$cache = $countries;
		return $cache;
	}
}