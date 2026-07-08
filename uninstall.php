<?php defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

if ( file_exists( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
}

if ( class_exists( 'Bromate\\SecurityApiFirewall\\Core\\Bootstrap' ) ) {
	Bromate\SecurityApiFirewall\Core\Bootstrap::uninstall();
}
