export type SecurityModuleKey =
	| 'authentication'
	| 'firewall'
	| 'login-hardening'
	| 'wordpress'
	| 'authentication'
	| 'routes'
	| 'models'
	| 'logs';

export type SecurityModule = {
	key: SecurityModuleKey;
	title: string;
	description: string;
	enabled: boolean;
};