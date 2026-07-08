import { styled, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';

const AppLogo = styled( Box )( () => ( {
	height: '100%',
	width:120,
	padding: '0 12px',
	background: 'linear-gradient(307deg, #ffb7c4 0%, #ff002e 100%)',
	borderRadius: 0,
	fontSize: '1.4rem',
	fontWeight: 800,
	color: '#fff',
	letterSpacing: '-0.02em',
	fontStyle: 'italic',
	position: 'relative',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	
} ) );

export default function AppIdentity() {
	const theme = useTheme();

	return (
		<Box
			sx={ {
				p:0,
				height: 75,
				width:220,
				display: 'flex',
				alignItems: 'center',
				gap: 1,
				borderRight: '1px solid',
				borderColor: theme.palette.divider,
			} }
		>
			<AppLogo>RAF</AppLogo>
			<Box sx={{p:1}}>
				<Typography 
				textTransform="uppercase" 
				variant="subtitle2" 
				lineHeight={1} 
				color="textPrimary"
				fontWeight={ 600 }>
					WP Security & API Firewall
				</Typography>
			</Box>
		</Box>
	);
}
