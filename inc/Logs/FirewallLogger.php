<?php namespace Bromate\SecurityApiFirewall\Logs;

defined( 'ABSPATH' ) || exit;

final class FirewallLogger {

	const IP_BLOCKED               = 'ip_blocked';
	const IP_RATE_LIMITED          = 'ip_rate_limited';
	const IP_BANNED                = 'ip_banned';
	const IP_WHITELISTED_BYPASS    = 'ip_whitelisted_bypass';
	const EMERGENCY_TOKEN_USED     = 'emergency_token_used';
	const AUTH_SUCCESS             = 'auth_success';
	const AUTH_FAILED              = 'auth_failed';
	const AUTH_REVOKED             = 'auth_revoked';
	const ADMIN_LOGIN_SUCCESS      = 'admin_login_success';
	const ADMIN_LOGIN_FAILED       = 'admin_login_failed';
	const ADMIN_LOGIN_RATE_LIMITED = 'admin_login_rate_limited';
	const ADMIN_LOGIN_BANNED       = 'admin_login_banned';
	const SETTINGS_CHANGED         = 'settings_changed';
	const IP_ENTRY_CREATED         = 'ip_entry_created';
	const IP_ENTRY_DELETED         = 'ip_entry_deleted';
	const EXPIRED_ENTRY_CLEANUP    = 'expired_entry_cleanup';

	public static function log(
		string $event,
		string $severity = 'info',
		array $context = array(),
		array $override = array()
	): bool {
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

	public static function ip_blocked( string $ip, string $reason, array $extra = array() ): bool {
		return self::log( self::IP_BLOCKED, 'warning', array_merge( array( 'reason' => $reason ), $extra ), array( 'ip' => $ip ) );
	}

	public static function ip_banned( string $ip, int $violations, array $extra = array() ): bool {
		return self::log( self::IP_BANNED, 'error', array_merge( array( 'violations' => $violations ), $extra ), array( 'ip' => $ip ) );
	}

	public static function ip_rate_limited( string $ip, int $count, int $threshold ): bool {
		return self::log(
			self::IP_RATE_LIMITED,
			'warning',
			array(
				'count'     => $count,
				'threshold' => $threshold,
			),
			array( 'ip' => $ip )
		);
	}

	public static function auth_failed( string $reason, ?int $user_id = null ): bool {
		return self::log( self::AUTH_FAILED, 'warning', array( 'reason' => $reason ), $user_id ? array( 'user_id' => $user_id ) : array() );
	}

	public static function auth_success( bool $success ): bool {
		return self::log( self::AUTH_SUCCESS, $success ? 'success' : 'error', array( 'success' => $success ) );
	}

	public static function emergency_token_used( bool $success ): bool {
		return self::log( self::EMERGENCY_TOKEN_USED, $success ? 'warning' : 'error', array( 'success' => $success ) );
	}

	public static function admin_login_failed( string $username ): bool {
		return self::log( self::ADMIN_LOGIN_FAILED, 'warning', array( 'username' => $username ) );
	}

	public static function admin_login_success( int $user_id ): bool {
		return self::log( self::ADMIN_LOGIN_SUCCESS, 'info', array(), array( 'user_id' => $user_id ) );
	}

	public static function settings_changed( int $user_id, array $changed_keys ): bool {
		return self::log( self::SETTINGS_CHANGED, 'info', array( 'changed_keys' => $changed_keys ), array( 'user_id' => $user_id ) );
	}

	public static function ip_entry_created( int $entry_id, string $ip, string $list_type ): bool {
		return self::log(
			self::IP_ENTRY_CREATED,
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

	public static function ip_entry_deleted( int $entry_id, string $ip ): bool {
		return self::log(
			self::IP_ENTRY_DELETED,
			'info',
			array( 'ip' => $ip ),
			array(
				'object_type' => 'ip_entry',
				'object_id'   => $entry_id,
			)
		);
	}
}
