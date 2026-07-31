import Stack from '@mui/material/Stack';
import Navigation from '@components/Navigation';
import { useNavigation } from '@contexts/NavigationContext';

import Dashboard from '@pages/Dashboard';
import Authentication from '@pages/Authentication';
import Firewall from '@pages/Firewall';
import Routes from '@pages/Routes';
import Models from '@pages/Models';
import GlobalSecurity from '@pages/GlobalSecurity';
import LoginSecurity from '@pages/LoginSecurity';
import Logs from '@pages/Logs';
import Config from '@pages/Config';

export default function AdminLayout() {
	const { panel } = useNavigation();

	return (
		<Navigation>
			<Stack px={0}>
				{panel === 'dashboard' && <Dashboard />}

				{panel === 'firewall' && <Firewall />}

				{panel === 'login-hardening' && <LoginSecurity />}

				{panel === 'wordpress' && <GlobalSecurity />}

				{panel === 'authentication' && <Authentication />}
				
				{panel === 'routes' && <Routes />}

				{panel === 'models' && <Models />}

				{panel === 'logs' && <Logs />}

				{panel === 'config' && <Config />}
			</Stack>
		</Navigation>
	);
}