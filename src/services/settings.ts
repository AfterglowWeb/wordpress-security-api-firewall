import { apiRequest } from '@services/api';

export const SettingsAPI = {
	readOptions: () =>
		apiRequest<Record<string, any>>(
			'bromate_security_api_firewall_read_options'
		),

	updateOptions: (options: Record<string, any>) =>
		apiRequest<Record<string, any>>(
			'bromate_security_api_firewall_update_options',
			{ options: JSON.stringify(options) }
		),

	updateOption: (key: string, value: any) =>
		apiRequest<Record<string, any>>(
			'bromate_security_api_firewall_update_option',
			{
				option: JSON.stringify({ key, value }),
			}
		),

	flushRewriteRules: () =>
		apiRequest<Record<string, any>>(
			'bromate_security_api_firewall_flush_rewrite_rules'
		),
};