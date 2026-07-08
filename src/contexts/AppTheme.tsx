import { ThemeProvider, createTheme } from '@mui/material';

const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      light:'#4c69e7',
      main: '#3858e9',
      dark: '#183ad6',
    },
    error: {
      light: '#c83030',
      main: '#cc1818',
      dark: '#b32d2e',
    },
    warning: {
      main: '#dba617',
    },
    success: {
      main: '#00a32a',
    },
    info: {
      main: '#72aee6',
    },
    background: {
      default: '#f0f0f1',
      paper: '#ffffff',
    },
    text: {
      primary: '#1d2327',
      secondary: '#646970',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
    fontSize: 13,
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 0,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 780,
      lg: 960,
      xl: 1280,
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
          textTransform: 'none',
          padding: '6px 16px',
          fontWeight: 500,
          '&.MuiButton-sizeSmall': {
            padding: '4px 12px',
            fontSize: '0.8125rem',
          },
          '&.MuiButton-sizeLarge': {
            padding: '8px 24px',
            fontSize: '1rem',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        text: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
  },
});

interface AppThemeProps {
  children: JSX.Element;
}

export default function AppTheme({ children }: AppThemeProps): JSX.Element {
  return (
    <ThemeProvider theme={appTheme}>
      {children}
    </ThemeProvider>
  );
}