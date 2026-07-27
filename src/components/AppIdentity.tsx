import { styled, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

interface AppLogoProps {
  open: boolean;
}

const AppLogo = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppLogoProps>(({ theme, open }) => ({
  height: '100%',
  width: open ? 80 : 65,
  flexShrink: 0,
  padding: open ? '0 12px' : 0,
  background: 'linear-gradient(307deg, #ffb7c4 0%, #ff002e 100%)',
  borderRadius: 0,
  fontSize: open ? '1.4rem' : '1rem',
  fontWeight: 800,
  color: '#fff',
  letterSpacing: '-0.02em',
  fontStyle: 'italic',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: theme.transitions.create(['width', 'font-size'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
}));

interface AppIdentityProps {
  open?: boolean;
}

export default function AppIdentity({ open = true }: AppIdentityProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 0,
        height: 75,
        width: open ? 220 : 65,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        overflow: 'hidden',
        flexShrink: 0,
        borderRight: '1px solid',
        borderColor: theme.palette.divider,
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}
    >
      <AppLogo open={open}>b.SAF</AppLogo>
      {open && (
        <Box sx={{ 
          p: 1, 
          overflow: 'hidden', 
          width: open? 132: 0, 
          transtion:'all .3s' 
          }}>
          <Typography
            textTransform="uppercase"
            variant="subtitle2"
            lineHeight={1}
            color="textPrimary"
            fontWeight={600}
            sx={{ width:132}}
          >
            Bromate Security & API Firewall
          </Typography>
        </Box>
      )}
    </Box>
  );
}