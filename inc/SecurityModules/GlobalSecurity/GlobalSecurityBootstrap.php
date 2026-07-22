<?php namespace Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity;

defined( 'ABSPATH' ) || exit;

use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\DisableAPIs;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\DisableComments;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\DisableEmbeds;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\DisableEmojiScripts;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\FilePermissions;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\HttpHeaders;
use Bromate\SecurityApiFirewall\SecurityModules\GlobalSecurity\RedirectTemplates;

class GlobalSecurityBootstrap {

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
