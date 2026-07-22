<?php namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

final class IpUtils {

	private static ?string $cached_ip = null;

	public static function get_client_ip(): string {
		if ( null !== self::$cached_ip ) {
			return self::$cached_ip;
		}
		$raw_ip = '';

		if ( isset( $_SERVER['REMOTE_ADDR'] ) ) {
			$value = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
			if ( ! empty( $value ) ) {
				$raw_ip = $value;
			}
		}

		if ( function_exists( 'getallheaders' ) ) {
			$all_headers = getallheaders();
			if ( is_array( $all_headers ) ) {
				foreach ( $all_headers as $name => $value ) {
					if ( 'remote-addr' === strtolower( $name ) && ! empty( $value ) ) {
						$raw_ip = sanitize_text_field( $value );
						break;
					}
				}
			}
		}

		$ip = filter_var( trim( $raw_ip ), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6 );
		if ( $ip ) {
			self::$cached_ip = $ip;
			return $ip;
		}

		return '';
	}

	public static function ip_matches( string $ip, string $entry ): bool {
		if ( strpos( $entry, '/' ) === false ) {
			$ip_bin    = inet_pton( $ip );
			$entry_bin = inet_pton( $entry );

			if ( false === $ip_bin || false === $entry_bin || strlen( $ip_bin ) !== strlen( $entry_bin ) ) {
				return false;
			}

			return $ip_bin === $entry_bin;
		}

			[ $network, $prefix ] = explode( '/', $entry, 2 );
			$prefix               = (int) $prefix;
			$ip_bin               = inet_pton( $ip );
			$net_bin              = inet_pton( $network );

		if ( false === $ip_bin || false === $net_bin || strlen( $ip_bin ) !== strlen( $net_bin ) ) {
			return false;
		}

		if ( $prefix <= 0 ) {
			return true;
		}

			$max_bits    = strlen( $ip_bin ) * 8;
			$prefix      = min( $prefix, $max_bits );
			$full_bytes  = intdiv( $prefix, 8 );
			$remain_bits = $prefix % 8;

		if ( $full_bytes > 0 && substr( $ip_bin, 0, $full_bytes ) !== substr( $net_bin, 0, $full_bytes ) ) {
			return false;
		}

		if ( $remain_bits > 0 ) {
			$mask = 0xFF & ( 0xFF << ( 8 - $remain_bits ) );
			if ( ( ord( $ip_bin[ $full_bytes ] ) & $mask ) !== ( ord( $net_bin[ $full_bytes ] ) & $mask ) ) {
				return false;
			}
		}

			return true;
	}

	public static function sanitize_ip_or_cidr( $value ): string {
		$value = trim( (string) $value );

		if ( '' === $value ) {
			return '';
		}

		if ( filter_var( $value, FILTER_VALIDATE_IP ) ) {
			return $value;
		}

		if ( strpos( $value, '/' ) !== false ) {
			[ $ip, $prefix ] = explode( '/', $value, 2 );
			$prefix          = (int) $prefix;

			if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) && $prefix >= 0 && $prefix <= 32 ) {
				return $ip . '/' . $prefix;
			}

			if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) && $prefix >= 0 && $prefix <= 128 ) {
				return $ip . '/' . $prefix;
			}
		}

		return '';
	}

	public static function is_valid_ip_or_cidr( string $entry ): bool {
		if ( strpos( $entry, '/' ) !== false ) {
			return self::is_valid_cidr( $entry );
		}

		return filter_var( $entry, FILTER_VALIDATE_IP ) !== false;
	}

	public static function is_valid_cidr( string $cidr ): bool {
		$parts = explode( '/', $cidr );

		if ( count( $parts ) !== 2 ) {
			return false;
		}

		list( $ip, $mask ) = $parts;

		if ( ! filter_var( $ip, FILTER_VALIDATE_IP ) ) {
			return false;
		}

		$mask = (int) $mask;

		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
			return $mask >= 0 && $mask <= 32;
		}

		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
			return $mask >= 0 && $mask <= 128;
		}

		return false;
	}

	public static function cidr_to_ip( string $entry ): string {
		if ( strpos( $entry, '/' ) !== false && self::is_valid_cidr( $entry ) ) {
			$parts = explode( '/', $entry );

			if ( count( $parts ) !== 2 ) {
				return '';
			}

			return $parts[0];
		}

		if ( filter_var( $entry, FILTER_VALIDATE_IP ) ) {
			return $entry;
		}

		return '';
	}
}
