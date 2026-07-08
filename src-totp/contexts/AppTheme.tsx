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
      contrastText: '#ffffff'
    },
    warning: {
      light: '#e2b22e',
      main: '#dba617',
      dark: '#daa106',
      contrastText: '#ffffff'
    },
    success: {
      main: '#00a32a',
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
    subtitle1: {
      fontSize: '1.3em',
      fontWeight: 600,
      lineHeight: 1.4,
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
    MuiIconButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '20px 24px 12px 24px',
          fontSize: '1.125rem',
          fontWeight: 600,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '8px 24px 16px 24px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '8px 24px 20px 24px',
          gap: '8px',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            '& fieldset': {
              borderRadius: 0,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderCollapse: 'collapse',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #e0e0e0',
          padding: '12px 16px',
        },
        head: {
          fontWeight: 600,
          color: '#1d2327',
        },
      },
    },
    MuiStepper: {
      styleOverrides: {
        root: {
          padding: 0,
        },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontWeight: 500,
          '&.Mui-active': {
            fontWeight: 600,
          },
        },
      },
    },
    MuiStepContent: {
      styleOverrides: {
        root: {
          borderLeft: '1px solid #e0e0e0',
          paddingLeft: '24px',
          marginLeft: '12px',
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