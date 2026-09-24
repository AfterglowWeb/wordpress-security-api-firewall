<?php namespace Bromate\SecurityApiFirewall\Cron;

use WP_Filesystem_Base;

defined( 'ABSPATH' ) || exit;

final class CronTemporaryFiles {

	public static function register() {
		add_action( 'bromate_cleanup_stale_exports', array( self::class, 'cleanup_stale_exports' ) );
	}

	public static function schedule_cleanup(): void {
		if ( ! wp_next_scheduled( 'bromate_cleanup_stale_exports' ) ) {
			wp_schedule_event( time(), 'hourly', 'bromate_cleanup_stale_exports' );
		}
	}

	public static function cleanup_stale_exports(): void {
		global $wp_filesystem;
		$upload_dir = wp_upload_dir();
		$export_dir = $upload_dir['basedir'] . '/bromate-exports/';

		if ( false === $wp_filesystem instanceof WP_Filesystem_Base ) {
			return;
		}

		if ( false === $wp_filesystem->exists( $export_dir ) ) {
			return;
		}

		$max_age = 15 * MINUTE_IN_SECONDS;
		$now     = time();

		foreach ( glob( $export_dir . '*' ) as $file ) {
			if ( $wp_filesystem->is_file( $file ) && ( $now - $wp_filesystem->mtime( $file ) ) > $max_age ) {
				wp_delete_file( $file );
			}
		}
	}
}
