<?php namespace Bromate\SecurityApiFirewall\Cron;

use Bromate\SecurityApiFirewall\Utils\FileUtils;

defined( 'ABSPATH' ) || exit;

final class CronTemporaryFiles {

    public static function register() {
        add_action( 'bromate_cleanup_stale_exports', [ self::class, 'cleanup_stale_exports' ] );
    }
        
    public static function schedule_cleanup(): void {
        if ( ! wp_next_scheduled( 'bromate_cleanup_stale_exports' ) ) {
            wp_schedule_event( time(), 'hourly', 'bromate_cleanup_stale_exports' );
        }
    }

    public static function cleanup_stale_exports(): void {
        $upload_dir = wp_upload_dir();
        $export_dir = $upload_dir['basedir'] . '/bromate-exports/';

        if ( ! FileUtils::exists( $export_dir ) ) {
            return;
        }

        $max_age = 15 * MINUTE_IN_SECONDS;
        $now     = time();

        foreach ( glob( $export_dir . '*' ) as $file ) {
            if ( FileUtils::is_file( $file ) && ( $now - FileUtils::mtime( $file ) ) > $max_age ) {
                wp_delete_file( $file );
            }
        }
    }

}