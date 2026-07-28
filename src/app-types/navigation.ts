export type PanelKey =
	| 'dashboard'
	| 'firewall'
	| 'login-hardening'
	| 'wordpress'
	| 'authentication'
	| 'routes'
	| 'models'
	| 'logs'
	| 'config';

export interface PanelDefinition {
    key: PanelKey;
    label: string;
    icon: string;
}