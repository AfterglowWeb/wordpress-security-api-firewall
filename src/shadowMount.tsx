import { createRoot } from '@wordpress/element';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import AppTheme from '@contexts/AppTheme';

import CssBaseline from '@mui/material/CssBaseline';

import { AdminDataProvider } from '@contexts/AdminDataContext';
import { PortalContainerContext } from '@contexts/PortalContainerContext';

import { type AdminData } from '@app-types/admin';
import App from './App';


export function createShadowRootMount(adminData: AdminData) {
  const host = document.getElementById('bromate-shadow-host');
  if (!host) return;

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const emotionContainer = document.createElement('div');
  shadowRoot.appendChild(emotionContainer);

  const cache = createCache({
    key: 'bromate-mui',
    container: emotionContainer,
    prepend: true,
  });

  const portalContainer = document.createElement('div');
  portalContainer.id = 'bromate-portal-root';
  shadowRoot.appendChild(portalContainer);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'bromate-react-root';
  shadowRoot.appendChild(mountPoint);

  const theme = createTheme(); // swap with your existing theme

  createRoot(mountPoint).render(
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <PortalContainerContext.Provider value={portalContainer}>
            <AdminDataProvider adminData={adminData}>
              <AppTheme>
              <App />
              </AppTheme>
            </AdminDataProvider>
          </PortalContainerContext.Provider>
        </ThemeProvider>
      </CacheProvider>
  );
}