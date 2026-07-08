<?php namespace Bromate\SecurityApiFirewall\Security\Ip;

defined( 'ABSPATH' ) || exit;

final class CidrMatcher {

	public static function ip_matches( string $ip, string $entry ): bool {
		// Plain IP — exact match.
		if ( strpos( $entry, '/' ) === false ) {
			return $ip === $entry;
		}

		[ $network, $prefix ] = explode( '/', $entry, 2 );
		$prefix               = (int) $prefix;
		$ip_bin               = inet_pton( $ip );
		$net_bin              = inet_pton( $network );

		// Both must be valid and the same address family.
		if ( false === $ip_bin || false === $net_bin || strlen( $ip_bin ) !== strlen( $net_bin ) ) {
			return false;
		}

		if ( $prefix <= 0 ) {
			return true; // /0 matches everything.
		}

		$max_bits    = strlen( $ip_bin ) * 8;
		$prefix      = min( $prefix, $max_bits );
		$full_bytes  = intdiv( $prefix, 8 );
		$remain_bits = $prefix % 8;

		// Compare the unambiguous full bytes.
		if ( $full_bytes > 0 && substr( $ip_bin, 0, $full_bytes ) !== substr( $net_bin, 0, $full_bytes ) ) {
			return false;
		}

		// Compare the partial byte at the boundary (if any).
		if ( $remain_bits > 0 ) {
			$mask = 0xFF & ( 0xFF << ( 8 - $remain_bits ) );
			if ( ( ord( $ip_bin[ $full_bytes ] ) & $mask ) !== ( ord( $net_bin[ $full_bytes ] ) & $mask ) ) {
				return false;
			}
		}

		return true;
	}

	public static function sanitize_ip_array( $value ): string {
		$value = trim( (string) $value );

		if ( '' === $value ) {
			return '';
		}

		// Plain IP address (IPv4 or IPv6).
		if ( filter_var( $value, FILTER_VALIDATE_IP ) ) {
			return $value;
		}

		// CIDR notation: validate network address and prefix length.
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
}
