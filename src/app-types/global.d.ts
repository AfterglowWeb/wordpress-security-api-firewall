
export {};

declare global {
	interface Window {
		bromateSecurityApiFirewall: AdminData;
		bromateModelsApp?: (adminData: AdminData, container: HTMLElement) => () => void;

	}
}

