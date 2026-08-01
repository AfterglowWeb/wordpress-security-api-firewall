<?php namespace Bromate\SecurityApiFirewall\Notifications;

defined( 'ABSPATH' ) || exit;

final class LogsEmailFormatter {

	public const SHORTCODE = 'bromate_logs';

	/** @var array Entries currently being rendered — read by the shortcode callback. */
	private static array $active_entries = array();
	private static bool $active_is_html  = true;

	public static function register(): void {
		add_shortcode( self::SHORTCODE, array( self::class, 'render_shortcode' ) );
	}

	/**
	 * Replaces the shortcode with the rendered logs if present in the body,
	 * otherwise appends a rendered block at the end.
	 */
	public static function inject( string $body, array $entries, bool $is_html ): string {
		self::$active_entries = $entries;
		self::$active_is_html = $is_html;

		if ( has_shortcode( $body, self::SHORTCODE ) ) {
			$body = do_shortcode( $body );
		} else {
			$body .= ( $is_html ? '<br><br>' : "\n\n" ) . self::render( $entries, $is_html );
		}

		self::$active_entries = array();

		return $body;
	}

	/**
	 * Removes the shortcode without rendering anything — used when inline
	 * logs are disabled but the user still left the shortcode in the body.
	 */
	public static function strip( string $body ): string {
		$stripped = preg_replace( '/\[' . self::SHORTCODE . '(?:\s[^\]]*)?\]/', '', $body );
		return null !== $stripped ? $stripped : $body;
	}

	public static function render_shortcode(): string {
		return self::render( self::$active_entries, self::$active_is_html );
	}

	private static function render( array $entries, bool $is_html ): string {
		if ( empty( $entries ) ) {
			return $is_html
				? '<p>' . esc_html__( 'No log entries to display.', 'bromate-security-api-firewall' ) . '</p>'
				: __( 'No log entries to display.', 'bromate-security-api-firewall' );
		}

		return $is_html ? self::render_html_table( $entries ) : self::render_text_list( $entries );
	}

	private static function render_html_table( array $entries ): string {
		$rows = '';
		foreach ( $entries as $entry ) {
			$rows .= sprintf(
				'<tr><td>%1$s</td><td>%2$s</td><td>%3$s</td><td>%4$s</td></tr>',
				esc_html( $entry['created_at'] ?? '' ),
				esc_html( $entry['event'] ?? '' ),
				esc_html( $entry['severity'] ?? '' ),
				esc_html( $entry['ip'] ?? '' )
			);
		}

		return '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;">'
			. '<thead><tr>'
			. '<th>' . esc_html__( 'Date', 'bromate-security-api-firewall' ) . '</th>'
			. '<th>' . esc_html__( 'Event', 'bromate-security-api-firewall' ) . '</th>'
			. '<th>' . esc_html__( 'Severity', 'bromate-security-api-firewall' ) . '</th>'
			. '<th>' . esc_html__( 'IP', 'bromate-security-api-firewall' ) . '</th>'
			. '</tr></thead><tbody>' . $rows . '</tbody></table>';
	}

	private static function render_text_list( array $entries ): string {
		$lines = array();
		foreach ( $entries as $entry ) {
			$lines[] = sprintf(
				'[%1$s] %2$s (%3$s) - %4$s',
				$entry['created_at'] ?? '',
				$entry['event'] ?? '',
				$entry['severity'] ?? '',
				$entry['ip'] ?? ''
			);
		}
		return implode( "\n", $lines );
	}
}
