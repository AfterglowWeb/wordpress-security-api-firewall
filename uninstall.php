<?php defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wp_filesystem;

if ( $wp_filesystem instanceof WP_Filesystem_Base && $wp_filesystem->exists( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
}

if ( class_exists( 'Bromate\\SecurityApiFirewall\\Core\\Bootstrap' ) ) {
	Bromate\SecurityApiFirewall\Core\Bootstrap::uninstall();
}
