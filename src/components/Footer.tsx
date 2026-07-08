import { __ } from '@wordpress/i18n';
import { useEffect } from '@wordpress/element';
import { useAdminData } from '@contexts/AdminDataContext';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

export default function Footer() {
	const { adminData } = useAdminData();

	useEffect( () => {
		if ( ! adminData ) {
		}
	}, [ adminData ] );

	if ( ! adminData ) {
		return null;
	}

	return (
		<Stack
			component="footer"
			flexDirection={ { xs: 'column', sm: 'row' } }
			gap={ 1 }
			py={ 1 }
			px={ 4 }
			justifyContent={{ xs: 'center', sm: 'flex-end' }}
			alignItems="center"
			sx={ {
				height: 40,
				boxSizing: 'border-box',
				borderTop: 1,
				borderColor: 'divider',
				background: (theme) => theme.palette.background.paper,
			} }
		>

			<Typography component="p" variant="caption" color="text.secondary">
				<Tooltip title={ 'Open in a new tab' } disableInteractive followCursor>
					<Link
					href="https://wal.abc-plugins.com"
					target="_blank"
					rel="nofollow noreferrer noopener"
					underline="always"
					variant="caption"
					>
						{ adminData.plugin_name + ' v' + adminData.plugin_version }
					</Link>
				</Tooltip>
			</Typography>
			<Typography component="p" variant="caption" color="text.secondary">
				<Tooltip title={ 'Open in a new tab' } disableInteractive followCursor>
					<Link
					href="https://creativecommons.org/licenses/by-sa/4.0/"
					target="_blank"
					rel="nofollow noreferrer noopener"
					underline="always"
					variant="caption"
					>
						{__('GPL-V2 License', 'bromate-security-api-firewall')}
					</Link>
				</Tooltip>
			</Typography>
			
		</Stack>
	);
}
