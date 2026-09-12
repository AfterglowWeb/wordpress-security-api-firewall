<?php

namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

use League\ISO3166\ISO3166;

final class GeoIpLookup {

	private const CRON_HOOK = 'bromate_security_api_firewall_refresh_country_ips';
	private const LAST_REFRESH_OPTION = 'bromate_security_api_firewall_country_ips_last_refresh';
	private const SOURCE_BASE = 'https://github.com/ipverse/country-ip-blocks/tree/master/country';
	private static string $data_file = '';
	private static ?array $ipv4_ranges = null;
	private static ?array $ipv6_ranges = null;

	public static function register(): void {
		self::$data_file = self::get_data_file_path();

		add_action( self::CRON_HOOK, array( __CLASS__, 'refresh_data' ) );

		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_HOOK );
		}
	}

	private static function get_data_file_path(): string {
		$upload_dir = wp_upload_dir();
		return trailingslashit( $upload_dir['basedir'] ) . 'bromate-country-ip-lookup.php';
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

			$response = wp_remote_get( $url, array(
				'timeout' => 15,
				'headers' => array( 'Accept' => 'application/json' ),
			) );

			if ( is_wp_error( $response ) ) {
				$all_ok = false;
				continue;
			}

			$body = wp_remote_retrieve_body( $response );
			$data = json_decode( $body, true );

			if ( ! is_array( $data ) || empty( $data['subnets'] ) ) {
				continue;
			}

			foreach ( $data['subnets']['ipv4'] ?? array() as $cidr ) {
				$range = self::cidr_to_range_ipv4( $cidr, $cc );
				if ( $range ) {
					$ipv4_ranges[] = $range;
				}
			}

			foreach ( $data['subnets']['ipv6'] ?? array() as $cidr ) {
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

		$php = self::generate_php_file( $ipv4_ranges, $ipv6_ranges );

		if ( ! self::atomic_write( self::$data_file, $php ) ) {
			return false;
		}

		update_option( self::LAST_REFRESH_OPTION, time(), false );

		return $all_ok;
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

		$end_bin = $start_bin;
		$full_bytes = intdiv( $bits, 8 );
		$remaining  = $bits % 8;

		for ( $i = $full_bytes; $i < 16; $i++ ) {
			$end_bin[ $i ] = chr( 0xFF );
		}

		if ( $remaining > 0 ) {
			$mask = ~( ( 1 << ( 8 - $remaining ) ) - 1 ) & 0xFF;
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

	private static function generate_php_file( array $ipv4, array $ipv6 ): string {
		$ipv4_export = var_export( $ipv4, true );
		$ipv6_export = var_export( $ipv6, true );

		return "<?php\n"
			. "// Auto-generated by Bromate CountryIpLookup. Do not edit.\n"
			. "// Generated: " . gmdate( 'Y-m-d H:i:s' ) . " UTC\n"
			. "return array(\n"
			. "'ipv4' => " . $ipv4_export . ",\n"
			. "'ipv6' => " . $ipv6_export . ",\n"
			. ");\n";
	}

	private static function atomic_write( string $path, string $contents ): bool {
		$tmp = $path . '.tmp.' . uniqid( '', true );

		if ( file_put_contents( $tmp, $contents, LOCK_EX ) === false ) {
			return false;
		}

		if ( ! rename( $tmp, $path ) ) {
			@unlink( $tmp );
			return false;
		}

		return true;
	}

	private static function load_data(): void {
		if ( self::$ipv4_ranges !== null || self::$ipv6_ranges !== null ) {
			return;
		}

		if ( ! file_exists( self::$data_file ) ) {
			self::$ipv4_ranges = array();
			self::$ipv6_ranges = array();
			return;
		}

		$data = include self::$data_file;

		if ( ! is_array( $data ) ) {
			self::$ipv4_ranges = array();
			self::$ipv6_ranges = array();
			return;
		}

		self::$ipv4_ranges = $data['ipv4'] ?? array();
		self::$ipv6_ranges = $data['ipv6'] ?? array();
	}

	public static function lookup( string $ip ): ?string {
		self::load_data();

		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
			return self::lookup_ipv4( ip2long( $ip ) );
		}

		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
			$bin = inet_pton( $ip );
			if ( $bin !== false ) {
				return self::lookup_ipv6( $bin );
			}
		}

		return null;
	}

	private static function lookup_ipv4( $ip ): ?string {
		if ( $ip === false || empty( self::$ipv4_ranges ) ) {
			return null;
		}

		$lo = 0;
		$hi = count( self::$ipv4_ranges ) - 1;

		while ( $lo <= $hi ) {
			$mid   = ( $lo + $hi ) >> 1;
			$range = self::$ipv4_ranges[ $mid ];

			if ( $ip < $range['start'] ) {
				$hi = $mid - 1;
			} elseif ( $ip > $range['end'] ) {
				$lo = $mid + 1;
			} else {
				return $range['cc'];
			}
		}

		return null;
	}

	private static function lookup_ipv6( string $ip ): ?string {
		if ( empty( self::$ipv6_ranges ) ) {
			return null;
		}

		$lo = 0;
		$hi = count( self::$ipv6_ranges ) - 1;

		while ( $lo <= $hi ) {
			$mid   = ( $lo + $hi ) >> 1;
			$range = self::$ipv6_ranges[ $mid ];

			if ( strcmp( $ip, $range['start'] ) < 0 ) {
				$hi = $mid - 1;
			} elseif ( strcmp( $ip, $range['end'] ) > 0 ) {
				$lo = $mid + 1;
			} else {
				return $range['cc'];
			}
		}

		return null;
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

		// XC and XO are not in the ISO standard — append them if missing.
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