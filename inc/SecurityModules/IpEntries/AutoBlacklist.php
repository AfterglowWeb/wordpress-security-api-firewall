<?php namespace Bromate\SecurityApiFirewall\SecurityModules\IpEntries;

use Bromate\SecurityApiFirewall\SecurityModules\IpEntries\IpEntriesRepository;

defined( 'ABSPATH' ) || exit;

class AutoBlacklist {

	private const AUTO_BLACKLIST_ORIGINS = ['auth_user_ip','public_rate_limit','login_attempts_limit','auth_attempts_limit','country'];

    public static function is_auto_blacklisted( string $ip ): bool {
        $entry = IpEntriesRepository::find_by_ip( $ip, 'blacklist' );
                
        return $entry && in_array( $entry['entry_origin'], self::AUTO_BLACKLIST_ORIGINS, true );
    }

    public static function auto_blacklist_ip(
        string $ip,
        int $duration = 0,
        bool $unlimited = false,
        string $origin = 'public_rate_limit'
    ): void {
        
        $expires_at = null;
        if ( ! $unlimited && $duration > 0 ) {
            $expires_at = gmdate( 'Y-m-d H:i:s', time() + $duration );
        }

        $existing = IpEntriesRepository::find_by_ip( $ip, 'blacklist' );

        if ( $existing ) {
            if ( in_array( $existing['entry_origin'], self::AUTO_BLACKLIST_ORIGINS, true ) ) {
                IpEntriesRepository::update( $existing['id'], array( 'expires_at' => $expires_at ) );
            }
            return;
        }

        IpEntriesRepository::insert( array(
            'ip'           => $ip,
            'list_type'    => 'blacklist',
            'entry_origin' => $origin,
            'entry_type'   => 'ip',
            'expires_at'   => $expires_at,
        ) );
    }

}