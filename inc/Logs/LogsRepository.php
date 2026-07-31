<?php namespace Bromate\SecurityApiFirewall\Logs;

use Bromate\SecurityApiFirewall\Cron\CronLogs;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpUtils;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

defined( 'ABSPATH' ) || exit;

final class LogsRepository {


	protected static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'bromate_security_api_firewall_logs';
	}


	private static function log_in_db( $id ): ?array {
		global $wpdb;

		if ( empty( $id ) ) {
			return null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$existing = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table() . ' WHERE id = %d',
				(int) $id
			),
			ARRAY_A
		);

		return $existing ?: null;
	}

	public static function delete_all_entries(): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = $wpdb->query( 'TRUNCATE TABLE ' . self::table() );
		return false !== $result;
	}

	public static function insert( array $data, bool $merge = false ): string {
		global $wpdb;

		if ( ! SettingsRepository::read_option( 'logs_enabled' ) ) {
			return '';
		}

		$event    = isset( $data['event'] ) ? self::sanitize_event( $data['event'] ) : '';
		$severity = isset( $data['severity'] ) ? self::sanitize_severity( $data['severity'] ) : 'info';

		if ( empty( $event ) ) {
			return '';
		}

		$keep_events = SettingsRepository::read_option( 'logs_keep_events' );
		if ( ! empty( $keep_events ) && is_array( $keep_events ) && ! in_array( $event, $keep_events, true ) ) {
			return '';
		}

		$keep_severities = SettingsRepository::read_option( 'logs_keep_severities' );
		if ( ! empty( $keep_severities ) && is_array( $keep_severities ) && ! in_array( $severity, $keep_severities, true ) ) {
			return '';
		}

		$row = array(
			'event'      => $event,
			'severity'   => $severity,
			'details'    => isset( $data['details'] )
				? ( is_string( $data['details'] ) ? $data['details'] : wp_json_encode( $data['details'] ) )
				: null,
			'ip'         => isset( $data['ip'] ) ? sanitize_text_field( $data['ip'] ) : IpUtils::get_client_ip(),
			'user_agent' => isset( $data['user_agent'] ) ? sanitize_text_field( $data['user_agent'] ) : self::current_user_agent(),
			'referrer'   => isset( $data['referrer'] ) ? sanitize_text_field( $data['referrer'] ) : self::current_referrer(),
			'method'     => isset( $data['method'] ) ? sanitize_text_field( $data['method'] ) : self::current_method(),
			'uri'        => isset( $data['uri'] ) ? sanitize_text_field( $data['uri'] ) : self::current_uri(),
			'user_id'    => ( isset( $data['user_id'] ) && '' !== $data['user_id'] )
				? (int) $data['user_id']
				: ( get_current_user_id() ? get_current_user_id() : null ),
			'created_at' => ( isset( $data['created_at'] ) && '' !== $data['created_at'] )
				? sanitize_text_field( $data['created_at'] )
				: current_time( 'mysql' ),
		);

		if ( $merge && isset( $data['id'] ) && '' !== $data['id'] ) {
			$existing = self::log_in_db( $data['id'] );
			if ( $existing ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				$result = $wpdb->update( self::table(), $row, array( 'id' => $existing['id'] ) );
				return ( false !== $result ) ? 'updated' : '';
			}
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$result = $wpdb->insert( self::table(), $row );

		if ( $result ) {
			CronLogs::maybe_rotate_logs();
			return 'inserted';
		}

		return '';
	}

	public static function insert_many( array $log_entries, bool $merge = false ) {

		if ( empty( $log_entries ) ) {
			return array( 'add_count' => 0, 'update_count' => 0 );
		}

		$inserted_count = 0;
		$updated_count  = 0;

		foreach ( $log_entries as $log_entry ) {
			$result = self::insert( $log_entry, $merge );
			if ( 'inserted' === $result ) {
				++$inserted_count;
			}
			if ( 'updated' === $result ) {
				++$updated_count;
			}
		}

		return array(
			'add_count'    => $inserted_count,
			'update_count' => $updated_count,
		);
	}

	public static function get_entries( array $args = array() ): array {
		global $wpdb;

		$defaults = array(
			'event'     => null,
			'severity'  => null,
			'ip'        => null,
			'user_id'   => null,
			'date_from' => null,
			'date_to'   => null,
			'search'    => null,
			'page'      => 1,
			'per_page'  => 50,
			'order_by'  => 'created_at',
			'order'     => 'DESC',
		);

		$args   = wp_parse_args( $args, $defaults );
		$table  = self::table();
		$where  = array( '1=1' );
		$values = array();

		$sortable = array( 'id', 'event', 'severity', 'ip', 'user_id', 'created_at' );

		$keep_severities = SettingsRepository::read_option( 'logs_keep_severities' );
		$keep_events     = SettingsRepository::read_option( 'logs_keep_events' );

		if ( ! empty( $keep_severities ) && is_array( $keep_severities ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $keep_severities ), '%s' ) );
			$where[]      = "severity IN ({$placeholders})";
			$values       = array_merge( $values, $keep_severities );
		}

		if ( ! empty( $keep_events ) && is_array( $keep_events ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $keep_events ), '%s' ) );
			$where[]      = "event IN ({$placeholders})";
			$values       = array_merge( $values, $keep_events );
		}

		if ( ! empty( $args['event'] ) ) {
			$where[]  = 'event = %s';
			$values[] = $args['event'];
		}

		if ( ! empty( $args['severity'] ) ) {
			$where[]  = 'severity = %s';
			$values[] = $args['severity'];
		}

		if ( ! empty( $args['ip'] ) ) {
			$where[]  = 'ip = %s';
			$values[] = $args['ip'];
		}

		if ( ! empty( $args['user_id'] ) ) {
			$where[]  = 'user_id = %d';
			$values[] = (int) $args['user_id'];
		}

		if ( ! empty( $args['date_from'] ) ) {
			$where[]  = 'created_at >= %s';
			$values[] = $args['date_from'];
		}

		if ( ! empty( $args['date_to'] ) ) {
			$where[]  = 'created_at <= %s';
			$values[] = $args['date_to'];
		}

		if ( ! empty( $args['search'] ) ) {
			$like     = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where[]  = '(ip LIKE %s OR uri LIKE %s OR context LIKE %s)';
			$values[] = $like;
			$values[] = $like;
			$values[] = $like;
		}

		$order_by     = in_array( $args['order_by'], $sortable, true ) ? $args['order_by'] : 'created_at';
		$order        = strtoupper( $args['order'] ) === 'ASC' ? 'ASC' : 'DESC';
		$page         = max( 1, (int) $args['page'] );
		$per_page     = max( 1, min( 200, (int) $args['per_page'] ) );
		$offset       = ( $page - 1 ) * $per_page;
		$where_clause = implode( ' AND ', $where );

		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_clause}";
		if ( ! empty( $values ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$count_sql = $wpdb->prepare( $count_sql, $values );
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$total = (int) $wpdb->get_var( $count_sql );

		$sql      = "SELECT * FROM {$table} WHERE {$where_clause} ORDER BY {$order_by} {$order} LIMIT %d OFFSET %d";
		$values[] = $per_page;
		$values[] = $offset;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $values ), ARRAY_A );

		return array(
			'entries'     => array_map( array( self::class, 'normalize' ), is_array( $rows ) ? $rows : array() ),
			'total'       => $total,
			'page'        => $page,
			'per_page'    => $per_page,
			'total_pages' => (int) ceil( $total / $per_page ),
		);
	}

	public static function get_all_entries(): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( 
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}bromate_security_api_firewall_logs ORDER BY created_at DESC" ), 
			ARRAY_A 
		);

		return array_map( array( static::class, 'normalize' ), $rows );
	}

	public static function delete( int $id ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->delete( self::table(), array( 'id' => $id ) );
	}

	public static function delete_many( array $ids ): int {
		global $wpdb;
		if ( empty( $ids ) ) {
			return 0;
		}
		$ids          = array_map( 'absint', $ids );
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$sql          = 'DELETE FROM ' . self::table() . " WHERE id IN ({$placeholders})";
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		return (int) $wpdb->query( $wpdb->prepare( $sql, $ids ) );
	}

	public static function delete_expired( int $days = 90 ): int {
		global $wpdb;

		if ( $days < 1 ) {
			$days = 90;
		}

		$sql = 'DELETE FROM ' . self::table() . ' WHERE created_at < DATE_SUB(NOW(), INTERVAL %d DAY)';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		return (int) $wpdb->query( $wpdb->prepare( $sql, $days ) );
	}

	public static function sanitize_severities( $raw_value ): array {
		if ( is_string( $raw_value ) && false !== strpos( $raw_value, ',' ) ) {
			$raw_value = explode( ',', $raw_value );
		}

		if ( empty( $raw_value ) ) {
			return array();
		}

		if ( ! is_array( $raw_value ) ) {
			$raw_value = array( $raw_value );
		}

		$severities = array_map(
			function ( $raw_severity ) {
				return self::sanitize_severity( $raw_severity );
			},
			$raw_value
		);

		return array_unique( array_filter( $severities ) );
	}

	public static function sanitize_events( $raw_value ): array {
		if ( is_string( $raw_value ) && false !== strpos( $raw_value, ',' ) ) {
			$raw_value = explode( ',', $raw_value );
		}

		if ( ! is_array( $raw_value ) || empty( $raw_value ) ) {
			return array();
		}

		$events = array_map(
			function ( $raw_event ) {
				return self::sanitize_event( $raw_event );
			},
			$raw_value
		);

		return array_unique( array_filter( $events ) );
	}

	public static function sanitize_event( string $raw_value ): string {

		$value   = sanitize_key( $raw_value );
		$allowed = array(
			'ip_country_blocked',
			'ip_rate_limited',
			'ip_blacklisted',
			'ip_whitelisted_bypass',
			'ip_entry_created',
			'ip_entry_deleted',
			'ip_entries_delete_expired',
			'auth_access_whitelist',
			'auth_success',
			'auth_failed',
			'auth_revoked',
			'auth_attempts_limit',
			'admin_login_access_whitelist',
			'admin_login_success',
			'admin_login_failed',
			'admin_login_attempts_limit',
			'admin_login_banned',
			'emergency_token_used',
			'plugin_settings_changed',
			'log_entries_delete_expired',
			'import_fail',
			'export_fail',
			'import_success',
			'export_success',
		);
		return in_array( $value, $allowed, true ) ? $value : 'unknown';
	}

	public static function sanitize_severity( string $raw_value ): string {
		$value   = sanitize_key( $raw_value );
		$allowed = array( 'info', 'warning', 'error' );
		return in_array( $value, $allowed, true ) ? $value : 'info';
	}

	private static function normalize( array $row ): array {
		return array(
			'id'         => (int) $row['id'],
			'event'      => $row['event'],
			'severity'   => $row['severity'],
			'details'    => $row['details'],
			'ip'         => $row['ip'],
			'user_agent' => $row['user_agent'],
			'referrer'   => $row['referrer'],
			'method'     => $row['method'],
			'uri'        => $row['uri'],
			'user_id'    => null !== $row['user_id'] ? (int) $row['user_id'] : null,
			'created_at' => $row['created_at'],
		);
	}

	private static function current_user_agent(): ?string {
		return isset( $_SERVER['HTTP_USER_AGENT'] )
			? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 512 )
			: null;
	}

	private static function current_referrer(): ?string {
		return isset( $_SERVER['HTTP_REFERER'] )
			? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_REFERER'] ) ), 0, 512 )
			: null;
	}

	private static function current_method(): ?string {
		return isset( $_SERVER['REQUEST_METHOD'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) )
			: null;
	}

	private static function current_uri(): ?string {
		return isset( $_SERVER['REQUEST_URI'] )
			? substr( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ), 0, 1024 )
			: null;
	}
}
