export type SecurityModuleKey =
	| 'authentication'
	| 'firewall'
	| 'routes'
	| 'wordpress'
	| 'models'
	| 'logs';

export type SecurityModule = {
	key: SecurityModuleKey;
	title: string;
	description: string;
	enabled: boolean;
};