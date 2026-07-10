<?php namespace Bromate\SecurityApiFirewall\Core\Schema;

defined( 'ABSPATH' ) || exit;

final class SchemaManager {

	const SCHEMA_VERSION = '1.7.2';
	const OPTION_KEY     = 'bromate_firewall_schema_version';

	public static function install(): void {
		$current = get_option( self::OPTION_KEY, '0.0.0' );

		if ( version_compare( $current, self::SCHEMA_VERSION, '>=' ) ) {
			return;
		}

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;

		self::create_ip_entries( $wpdb );
		self::create_logs( $wpdb );

		update_option( self::OPTION_KEY, self::SCHEMA_VERSION, false );
	}

	private static function create_ip_entries( \wpdb $wpdb ): void {
		$table           = $wpdb->prefix . 'bromate_security_api_firewall_ip_entries';
		$charset_collate = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$table} (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			ip           VARCHAR(45)     NOT NULL,
			list_type    ENUM('whitelist','blacklist') NOT NULL DEFAULT 'blacklist',
			entry_type   ENUM('ip','cidr')             NOT NULL DEFAULT 'ip',
			entry_origin ENUM('manual','auth_user_ip','public_rate_limit','login_rate_limit','country') NOT NULL DEFAULT 'manual',
			agent        VARCHAR(255)    NULL DEFAULT NULL,
			user_id      BIGINT UNSIGNED NULL DEFAULT NULL,
			referrer     VARCHAR(255)    NULL DEFAULT NULL,
			country_code CHAR(2)         NULL DEFAULT NULL,
			country_name VARCHAR(100)    NULL DEFAULT NULL,
			created_at   DATETIME        NOT NULL,
			updated_at   DATETIME        NOT NULL,
			expires_at   DATETIME        NULL DEFAULT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY   ip_list (ip, list_type),
			KEY          list_type    (list_type),
			KEY          entry_type   (entry_type),
			KEY          entry_origin (entry_origin),
			KEY          user_id      (user_id),
			KEY          country_code (country_code),
			KEY          created_at   (created_at)
		) {$charset_collate};"
		);
	}

	private static function create_logs( \wpdb $wpdb ): void {
		$table           = $wpdb->prefix . 'bromate_security_api_firewall_logs';
		$charset_collate = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$table} (
			id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			event       VARCHAR(64)     NOT NULL,
			severity    ENUM('debug','info','warning','error','critical') NOT NULL DEFAULT 'info',
			ip          VARCHAR(45)     DEFAULT NULL,
			user_agent  VARCHAR(512)    DEFAULT NULL,
			referrer    VARCHAR(512)    DEFAULT NULL,
			method      VARCHAR(10)     DEFAULT NULL,
			uri         VARCHAR(1024)   DEFAULT NULL,
			user_id     BIGINT UNSIGNED DEFAULT NULL,
			object_type VARCHAR(64)     DEFAULT NULL,
			object_id   BIGINT UNSIGNED DEFAULT NULL,
			context     LONGTEXT        DEFAULT NULL,
			created_at  DATETIME        NOT NULL,
			PRIMARY KEY (id),
			KEY idx_event      (event),
			KEY idx_ip         (ip),
			KEY idx_user_id    (user_id),
			KEY idx_severity   (severity),
			KEY idx_created_at (created_at)
		) {$charset_collate};"
		);
	}
}
