<?php namespace Bromate\SecurityApiFirewall\Security\IpEntry;

defined( 'ABSPATH' ) || exit;


class ClientIpResolver {

	private static ?string $cached_ip = null;

	public static function get_client_ip(): string {
		if ( null !== self::$cached_ip ) {
			return self::$cached_ip;
		}

		$ip = self::resolve_ip_from_headers();

		self::$cached_ip = $ip;

		return $ip;
	}

	private static function resolve_ip_from_headers(): string {
		$headers = self::get_headers();

			if ( ! isset( $headers[ 'REMOTE_ADDR' ] ) || empty( $headers[ 'REMOTE_ADDR' ] ) ) {
				return '';
			}

			$raw_ip = $headers[ 'REMOTE_ADDR' ];

			if ( strpos( $raw_ip, ',' ) !== false ) {
				$ips = array_map( 'trim', explode( ',', $raw_ip ) );
				foreach ( $ips as $ip ) {
					$validated_ip = self::validate_ip( $ip );
					if ( $validated_ip ) {
						return $validated_ip;
					}
				}
			} else {
				$validated_ip = self::validate_ip( $raw_ip );
				if ( $validated_ip ) {
					return $validated_ip;
				}
			}
		

		return '';
	}

	private static function validate_ip( string $ip ) {
		$ip = trim( $ip );

		if ( empty( $ip ) ) {
			return false;
		}

		return filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6 );
	}

	private static function get_headers(): array {
		$headers = array();

			if ( isset( $_SERVER[ 'REMOTE_ADDR' ] ) ) {
				$value = sanitize_text_field( wp_unslash( $_SERVER[ 'REMOTE_ADDR' ] ) );
				if ( ! empty( $value ) ) {
					$headers[ 'REMOTE_ADDR' ] = $value;
				}
			}
	

		if ( function_exists( 'getallheaders' ) ) {
			$all_headers = getallheaders();
			if ( is_array( $all_headers ) ) {
				
					$key = str_replace( '_', '-', 'REMOTE_ADDR' );
					$key = strtolower( $key );

					foreach ( $all_headers as $name => $value ) {
						$value = sanitize_text_field( wp_unslash( $_SERVER[ 'REMOTE_ADDR' ] ) );
						if ( strtolower( $name ) === $key && ! empty( $value ) ) {
							$headers[ 'REMOTE_ADDR' ] =  $value;
							break;
						}
					}
				
			}
		}

		return $headers;
	}
}
