import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import TextField from '@mui/material/TextField';

import ObjectTypeSelect from '@components/ObjectTypeSelect';
import type { RoutesSettings } from '@app-types/routes';


const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

const SECURITY_DEFAULTS = {
  routes_policy_enabled: true,
  routes_policy_default_hidden_routes:  true,
  routes_policy_hidden_methods:         ['delete', 'put', 'patch'] as string[],
  routes_policy_hidden_wp_objects:      [] as string[],
  routes_policy_auth_enforce:           false,
  routes_policy_hidden_routes_redirect_option: '403' as const,
  routes_policy_hidden_routes_redirect_user_url: '',
};

type Props = {
  settings: RoutesSettings;
  onChange: <K extends keyof RoutesSettings>(key: K, value: RoutesSettings[K]) => void;
};

export default function GlobalRoutesPolicy({ settings, onChange }: Props): JSX.Element {

  const enabled = settings.routes_policy_enabled ?? false;

  const securityDefaultsApplied = useMemo(() => (
    !!settings.routes_policy_default_hidden_routes &&
    ['delete', 'put', 'patch'].every((m) => settings.routes_policy_hidden_methods?.includes(m)) &&
    settings.routes_policy_hidden_routes_redirect_option === '403'
  ), [settings]);

  const toggleSecurityDefaults = () => {
    if (securityDefaultsApplied) {
      onChange('routes_policy_default_hidden_routes', false);
      onChange('routes_policy_hidden_methods', []);
      onChange('routes_policy_hidden_routes_redirect_option', '403' as const);
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
    <Stack flexDirection="column" gap={3} maxWidth={650}>

      <Stack flexDirection="row" gap={1} alignItems="center">
				<FormControlLabel
					label={__('Enable', 'bromate-security-api-firewall')}
					control={
					<Switch
            checked={enabled}
            onChange={(e) => onChange('routes_policy_enabled', e.target.checked)}
					/>
					}
					sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
				/>
				<Divider orientation="vertical" variant="middle" flexItem />
				<Stack>
				  <Typography variant="h6">{__('REST API Control', 'bromate-security-api-firewall')}</Typography>
				</Stack>
			</Stack>

      <Stack flexDirection="column" gap={2} sx={{ opacity: enabled ? 1 : 0.6 }}>

        <FormControlLabel
          control={
            <Switch
              checked={securityDefaultsApplied}
              onChange={toggleSecurityDefaults}
              disabled={!enabled}
            />
          }
          label={__('Apply Security Defaults', 'bromate-security-api-firewall')}
        />


        <Stack spacing={2} maxWidth={350}>
          <Typography variant="body1">{__('Disable WordPress Objects', 'bromate-security-api-firewall')}</Typography>
          <ObjectTypeSelect
            label={__('Select types', 'bromate-security-api-firewall')}
            value={settings.routes_policy_hidden_wp_objects ?? []}
            onChange={(value: string[]) => onChange('routes_policy_hidden_wp_objects', value)}
            disabled={!enabled}
          />
        </Stack>

        <Stack spacing={0}>
          <Typography variant="body1">{__('Disable Methods', 'bromate-security-api-firewall')}</Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {HTTP_METHODS.map((method) => (
              <FormControlLabel
                key={method}
                label={method}
                control={
                  <Switch
                    checked={settings.routes_policy_hidden_methods?.includes(method.toLowerCase()) ?? false}
                    onChange={() => toggleMethod(method)}
                    disabled={!enabled}
                  />
                }
              />
            ))}
          </Stack>

        </Stack>

        <FormControl
        component="fieldset"
        disabled={!enabled}
        sx={{ display: 'block' }}
        >
          <Typography variant="subtitle1">
            {__('Disabled Routes Response', 'bromate-security-api-firewall')}
          </Typography>
          <RadioGroup
            value={settings.routes_policy_hidden_routes_redirect_option ?? '404'}
            onChange={(e) => onChange('routes_policy_hidden_routes_redirect_option', e.target.value as '401' | '403' | '404' | 'front' | 'login' | 'custom')}
          >
            <FormControlLabel
              value="404"
              control={<Radio size="small" />}
              label={__('404 Not Found', 'bromate-security-api-firewall')}
            />
            <FormControlLabel
              value="403"
              control={<Radio size="small" />}
              label={__('403 Forbidden', 'bromate-security-api-firewall')}
            />
            <FormControlLabel
              value="401"
              control={<Radio size="small" />}
              label={__('401 Unauthorized', 'bromate-security-api-firewall')}
            />
            <FormControlLabel
              value="front"
              control={<Radio size="small" />}
              label={__('Front Page', 'bromate-security-api-firewall')}
            />
            <FormControlLabel
              value="login"
              control={<Radio size="small" />}
              label={__('Login Form', 'bromate-security-api-firewall')}
            />
            <FormControlLabel
              value="custom"
              control={<Radio size="small" />}
              label={__('Custom URL', 'bromate-security-api-firewall')}
            />
            <Stack sx={{ pl: 4, mt: 1 }}>
              <TextField
              label={__('Custom URL', 'bromate-security-api-firewall')}
              type="url"
              size="small"
              placeholder="https://example.com"
              value={settings.routes_policy_hidden_routes_redirect_user_url || ''}
              onChange={(e) => onChange('routes_policy_hidden_routes_redirect_user_url',  e.target.value)}
              disabled={
                !enabled ||
                settings.routes_policy_hidden_routes_redirect_option !== 'custom'
              }
              fullWidth
            />
            </Stack>
            
          </RadioGroup>
        </FormControl>
 
        <FormControlLabel
          sx={{mt:1}}
          label={
          <>
          <Typography variant="body1">{__('Enforce Authentication On `wp/v2/*` Routes', 'bromate-security-api-firewall')}</Typography>
          <Typography variant="caption">{__('You may control plugin routes in the REST API tree.', 'bromate-security-api-firewall')}</Typography>
          </>
          }
          control={
            <Switch
              checked={settings.routes_policy_auth_enforce ?? false}
              onChange={(e) => onChange('routes_policy_auth_enforce',  e.target.checked)}
              disabled={!enabled}
            />
          }
        />

      </Stack>

    </Stack>
  );
}