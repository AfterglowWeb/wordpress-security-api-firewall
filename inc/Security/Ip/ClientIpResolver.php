<?php namespace Bromate\SecurityApiFirewall\Security\Ip;

defined( 'ABSPATH' ) || exit;


class ClientIpResolver {

	private const IP_HEADERS = array(
		'HTTP_CF_CONNECTING_IP',       // Cloudflare.
		'HTTP_X_REAL_IP',              // Nginx/Apache.
		'HTTP_X_FORWARDED_FOR',        // Standard proxy header.
		'HTTP_X_CLUSTER_CLIENT_IP',    // Cluster environments.
		'HTTP_X_FORWARDED',            // Alternative forward header.
		'HTTP_FORWARDED_FOR',          // Alternative forward header.
		'HTTP_FORWARDED',              // Alternative forward header.
		'REMOTE_ADDR',                 // Fallback.
	);

	private static ?string $cached_ip = null;

	public static function get_client_ip( bool $skip_validation = false ): string {
		if ( null !== self::$cached_ip ) {
			return self::$cached_ip;
		}

		$ip = self::resolve_ip_from_headers( $skip_validation );

		self::$cached_ip = $ip;

		return $ip;
	}

	private static function resolve_ip_from_headers( bool $skip_validation ): string {
		$headers = self::get_headers();

		foreach ( self::IP_HEADERS as $header ) {
			if ( ! isset( $headers[ $header ] ) || empty( $headers[ $header ] ) ) {
				continue;
			}

			$raw_ip = $headers[ $header ];

			if ( strpos( $raw_ip, ',' ) !== false ) {
				$ips = array_map( 'trim', explode( ',', $raw_ip ) );
				foreach ( $ips as $ip ) {
					$validated_ip = self::validate_ip( $ip, $skip_validation );
					if ( $validated_ip ) {
						return $validated_ip;
					}
				}
			} else {
				$validated_ip = self::validate_ip( $raw_ip, $skip_validation );
				if ( $validated_ip ) {
					return $validated_ip;
				}
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

		foreach ( self::IP_HEADERS as $header ) {
			if ( isset( $_SERVER[ $header ] ) ) {
				$value = sanitize_text_field( wp_unslash( $_SERVER[ $header ] ) );
				if ( ! empty( $value ) ) {
					$headers[ $header ] = $value;
				}
			}
		}

		if ( function_exists( 'getallheaders' ) ) {
			$all_headers = getallheaders();
			if ( is_array( $all_headers ) ) {
				foreach ( self::IP_HEADERS as $header ) {
					$key = str_replace( 'HTTP_', '', $header );
					$key = str_replace( '_', '-', $key );
					$key = strtolower( $key );

					foreach ( $all_headers as $name => $value ) {
						if ( strtolower( $name ) === $key && ! empty( $value ) ) {
							$headers[ $header ] = sanitize_text_field( wp_unslash( $value ) );
							break;
						}
					}
				}
			}
		}

		return $headers;
	}
}
