<?php
namespace Bromate\SecurityApiFirewall\Admin;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsConfig;
use Bromate\SecurityApiFirewall\Utils\FileUtils;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use WP_User;

class AdminPage {

	private function __construct() {}


	public static function register(): void {
		$self = new self();
		add_action(
			'admin_init',
			function () {
				$role_object = get_role( 'administrator' );
				$role_object->add_cap( 'bromate_security_api_firewall_edit_options' );
			}
		);
		add_action( 'admin_menu', array( $self, 'register_admin_page' ) );
		add_action( 'admin_enqueue_scripts', array( $self, 'enqueue_scripts' ), 10, 1 );
		add_action( 'admin_footer', array( $self, 'print_inline_styles' ), 20 );
	}

	public function register_admin_page(): void {
		add_menu_page(
			__( 'WP Security & API Firewall', 'bromate-security-api-firewall' ),
			__( 'WP Security & API Firewall', 'bromate-security-api-firewall' ),
			'bromate_security_api_firewall_edit_options',
			'bromate-security-api-firewall',
			array( $this, 'render_admin_page' ),
			'dashicons-tablet',
			99
		);
	}

	public function render_admin_page(): void {
		?>
		<div id="bromate-security-api-firewall-page"><div id="bromate-shadow-host"></div></div>
		
		<?php
	}

	public function enqueue_scripts( $hook ): void {
		if ( 'toplevel_page_bromate-security-api-firewall' !== $hook ) {
			return;
		}

		$user = wp_get_current_user();

		if ( ! $user instanceof WP_User ) {
			return;
		}

		$mui_config       = FileUtils::load_script_config( BROMATE_SECURITY_API_FIREWALL_DIR . 'build/mui.asset.php' );
		$mui_dependencies = ! empty( $mui_config ) && isset( $mui_config['dependencies'] ) ? $mui_config['dependencies'] : array();
		$mui_dependencies = array_unique( $mui_dependencies );
		wp_enqueue_script(
			'bromate-security-api-firewall-mui',
			BROMATE_SECURITY_API_FIREWALL_URL . 'build/mui.js',
			$mui_dependencies,
			$mui_config['version'],
			true
		);

		$mui_datagrid_config       = FileUtils::load_script_config( BROMATE_SECURITY_API_FIREWALL_DIR . 'build/mui-datagrid.asset.php' );
		$mui_datagrid_dependencies = ! empty( $mui_datagrid_config ) && isset( $mui_datagrid_config['dependencies'] ) ? $mui_datagrid_config['dependencies'] : array();
		$mui_datagrid_dependencies = array_unique( array_merge( array( 'bromate-security-api-firewall-mui' ), $mui_datagrid_dependencies ) );
		wp_enqueue_script(
			'bromate-security-api-firewall-mui-datagrid',
			BROMATE_SECURITY_API_FIREWALL_URL . 'build/mui-datagrid.js',
			$mui_datagrid_dependencies,
			$mui_datagrid_config['version'],
			true
		);

		$index_script_config = FileUtils::load_script_config( BROMATE_SECURITY_API_FIREWALL_DIR . 'build/index.asset.php' );
		$index_dependencies  = ! empty( $index_script_config ) && isset( $index_script_config['dependencies'] ) ? $index_script_config['dependencies'] : array();
		$index_dependencies  = array_unique( array_merge( array( 'bromate-security-api-firewall-mui' ), $index_dependencies ) );
		wp_enqueue_script(
			'bromate-security-api-firewall',
			BROMATE_SECURITY_API_FIREWALL_URL . 'build/index.js',
			$index_dependencies,
			$index_script_config['version'],
			true
		);

		wp_localize_script(
			'bromate-security-api-firewall',
			'bromateSecurityApiFirewall',
			array(
				'nonce'               => wp_create_nonce( 'bromate_security_api_firewall_update_options_nonce' ),
				'ajaxurl'             => admin_url( 'admin-ajax.php' ),
				'options'             => SettingsRepository::read_options(),
				'plugin'              => array(
					'name'    => 'WP Security & API Firewall',
					'version' => BROMATE_SECURITY_API_FIREWALL_VERSION,
				),
				'currentUser'         => array(
					'id'    => $user->ID,
					'login' => $user->user_login,
				),
				'panels'              => SettingsConfig::groups_config(),
				'has_rest_api_models' => defined( 'BROMATE_REST_API_MODELS_VERSION' ),
			)
		);
	}

	public function print_inline_styles(): void {
		$hook = get_current_screen();
		if ( 'toplevel_page_bromate-security-api-firewall' !== $hook->id ) {
			return;
		}
		$custom_css = '
		body.toplevel_page_bromate-security-api-firewall #wpcontent {
			padding-left:0;
		}
		body.toplevel_page_bromate-security-api-firewall #wpbody-content {
			padding-bottom:0;
		}
		body.toplevel_page_bromate-security-api-firewall #wpfooter {
			display:none;
		}
		body.toplevel_page_bromate-security-api-firewall #wpbody-content .notice {
			display:none;
		}
		';
		echo '<style type="text/css">' . esc_html( $custom_css ) . '</style>';
	}

	public function admin_notices(): void {
		if ( ! function_exists( 'get_plugin_data' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$plugin_data = get_plugin_data( BROMATE_SECURITY_API_FIREWALL_FILE );

		if ( ! is_array( $plugin_data ) ) {
			return;
		}

		$requires_wp  = $plugin_data['RequiresWP'] ?? '';
		$requires_php = $plugin_data['RequiresPHP'] ?? '';

		if ( empty( $requires_wp ) && empty( $requires_php ) ) {
			return;
		}

		$hook = get_current_screen();
		if ( 'toplevel_page_bromate-security-api-firewall' !== $hook->id ) {
			return;
		}

		if ( $requires_wp && version_compare( get_bloginfo( 'version' ), $requires_wp, '<' ) ) {
			echo '<div class="notice notice-error"><p>';
			/* translators: %s is the WordPress version */
			printf( esc_html__( 'Bromate Application Layer requires WordPress version %s.', 'bromate-security-api-firewall' ), esc_html( $requires_wp ) );
			echo '</p></div>';
		}

		if ( $requires_php && version_compare( PHP_VERSION, $requires_php, '<' ) ) {
			echo '<div class="notice notice-error"><p>';
			/* translators: %s is the PHP version */
			printf( esc_html__( 'Bromate Application Layer requires PHP version %s.', 'bromate-security-api-firewall' ), esc_html( $requires_php ) );
			echo '</p></div>';
		}
	}
}
