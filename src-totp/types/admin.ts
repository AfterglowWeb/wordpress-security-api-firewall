export interface AdminData {
	ajaxurl?: string;
	nonce?: string;
	plugin_name?: string;
	sitename?: string;
	plugin_version?: string;
	username: string;
	is_user_enabled: boolean;
	is_profile_page: boolean;
	show_dialog: boolean;
	settings: object;
	policy: 'mandatory' | 'grace' | 'free';
	grace_period: number;
	remaining_days: number;
}