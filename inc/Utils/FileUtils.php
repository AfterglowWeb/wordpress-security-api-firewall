<?php namespace Bromate\SecurityApiFirewall\Utils;

defined( 'ABSPATH' ) || exit;

use Exception;
use WP_Error;

class FileUtils {

	public static function load_script_config( $file_path ): array {
		$config = array();
		if ( self::is_readable( $file_path ) ) {
			$raw_config             = include realpath( $file_path );
			$config['dependencies'] = isset( $raw_config['dependencies'] ) ? array_map( 'sanitize_text_field', $raw_config['dependencies'] ) : array();
			$config['version']      = isset( $raw_config['version'] ) ? sanitize_text_field( $raw_config['version'] ) : wp_rand();
		}
		return $config;
	}

	/**
	 * Get the WordPress filesystem instance.
	 *
	 * @return \WP_Filesystem_Base|null
	 */
	public static function wp_filesystem() {
		global $wp_filesystem;

		if ( ! $wp_filesystem ) {
			try {
				require_once ABSPATH . 'wp-admin/includes/file.php';
				WP_Filesystem();
			} catch ( Exception $e ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter
				return null;
			}
		}

		return $wp_filesystem;
	}

	/**
	 * Check if a file is readable.
	 */
	public static function is_readable( string $file_path ): bool {
		$wp_filesystem = self::wp_filesystem();

		if ( $wp_filesystem ) {
			return $wp_filesystem->is_readable( $file_path );
		}

		return is_readable( $file_path );
	}

	/**
	 * Check if a path is a directory.
	 */
	public static function is_dir( string $path ): bool {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return false;
		}

		return $wp_filesystem->is_dir( $path );
	}

	/**
	 * Check if a path is writable.
	 */
	public static function is_writable( string $path ): bool {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return false;
		}

		return $wp_filesystem->is_writable( $path );
	}

	/**
	 * Check if a file exists.
	 */
	public static function exists( string $path ): bool {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return false;
		}

		return $wp_filesystem->exists( $path );
	}

	/**
	 * Read file contents.
	 *
	 * @return string|null File contents or null on failure.
	 */
	public static function read_file( string $file_path ): ?string {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return null;
		}

		if ( ! $wp_filesystem->is_readable( $file_path ) ) {
			return null;
		}

		$content = $wp_filesystem->get_contents( $file_path );

		return false === $content ? null : $content;
	}

	/**
	 * Write content to a file.
	 * Creates parent directories if they don't exist.
	 */
	public static function write_file( string $file_path, string $content ): bool {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
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

	/**
	 * Create a directory (and parents if needed).
	 */
	public static function mkdir_p( string $dir_path ): bool {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return false;
		}

		if ( $wp_filesystem->is_dir( $dir_path ) ) {
			return true;
		}

		return wp_mkdir_p( $dir_path );
	}

	/**
	 * List directory contents.
	 *
	 * @return array|false Array of file info or false on failure.
	 */
	public static function dirlist( string $path ) {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return false;
		}

		return $wp_filesystem->dirlist( $path );
	}

	/**
	 * Recursively copy a directory.
	 *
	 * @return array|WP_Error Array of copied file paths on success, WP_Error on failure.
	 */
	public static function copy_directory( string $source, string $target ) {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return new WP_Error( 'filesystem', esc_html__( 'WordPress filesystem not available.', 'bromate-security-api-firewall' ) );
		}

		$copied_files = array();

		$files = $wp_filesystem->dirlist( $source );

		if ( false === $files ) {
			return new WP_Error( 'read_error', esc_html__( 'Could not read source directory.', 'bromate-security-api-firewall' ) );
		}

		foreach ( $files as $filename => $file_info ) {
			$source_path = trailingslashit( $source ) . $filename;
			$target_path = trailingslashit( $target ) . $filename;

			if ( 'd' === $file_info['type'] ) {
				if ( ! $wp_filesystem->is_dir( $target_path ) ) {
					if ( ! $wp_filesystem->mkdir( $target_path, FS_CHMOD_DIR ) ) {
						return new WP_Error(
							'mkdir_error',
							sprintf(
								/* translators: %s is the directory target path */
								esc_html__( 'Failed to create directory: %s', 'bromate-security-api-firewall' ),
								$target_path
							)
						);
					}
				}

				$sub_result = self::copy_directory( $source_path, $target_path );

				if ( is_wp_error( $sub_result ) ) {
					return $sub_result;
				}

				$copied_files = array_merge( $copied_files, $sub_result );

			} else {
				$content = $wp_filesystem->get_contents( $source_path );

				if ( false === $content ) {
					return new WP_Error(
						'read_error',
						sprintf(
							/* translators: %s is the file path */
							esc_html__( 'Failed to read file: %s', 'bromate-security-api-firewall' ),
							$source_path
						)
					);
				}

				if ( ! $wp_filesystem->put_contents( $target_path, $content, FS_CHMOD_FILE ) ) {
					return new WP_Error(
						'write_error',
						sprintf(
							/* translators: %s is the file path */
							esc_html__( 'Failed to write file: %s', 'bromate-security-api-firewall' ),
							$target_path
						)
					);
				}

				$copied_files[] = str_replace( trailingslashit( $target ), '', $target_path );
			}
		}

		return $copied_files;
	}

	/**
	 * Recursively delete a directory.
	 */
	public static function delete_directory( string $path, bool $recursive = true ): bool {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return false;
		}

		if ( ! $wp_filesystem->is_dir( $path ) ) {
			return false;
		}

		return $wp_filesystem->delete( $path, $recursive );
	}

	/**
	 * Delete a file.
	 */
	public static function delete_file( string $file_path ): bool {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return false;
		}

		if ( ! $wp_filesystem->exists( $file_path ) ) {
			return true;
		}

		return $wp_filesystem->delete( $file_path );
	}

	/**
	 * Get file permissions.
	 *
	 * WP_Filesystem::getchmod() returns a 3-digit octal string (e.g. '440').
	 *
	 * @return string|false Permissions as a 3-digit string (e.g. '440') or false on failure.
	 */
	public static function get_file_permissions( string $file_path ) {
		$wp_filesystem = self::wp_filesystem();

		if ( ! $wp_filesystem ) {
			return false;
		}

		if ( ! $wp_filesystem->exists( $file_path ) ) {
			return false;
		}

		$perms = $wp_filesystem->getchmod( $file_path );
		return false === $perms ? false : (string) $perms;
	}

	/**
	 * Change file permissions.
	 *
	 * @return bool True on success, false on failure.
	 */
	public static function change_file_permissions( string $file_path, int $permissions ): bool {
		$wp_filesystem = self::wp_filesystem();
		if ( ! $wp_filesystem ) {
			return false;
		}
		if ( ! $wp_filesystem->exists( $file_path ) ) {
			return false;
		}
		return $wp_filesystem->chmod( $file_path, $permissions );
	}
}
