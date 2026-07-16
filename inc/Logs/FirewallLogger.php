<?php namespace Bromate\SecurityApiFirewall\Logs;

defined( 'ABSPATH' ) || exit;

final class FirewallLogger {

	public static function log(
		string $event,
		string $severity = 'info',
		array $context = array(),
		array $override = array()
	): bool {

		if(in_array($event, [
			'ip_blocked',
			'ip_rate_limited',
			'ip_banned',
			'ip_whitelisted_bypass',
			'ip_entry_created',
			'ip_entry_deleted',
			'expired_ip_entry_cleanup',
			'auth_success',
			'auth_failed',
			'auth_revoked',
			'admin_login_success',
			'admin_login_failed',
			'admin_login_rate_limited',
			'admin_login_banned',
			'emergency_token_used',
			'plugin_settings_changed',

		])) {
			return LogRepository::insert(
				array_merge(
					array(
						'event'    => $event,
						'severity' => $severity,
						'context'  => ! empty( $context ) ? $context : null,
					),
					$override
				)
			);
		}
	}

	public static function ip_blocked( string $ip, string $reason, array $extra = array() ): bool {
		return self::log( 'ip_blocked', 'warning', array_merge( array( 'reason' => $reason ), $extra ), array( 'ip' => $ip ) );
	}

	public static function ip_whitelist_bypass( string $ip, string $reason, array $extra = array() ): bool {
		return self::log( 'ip_whitelist_bypass', 'info', array_merge( array( 'reason' => $reason ), $extra ), array( 'ip' => $ip ) );
	}

	public static function ip_banned( string $ip, int $violations, array $extra = array() ): bool {
		return self::log( 'ip_banned', 'error', array_merge( array( 'violations' => $violations ), $extra ), array( 'ip' => $ip ) );
	}

	public static function ip_rate_limited( string $ip, int $count, int $threshold ): bool {
		return self::log( 'ip_rate_limited', 'warning', array( 'count' => $count, 'threshold' => $threshold), array( 'ip' => $ip ));
	}

	public static function auth_failed( string $reason, ?int $user_id = null ): bool {
		return self::log( 'auth_failed', 'warning', array( 'reason' => $reason ), $user_id ? array( 'user_id' => $user_id ) : array() );
	}

	public static function auth_success( string $ip, bool $success ): bool {
		return self::log( 'auth_success', $success ? 'success' : 'error', array( 'success' => $success ), array( 'ip' => $ip ) );
	}

	public static function emergency_token_used( string $ip, bool $success ): bool {
		return self::log( 'emergency_token_used', $success ? 'warning' : 'error', array( 'success' => $success ) );
	}

	public static function admin_login_failed( string $ip, string $username ): bool {
		return self::log( 'admin_login_failed', 'warning', array( 'username' => $username ), array( 'ip' => $ip ) );
	}

	public static function admin_login_success( string $ip,  $user_id ): bool {
		return self::log( 'admin_login_success', 'info', array(), array( 'user_id' => $user_id ), array( 'ip' => $ip ) );
	}

	public static function settings_changed( string $ip, int $user_id, array $changed_keys ): bool {
		return self::log( 'settings_changed', 'info', array( 'changed_keys' => $changed_keys ), array( 'user_id' => $user_id ), array( 'ip' => $ip ) );
	}

	public static function ip_entry_created( string $ip, int $entry_id, string $list_type ): bool {
		return self::log(
			'ip_entry_created',
			'info',
			array(
				'ip'        => $ip,
				'list_type' => $list_type,
			),
			array(
				'object_type' => 'ip_entry',
				'object_id'   => $entry_id,
			)
		);
	}

	public static function ip_entry_deleted(string $ip,  int $entry_id ): bool {
		return self::log(
			'ip_entry_deleted',
			'info',
			array( 'ip' => $ip ),
			array(
				'object_type' => 'ip_entry',
				'object_id'   => $entry_id,
			)
		);
	}
}
