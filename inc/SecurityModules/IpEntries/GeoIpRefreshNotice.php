<?php namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

defined( 'ABSPATH' ) || exit;

final class GeoIpRefreshNotice {

	public static function register(): void {
		add_action( 'admin_notices', array( self::class, 'maybe_render_notice' ) );
		add_action( 'admin_enqueue_scripts', array( self::class, 'maybe_enqueue_script' ) );
	}

	private static function should_show(): bool {
		if ( ! current_user_can( 'manage_options' ) ) {
			return false;
		}
		$status = GeoIpLookup::get_refresh_status();
		return ! empty( $status['in_progress'] );
	}

	public static function maybe_render_notice(): void {
		if ( ! self::should_show() ) {
			return;
		}

		$status = GeoIpLookup::get_refresh_status();
		$percent = (int) ( $status['percent'] ?? 0 );
		?>
		<div id="bromate-geoip-refresh-notice" class="notice notice-info">
			<p>
				<strong><?php esc_html_e( 'Bromate Security & API Firewall', 'bromate-security-api-firewall' ); ?>:</strong>
				<span id="bromate-geoip-refresh-text">
					<?php
					printf(
						/* translators: 1: countries processed, 2: total countries, 3: percent complete */
						esc_html__( 'Building the country IP database in the background — %1$d of %2$d countries processed (%3$d%%).', 'bromate-security-api-firewall' ),
						(int) ( $status['processed'] ?? 0 ),
						(int) ( $status['total'] ?? 0 ),
						$percent
					);
					?>
				</span>
			</p>
			<div style="background:#e5e5e5;border-radius:3px;height:8px;max-width:400px;overflow:hidden;margin:0 0 12px;">
				<div id="bromate-geoip-refresh-bar" style="background:#2271b1;height:100%;width:<?php echo esc_attr( $percent ); ?>%;transition:width .4s ease;"></div>
			</div>
		</div>
		<?php
	}

	public static function maybe_enqueue_script( string $hook ): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( ! self::should_show() ) {
			return;
		}

		wp_register_script(
			'bromate-geoip-refresh-notice',
			false,
			array(),
			BROMATE_SECURITY_API_FIREWALL_VERSION,
			true
		);
		wp_enqueue_script( 'bromate-geoip-refresh-notice' );

		wp_add_inline_script(
			'bromate-geoip-refresh-notice',
			self::inline_script(),
		);

		wp_localize_script(
			'bromate-geoip-refresh-notice',
			'bromateGeoIpRefresh',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'bromate_geoip_refresh_status' ),
				'i18n'    => array(
					/* translators: 1: countries processed, 2: total countries, 3: percent complete */
					'progress' => esc_html__( 'Building the country IP database in the background — %1$d of %2$d countries processed (%3$d%%).', 'bromate-security-api-firewall' ),
					'done'     => esc_html__( 'Country IP database build complete.', 'bromate-security-api-firewall' ),
				),
			)
		);
	}

	private static function inline_script(): string {
		return <<<'JS'
( function () {
	var notice   = document.getElementById( 'bromate-geoip-refresh-notice' );
	var textEl   = document.getElementById( 'bromate-geoip-refresh-text' );
	var barEl    = document.getElementById( 'bromate-geoip-refresh-bar' );
	if ( ! notice || ! window.bromateGeoIpRefresh ) {
		return;
	}

	var cfg       = window.bromateGeoIpRefresh;
	var pollDelay = 5000;
	var timer     = null;

	function formatProgress( processed, total, percent ) {
		return cfg.i18n.progress
			.replace( '%1$d', processed )
			.replace( '%2$d', total )
			.replace( '%3$d', percent );
	}

	function poll() {
		var body = new URLSearchParams();
		body.append( 'action', 'bromate_get_geoip_refresh_status' );
		body.append( 'nonce', cfg.nonce );

		fetch( cfg.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString(),
		} )
			.then( function ( res ) { return res.json(); } )
			.then( function ( json ) {
				if ( ! json || ! json.success || ! json.data ) {
					return;
				}
				var data = json.data;

				if ( ! data.in_progress ) {
					if ( textEl ) {
						textEl.textContent = cfg.i18n.done;
					}
					if ( barEl ) {
						barEl.style.width = '100%';
					}
					window.setTimeout( function () {
						if ( notice && notice.parentNode ) {
							notice.parentNode.removeChild( notice );
						}
					}, 4000 );
					if ( timer ) {
						window.clearInterval( timer );
					}
					return;
				}

				if ( textEl ) {
					textEl.textContent = formatProgress( data.processed, data.total, data.percent );
				}
				if ( barEl ) {
					barEl.style.width = data.percent + '%';
				}
			} )
			.catch( function () {
				// Network hiccup — try again on the next tick rather than
				// surfacing an error in a passive background notice.
			} );
	}

	timer = window.setInterval( poll, pollDelay );
	poll();
} )();
JS;
	}
}