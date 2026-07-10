import { useCallback } from '@wordpress/element';
import RedirectFront from './RedirectFront';
import type { RedirectFrontSettings, FirewallSettings } from '@app-types/firewall';

interface RedirectFrontWrapperProps {
	settings: RedirectFrontSettings;
	onChange: <K extends keyof FirewallSettings>(key: K, value: FirewallSettings[K]) => void;
}

export default function RedirectFrontWrapper({ 
	settings, 
	onChange 
}: RedirectFrontWrapperProps): JSX.Element {
	const handleChange = useCallback(
		(key: string, value: any) => {
			onChange(key as keyof typeof settings, value);
		},
		[onChange]
	);

	return (
		<RedirectFront
			enabled={settings.redirect_front_enabled}
			options={settings.redirect_front_options}
			userUrl={settings.redirect_front_user_url}
			onChange={handleChange}
		/>
	);
}