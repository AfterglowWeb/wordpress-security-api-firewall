<?php namespace Bromate\SecurityApiFirewall\Security\IpEntry;

defined( 'ABSPATH' ) || exit;

class ClientIpResolver {

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
}
