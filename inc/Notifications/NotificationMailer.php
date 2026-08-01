<?php namespace Bromate\SecurityApiFirewall\Notifications;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsMigrate;

final class NotificationMailer {

	public static function send( NotificationEmailModel $model, array $entries ): bool {
		if ( ! $model->enabled || ! $model->has_recipients() ) {
			return false;
		}

		$is_html = 'html' === $model->format;

		$body = $model->inline_logs
			? LogsEmailFormatter::inject( $model->body, $entries, $is_html )
			: LogsEmailFormatter::strip( $model->body );

		$headers = array();

		if ( $is_html ) {
			$headers[] = 'Content-Type: text/html; charset=UTF-8';
		}

		foreach ( $model->cc as $cc_address ) {
			$headers[] = 'Cc: ' . $cc_address;
		}

		foreach ( $model->cci as $bcc_address ) {
			$headers[] = 'Bcc: ' . $bcc_address;
		}

		$attachment_path = null;
		$attachments     = array();

		if ( $model->attachment_logs && ! empty( $entries ) ) {
			$attachment_path = self::build( $entries, $model->attachment_logs_format );
			if ( $attachment_path ) {
				$attachments[] = $attachment_path;
			}
		}

		$sent = wp_mail( $model->to, $model->subject, $body, $headers, $attachments );

		if ( $attachment_path && file_exists( $attachment_path ) ) {
			wp_delete_file( $attachment_path );
		}

		return $sent;
	}

	public static function build( array $entries, string $format ): ?string {
		global $wpdb;
		$format       = 'json' === $format ? 'json' : 'csv';
		$file_details = SettingsMigrate::get_instance()->export_table_data( $wpdb->prefix . 'bromate_security_api_firewall_logs', $entries, $format );
		return $file_details ? $file_details['path'] : null;
	}
}
