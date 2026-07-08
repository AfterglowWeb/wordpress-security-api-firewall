<?php namespace Bromate\SecurityApiFirewall\Security\WordPress;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\Security\WordPress\DisableAPIs;
use Bromate\SecurityApiFirewall\Security\WordPress\DisableComments;
use Bromate\SecurityApiFirewall\Security\WordPress\DisableEmbeds;
use Bromate\SecurityApiFirewall\Security\WordPress\DisableEmojiScripts;
use Bromate\SecurityApiFirewall\Security\WordPress\FilePermissions;
use Bromate\SecurityApiFirewall\Security\WordPress\HttpHeaders;
use Bromate\SecurityApiFirewall\Security\WordPress\RedirectTemplates;

class WordPressSecurityBootstrap {

	protected static $instance = null;

	public static function register() {
		if ( null === static::$instance ) {
			static::$instance = new static();
		}
		return static::$instance;
	}

	private function __construct() {
		DisableAPIs::register();
		DisableComments::register();
		DisableEmbeds::register();
		DisableEmojiScripts::register();
		FilePermissions::register();
		HttpHeaders::register();
		RedirectTemplates::register();
	}
}
