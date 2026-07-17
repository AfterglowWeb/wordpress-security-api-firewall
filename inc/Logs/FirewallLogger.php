<?php namespace Bromate\SecurityApiFirewall\Logs;

defined( 'ABSPATH' ) || exit;

final class FirewallLogger {

	public static function log(
		string $event,
		string $severity = 'info',
		array $details = array(),
		string $ip = '',
		array $context = array()
	): bool {

		$result = false;
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
				array(
					'event'    => $event,
					'severity' => $severity,
					'details' => $details,
					'ip'      => $ip,
					'context'  => ! empty( $context ) ? $context : null,
				)
			);
		}
		return $result;
	}

	public static function ip_entry_created( string $ip, int $user_id, string $ip_created, int $entry_id, string $list_type ): bool {
		return self::log(
			'ip_entry_created',
			'info',
			array(
				'reason' => sprintf(__('Entry created by user %d',''), $user_id),
				'extra' => array(
					'entry_id'  => $entry_id,
					'ip'        => $ip_created,
					'list_type' => $list_type,
				)
			),
			$ip
		);
	}

	public static function ip_entry_deleted(string $ip, int $user_id, string $ip_deleted, int $entry_id, int $list_type ): bool {
		return self::log(
			'ip_entry_deleted',
			'info',
			array(
				'reason' => sprintf(__('Entry deleted by user %d',''), $user_id),
				'extra' => array(
					'entry_id'   => $entry_id,
					'ip'        => $ip_deleted,
					'list_type' => $list_type,
				)
			),
			$ip
		);
	}
}
