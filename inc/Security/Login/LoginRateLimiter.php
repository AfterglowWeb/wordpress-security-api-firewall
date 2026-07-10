<?php namespace Bromate\SecurityApiFirewall\Security\Login;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Security\IpEntry\IpEntryRepository;
use Bromate\SecurityApiFirewall\Security\IpEntry\CidrMatcher;
use Bromate\SecurityApiFirewall\Security\IpEntry\ClientIpResolver;

final class LoginRateLimiter {

	public const  BLOCK_PREFIX  = 'rest_firewall_login_blocked_';
	public const  STRIKE_PREFIX = 'rest_firewall_login_strikes_';
	private const COUNT_PREFIX  = 'rest_firewall_login_';

	protected static ?self $instance = null;

	public static function get_instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_filter( 'authenticate', array( $this, 'check_before_auth' ), 5, 1 );
		add_action( 'wp_login_failed', array( $this, 'on_login_failed' ), 10 );
	}

	public function check_before_auth( $user ) {
		if ( ! $this->is_enabled() ) {
			return $user;
		}

		$ip = ClientIpResolver::get_client_ip();
		if ( '' === $ip || $this->is_whitelisted( $ip ) ) {
			return $user;
		}

		if ( get_transient( self::BLOCK_PREFIX . self::ip_hash( $ip ) ) ) {
			return new \WP_Error(
				'too_many_login_attempts',
				__( 'Too many failed login attempts. Please try again later.', 'bromate-security-api-firewall' )
			);
		}

		return $user;
	}

	public function on_login_failed(): void {
		if ( ! $this->is_enabled() ) {
			return;
		}

		$ip = ClientIpResolver::get_client_ip();
		if ( '' === $ip || $this->is_whitelisted( $ip ) ) {
			return;
		}

		$hash = self::ip_hash( $ip );

		if ( get_transient( self::BLOCK_PREFIX . $hash ) ) {
			return;
		}

		$opts      = $this->get_options();
		$count_key = self::COUNT_PREFIX . $hash;
		$count     = (int) get_transient( $count_key );
		++$count;

		if ( $count >= $opts['attempts'] ) {
			set_transient( self::BLOCK_PREFIX . $hash, $ip, $opts['blacklist_time'] );
			delete_transient( $count_key );

			if ( $opts['promote_after'] > 0 ) {
				$strike_key = self::STRIKE_PREFIX . $hash;
				$strikes    = (int) get_transient( $strike_key ) + 1;

				if ( $strikes >= $opts['promote_after'] ) {
					$this->promote_to_global_blacklist( $ip, $opts['blacklist_time'] );
					delete_transient( $strike_key );
				} else {
					set_transient( $strike_key, $strikes, $opts['blacklist_time'] * ( $opts['promote_after'] + 1 ) );
				}
			}
		} else {
			set_transient( $count_key, $count, $opts['window'] );
		}
	}

	private function is_enabled(): bool {
		return (bool) SettingsRepository::read_option( 'login_rate_limit_enabled' );
	}

	private function get_options(): array {
		$opts = SettingsRepository::read_options();
		return array(
			'attempts'       => max( 1, (int) ( $opts['login_rate_limit_attempts'] ?? 5 ) ),
			'window'         => max( 1, (int) ( $opts['login_rate_limit_window'] ?? 300 ) ),
			'blacklist_time' => max( 1, (int) ( $opts['login_rate_limit_blacklist_time'] ?? 3600 ) ),
			'promote_after'  => max( 0, (int) ( $opts['login_rate_limit_promote_after'] ?? 0 ) ),
		);
	}

	public static function ip_hash( string $ip ): string {
		return substr( hash( 'sha256', $ip ), 0, 16 );
	}

	private function promote_to_global_blacklist( string $ip, int $duration ): void {
		if ( ! class_exists( IpEntryRepository::class ) ) {
			return;
		}

		if ( IpEntryRepository::ip_in_list( $ip, 'global_blacklist' ) ) {
			return;
		}

		IpEntryRepository::insert(
			array(
				'ip'           => $ip,
				'list_type'    => 'global_blacklist',
				'entry_origin' => 'rate_limit',
				'expires_at'   => gmdate( 'Y-m-d H:i:s', time() + $duration ),
			)
		);
	}


	private function is_whitelisted( string $ip ): bool {
		$whitelist = array_filter( (array) SettingsRepository::read_option( 'absolute_whitelist' ) );

		foreach ( $whitelist as $entry ) {
			if ( CidrMatcher::ip_matches( $ip, (string) $entry ) ) {
				return true;
			}
		}

		return false;
	}
}
