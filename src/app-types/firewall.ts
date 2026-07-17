export type RedirectFrontOptions = '404' | 'front' | 'login' | 'custom';

export interface RedirectFrontSettings {
	redirect_front_enabled: boolean;
	redirect_front_options: RedirectFrontOptions;
	redirect_front_user_url: string;
}

export interface FirewallSettings extends RedirectFrontSettings {
	rate_limit_enabled: boolean;
	rate_limit_max: number;
	rate_limit_time: number;
	rate_limit_block_duration: number;
	rate_limit_blacklist_threshold: number;
	rate_limit_violation_window: number;
	rate_limit_countries: string[];
}

export const DEFAULT_REDIRECT_FRONT_SETTINGS: RedirectFrontSettings = {
	redirect_front_enabled: false,
	redirect_front_options: '404',
	redirect_front_user_url: '',
};

export const DEFAULT_FIREWALL_SETTINGS: FirewallSettings = {
	...DEFAULT_REDIRECT_FRONT_SETTINGS,
	rate_limit_enabled: false,
	rate_limit_max: 120,
	rate_limit_time: 60,
	rate_limit_block_duration: 60,
	rate_limit_blacklist_threshold: 5,
	rate_limit_violation_window:300,
	rate_limit_countries: [],
};