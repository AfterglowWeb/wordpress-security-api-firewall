<?php namespace Bromate\SecurityApiFirewall\Core\Schema;

defined( 'ABSPATH' ) || exit;

final class SchemaManager {

	private const SCHEMA_VERSION_OPTION_KEY = 'bromate_security_api_firewall_schema_version';

	public static function install(): void {
		$current = get_option( self::SCHEMA_VERSION_OPTION_KEY, '0.0.0' );

		if ( version_compare( $current, BROMATE_SECURITY_API_FIREWALL_SCHEMA_VERSION, '>=' ) ) {
			return;
		}

		require_once realpath( ABSPATH . 'wp-admin/includes/upgrade.php' );
		global $wpdb;

		self::create_ip_entries( $wpdb );
		self::create_logs( $wpdb );
		self::create_rate_buckets( $wpdb );

		update_option( self::SCHEMA_VERSION_OPTION_KEY, BROMATE_SECURITY_API_FIREWALL_SCHEMA_VERSION, false );
	}

	public static function drop_tables(): void {

		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- DROP TABLE on uninstall is mandatory.
		$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}bromate_security_api_firewall_ip_entries" );
		$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}bromate_security_api_firewall_logs" );
		$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}bromate_rate_buckets" );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- DROP TABLE on uninstall is mandatory.
	}

	public static function delete_schema_version(): void {
		delete_option( self::SCHEMA_VERSION_OPTION_KEY );
	}

	public static function rate_buckets_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'bromate_rate_buckets';
	}

	private static function create_ip_entries( \wpdb $wpdb ): void {
		$table           = $wpdb->prefix . 'bromate_security_api_firewall_ip_entries';
		$charset_collate = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$table} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				ip VARCHAR(45) NOT NULL,
				list_type ENUM('whitelist','blacklist') NOT NULL DEFAULT 'blacklist',
				entry_type ENUM('ip','cidr') NOT NULL DEFAULT 'ip',
				entry_origin ENUM('manual','auth_user_ip','public_rate_limit','login_attempts_limit','auth_attempts_limit','country') NOT NULL DEFAULT 'manual',
				agent VARCHAR(255) NULL,
				user_id BIGINT UNSIGNED NULL,
				referrer VARCHAR(255) NULL,
				country_code CHAR(2) NULL,
				country_name VARCHAR(255) NULL,
				city VARCHAR(255) NULL,
				isp VARCHAR(255) NULL,
				latitude DECIMAL(9,6) NULL,
				longitude DECIMAL(10,6) NULL,
				created_at DATETIME NOT NULL,
				updated_at DATETIME NOT NULL,
				expires_at DATETIME NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY idx_ip_list (ip, list_type),
				KEY idx_list_type (list_type),
				KEY idx_entry_type (entry_type),
				KEY idx_entry_origin (entry_origin),
				KEY idx_user_id (user_id),
				KEY idx_country_code (country_code),
				KEY idx_created_at (created_at),
				KEY idx_expires_at (expires_at)
			) ENGINE=InnoDB{$charset_collate};"
		);
	}

	private static function create_logs( \wpdb $wpdb ): void {
		$table           = $wpdb->prefix . 'bromate_security_api_firewall_logs';
		$charset_collate = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$table} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				event VARCHAR(64) NOT NULL,
				details LONGTEXT NULL,
				severity ENUM('info','warning','error') NOT NULL DEFAULT 'info',
				ip VARCHAR(45) NULL,
				user_agent VARCHAR(512) NULL,
				referrer VARCHAR(512) NULL,
		b		method VARCHAR(10) NULL,
				uri VARCHAR(1024) NULL,
				user_id BIGINT UNSIGNED NULL,
				created_at DATETIME NOT NULL,
				PRIMARY KEY  (id),
				KEY idx_user_id (user_id),
				KEY idx_created_at (created_at),
				KEY idx_severity_created (severity, created_at),
				KEY idx_event_created (event, created_at),
				FULLTEXT KEY idx_uri_ft (uri)
			) ENGINE=InnoDB {$charset_collate};"
		);
	}

	private static function create_rate_buckets( \wpdb $wpdb ): void {
		$table           = $wpdb->prefix . 'bromate_rate_buckets';
		$charset_collate = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$table} (
				client_hash CHAR(32) NOT NULL,
				tokens DOUBLE NOT NULL DEFAULT 0,
				last_refill DOUBLE NOT NULL DEFAULT 0,
				updated_at BIGINT UNSIGNED NOT NULL,
				PRIMARY KEY  (client_hash),
				KEY idx_updated_at (updated_at)
			) ENGINE=InnoDB {$charset_collate};"
		);
	}
}