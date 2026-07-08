import { createRoot } from '@wordpress/element';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import CssBaseline from '@mui/material/CssBaseline';

import { AdminDataProvider } from '@totp-contexts/AdminDataContext';
import { PortalContainerContext } from '@totp-contexts/PortalContainerContext';

import { type AdminData } from '@totp-types/admin';
import AppTheme from '@totp-contexts/AppTheme';
import App from './App';

export function createShadowRootMount(adminData: AdminData) {
  const host = document.getElementById('bromate-security-api-firewall-totp-shadow-host');
  if (!host) return;

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const emotionContainer = document.createElement('div');
  shadowRoot.appendChild(emotionContainer);

  const cache = createCache({
    key: 'bromate-security-api-firewall-totp-mui',
    container: emotionContainer,
    prepend: true,
  });

  const portalContainer = document.createElement('div');
  portalContainer.id = 'bromate-security-api-firewall-totp-portal-root';
  shadowRoot.appendChild(portalContainer);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'bromate-security-api-firewall-totp-react-root';
  shadowRoot.appendChild(mountPoint);

  createRoot(mountPoint).render(
      <CacheProvider value={cache}>
          <CssBaseline />
          <PortalContainerContext.Provider value={portalContainer}>
            <AdminDataProvider adminData={adminData}>
              <AppTheme>
              <App />
              </AppTheme>
            </AdminDataProvider>
          </PortalContainerContext.Provider>
      </CacheProvider>
  );
}


