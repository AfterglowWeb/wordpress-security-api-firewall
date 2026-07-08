export type RateLimitSettings = {
	rate_limit_enabled: boolean;
	rate_limit_max: number;
	rate_limit_time: number;
	rate_limit_block_duration: number;
	rate_limit_blacklist_threshold: number;
	rate_limit_emergency_token_hash?: string;
	rate_limit_countries?: string[];
};