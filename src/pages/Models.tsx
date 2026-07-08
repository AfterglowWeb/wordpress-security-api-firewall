import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useAdminData } from '@contexts/AdminDataContext';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

export default function Models() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { adminData } = useAdminData();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !adminData.has_rest_api_models) return;

    const mount = () => {
      if (typeof window.bromateModelsApp === 'function' && container) {
        cleanupRef.current = window.bromateModelsApp(adminData, container);
      }
    };

    if (typeof window.bromateModelsApp === 'function') {
      mount();
    } else {
      window.addEventListener('bromate-models-app-ready', mount, { once: true });
    }

    return () => {
      window.removeEventListener('bromate-models-app-ready', mount);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [adminData]);

  if (!adminData.has_rest_api_models) {
    return (
      <Alert severity="info" sx={{ maxWidth: 600 }}>
        <AlertTitle>{__('Models', 'bromate-security-api-firewall')}</AlertTitle>
        {__(
          'Install and activate the Bromate REST API Models plugin to define and manage custom models for your REST API.',
          'bromate-security-api-firewall'
        )}
      </Alert>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  );
}