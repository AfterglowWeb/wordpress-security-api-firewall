<?php
namespace Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use Bromate\SecurityApiFirewall\Logs\Logger;
use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpUtils;
use Bromate\SecurityApiFirewall\SecurityModules\LoginSecurity\TOTPRepository;
use Exception;
use WP_Error;

final class TOTPLoginService {

	private const TRUSTED_COOKIE_NAME       = 'bromate_totp_trusted';
	private const VERIFIED_TRANSIENT_PREFIX = 'bromate_totp_verified_';
	private const SESSION_ID_COOKIE_NAME    = 'bromate_totp_session';
	private const MAX_ATTEMPTS              = 5;
	private const TRANSIENT_EXPIRY          = 300;
	private const TOKEN_EXPIRY_DAYS         = 30;
	private const SESSION_COOKIE_EXPIRY     = 43200; // 12 hours.

	public static function register(): void {
		$service = new self();
		if ( empty( SettingsRepository::read_option( 'login_totp_enabled' ) ) ) {
			return;
		}

		add_action( 'login_form', array( $service, 'add_totp_field_to_login' ) );
		add_action( 'woocommerce_login_form', array( $service, 'add_totp_field_to_login' ) );
		add_filter( 'wp_authenticate_user', array( $service, 'validate_totp' ), 10, 1 );
		add_action( 'wp_login', array( $service, 'handle_login_actions' ), 10 );
		add_action( 'wp_logout', array( $service, 'clear_trusted_cookie' ) );

		add_action( 'wp_ajax_bromate_verify_totp', array( $service, 'ajax_verify_totp' ) );
		add_action( 'wp_ajax_nopriv_bromate_verify_totp', array( $service, 'ajax_verify_totp' ) );
		add_action( 'wp_ajax_bromate_finish_login', array( $service, 'ajax_finish_login' ) );
		add_action( 'wp_ajax_nopriv_bromate_finish_login', array( $service, 'ajax_finish_login' ) );

		add_action( 'login_head', array( $service, 'add_custom_styles' ) );
		add_action( 'wp_head', array( $service, 'add_custom_styles' ) );

		add_filter( 'login_body_class', array( $service, 'add_body_class' ) );
		add_filter( 'body_class', array( $service, 'add_body_class' ) );

		add_action( 'login_enqueue_scripts', array( $service, 'enqueue_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $service, 'enqueue_scripts' ) );

		if ( ! wp_next_scheduled( 'bromate_totp_cleanup' ) ) {
			wp_schedule_event( time(), 'daily', 'bromate_totp_cleanup' );
		}
		add_action( 'bromate_totp_cleanup', array( $service, 'cleanup_expired_data' ) );
	}

	private function generate_session_id(): string {
		try {
			$bytes = random_bytes( 32 );
			return bin2hex( $bytes );
		} catch ( Exception $e ) {
			return hash( 'sha256', uniqid( 'bromate_totp_', true ) . mt_rand() );
		}
	}

	private function get_session_id(): string {
		if ( isset( $_COOKIE[ self::SESSION_ID_COOKIE_NAME ] ) ) {
			$session_id = sanitize_text_field( wp_unslash( $_COOKIE[ self::SESSION_ID_COOKIE_NAME ] ) );
			if ( preg_match( '/^[a-f0-9]{64}$/', $session_id ) ) {
				return $session_id;
			}
		}

		$session_id = $this->generate_session_id();

		setcookie(
			self::SESSION_ID_COOKIE_NAME,
			$session_id,
			time() + self::SESSION_COOKIE_EXPIRY,
			COOKIEPATH,
			COOKIE_DOMAIN,
			is_ssl(),
			true
		);

		return $session_id;
	}

	private function get_verified_transient_key( string $session_id ): string {
		return self::VERIFIED_TRANSIENT_PREFIX . $session_id;
	}

	public function enqueue_scripts(): void {
		if ( ! $this->should_load_scripts() ) {
			return;
		}

		wp_enqueue_script(
			'bromate-totp-login',
			BROMATE_SECURITY_API_FIREWALL_URL . 'public/js/totp-login.js',
			array( 'jquery' ),
			BROMATE_SECURITY_API_FIREWALL_VERSION,
			true
		);

		wp_localize_script(
			'bromate-totp-login',
			'bromateTotp',
			array(
				'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
				'nonce'       => wp_create_nonce( 'bromate_totp_verify' ),
				'sessionId'   => $this->get_session_id(),
				'redirectUrl' => admin_url(),
			)
		);
	}

	private function should_load_scripts(): bool {
		return $this->is_login_page() || $this->should_show_totp();
	}

	private function is_login_page(): bool {
		global $pagenow;
		return in_array( $pagenow, array( 'wp-login.php', 'wp-signup.php' ), true );
	}

	private function should_show_totp(): bool {
		$session_id = $this->get_session_id();
		$pending    = get_transient( 'bromate_totp_pending_' . $session_id );

		if ( ! $pending || ! isset( $pending['user_id'] ) ) {
			return false;
		}

		$user_id = (int) $pending['user_id'];

		if ( ! TOTPRepository::get_instance()->is_user_enrolled( $user_id ) ) {
			return false;
		}

		$verified_key = $this->get_verified_transient_key( $session_id );
		if ( get_transient( $verified_key ) ) {
			return false;
		}

		if ( $this->is_trusted_device( $user_id ) ) {
			return false;
		}

		return true;
	}

	public function add_body_class( $classes ) {
		if ( $this->should_show_totp() ) {
			if ( is_array( $classes ) ) {
				$classes[] = 'bromate-totp-active';
			} else {
				$classes .= ' bromate-totp-active';
			}
		}
		return $classes;
	}

	public function add_totp_field_to_login(): void {
		$session_id = $this->get_session_id();
		$pending    = get_transient( 'bromate_totp_pending_' . $session_id );

		if ( ! $pending || ! isset( $pending['user_id'] ) ) {
			return;
		}

		$user_id = (int) $pending['user_id'];

		if ( ! TOTPRepository::get_instance()->is_user_enrolled( $user_id ) ) {
			return;
		}

		$verified_key = $this->get_verified_transient_key( $session_id );
		if ( get_transient( $verified_key ) ) {
			return;
		}

		if ( $this->is_trusted_device( $user_id ) ) {
			return;
		}

		$this->render_totp_field( $session_id );
	}

	private function render_totp_field( string $session_id ): void {
		?>
		<div id="bromate-totp-field" class="bromate-totp-field">
			<h3 style="text-align:center;margin-bottom:12px">
				<?php esc_html_e( 'Two-factor Authentication', 'bromate-security-api-firewall' ); ?>
			</h3>
			<p>
				<label for="bromate-totp-code" style="display: block; margin-bottom: 4px; font-weight: 500;">
					<?php esc_html_e( '6-digit code from your authenticator app', 'bromate-security-api-firewall' ); ?>
				</label>
				<input 
					type="text" 
					name="bromate_totp_code" 
					id="bromate-totp-code" 
					class="input" 
					value="" 
					size="20" 
					maxlength="6"
					pattern="[0-9]{6}"
					inputmode="numeric"
					autocomplete="one-time-code"
					placeholder="<?php esc_attr_e( '123456', 'bromate-security-api-firewall' ); ?>"
					style="letter-spacing: 4px; font-size: 20px; text-align: center; width: 100%; padding: 8px;"
				>
			</p>
			<p class="forgetmenot" style="margin: 12px 0;">
				<label for="bromate-totp-remember" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500;">
					<input type="checkbox" name="bromate_totp_remember" id="bromate-totp-remember" value="1" style="margin: 0 2px 0 0;">
					<?php esc_html_e( 'Remember this device for 30 days', 'bromate-security-api-firewall' ); ?>
				</label>
			</p>
			<div id="bromate-totp-error" class="bromate-totp-error" style="color: #d63638; margin-top: 12px; padding: 8px 12px; background: #fcf0f1; border-radius: 2px; display:none;"></div>
			<?php wp_nonce_field( 'bromate_totp_verify', 'bromate_totp_nonce' ); ?>
			<input type="hidden" name="bromate_totp_session" value="<?php echo esc_attr( $session_id ); ?>">
			<input type="hidden" name="bromate_totp_show" value="1">
			
			<p class="submit">
				<button type="button" id="bromate-totp-verify-button" class="button button-primary button-large" style="font-size:14px; width:100%;">
					<?php esc_html_e( 'Verify', 'bromate-security-api-firewall' ); ?>
				</button>
			</p>
		</div>
		<?php
	}

	public function ajax_finish_login(): void {
		if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ) ), 'bromate_totp_verify' ) ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
			return;
		}

		$session_id = isset( $_POST['session_id'] ) ? sanitize_text_field( wp_unslash( $_POST['session_id'] ) ) : '';
		if ( ! $this->validate_session_id( $session_id ) ) {
			wp_send_json_error( array( 'message' => 'Invalid session ID' ), 400 );
			return;
		}

		$pending = get_transient( 'bromate_totp_pending_' . $session_id );
		if ( ! $pending || ! isset( $pending['user_id'] ) || ! isset( $pending['timestamp'] ) ) {
			wp_send_json_error( array( 'message' => 'Session expired or invalid' ), 401 );
			return;
		}

		if ( ( time() - $pending['timestamp'] ) > self::TRANSIENT_EXPIRY ) {
			delete_transient( 'bromate_totp_pending_' . $session_id );
			wp_send_json_error( array( 'message' => 'Session expired' ), 401 );
			return;
		}

		$verified_key = $this->get_verified_transient_key( $session_id );
		if ( ! get_transient( $verified_key ) ) {
			wp_send_json_error( array( 'message' => 'TOTP not verified' ), 401 );
			return;
		}

		$user_id = (int) $pending['user_id'];
		$user    = get_user_by( 'id', $user_id );

		if ( ! $user ) {
			wp_send_json_error( array( 'message' => 'User not found' ), 404 );
			return;
		}

		if ( $user->ID !== $user_id ) {
			wp_send_json_error( array( 'message' => 'User mismatch' ), 403 );
			return;
		}

		wp_set_current_user( $user_id, $user->user_login );
		wp_set_auth_cookie( $user_id, true );
		do_action( 'wp_login', $user->user_login, $user );

		$this->cleanup_session_data( $session_id );

		$redirect_to = isset( $pending['redirect_to'] ) && $pending['redirect_to'] 
			? $pending['redirect_to'] 
			: admin_url();

		$this->log_security_event( $user_id, 'totp_login_success' );

		wp_send_json_success(
			array(
				'message'      => 'Login successful',
				'redirect_url' => $redirect_to,
			)
		);
	}

	public function on_login_failed( string $username ): void {
		$session_id = $this->get_session_id();
		$pending = get_transient( 'bromate_totp_pending_' . $session_id );

		if ( ! $pending || ! isset( $pending['user_id'] ) ) {
			return;
		}

		$user_id = (int) $pending['user_id'];
		$user    = get_user_by( 'id', $user_id );

		if ( ! $user || $user->user_login !== $username ) {
			return;
		}

		$http_user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) 
			? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) 
			: '';

		TOTPRepository::get_instance()->record_failed_attempt(
			$user_id,
			array(
				'time'       => time(),
				'ip'         => IpUtils::get_client_ip(),
				'user_agent' => $http_user_agent,
			)
		);

		$this->log_security_event( $user_id, 'totp_login_failed' );
	}

	public function validate_totp( $user ) {
		if ( is_wp_error( $user ) ) {
			return $user;
		}

		if ( ! TOTPRepository::get_instance()->is_user_enrolled( $user->ID ) ) {
			return $user;
		}

		if ( $this->is_trusted_device( $user->ID ) ) {
			return $user;
		}

		$session_id   = $this->get_session_id();
		$verified_key = $this->get_verified_transient_key( $session_id );

		if ( get_transient( $verified_key ) ) {
			return $user;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- No nonce provided by login form.
		if ( empty( $_POST['bromate_totp_code'] ) ) {
			set_transient(
				'bromate_totp_pending_' . $session_id,
				array(
					'user_id'     => $user->ID,
					'username'    => $user->user_login,
					'timestamp'   => time(),
					// phpcs:ignore WordPress.Security.NonceVerification.Missing -- No nonce provided by login form.
					'redirect_to' => isset( $_POST['redirect_to'] ) 
						? sanitize_text_field( wp_unslash( $_POST['redirect_to'] ) ) 
						: admin_url(),
				),
				self::TRANSIENT_EXPIRY
			);
			return new WP_Error(
				'bromate_totp_required',
				esc_html__( 'Two-factor authentication is enabled for your account. Please enter your verification code.', 'bromate-security-api-firewall' )
			);
		}

		return new WP_Error(
			'bromate_totp_required',
			esc_html__( 'Please verify your code using the button below.', 'bromate-security-api-firewall' )
		);
	}

	public function ajax_verify_totp(): void {
		if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ) ), 'bromate_totp_verify' ) ) {
			wp_send_json_error( array( 'message' => 'Invalid security token' ), 403 );
			return;
		}

		$code = isset( $_POST['code'] ) 
			? preg_replace( '/[^0-9]/', '', sanitize_text_field( wp_unslash( $_POST['code'] ) ) ) 
			: '';
		
		if ( strlen( $code ) !== 6 && strlen( $code ) !== 8 ) {
			wp_send_json_error( array( 'message' => 'Invalid verification code format' ), 400 );
			return;
		}

		$session_id = isset( $_POST['session_id'] ) 
			? sanitize_text_field( wp_unslash( $_POST['session_id'] ) ) 
			: '';
		
		if ( ! $this->validate_session_id( $session_id ) ) {
			wp_send_json_error( array( 'message' => 'Invalid session ID' ), 400 );
			return;
		}

		$pending = get_transient( 'bromate_totp_pending_' . $session_id );

		if ( ! $pending || ! isset( $pending['user_id'] ) || ! isset( $pending['timestamp'] ) ) {
			wp_send_json_error( array( 'message' => 'Session expired or invalid' ), 401 );
			return;
		}

		if ( ( time() - $pending['timestamp'] ) > self::TRANSIENT_EXPIRY ) {
			delete_transient( 'bromate_totp_pending_' . $session_id );
			wp_send_json_error( array( 'message' => 'Session expired' ), 401 );
			return;
		}

		$user_id  = (int) $pending['user_id'];

		if ( TOTPRepository::get_instance()->is_locked_out( $user_id ) ) {
			wp_send_json_error(
				array(
					'message' => 'Too many failed attempts. Please try again later.',
					'locked'  => true,
				),
				429
			);
			return;
		}

		$verified = false;

		if ( TOTPRepository::get_instance()->verify_totp_code_for_login( $user_id, $code ) ) {
			$verified = true;
		} elseif ( TOTPRepository::get_instance()->verify_backup_code( $user_id, $code ) ) {
			$verified = true;
		}

		if ( ! $verified ) {
			TOTPRepository::get_instance()->record_user_failed_attempt( $user_id );
			$this->on_login_failed( $pending['username'] );

			if ( TOTPRepository::get_instance()->is_locked_out( $user_id ) ) {
				wp_send_json_error(
					array( 'message' => 'Too many failed attempts. Please try again later.' ),
					429
				);
				return;
			}

			wp_send_json_error( array( 'message' => __( 'Invalid verification code.', 'bromate-security-api-firewall' ) ), 401 );

			return;
		}

		TOTPRepository::get_instance()->clear_user_attempts( $user_id );

		$verified_key = $this->get_verified_transient_key( $session_id );
		set_transient( $verified_key, true, self::TRANSIENT_EXPIRY );

		$remember_device = isset( $_POST['remember_device'] ) 
			&& filter_var( wp_unslash( $_POST['remember_device'] ), FILTER_VALIDATE_BOOLEAN );
		
		if ( $remember_device ) {
			$this->set_trusted_device( $user_id );
		}

		$this->log_security_event( $user_id, 'totp_verification_success' );

		wp_send_json_success(
			array(
				'message'  => 'Verification successful',
				'verified' => true,
			)
		);
	}

	public function handle_login_actions(): void {
		$session_id = $this->get_session_id();
		$this->cleanup_session_data( $session_id );
	}

	public function clear_trusted_cookie(): void {
		if ( isset( $_COOKIE[ self::TRUSTED_COOKIE_NAME ] ) ) {
			$token = sanitize_text_field( wp_unslash( $_COOKIE[ self::TRUSTED_COOKIE_NAME ] ) );

			$user_id = get_current_user_id();
			if ( $user_id ) {
				$tokens = TOTPRepository::get_instance()->get_trusted_tokens( $user_id );
				if ( is_array( $tokens ) && isset( $tokens[ $token ] ) ) {
					TOTPRepository::get_instance()->remove_trusted_token( $user_id, $token );
				}
			}

			$this->clear_cookie( self::TRUSTED_COOKIE_NAME );
		}

		if ( isset( $_COOKIE[ self::SESSION_ID_COOKIE_NAME ] ) ) {
			$session_id = sanitize_text_field( wp_unslash( $_COOKIE[ self::SESSION_ID_COOKIE_NAME ] ) );
			if ( $this->validate_session_id( $session_id ) ) {
				$this->cleanup_session_data( $session_id );
			}
			$this->clear_cookie( self::SESSION_ID_COOKIE_NAME );
		}
	}

	private function set_trusted_device( int $user_id ): void {
		$token = $this->generate_trusted_token();
		$user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) 
			? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) 
			: '';

		$token_data = array(
			'expires'    => time() + ( self::TOKEN_EXPIRY_DAYS * DAY_IN_SECONDS ),
			'user_agent' => $user_agent,
			'created'    => time(),
			'ip'         => IpUtils::get_client_ip(),
			'last_used'  => time(),
		);

		TOTPRepository::get_instance()->store_trusted_token( $user_id, $token, $token_data );

		setcookie(
			self::TRUSTED_COOKIE_NAME,
			$token,
			time() + ( self::TOKEN_EXPIRY_DAYS * DAY_IN_SECONDS ),
			COOKIEPATH,
			COOKIE_DOMAIN,
			is_ssl(),
			true
		);
	}

	private function generate_trusted_token(): string {
		try {
			$bytes = random_bytes( 32 );
			return bin2hex( $bytes );
		} catch ( Exception $e ) {
			return hash( 'sha256', uniqid( 'bromate_trusted_', true ) . mt_rand() );
		}
	}

	private function verify_trusted_token( int $user_id, string $token ): bool {
		$tokens = TOTPRepository::get_instance()->get_trusted_tokens( $user_id );
		
		if ( ! is_array( $tokens ) || ! isset( $tokens[ $token ] ) ) {
			return false;
		}

		$token_data = $tokens[ $token ];

		if ( ! isset( $token_data['expires'] ) || $token_data['expires'] < time() ) {
			TOTPRepository::get_instance()->remove_trusted_token( $user_id, $token );
			return false;
		}

		if ( isset( $token_data['user_agent'] ) ) {
			$current_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) 
				? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) 
				: '';
			
			if ( $token_data['user_agent'] !== $current_agent ) {
				return false;
			}
		}

		$token_data['last_used'] = time();
		TOTPRepository::get_instance()->store_trusted_token( $user_id, $token, $token_data );

		return true;
	}

	private function cleanup_expired_tokens( int $user_id ): void {
		$tokens = TOTPRepository::get_instance()->get_trusted_tokens( $user_id );
		if ( ! is_array( $tokens ) ) {
			return;
		}

		$now = time();
		$modified = false;

		foreach ( $tokens as $key => $data ) {
			if ( ! isset( $data['expires'] ) || $data['expires'] < $now ) {
				unset( $tokens[ $key ] );
				$modified = true;
			}
		}

		if ( $modified ) {
			update_user_meta( $user_id, '_bromate_security_api_firewall_totp_trusted_token', $tokens );
		}
	}

	private function is_trusted_device( int $user_id ): bool {
		if ( ! isset( $_COOKIE[ self::TRUSTED_COOKIE_NAME ] ) ) {
			return false;
		}

		$token = sanitize_text_field( wp_unslash( $_COOKIE[ self::TRUSTED_COOKIE_NAME ] ) );

		if ( ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
			return false;
		}

		$this->cleanup_expired_tokens( $user_id );

		return $this->verify_trusted_token( $user_id, $token );
	}

	private function validate_session_id( string $session_id ): bool {
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $session_id ) ) {
			return false;
		}

		if ( ! isset( $_COOKIE[ self::SESSION_ID_COOKIE_NAME ] ) ) {
			return false;
		}

		$cookie_session_id = sanitize_text_field( wp_unslash( $_COOKIE[ self::SESSION_ID_COOKIE_NAME ] ) );

		return hash_equals( $cookie_session_id, $session_id );
	}

	private function cleanup_session_data( string $session_id ): void {
		delete_transient( 'bromate_totp_pending_' . $session_id );
		delete_transient( $this->get_verified_transient_key( $session_id ) );
	}

	private function clear_cookie( string $cookie_name ): void {
		setcookie(
			$cookie_name,
			'',
			time() - 3600,
			COOKIEPATH,
			COOKIE_DOMAIN,
			is_ssl(),
			true
		);
		unset( $_COOKIE[ $cookie_name ] );
	}

	private function log_security_event( int $user_id, string $event ): void {
		if ( function_exists( 'wc_get_logger' ) ) {
			$logger = wc_get_logger();
			$logger->info(
				sprintf(
					'TOTP Event: %s for user %d from IP %s',
					$event,
					$user_id,
					IpUtils::get_client_ip()
				),
				array( 'source' => 'bromate-totp' )
			);
		}

		Logger::log(
			'totp_login_attempts_limit',
			'error',
			[sprintf(
				'Bromate TOTP Event: %s for user %d from IP %s',
				$event,
				$user_id,
				IpUtils::get_client_ip()
			)],
			IpUtils::get_client_ip()
		);
		
	}

	public function cleanup_expired_data(): void {
		global $wpdb;

		$wpdb->query(
			"DELETE FROM {$wpdb->options}
			WHERE option_name LIKE '_transient_timeout_bromate_totp_%'
			AND option_value < UNIX_TIMESTAMP()"
		);

		$users = get_users( array( 'fields' => 'ID' ) );
		foreach ( $users as $user_id ) {
			$this->cleanup_expired_tokens( $user_id );
		}
	}

	public function add_custom_styles(): void {
		if ( ! $this->should_show_totp() ) {
			return;
		}
		?>
		<style>
			body.bromate-totp-active #loginform > p:first-child,
			body.bromate-totp-active #loginform .user-pass-wrap,
			body.bromate-totp-active #loginform .wp-pwd,
			body.bromate-totp-active #loginform > p.forgetmenot,
			body.bromate-totp-active #loginform > p.submit,
			body.bromate-totp-active #loginform + p#nav {
				display: none !important;
			}

			body.bromate-totp-active #bromate-totp-field {
				display: block !important;
			}
			
			body.bromate-totp-active #bromate-totp-field .submit {
				display: block !important;
				margin-top: 16px;
			}
			
			body.bromate-totp-active #bromate-totp-field .submit input {
				width: 100%;
			}

			body.bromate-totp-active #login_error.notice-error {
				border-left-color: #3858e9 !important;
				border-left: 4px solid #3858e9 !important;
				background-color: #fff !important;
			}

			#bromate-totp-field {
				display: none !important;
			}
			
			body.bromate-totp-active #wp-submit {
				display: none !important;
			}
			
			body.bromate-totp-active #bromate-totp-verify-button {
				width: 100%;
				font-size: 14px;
			}
		</style>
		<?php
	}
}