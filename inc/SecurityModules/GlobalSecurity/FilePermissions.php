<?php namespace Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Utils\FileUtils;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

defined( 'ABSPATH' ) || exit;

class FilePermissions {
	private static $instance = null;

	public static function register() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	private function __construct() {
		add_action( 'wp_ajax_update_wpconfig_file_permissions', array( $this, 'ajax_update_wpconfig_file_permissions' ) );
		add_action( 'wp_ajax_protect_uploads_dir', array( $this, 'ajax_protect_uploads_dir' ) );
		add_action( 'wp_ajax_get_files_hardening_status', array( $this, 'ajax_get_files_hardening_status' ) );

		if ( SettingsRepository::read_option( 'harden_wpconfig_file_permissions' ) ) {
			$permissions = $this->read_file_permissions( ABSPATH . 'wp-config.php' );
			if ( $permissions && '440' !== $permissions ) {
				$this->change_file_permissions( ABSPATH . 'wp-config.php' );
			}
		}
	}

	public function ajax_update_wpconfig_file_permissions(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$permissions = $this->read_file_permissions( ABSPATH . 'wp-config.php' );

		if ( ! $permissions ) {
			wp_send_json_success( array( 'message' => esc_html__( 'wp-config.php is not readable.', 'bromate-security-api-firewall' ) ) );
			return;
		}

		if ( '440' === $permissions ) {
			wp_send_json_success( array( 'message' => esc_html__( 'wp-config.php permissions are already secured (440).', 'bromate-security-api-firewall' ) ) );
			return;
		}

		if ( $this->change_file_permissions( ABSPATH . 'wp-config.php' ) ) {
			wp_send_json_success( array( 'message' => esc_html__( 'wp-config.php permissions set to 440 successfully.', 'bromate-security-api-firewall' ) ) );
		} else {
			wp_send_json_success( array( 'message' => esc_html__( 'Failed to update wp-config.php permissions. Check that the web server user owns the file.', 'bromate-security-api-firewall' ) ) );
		}
	}

	public function ajax_get_files_hardening_status(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$wpconfig_perms  = $this->read_file_permissions( ABSPATH . 'wp-config.php' );
		$wpconfig_secure = ( '440' === $wpconfig_perms || '400' === $wpconfig_perms );

		$uploads_dir           = wp_upload_dir();
		$uploads_htaccess_path = self::get_uploads_htaccess_path();

		$htaccess_content  = $uploads_htaccess_path ? FileUtils::read_file( $uploads_htaccess_path ) : '';
		$uploads_protected = false !== strpos( $htaccess_content, '# WP Security & API Firewall' );

		wp_send_json_success(
			array(
				'wpconfig_secure'       => $wpconfig_secure,
				'wpconfig_perms'        => $wpconfig_perms ? $wpconfig_perms : null,
				'uploads_protected'     => $uploads_protected,
				'theme_editor_disabled' => self::theme_editor_disabled(),
				'nginx_snippet'         => $this->get_uploads_nginx_snippet( $uploads_dir['baseurl'] ),
			)
		);
	}

	public function ajax_protect_uploads_dir(): void {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Unauthorized', 'bromate-security-api-firewall' ) ), 401 );
		}

		$message      = '';
		$severity     = 'info';
		$is_protected = false;

		$htaccess_path        = self::get_uploads_htaccess_path();
		$htaccess_content     = $htaccess_path ? FileUtils::read_file( $htaccess_path ) : '';
		$new_htaccess_content = self::get_uploads_htaccess();

		if ( false !== strpos( $htaccess_content, '# WP Security & API Firewall' ) ) {
			$message      = esc_html__( 'Apache: .htaccess rules already present.', 'bromate-security-api-firewall' );
			$is_protected = true;
			$severity     = 'success';
		} elseif ( $htaccess_path && FileUtils::write_file( $htaccess_path, $new_htaccess_content ) ) {
			$message      = esc_html__( 'Apache: .htaccess created successfully.', 'bromate-security-api-firewall' );
			$is_protected = true;
			$severity     = 'success';
		} else {
			$message  = esc_html__( 'Apache: could not write .htaccess — check directory permissions.', 'bromate-security-api-firewall' );
			$severity = 'info';
		}

		$message = esc_html__( 'Nginx: .htaccess files are ignored by Nginx. Add the following block to your server configuration:', 'bromate-security-api-firewall' );

		if ( true === $is_protected ) {
			SettingsRepository::update_option( 'harden_uploads_dir_permissions', true );
		}

		wp_send_json_success(
			array(
				'message'  => $message,
				'severity' => $severity,
			)
		);
	}

	private function read_file_permissions( string $file_path ) {
		FileUtils::wp_filesystem();
		$perms = FileUtils::get_file_permissions( $file_path );
		return false === $perms ? false : ltrim( $perms, '0' );
	}

	private function change_file_permissions( string $file_path ): bool {
		FileUtils::wp_filesystem();
		if ( ! FileUtils::is_readable( $file_path ) ) {
			return false;
		}

		$success = FileUtils::change_file_permissions( $file_path, 0440 );

		if ( $success ) {
			SettingsRepository::update_option( 'harden_wpconfig_file_permissions', true );
		}
		return $success;
	}

	private static function get_uploads_htaccess_path(): string {
		$uploads_dir   = wp_upload_dir();
		$uploads_path  = trailingslashit( $uploads_dir['basedir'] );
		$htaccess_path = realpath( $uploads_path . '.htaccess' );

		return FileUtils::exists( $htaccess_path ) ? $htaccess_path : '';
	}

	private static function get_uploads_htaccess(): string {
		return <<<'HTACCESS'
		# WP Security & API Firewall — uploads directory protection
		# Deny execution of PHP and other server-side scripts.
		<FilesMatch "\.(php[0-9]?|phtml|phar|pl|py|cgi|sh|rb|asp|aspx|jsp)$">
			<IfModule mod_authz_core.c>
				Require all denied
			</IfModule>
			<IfModule !mod_authz_core.c>
				Order allow,deny
				Deny from all
			</IfModule>
		</FilesMatch>

		# Disable directory listing.
		Options -Indexes
		HTACCESS;
	}

	private function get_uploads_nginx_snippet( string $uploads_url ): string {
		$uploads_path_rel = wp_parse_url( $uploads_url, PHP_URL_PATH );
		return sprintf(
			"location ~* ^%s/.*\.(php[0-9]?|phtml|phar|pl|py|cgi|sh)$ {\n    deny all;\n}\nlocation ^~ %s/ {\n    autoindex off;\n}",
			rtrim( $uploads_path_rel, '/' ),
			rtrim( $uploads_path_rel, '/' )
		);
	}

	private function theme_editor_disabled(): bool {
		return defined( 'DISALLOW_FILE_EDIT' ) && true === DISALLOW_FILE_EDIT;
	}
}
