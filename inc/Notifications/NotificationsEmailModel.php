<?php namespace Bromate\SecurityApiFirewall\Notifications;

use Bromate\SecurityApiFirewall\Core\Settings\SettingsRepository;

defined( 'ABSPATH' ) || exit;

final class NotificationEmailModel {

	public string $type;
	public bool $enabled;
	public string $to;
	public array $cc;
	public array $cci;
	public string $subject;
	public string $body;
	public string $format;
	public bool $attachment_logs;
	public string $attachment_logs_format;
	public bool $inline_logs;

	public ?string $recurrence = null;
	public ?string $time       = null;

	private function __construct() {}

	public static function for_type( string $type ): self {
		$type = 'digest' === $type ? 'digest' : 'instant';

		$model                         = new self();
		$model->type                   = $type;
		$model->to                     = (string) SettingsRepository::read_option( "notifications_{$type}_to" );
		$model->cc                     = (array) SettingsRepository::read_option( "notifications_{$type}_cc" );
		$model->cci                    = (array) SettingsRepository::read_option( "notifications_{$type}_cci" );
		$model->subject                = (string) SettingsRepository::read_option( "notifications_{$type}_subject" );
		$model->body                   = (string) SettingsRepository::read_option( "notifications_{$type}_body" );
		$model->format                 = (string) SettingsRepository::read_option( "notifications_{$type}_format" );
		$model->attachment_logs        = (bool) SettingsRepository::read_option( "notifications_{$type}_attachment_logs" );
		$model->attachment_logs_format = (string) SettingsRepository::read_option( "notifications_{$type}_attachment_logs_format" );
		$model->inline_logs            = (bool) SettingsRepository::read_option( "notifications_{$type}_inline_logs" );

		if ( 'digest' === $type ) {
			$model->enabled    = (bool) SettingsRepository::read_option( 'notifications_digest_enabled' );
			$model->recurrence = (string) SettingsRepository::read_option( 'notifications_digest_recurrence' );
			$model->time       = (string) SettingsRepository::read_option( 'notifications_digest_time' );
		} else {
			$model->enabled = true;
		}

		return $model;
	}

	public function has_recipients(): bool {
		return '' !== trim( $this->to ) || ! empty( $this->cc ) || ! empty( $this->cci );
	}
}
