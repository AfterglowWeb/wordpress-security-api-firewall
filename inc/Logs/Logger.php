<?php namespace Bromate\SecurityApiFirewall\Logs;

use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpUtils;

defined( 'ABSPATH' ) || exit;

final class Logger {

	public static function log(
		string $event,
		string $severity = 'info',
		array $details = array(),
		string $ip = '',
	): bool {

		$event    = LogsRepository::sanitize_event( $event );
		$severity = LogsRepository::sanitize_severity( $severity );
		$ip       = ! empty( $ip ) && IpUtils::is_valid_ip_or_cidr( $ip ) ? IpUtils::sanitize_ip_or_cidr( $ip ) : IpUtils::get_client_ip();

		return LogsRepository::insert(
			array(
				'event'    => $event,
				'severity' => $severity,
				'details'  => $details,
				'ip'       => $ip,
			)
		);
	}

	public static function ip_entry_created( string $ip, int $user_id, string $ip_created, int $entry_id, string $list_type ): bool {
		return self::log(
			'ip_entry_created',
			'info',
			array(
				/* translators: %d is the user ID. */
				'reason' => sprintf( esc_html__( 'Entry created by user %d', 'bromate-security-api-firewall' ), $user_id ),
				'extra'  => array(
					'entry_id'  => $entry_id,
					'ip'        => $ip_created,
					'list_type' => $list_type,
				),
			),
			$ip
		);
	}

	public static function ip_entry_deleted( string $ip, int $user_id, string $ip_deleted, int $entry_id, int $list_type ): bool {
		return self::log(
			'ip_entry_deleted',
			'info',
			array(
				/* translators: %d is the user ID. */
				'reason' => sprintf( esc_html__( 'Entry deleted by user %d', 'bromate-security-api-firewall' ), $user_id ),
				'extra'  => array(
					'entry_id'  => $entry_id,
					'ip'        => $ip_deleted,
					'list_type' => $list_type,
				),
			),
			$ip
		);
	}
}
