<?php namespace Bromate\SecurityApiFirewall\Security\Authentication;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Logs\Logger;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\JWK;
use Throwable;
use Exception;

class JwtAuthentication {

	const USER_SUBCLAIM_METAKEY    = 'jwt_subclaim';
	const JWKS_KEYS_OPTION         = 'bromate_security_api_firewall_jwt_keys';
	const KEY_GRACE_PERIOD_SECONDS = 7 * DAY_IN_SECONDS;

	public static function validate_bearer_jwt( array $config ): bool {
		$token = self::extract_bearer_token();

		if ( empty( $token ) ) {
			return false;
		}

		$algorithm  = $config['algorithm'] ?? 'RS256';
		$public_key = $config['public_key'] ?? '';
		$jwks_url   = $config['jwks_url'] ?? '';
		$audience   = $config['audience'] ?? '';
		$issuer     = $config['issuer'] ?? '';

		JWT::$leeway = 60;

		$decoded = null;

		try {
			if ( ! empty( $jwks_url ) ) {
				$jwks = self::get_remote_jwks( $jwks_url );

				if ( ! empty( $jwks ) ) {
					$keys    = JWK::parseKeySet( $jwks, $algorithm );
					$decoded = JWT::decode( $token, $keys );
				}
			}

			if ( null === $decoded && ! empty( $public_key ) ) {
				$decoded = JWT::decode( $token, new Key( $public_key, $algorithm ) );
			}

			if ( null === $decoded ) {
				$jwks = self::build_jwks( true );
				if ( ! empty( $jwks['keys'] ) ) {
					$keys    = JWK::parseKeySet( $jwks, $algorithm );
					$decoded = JWT::decode( $token, $keys );
				}
			}
		} catch ( Throwable $e ) {
			Logger::log( 'jwt_auth_failed', 'warning', (array) $e );
			return false;
		}

		if ( null === $decoded ) {
			return false;
		}

		if ( ! empty( $audience ) && ( $decoded->aud ?? null ) !== $audience ) {
			return false;
		}

		if ( ! empty( $issuer ) && ( $decoded->iss ?? null ) !== $issuer ) {
			return false;
		}

		$user_id = self::get_user_id_from_subclaim( $decoded->sub ?? '' );
		if ( 0 === $user_id || ! self::validate_user_subclaim( $user_id, $decoded->sub ?? '' ) ) {
			return false;
		}

		return true;
	}

	private static function get_remote_jwks( string $url ): array {
		try {
			$response = wp_remote_get(
				$url,
				array(
					'timeout' => 10,
					'headers' => array(
						'Accept' => 'application/json',
					),
				)
			);

			if ( is_wp_error( $response ) ) {
				return array();
			}

			$body = wp_remote_retrieve_body( $response );
			$data = json_decode( $body, true );

			if ( ! is_array( $data ) || empty( $data['keys'] ) ) {
				return array();
			}

			return $data;
		} catch ( Throwable $e ) {
			return array();
		}
	}

	public static function create_user_subclaim( int $user_id, array $options = array() ): string {
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return '';
		}

		$options = wp_parse_args(
			$options,
			array(
				'force_new'          => false,
				'meta_key'           => self::USER_SUBCLAIM_METAKEY,
				'prefix'             => 'user',
				'include_user_login' => true,
				'include_user_email' => false,
			)
		);

		if ( ! $options['force_new'] ) {
			$existing_subclaim = get_user_meta( $user_id, $options['meta_key'], true );
			if ( ! empty( $existing_subclaim ) && is_string( $existing_subclaim ) ) {
				return $existing_subclaim;
			}
		}

		$components   = array();
		$components[] = $options['prefix'];
		$components[] = $user_id;
		$components[] = time();
		$components[] = bin2hex( random_bytes( 16 ) );

		if ( $options['include_user_login'] ) {
			$components[] = sanitize_title( $user->user_login );
		}

		if ( $options['include_user_email'] ) {
			$components[] = hash( 'sha256', $user->user_email );
		}

		$subclaim = implode( '_', $components );

		$updated = update_user_meta( $user_id, $options['meta_key'], $subclaim );
		if ( ! $updated ) {
			return '';
		}

		return $subclaim;
	}

	// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation.functions.base64_encode -- Required by RFC 7518 for JWK modulus/exponent encoding;
	private static function base64url_encode( string $data ): string {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}

	private static function extract_bearer_token(): string {

		$auth = isset( $_SERVER['HTTP_AUTHORIZATION'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) ) : '';

		if ( empty( $auth ) && function_exists( 'getallheaders' ) ) {
			$headers = getallheaders();
			$auth    = $headers['Authorization'] ?? $headers['authorization'] ?? '';
		}

		if ( ! is_string( $auth ) || stripos( $auth, 'bearer ' ) !== 0 ) {
			return '';
		}

		return trim( substr( $auth, 7 ) );
	}

	private static function get_user_subclaim( int $user_id ): string {
		$subclaim = get_user_meta( $user_id, self::USER_SUBCLAIM_METAKEY, true );
		return is_string( $subclaim ) && ! empty( $subclaim ) ? $subclaim : '';
	}

	private static function delete_user_subclaim( int $user_id ): bool {
		return delete_user_meta( $user_id, self::USER_SUBCLAIM_METAKEY );
	}

	private static function get_user_id_from_subclaim( string $subclaim ): int {
		$parts = explode( '_', $subclaim );

		if ( count( $parts ) >= 2 ) {
			$user_id = filter_var( $parts[1], FILTER_VALIDATE_INT );
			if ( false !== $user_id ) {
				return $user_id;
			}
		}

		$authorized_users = SettingsRepository::read_option( 'auth_users' );
		if ( empty( $authorized_users ) ) {
			return 0;
		}

		$users = array_values(
			array_filter(
				$authorized_users,
				function ( $authorized_user ) use ( $subclaim ) {
					return ( $authorized_user[ self::USER_SUBCLAIM_METAKEY ] ?? '' ) === $subclaim;
				}
			)
		);

		return 1 === count( $users ) ? (int) $users[0] : 0;
	}

	private static function validate_user_subclaim( int $user_id, string $subclaim ): bool {
		$stored_subclaim = self::get_user_subclaim( $user_id );
		return $stored_subclaim === $subclaim;
	}

	private static function regenerate_user_subclaim( int $user_id ): string {
		self::delete_user_subclaim( $user_id );
		return self::create_user_subclaim( $user_id );
	}

	public static function create_key_pair( bool $keep_previous_for_grace_period = true ): array {
		if ( ! extension_loaded( 'openssl' ) ) {
			throw new Exception( 'OpenSSL extension is not loaded. Please enable it in your PHP configuration.' );
		}

		$openssl_version = OPENSSL_VERSION_TEXT;
		if ( empty( $openssl_version ) ) {
			throw new Exception( 'OpenSSL is not properly configured.' );
		}

		$config = array(
			'digest_alg'       => 'sha256',
			'private_key_bits' => 2048,
			'private_key_type' => OPENSSL_KEYTYPE_RSA,
			'config'           => self::get_openssl_config_path(),
		);

		$private_key_resource = openssl_pkey_new( $config );

		if ( false === $private_key_resource ) {
			$message = sanitize_text_field( openssl_error_string() );
			$error   = $message ? $message : '';

			throw new Exception( 'Failed to generate key pair: ' . esc_attr( $error ) );
		}

		$private_key_pem = '';
		if ( ! openssl_pkey_export( $private_key_resource, $private_key_pem, null, $config ) ) {
			$error = sanitize_text_field( openssl_error_string() );
			throw new Exception( 'Failed to export private key: ' . esc_attr( $error ? $error : 'Unknown error' ) );
		}

		$key_details = openssl_pkey_get_details( $private_key_resource );
		if ( false === $key_details || ! isset( $key_details['key'] ) ) {
			$error = sanitize_text_field( openssl_error_string() );
			throw new Exception( 'Failed to extract public key: ' . esc_attr( $error ? $error : 'Unknown error' ) );
		}

		$public_key_pem    = $key_details['key'];
		$encrypted_private = self::encrypt_private_key( $private_key_pem );
		$kid               = self::generate_kid();

		$keys = self::get_all_key_records();

		if ( $keep_previous_for_grace_period ) {
			$now = time();
			foreach ( $keys as &$existing ) {
				if ( null === ( $existing['expires_at'] ?? null ) ) {
					$existing['expires_at'] = $now + self::KEY_GRACE_PERIOD_SECONDS;
				}
			}
			unset( $existing );
		} else {
			$keys = array();
		}

		$keys = array_values(
			array_filter(
				$keys,
				function ( $k ) {
					return ( $k['expires_at'] ?? null ) === null || $k['expires_at'] > time();
				}
			)
		);

		$new_record = array(
			'kid'         => $kid,
			'algorithm'   => 'RS256',
			'public_pem'  => $public_key_pem,
			'private_enc' => $encrypted_private,
			'created_at'  => time(),
			'expires_at'  => null,
		);

		array_unshift( $keys, $new_record );

		$updated = update_option( self::JWKS_KEYS_OPTION, $keys );
		if ( ! $updated ) {
			throw new Exception( 'Failed to store key pair in database.' );
		}

		return array(
			'kid'     => $kid,
			'private' => $encrypted_private,
			'public'  => $public_key_pem,
		);
	}

	private static function generate_kid(): string {
		return bin2hex( random_bytes( 8 ) );
	}

	private static function get_openssl_config_path(): ?string {
		$possible_paths = array(
			'/etc/ssl/openssl.cnf',
			'/etc/pki/tls/openssl.cnf',
			'/usr/local/ssl/openssl.cnf',
			'/usr/local/etc/openssl/openssl.cnf',
			'/usr/local/openssl/openssl.cnf',
			'/opt/local/etc/openssl/openssl.cnf',
			'/etc/openssl/openssl.cnf',
		);

		foreach ( $possible_paths as $path ) {
			if ( file_exists( $path ) ) {
				return $path;
			}
		}

		$env_path = getenv( 'OPENSSL_CONF' );
		if ( $env_path && file_exists( $env_path ) ) {
			return $env_path;
		}

		if ( strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ) {
			$windows_paths = array(
				'C:/Program Files/OpenSSL-Win64/bin/openssl.cfg',
				'C:/Program Files/OpenSSL-Win32/bin/openssl.cfg',
				'C:/OpenSSL-Win64/bin/openssl.cfg',
				'C:/OpenSSL-Win32/bin/openssl.cfg',
			);
			foreach ( $windows_paths as $path ) {
				if ( file_exists( $path ) ) {
					return $path;
				}
			}
		}

		return null;
	}

	private static function encrypt_private_key( string $private_key ): string {
		$encryption_key = wp_salt( 'auth' ) . wp_salt( 'secure_auth' );
		$encryption_key = hash( 'sha256', $encryption_key, true );

		$iv = openssl_random_pseudo_bytes( 16 );
		if ( false === $iv ) {
			throw new Exception( 'Failed to generate encryption IV.' );
		}

		$encrypted_private = openssl_encrypt(
			$private_key,
			'AES-256-CBC',
			$encryption_key,
			0,
			$iv
		);

		if ( false === $encrypted_private ) {
			$openssl_error = sanitize_text_field( openssl_error_string() );
			throw new Exception( 'Failed to encrypt private key: ' . esc_attr( $openssl_error ) );
		}

		return bin2hex( $iv . $encrypted_private );
	}

	private static function decrypt_private_key_pem( string $encrypted_data ): ?string {
		$encryption_key = wp_salt( 'auth' ) . wp_salt( 'secure_auth' );
		$encryption_key = hash( 'sha256', $encryption_key, true );

		$decoded = hex2bin( $encrypted_data );
		if ( false === $decoded || strlen( $decoded ) < 16 ) {
			return null;
		}

		$iv        = substr( $decoded, 0, 16 );
		$encrypted = substr( $decoded, 16 );

		$private_key = openssl_decrypt(
			$encrypted,
			'AES-256-CBC',
			$encryption_key,
			0,
			$iv
		);

		return false !== $private_key ? $private_key : null;
	}

	private static function get_all_key_records(): array {
		$keys = get_option( self::JWKS_KEYS_OPTION, array() );
		return is_array( $keys ) ? $keys : array();
	}

	public static function get_active_key_record(): ?array {
		foreach ( self::get_all_key_records() as $record ) {
			if ( null === ( $record['expires_at'] ?? null ) ) {
				return $record;
			}
		}
		return null;
	}

	public static function get_active_private_key(): ?string {
		$record = self::get_active_key_record();
		if ( ! $record ) {
			return null;
		}
		return self::decrypt_private_key_pem( $record['private_enc'] );
	}

	public static function get_active_kid(): ?string {
		return self::get_active_key_record()['kid'] ?? null;
	}

	public static function get_public_key(): ?string {
		$record = self::get_active_key_record();
		return $record['public_pem'] ?? null;
	}

	public static function has_key_pair(): bool {
		return null !== self::get_active_key_record();
	}

	public static function get_key_pair_summary(): array {
		$now      = time();
		$active   = null;
		$rotating = array();

		foreach ( self::get_all_key_records() as $record ) {
			$is_active = null === ( $record['expires_at'] ?? null );

			if ( $is_active ) {
				$active = array(
					'kid'        => $record['kid'],
					'public_key' => $record['public_pem'],
					'created_at' => $record['created_at'],
				);
				continue;
			}

			if ( $record['expires_at'] > $now ) {
				$rotating[] = array(
					'kid'        => $record['kid'],
					'created_at' => $record['created_at'],
					'expires_at' => $record['expires_at'],
				);
			}
		}

		return array(
			'active'   => $active,
			'rotating' => $rotating,
		);
	}

	public static function delete_key_pair(): bool {
		return update_option( self::JWKS_KEYS_OPTION, array() );
	}

	public static function build_jwks( bool $include_grace_period_keys = false ): array {
		$now  = time();
		$keys = array();

		foreach ( self::get_all_key_records() as $record ) {
			$expires_at = isset( $record['expires_at'] ) ? $record['expires_at'] : null;
			$is_active  = null === $expires_at;
			$in_grace   = null !== $expires_at && $expires_at > $now;

			if ( ! $is_active && ! ( $include_grace_period_keys && $in_grace ) ) {
				continue;
			}

			$jwk = self::pem_to_jwk( $record['public_pem'], $record['kid'], $record['algorithm'] ?? 'RS256' );
			if ( ! empty( $jwk ) ) {
				$keys[] = $jwk;
			}
		}

		return array( 'keys' => $keys );
	}

	private static function pem_to_jwk( string $pem, string $kid, string $algorithm = 'RS256' ): array {
		$resource = openssl_pkey_get_public( $pem );
		if ( false === $resource ) {
			return array();
		}

		$details = openssl_pkey_get_details( $resource );
		if ( false === $details || ! isset( $details['rsa']['n'], $details['rsa']['e'] ) ) {
			return array();
		}

		return array(
			'kty' => 'RSA',
			'use' => 'sig',
			'alg' => $algorithm,
			'kid' => $kid,
			'n'   => self::base64url_encode( $details['rsa']['n'] ),
			'e'   => self::base64url_encode( $details['rsa']['e'] ),
		);
	}
}
