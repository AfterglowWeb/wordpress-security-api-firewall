<?php namespace Bromate\SecurityApiFirewall\Security\Login;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;
use WP_Error;
use WP_User;

final class Recaptcha {

	protected static ?self $instance = null;

	public static function get_instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'login_enqueue_scripts', array( $this, 'enqueue_recaptcha_script' ) );
		add_action( 'login_form', array( $this, 'render_recaptcha_field' ) );
		add_filter( 'authenticate', array( $this, 'check_before_auth' ), 5, 3 );
		add_action( 'wp_login_failed', array( $this, 'on_login_failed' ), 10 );
	}

	public function enqueue_recaptcha_script(): void {
		if ( ! $this->is_enabled() ) {
			return;
		}

		$options = $this->get_options();
		if ( empty( $options['site_key'] ) ) {
			return;
		}

		wp_enqueue_script(
			'google-recaptcha',
			'https://www.google.com/recaptcha/api.js?render=' . esc_attr( $options['site_key'] ),
			array(),
			null,
			true // Load in footer
		);
	}


	public function render_recaptcha_field(): void {
		if ( ! $this->is_enabled() ) {
			return;
		}

		$options = $this->get_options();
		if ( empty( $options['site_key'] ) ) {
			return;
		}

		?>
		<input type="hidden" name="g-recaptcha-token" id="g-recaptcha-token" value="">
		<script>
			(function() {
				var siteKey = '<?php echo esc_js( $options['site_key'] ); ?>';
				var tokenField = document.getElementById('g-recaptcha-token');
				
				if (typeof grecaptcha !== 'undefined') {
					grecaptcha.ready(function() {
						grecaptcha.execute(siteKey, {action: 'login'}).then(function(token) {
							if (tokenField) {
								tokenField.value = token;
							}
						});
					});
				}
			})();
		</script>
		<?php
	}

	public function check_before_auth( $user, $username, $password ) {
		if ( ! $this->is_enabled() ) {
			return $user;
		}

		if ( $user instanceof WP_User || $this->is_rest_api_request() ) {
			return $user;
		}

		if ( empty( $username ) || empty( $password ) ) {
			return $user;
		}

		$options = $this->get_options();
		
		if ( empty( $options['site_key'] ) || empty( $options['secret_key'] ) ) {
			return new WP_Error(
				'recaptcha_misconfigured',
				__( 'reCAPTCHA is not properly configured. Please contact the site administrator.', 'bromate-security-api-firewall' )
			);
		}

		$token = isset( $_POST['g-recaptcha-token'] ) ? sanitize_text_field( wp_unslash( $_POST['g-recaptcha-token'] ) ) : '';
		
		if ( empty( $token ) ) {
			return new WP_Error(
				'recaptcha_missing_token',
				__( 'reCAPTCHA verification failed. Please try again.', 'bromate-security-api-firewall' )
			);
		}

		$verification_result = $this->verify_recaptcha_token( $token, $options['secret_key'] );
		
		if ( is_wp_error( $verification_result ) ) {
			return $verification_result;
		}

		if ( $verification_result['score'] < $options['threshold'] ) {
			$this->log_failed_attempt( $username, $verification_result['score'] );
			return new WP_Error(
				'recaptcha_score_too_low',
				__( 'reCAPTCHA verification failed. Please try again.', 'bromate-security-api-firewall' )
			);
		}

		add_filter( 'authenticate', array( $this, 'store_recaptcha_data' ), 999, 3 );

		return $user;
	}

	/**
	 * Store reCAPTCHA data in user meta after successful authentication
	 */
	public function store_recaptcha_data( $user, $username, $password ) {
		if ( $user instanceof WP_User && isset( $_POST['g-recaptcha-token'] ) ) {
			$token = sanitize_text_field( wp_unslash( $_POST['g-recaptcha-token'] ) );
			$options = $this->get_options();
			$verification = $this->verify_recaptcha_token( $token, $options['secret_key'] );
			
			if ( ! is_wp_error( $verification ) ) {
				update_user_meta(
					$user->ID,
					'last_recaptcha_score',
					array(
						'score' => $verification['score'],
						'time'  => time(),
						'action' => 'login',
					)
				);
			}
		}
		return $user;
	}

	/**
	 * Handle failed login attempts
	 */
	public function on_login_failed(): void {
		if ( ! $this->is_enabled() ) {
			return;
		}

		// Log the failed attempt with reCAPTCHA status
		$token = isset( $_POST['g-recaptcha-token'] ) ? sanitize_text_field( wp_unslash( $_POST['g-recaptcha-token'] ) ) : '';
		$username = isset( $_POST['log'] ) ? sanitize_user( wp_unslash( $_POST['log'] ) ) : '';

		if ( ! empty( $username ) ) {
			$failed_attempts = get_transient( 'recaptcha_failed_login_' . md5( $username ) ) ?: 0;
			set_transient( 'recaptcha_failed_login_' . md5( $username ), ++$failed_attempts, HOUR_IN_SECONDS );
		}

		if ( ! empty( $token ) ) {
			$options = $this->get_options();
			$verification = $this->verify_recaptcha_token( $token, $options['secret_key'] );
			
			if ( ! is_wp_error( $verification ) ) {
				error_log( sprintf(
					'[reCAPTCHA] Failed login attempt - Username: %s, Score: %f, Action: %s',
					$username,
					$verification['score'],
					$verification['action'] ?? 'login'
				) );
			}
		}
	}

	/**
	 * Verify reCAPTCHA token with Google's API
	 *
	 * @param string $token      The reCAPTCHA token.
	 * @param string $secret_key The reCAPTCHA secret key.
	 * @return array|WP_Error
	 */
	private function verify_recaptcha_token( string $token, string $secret_key ) {
		$url = 'https://www.google.com/recaptcha/api/siteverify';
		
		$response = wp_remote_post( $url, array(
			'body' => array(
				'secret'   => $secret_key,
				'response' => $token,
				'remoteip' => $this->get_client_ip(),
			),
			'timeout' => 10,
		) );

		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'recaptcha_connection_error',
				__( 'Unable to verify reCAPTCHA. Please try again.', 'bromate-security-api-firewall' )
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( ! isset( $data['success'] ) || ! $data['success'] ) {
			$error_codes = isset( $data['error-codes'] ) ? implode( ', ', $data['error-codes'] ) : 'unknown';
			return new WP_Error(
				'recaptcha_verification_failed',
				sprintf(
					__( 'reCAPTCHA verification failed. Error: %s', 'bromate-security-api-firewall' ),
					$error_codes
				)
			);
		}

		// For v3, check the action matches
		if ( isset( $data['action'] ) && $data['action'] !== 'login' ) {
			return new WP_Error(
				'recaptcha_invalid_action',
				__( 'Invalid reCAPTCHA action.', 'bromate-security-api-firewall' )
			);
		}

		return array(
			'score'   => (float) $data['score'],
			'action'  => $data['action'] ?? 'login',
			'hostname' => $data['hostname'] ?? '',
		);
	}

	/**
	 * Check if reCAPTCHA is enabled
	 */
	private function is_enabled(): bool {
		return (bool) SettingsRepository::read_option( 'login_recaptcha_enabled' );
	}

	/**
	 * Get reCAPTCHA options
	 */
	private function get_options(): array {
		return array(
			'site_key'   => (string) SettingsRepository::read_option( 'login_recaptcha_site_key' ),
			'secret_key' => (string) SettingsRepository::read_option( 'login_recaptcha_secret_key' ),
			'threshold'  => (float) SettingsRepository::read_option( 'login_recaptcha_threshold', 0.5 ),
		);
	}

	/**
	 * Log failed reCAPTCHA attempt
	 */
	private function log_failed_attempt( string $username, float $score ): void {
		error_log( sprintf(
			'[reCAPTCHA] Failed verification - Username: %s, Score: %f, IP: %s',
			$username,
			$score,
			$this->get_client_ip()
		) );
	}

	/**
	 * Get client IP address
	 */
	private function get_client_ip(): string {
		$ip_address = '';
		
		if ( isset( $_SERVER['HTTP_CLIENT_IP'] ) ) {
			$ip_address = $_SERVER['HTTP_CLIENT_IP'];
		} elseif ( isset( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
			$ip_address = $_SERVER['HTTP_X_FORWARDED_FOR'];
		} elseif ( isset( $_SERVER['HTTP_X_FORWARDED'] ) ) {
			$ip_address = $_SERVER['HTTP_X_FORWARDED'];
		} elseif ( isset( $_SERVER['HTTP_FORWARDED_FOR'] ) ) {
			$ip_address = $_SERVER['HTTP_FORWARDED_FOR'];
		} elseif ( isset( $_SERVER['HTTP_FORWARDED'] ) ) {
			$ip_address = $_SERVER['HTTP_FORWARDED'];
		} elseif ( isset( $_SERVER['REMOTE_ADDR'] ) ) {
			$ip_address = $_SERVER['REMOTE_ADDR'];
		}
		
		return sanitize_text_field( $ip_address );
	}

	/**
	 * Check if the current request is a REST API request
	 */
	private function is_rest_api_request(): bool {
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return true;
		}
		
		if ( isset( $_SERVER['REQUEST_URI'] ) ) {
			$rest_route = rest_get_url_prefix();
			$request_uri = esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) );
			return false !== strpos( $request_uri, '/' . $rest_route . '/' );
		}
		
		return false;
	}
}