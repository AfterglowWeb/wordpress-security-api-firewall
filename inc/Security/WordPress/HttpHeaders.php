<?php namespace Bromate\SecurityApiFirewall\Security\WordPress;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

defined( 'ABSPATH' ) || exit;

class HttpHeaders {
    
    private static $instance = null;
    
    public static function register() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {

        add_action('wp_headers', [self::class, 'remove_wp_headers'], 10, 1);
        
        add_action('template_redirect', [self::class, 'send_headers_early'], 1);
        
        add_action('admin_init', [self::class, 'send_headers_early'], 1);
        
        add_action('login_init', [self::class, 'send_headers_early'], 1);
        
        add_action('do_feed', [self::class, 'send_headers_early'], 1);
        add_action('do_feed_rss', [self::class, 'send_headers_early'], 1);
        add_action('do_feed_rss2', [self::class, 'send_headers_early'], 1);
        add_action('do_feed_atom', [self::class, 'send_headers_early'], 1);
        
        add_action('wp', [self::class, 'send_headers_on_404'], 1);
    }

    public static function send_headers_early(): void {
        if (headers_sent()) {
            return;
        }
        
        self::send_security_headers();
        self::send_compression_headers();
        self::send_caching_headers();
    }

    public static function send_headers_on_404(): void {
        if (is_404() && !headers_sent()) {
            self::send_headers_early();
        }
    }
    
    public static function remove_wp_headers($headers): array {

        if (SettingsRepository::read_option('http_headers_secure')) {
            $header_options = SettingsRepository::read_option('http_headers_secure_options');
            
            if (!empty($header_options['x_powered_by'])) {
                unset($headers['X-Powered-By']);
            }
            
            if (!empty($header_options['server'])) {
                unset($headers['Server']);
            }
            
            if (!empty($header_options['x_generator'])) {
                unset($headers['X-Generator']);
            }
        }
        
        return $headers;
    }
    
    public static function add_headers_to_rest($served, $result, $request): bool {
        if (!headers_sent()) {
            self::send_headers_early();
        }
        return $served;
    }

    private static function send_security_headers(): void {
        if (!SettingsRepository::read_option('http_headers_secure')) {
            return;
        }
        
        $header_options = SettingsRepository::read_option('http_headers_secure_options');
        if (!is_array($header_options)) {
            $header_options = [];
        }

        if (!empty($header_options['x_powered_by'])) {
            header_remove('X-Powered-By');
        }
        if (!empty($header_options['server'])) {
            header_remove('Server');
        }
        if (!empty($header_options['x_generator'])) {
            header_remove('X-Generator');
        }
        
  
        if (!empty($header_options['referrer_policy'])) {
            header('Referrer-Policy: ' . esc_attr($header_options['referrer_policy']));
        }
 
        if (!empty($header_options['cross_origin_resource_policy'])) {
            header('Cross-Origin-Resource-Policy: ' . esc_attr($header_options['cross_origin_resource_policy']));
        }

        if (!empty($header_options['x_content_type_options'])) {
            header('X-Content-Type-Options: nosniff');
        }

        if (!empty($header_options['x_frame_options'])) {
            header('X-Frame-Options: SAMEORIGIN');
        }
        
        if (!empty($header_options['strict_transport_security']) && is_ssl() && !self::is_rest_request()) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
        
        if (!empty($header_options['content_security_policy'])) {
            header('Content-Security-Policy: ' . $header_options['content_security_policy']);
        }
        
        if (!empty($header_options['permissions_policy'])) {
            header('Permissions-Policy: ' . $header_options['permissions_policy']);
        }
    }
    
    private static function send_caching_headers(): void {
        if (!SettingsRepository::read_option('http_headers_caching')) {
            return;
        }
        
        $caching_options = SettingsRepository::read_option('http_headers_caching_options');
        if (!is_array($caching_options) || empty($caching_options)) {
            return;
        }
        
        if (headers_sent()) {
            return;
        }
        
        $cache_control = [];
        
        if (!empty($caching_options['no_cache'])) {
            $cache_control[] = 'no-cache';
        }
        if (!empty($caching_options['no_store'])) {
            $cache_control[] = 'no-store';
        }
        if (!empty($caching_options['must_revalidate'])) {
            $cache_control[] = 'must-revalidate';
        }
        if (!empty($caching_options['public'])) {
            $cache_control[] = 'public';
        }
        if (!empty($caching_options['private'])) {
            $cache_control[] = 'private';
        }
        if (isset($caching_options['max_age']) && $caching_options['max_age'] > 0) {
            $cache_control[] = 'max-age=' . intval($caching_options['max_age']);
        }
        
        if (!empty($cache_control)) {
            header('Cache-Control: ' . implode(', ', $cache_control));
        }
        
        if (!empty($caching_options['pragma_no_cache'])) {
            header('Pragma: no-cache');
        }
        
        if (isset($caching_options['expires']) && $caching_options['expires'] > 0) {
            header('Expires: ' . gmdate('D, d M Y H:i:s', time() + intval($caching_options['expires'])) . ' GMT');
        }
    }

	private static function send_compression_headers(): void {
        if (!SettingsRepository::read_option('http_headers_compression')) {
            return;
        }
        
        if (!headers_sent()) {
            header('Accept-Encoding: gzip, deflate, br');
            header('Vary: Accept-Encoding');
        }
    }
    
    private static function is_rest_request(): bool {
        return defined('REST_REQUEST') && REST_REQUEST;
    }

    public static function sanitize_secure_headers(array $value): array {

        $sanitized = [];
        
        foreach ([
            'x_powered_by',
            'server',
            'x_generator',
            'x_content_type_options',
            'x_frame_options',
            'strict_transport_security',
        ] as $field) {
			if( isset($value[$field]) ) {
            	$sanitized[$field] = rest_sanitize_boolean( $value[$field] );
			}
        }
        
        if (!empty($value['referrer_policy'])) {
			$referrer_policy = self::sanitize_referrer_policies($value['referrer_policy']);
			if( !empty( $referrer_policy ) ) {
            	$sanitized['referrer_policy'] = $value['referrer_policy'];
			}
        }
        
        if (!empty($value['cross_origin_resource_policy'])) {
			$cross_origin_policy = self::sanitize_cross_origin_policies($value['cross_origin_resource_policy']);
			if( !empty( $cross_origin_policy ) ) {
            	$sanitized['cross_origin_resource_policy'] = $cross_origin_policy;
			}
        }

		if (!empty($value['content_security_policy'])) {
        	$sanitized['content_security_policy'] = self::sanitize_content_security_policy($value['content_security_policy']);
		}
        
		if (!empty($value['permissions_policy'])) {
        	$sanitized['permissions_policy'] = sanitize_textarea_field($value['permissions_policy']);
		}
        return $sanitized;
    }

    public static function get_all_headers_options(): array {
        return [
            'secure_headers'      => HttpHeaders::get_secure_headers_options(),
            'caching_headers'     => HttpHeaders::get_caching_headers_options(),
            'headers_compression' => SettingsRepository::read_option('http_headers_compression'),
        ];
    }

	public static function get_secure_headers_options(): array {
		$secure_headers = SettingsRepository::read_option_settings('http_headers_secure_options');
        return $secure_headers['options'];
    }

    public static function get_caching_headers_options(): array {
		$caching_headers = SettingsRepository::read_option_settings('http_headers_caching_options');
        return $caching_headers['options'];
    }
    
    public static function sanitize_caching_headers(array $value): array {

        $sanitized = [];
        $defaults = self::get_caching_headers_options();
        
        foreach ([
            'no_cache',
            'no_store',
            'must_revalidate',
            'public',
            'private',
            'pragma_no_cache',
        ] as $field) {
            if( isset($value[$field]) ) {
            	$sanitized[$field] = rest_sanitize_boolean( $value[$field] );
			}
        }
        
        if( isset($value['max_age']) ) {
			$sanitized['max_age'] = max( 0, min( $defaults['max_age']['default'], intval( $value['max_age'] ) ) );
		}

		 if( isset($value['expires']) ) {
			$sanitized['expires'] = max( 0, min( $defaults['expires']['default'], intval( $value['expires'] ) ) );
		}
        
        return $sanitized;
    }

	private static function sanitize_referrer_policies( $policy ) {
		$options = self::get_secure_headers_options();
		$policy = sanitize_text_field( $policy );
		return in_array($policy, $options['referrer_policy']['options']) ? $policy : '';
	}

	private static function sanitize_cross_origin_policies( $policy ) {
		$options = self::get_secure_headers_options();
		$policy = sanitize_text_field( $policy );
		return in_array($policy, $options['cross_origin_policies']['options']) ? $policy : '';
	}

	private static function sanitize_content_security_policy(string $value): string {
        if ( empty( $value ) ) {
            return '';
        }
        
        $value = wp_strip_all_tags($value);
        $value = preg_replace('/[^a-zA-Z0-9\s\-\.\*:\/\'"_=;]/', '', $value);
        
        return sanitize_textarea_field($value);
    }
}