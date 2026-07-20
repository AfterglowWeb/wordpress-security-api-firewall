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
		$event = LogRepository::sanitize_event($event);
		$severity = LogRepository::sanitize_severity( $severity );
		
		return LogRepository::insert(
			array(
				'event'    => $event,
				'severity' => $severity,
				'details' => $details,
				'ip'      => $ip,
				'context'  => ! empty( $context ) ? $context : null,
			)
		);
		
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
