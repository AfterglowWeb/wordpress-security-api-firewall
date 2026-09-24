<?php namespace Bromate\SecurityApiFirewall\Utils;

defined( 'ABSPATH' ) || exit;

use WP_Filesystem_Base;

class FileUtils {

	public static function load_script_config( $file_path ): array {
		global $wp_filesystem;

		$config = array();
		if ( $wp_filesystem instanceof WP_Filesystem_Base && $wp_filesystem->is_readable( $file_path ) ) {
			$raw_config             = include realpath( $file_path );
			$config['dependencies'] = isset( $raw_config['dependencies'] ) ? array_map( 'sanitize_text_field', $raw_config['dependencies'] ) : array();
			$config['version']      = isset( $raw_config['version'] ) ? sanitize_text_field( $raw_config['version'] ) : wp_rand();
		}
		return $config;
	}

	public static function write_file( string $file_path, string $content ): bool {
		global $wp_filesystem;

		if ( ! $wp_filesystem instanceof WP_Filesystem_Base ) {
			return false;
		}

		$dir = dirname( $file_path );

		if ( ! $wp_filesystem->is_dir( $dir ) ) {
			if ( ! wp_mkdir_p( $dir ) ) {
				return false;
			}
		}

		if ( ! $wp_filesystem->is_writable( $dir ) ) {
			return false;
		}

		return $wp_filesystem->put_contents( $file_path, $content, FS_CHMOD_FILE );
	}

}
