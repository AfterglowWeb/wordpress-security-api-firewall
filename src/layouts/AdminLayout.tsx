import Stack from '@mui/material/Stack';
import Navigation from '@components/Navigation';
import { useNavigation } from '@contexts/NavigationContext';

import Dashboard from '@pages/Dashboard';
import Authentication from '@pages/Authentication';
import Firewall from '@pages/Firewall';
import Routes from '@pages/Routes';
import Models from '@pages/Models';
import WordPress from '@pages/WordPress';
import LoginHardening from '@pages/LoginHardening';
import Logs from '@pages/Logs';

export default function AdminLayout() {
	const { panel } = useNavigation();

	return (
		<Navigation>
			<Stack px={0}>
				{panel === 'dashboard' && <Dashboard />}

				{panel === 'firewall' && <Firewall />}

				{panel === 'login-hardening' && <LoginHardening />}

				{panel === 'wordpress' && <WordPress />}

				{panel === 'authentication' && <Authentication />}
				
				{panel === 'routes' && <Routes />}

				{panel === 'models' && <Models />}

				{panel === 'logs' && <Logs />}
			</Stack>
		</Navigation>
	);
}