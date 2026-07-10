<?php namespace Bromate\SecurityApiFirewall\Security\IpEntry;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

class IpEntryRepository {

	protected static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'bromate_security_api_firewall_ip_entries';
	}

	public static function entry_config(): array {
		return array(
			'id'           => array(
				'type'     => 'integer',
				'sortable' => true,
			),
			'ip'           => array(
				'type'              => 'string',
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
				'sortable'          => true,
			),
			'list_type'    => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'blacklist',
				'allowed_values'    => array( 'whitelist', 'blacklist', 'global_blacklist' ),
				'sortable'          => true,
			),
			'entry_origin' => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'manual',
				'allowed_values'    => array( 'manual', 'auth_user_ip', 'public_rate_limit', 'login_rate_limit', 'country' ),
				'sortable'          => true,
			),
			'entry_type'   => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'manual',
				'allowed_values'    => array( 'ip', 'cidr', 'country' ),
				'sortable'          => true,
			),
			'agent'        => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => null,
				'sortable'          => false,
			),
			'user_id'      => array(
				'type'     => 'integer',
				'default'  => null,
				'sortable' => true,
			),
			'referrer'     => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => null,
				'sortable'          => false,
			),
			'country_code' => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => null,
				'sortable'          => true,
			),
			'country_name' => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => null,
				'sortable'          => true,
			),
			'created_at'   => array(
				'type'     => 'datetime',
				'sortable' => true,
			),
			'expires_at'   => array(
				'type'     => 'datetime',
				'default'  => null,
				'sortable' => true,
			),
			'updated_at'   => array(
				'type'     => 'datetime',
				'sortable' => true,
			),
		);
	}

	protected static function normalize( array $row ): array {
		return array(
			'id'           => (int) $row['id'],
			'ip'           => $row['ip'],
			'list_type'    => $row['list_type'],
			'entry_type'   => $row['entry_type'],
			'entry_origin' => $row['entry_origin'],
			'agent'        => $row['agent'],
			'user_id'      => $row['user_id'],
			'referrer'     => $row['referrer'],
			'country_code' => $row['country_code'],
			'country_name' => $row['country_name'],
			'expires_at'   => $row['expires_at'],
			'created_at'   => $row['created_at'],
			'updated_at'   => $row['updated_at'],
		);
	}

	public static function get_entries( array $args = array() ): array {
		global $wpdb;

		$defaults = array(
			'list_type'    => null,
			'entry_type'   => null,
			'entry_origin' => null,
			'search'       => null,
			'page'         => 1,
			'per_page'     => 25,
			'order_by'     => 'created_at',
			'order'        => 'DESC',
		);

		$args   = wp_parse_args( $args, $defaults );
		$table  = self::table();
		$where  = array( '1=1' );
		$values = array();
		$config = self::entry_config();

		if ( ! empty( $args['list_type'] ) ) {
			$where[]  = 'list_type = %s';
			$values[] = $args['list_type'];
		}

		if ( ! empty( $args['entry_type'] ) ) {
			$where[]  = 'entry_type = %s';
			$values[] = $args['entry_type'];
		}

		if ( ! empty( $args['entry_origin'] ) ) {
			$where[]  = 'entry_origin = %s';
			$values[] = $args['entry_origin'];
		}

		if ( ! isset( $args['include_expired'] ) || ! $args['include_expired'] ) {
			$where[] = '(expires_at IS NULL OR expires_at > NOW())';
		}

		if ( ! empty( $args['search'] ) ) {
			$search   = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where[]  = '(ip LIKE %s OR country_name LIKE %s OR agent LIKE %s)';
			$values[] = $search;
			$values[] = $search;
			$values[] = $search;
		}

		$order_by = 'created_at';
		if ( isset( $config[ $args['order_by'] ] ) && ! empty( $config[ $args['order_by'] ]['sortable'] ) ) {
			$order_by = $args['order_by'];
		}

		$order    = strtoupper( $args['order'] ) === 'ASC' ? 'ASC' : 'DESC';
		$page     = max( 1, (int) $args['page'] );
		$per_page = max( 1, min( 100, (int) $args['per_page'] ) );
		$offset   = ( $page - 1 ) * $per_page;

		$where_clause = implode( ' AND ', $where );

		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_clause}";
		if ( ! empty( $values ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- SQL built from whitelisted column names and %s/%d placeholders only
			$count_sql = $wpdb->prepare( $count_sql, $values );
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$total = (int) $wpdb->get_var( $count_sql );

		$sql      = "SELECT * FROM {$table} WHERE {$where_clause} ORDER BY {$order_by} {$order} LIMIT %d OFFSET %d";
		$values[] = $per_page;
		$values[] = $offset;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$entries = $wpdb->get_results( $wpdb->prepare( $sql, $values ), ARRAY_A );

		return array(
			'entries'     => array_map(
				function ( $entry ) {
					if ( ! empty( $entry['user_id'] ) ) {
							$user = get_userdata( $entry['user_id'] );
							$entry['user_display_name'] = $user ? $user->display_name : null;
					} else {
						$entry['user_display_name'] = null;
					}
					return $entry;
				},
				array_map( array( self::class, 'normalize' ), is_array( $entries ) ? $entries : array() )
			),
			'total'       => $total,
			'page'        => $page,
			'per_page'    => $per_page,
			'total_pages' => ceil( $total / $per_page ),
		);
	}

	public static function get_login_ip_entries( string $list_type = 'blacklist' ): array {
		return self::get_entries(
			array(
				'list_type'    => 'blacklist' === $list_type ? 'blacklist' : 'whitelist',
				'entry_origin' => 'login_rate_limit',
				'per_page'     => 100,
			)
		);
	}

	public static function find_by_id( int $id ): ?array {
		global $wpdb;

		$sql = 'SELECT * FROM ' . self::table() . ' WHERE id = %d LIMIT 1';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( $sql, $id ), ARRAY_A );

		return $row ? self::normalize( $row ) : null;
	}

	public static function find_by_ip( string $ip, string $list_type = 'blacklist' ): array {
		global $wpdb;

		$sql = '
			SELECT *
			FROM ' . self::table() . '
			WHERE ip = %s
			AND list_type = %s
			AND (
				expires_at IS NULL
				OR expires_at > NOW()
			)
			LIMIT 1
			';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( $sql, $ip, $list_type ), ARRAY_A );

		return $row ? self::normalize( $row ) : array();
	}

	public static function find_by_user( int $user_id ): array {
		global $wpdb;

		$sql = 'SELECT * FROM ' . self::table() . ' WHERE user_id = %d ORDER BY created_at DESC';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $user_id ), ARRAY_A );

		return array_map( array( self::class, 'normalize' ), is_array( $rows ) ? $rows : array() );
	}

	public static function ip_in_list( string $ip, string $list_type = 'blacklist' ): bool {
		global $wpdb;

		if ( self::find_by_ip( $ip, $list_type ) ) {
			return true;
		}

		$sql = '
			SELECT ip 
			FROM ' . self::table() . ' 
			WHERE list_type = %s 
			AND ip LIKE %s 
			AND (
				expires_at IS NULL 
				OR expires_at > NOW()
			)
			';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$cidrs = $wpdb->get_col( $wpdb->prepare( $sql, $list_type, '%/%' ) );

		foreach ( $cidrs as $cidr ) {
			if ( CidrMatcher::ip_matches( $ip, $cidr ) ) {
				return true;
			}
		}

		return false;
	}

	public static function insert( array $data ) {
		global $wpdb;

		$sanitized = self::sanitize_entry( $data );
		if ( ! $sanitized ) {
			return false;
		}

		$now                     = current_time( 'mysql' );
		$sanitized['created_at'] = $now;
		$sanitized['updated_at'] = $now;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$result = $wpdb->insert( self::table(), $sanitized );

		return $result ? $wpdb->insert_id : false;
	}

	public static function update( int $id, array $data ): bool {
		global $wpdb;

		$sanitized = self::sanitize_entry( $data, false );
		if ( empty( $sanitized ) ) {
			return false;
		}

		$sanitized['updated_at'] = current_time( 'mysql' );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (bool) $wpdb->update( self::table(), $sanitized, array( 'id' => $id ) );
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

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- placeholders generated from validated integer IDs
		return (int) $wpdb->query( $wpdb->prepare( $sql, $ids ) );
	}

	public static function delete_expired(): int {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- static SQL, no user input
		return (int) $wpdb->query( 'DELETE FROM ' . self::table() . ' WHERE expires_at IS NOT NULL AND expires_at < NOW()' );
	}

	public static function get_country_stats( string $list_type = 'blacklist' ): array {
		global $wpdb;

		$sql = 'SELECT country_code, country_name, COUNT(*) as count
				FROM ' . self::table() . '
				WHERE list_type = %s
				AND (expires_at IS NULL OR expires_at > NOW())
				AND country_code IS NOT NULL
				GROUP BY country_code, country_name
				ORDER BY count DESC';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$results = $wpdb->get_results( $wpdb->prepare( $sql, $list_type ), ARRAY_A );
		return is_array( $results ) ? $results : array();
	}

	public static function country_in_list( string $country_code ): bool {
		$blocked = SettingsRepository::read_option( 'rate_limit_countries' );
		$blocked = is_array( $blocked ) ? $blocked : array();

		return in_array( strtoupper( $country_code ), $blocked, true );
	}

	public static function block_country( string $country_code ): bool {
		$country_code = strtoupper( $country_code );

		$blocked = SettingsRepository::read_option( 'rate_limit_countries' );
		$blocked = is_array( $blocked ) ? $blocked : array();

		if ( in_array( $country_code, $blocked, true ) ) {
			return true;
		}

		$blocked[] = $country_code;

		$result = SettingsRepository::update_option( 'rate_limit_countries', $blocked );

		return false !== $result;
	}

	public static function unblock_country( string $country_code ): bool {
		$country_code = strtoupper( $country_code );

		$blocked = SettingsRepository::read_option( 'rate_limit_countries' );
		$blocked = is_array( $blocked ) ? $blocked : array();

		$filtered = array_values( array_diff( $blocked, array( $country_code ) ) );

		$result = SettingsRepository::update_option( 'rate_limit_countries', $filtered );

		return false !== $result;
	}

	protected static function sanitize_entry( array $data, bool $require_ip = true ): ?array {
		$config    = self::entry_config();
		$sanitized = array();

		foreach ( $config as $key => $field_config ) {
			if ( in_array( $key, array( 'id', 'created_at', 'updated_at' ), true ) ) {
				continue;
			}

			if ( ! isset( $data[ $key ] ) ) {
				continue;
			}

			$value = $data[ $key ];

			if ( ! empty( $field_config['sanitize_callback'] ) && is_callable( $field_config['sanitize_callback'] ) ) {
				$value = call_user_func( $field_config['sanitize_callback'], $value );
			}

			if ( ! empty( $field_config['allowed_values'] ) && ! in_array( $value, $field_config['allowed_values'], true ) ) {
				$value = $field_config['default'] ?? null;
			}

			$sanitized[ $key ] = $value;
		}

		if ( $require_ip && ( empty( $sanitized['ip'] ) || ! CidrMatcher::is_valid_ip_or_cidr( $sanitized['ip'] ) ) ) {
			return null;
		}

		return $sanitized;
	}
}
