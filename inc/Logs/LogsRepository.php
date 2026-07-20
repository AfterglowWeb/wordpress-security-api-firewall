<?php namespace Bromate\SecurityApiFirewall\Logs;

use Bromate\SecurityApiFirewall\Security\IpEntry\ClientIpResolver;

defined( 'ABSPATH' ) || exit;

final class LogsRepository {

	protected static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'bromate_security_api_firewall_logs';
	}

	public static function insert( array $data ): bool {
		global $wpdb;

		$row = array(
			'event'      => isset( $data['event'] ) ? sanitize_text_field( $data['event'] ) : '',
			'severity'   => isset( $data['severity'] ) ? self::sanitize_severity( $data['severity'] ) : 'info',
			'details'    => isset( $data['details'] ) ? wp_json_encode( $data['details'] ) : null,
			'ip'         => isset( $data['ip'] ) ? sanitize_text_field( $data['ip'] ) : ClientIpResolver::get_client_ip(),
			'user_agent' => self::current_user_agent(),
			'referrer'   => self::current_referrer(),
			'method'     => self::current_method(),
			'uri'        => self::current_uri(),
			'user_id'    => get_current_user_id() ? get_current_user_id() : null,
			'context'    => isset( $data['context'] ) ? wp_json_encode( $data['context'] ) : null,
			'created_at' => current_time( 'mysql' ),
		);

		if ( empty( $row['event'] ) ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		return (bool) $wpdb->insert( self::table(), $row );
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

	public static function cleanup( int $days = 90 ): int {
		global $wpdb;
		$sql = 'DELETE FROM ' . self::table() . ' WHERE created_at < DATE_SUB(NOW(), INTERVAL %d DAY)';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		return (int) $wpdb->query( $wpdb->prepare( $sql, $days ) );
	}

	public static function sanitize_severities( $raw_value ): array {
		if( is_string($raw_value) && false !== strpos($raw_value, ',') ) {
			$raw_value = explode(',', $raw_value);
		}

		if( empty($raw_value) ) {
			return [];
		}

		if( !is_array($raw_value) ) {
			$raw_value = [$raw_value];
		}

		$severities = array_map( function($raw_severity) {
			return self::sanitize_severity($raw_severity);
		}, $raw_value);

		return array_unique(array_filter($severities));
			
	}

	public static function sanitize_events( $raw_value ): array {
		if( is_string($raw_value) && false !== strpos($raw_value, ',') ) {
			$raw_value = explode(',', $raw_value);
		}

		if( !is_array($raw_value) || empty($raw_value) ) {
			return [];
		}

		$events = array_map( function($raw_event) {
			return self::sanitize_event($raw_event);
		}, $raw_value);

		return array_unique(array_filter($events));
			
		
	}

	public static function sanitize_event( string $raw_value ): string {

		$value   = sanitize_key( $raw_value );
		$allowed = array(
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
			'unknown',
		);
		return in_array( $value, $allowed, true ) ? $value : 'unknown';
	}

	public static function sanitize_severity( string $raw_value ): string {
		$value   = sanitize_key( $raw_value );
		$allowed = array('info', 'warning', 'error' );
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
			'context'    => null !== $row['context'] ? json_decode( $row['context'], true ) : null,
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
