import { useMemo } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';

import ObjectTypeSelect from '@components/ObjectTypeSelect';
import type { RoutesSettings } from '@app-types/routes';
import { usePortalContainer } from '@contexts/PortalContainerContext';


const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

const SECURITY_DEFAULTS = {
  routes_policy_enabled: true,
  routes_policy_default_hidden_routes:  true,
  routes_policy_hidden_methods:         ['delete', 'put', 'patch'] as string[],
  routes_policy_hidden_wp_objects:      [] as string[],
  routes_policy_hidden_response_code:   '403' as const,
};

type Props = {
  settings: RoutesSettings;
  onChange: <K extends keyof RoutesSettings>(key: K, value: RoutesSettings[K]) => void;
};

export default function GlobalRoutesPolicy({ settings, onChange }: Props): JSX.Element {
  const portalContainer = usePortalContainer();

  const securityDefaultsApplied = useMemo(() => (
    !!settings.routes_policy_default_hidden_routes &&
    ['delete', 'put', 'patch'].every((m) => settings.routes_policy_hidden_methods?.includes(m)) &&
    settings.routes_policy_hidden_response_code === '403'
  ), [settings]);

  const toggleSecurityDefaults = () => {
    if (securityDefaultsApplied) {
      onChange('routes_policy_enabled', false);
      onChange('routes_policy_default_hidden_routes', false);
      onChange('routes_policy_hidden_methods', []);
      onChange('routes_policy_hidden_response_code', '404' as const);
    } else {
      (Object.entries(SECURITY_DEFAULTS) as [keyof RoutesSettings, RoutesSettings[keyof RoutesSettings]][])
        .forEach(([key, value]) => onChange(key, value));
    }
  };

  const toggleMethod = (method: string) => {
    const key = method.toLowerCase();
    const current = settings.routes_policy_hidden_methods ?? [];
    onChange(
      'routes_policy_hidden_methods',
      current.includes(key) ? current.filter((m) => m !== key) : [...current, key]
    );
  };

  return (
    <Stack spacing={3}>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={settings.routes_policy_enabled ?? false}
            onChange={(e) => onChange('routes_policy_enabled', e.target.checked)}
          />
        }
        label={__('Enable Routes Policy', 'bromate-security-api-firewall')}
      />


      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={securityDefaultsApplied}
            onChange={toggleSecurityDefaults}
          />
        }
        label={__('Apply security defaults', 'bromate-security-api-firewall')}
      />


      <Stack spacing={2} maxWidth={350}>
        <Typography variant="h6">{__('Block WordPress Objects', 'bromate-security-api-firewall')}</Typography>
        <ObjectTypeSelect
          label={__('Select types', 'bromate-security-api-firewall')}
          value={settings.routes_policy_hidden_wp_objects ?? []}
          onChange={(value: string[]) => onChange('routes_policy_hidden_wp_objects', value)}
        />
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h6">{__('Block Methods', 'bromate-security-api-firewall')}</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {HTTP_METHODS.map((method) => (
            <FormControlLabel
              key={method}
              label={method}
              control={
                <Switch
                  size="small"
                  checked={settings.routes_policy_hidden_methods?.includes(method.toLowerCase()) ?? false}
                  onChange={() => toggleMethod(method)}
                />
              }
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h6">{__('Blocked Response', 'bromate-security-api-firewall')}</Typography>
        <FormControl size="small" sx={{ maxWidth: 200 }}>
          <InputLabel>{__('Code', 'bromate-security-api-firewall')}</InputLabel>
          <Select
            MenuProps={ {
						container:portalContainer
					} }
            value={settings.routes_policy_hidden_response_code ?? '404'}
            label={__('Code', 'bromate-security-api-firewall')}
            onChange={(e) => onChange('routes_policy_hidden_response_code', e.target.value as '401' | '403' | '404')}
          >
            <MenuItem value="401">{__('401 Unauthorized', 'bromate-security-api-firewall')}</MenuItem>
            <MenuItem value="403">{__('403 Forbidden', 'bromate-security-api-firewall')}</MenuItem>
            <MenuItem value="404">{__('404 Not Found', 'bromate-security-api-firewall')}</MenuItem>
          </Select>
        </FormControl>
      </Stack>

    </Stack>
  );
}