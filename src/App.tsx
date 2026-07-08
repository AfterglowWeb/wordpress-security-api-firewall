import { useEffect } from '@wordpress/element';
import { DialogProvider } from '@contexts/DialogContext';
import { NavigationProvider } from '@contexts/NavigationContext';
import AdminLayout from '@layouts/AdminLayout';
import { SettingsAPI } from '@services/settings';
import { useAdminData } from '@contexts/AdminDataContext';

export default function App() {
	const { updateAdminData } = useAdminData();

	useEffect(() => {
		let isMounted = true;

		void (async () => {
			try {
				const settings = await SettingsAPI.readOptions();
				if (isMounted) {
					updateAdminData({ settings });
				}
			} catch (error) {
				console.error('Failed to load settings', error);
			}
		})();

		return () => {
			isMounted = false;
		};
	}, [updateAdminData]);

	return (
		<DialogProvider>
			<NavigationProvider>
				<AdminLayout />
			</NavigationProvider>
		</DialogProvider>
	);
}
