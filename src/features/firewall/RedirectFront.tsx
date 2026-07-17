// features/firewall/RedirectFront.tsx
import { useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';

const TEXT_DOMAIN = 'bromate-security-api-firewall';

type RedirectFrontOptions = '404' | '401' | '403' | 'front' | 'login' | 'custom';

export interface RedirectFrontProps {
	enabled: boolean;
	options: RedirectFrontOptions;
	userUrl: string;
	onChange: (key: string, value: any) => void;
}

export default function RedirectFront({
	enabled,
	options,
	userUrl,
	onChange,
}: RedirectFrontProps): JSX.Element {
	const handleRedirectChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const value = event.target.value as RedirectFrontOptions;
			onChange('redirect_front_options', value);
		},
		[onChange]
	);

	const handleSwitchChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			onChange('redirect_front_enabled', event.target.checked);
		},
		[onChange]
	);

	const handleUrlChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			onChange('redirect_front_user_url', event.target.value);
		},
		[onChange]
	);

	return (
		<Stack flexDirection="column" gap={2} maxWidth={650}>
			<Stack flexDirection="row" gap={1} alignItems="center">
				<FormControlLabel
					label={__('Enable', 'bromate-security-api-firewall')}
					control={
						<Switch
							checked={!!enabled}
							onChange={handleSwitchChange}
						/>
					}
					sx={{ mr: 0, '& .MuiTypography-root': { lineHeight: '2em' } }}
				/>
				<Divider orientation="vertical" variant="middle" flexItem />
				<Stack>
					<Typography variant="h6">
						{__('Redirect Theme', 'bromate-security-api-firewall')}
					</Typography>
					<Typography variant="caption" color="text.secondary">
						{__(
							'Turn WordPress into a REST API resource only. All the theme templates will be redirected.',
							TEXT_DOMAIN
						)}
					</Typography>
				</Stack>
			</Stack>

			<FormControl
				component="fieldset"
				disabled={!enabled}
				sx={{ display: 'block' }}
			>
				<Typography variant="subtitle1">
					{__('Redirected Theme Response', 'bromate-security-api-firewall')}
				</Typography>
				<RadioGroup
					value={options || '404'}
					onChange={handleRedirectChange}
				>
					<FormControlLabel
						value="404"
						control={<Radio size="small" />}
						label={__('404 Not Found', TEXT_DOMAIN)}
						sx={{maxWidth:200}}
					/>
					<FormControlLabel
						value="403"
						control={<Radio size="small" />}
						label={__('403 Forbidden', TEXT_DOMAIN)}
						sx={{maxWidth:200}}
					/>
					<FormControlLabel
						value="401"
						control={<Radio size="small" />}
						label={__('401 Unauthorized', TEXT_DOMAIN)}
						sx={{maxWidth:200}}
					/>
					<FormControlLabel
						value="front"
						control={<Radio size="small" />}
						label={__('Front Page', TEXT_DOMAIN)}
						sx={{maxWidth:200}}
					/>
					<FormControlLabel
						value="login"
						control={<Radio size="small" />}
						label={__('Login Form', TEXT_DOMAIN)}
						sx={{maxWidth:200}}
					/>
					<FormControlLabel
						value="custom"
						control={<Radio size="small" />}
						label={__('Custom URL', TEXT_DOMAIN)}
						sx={{maxWidth:200}}
					/>
					<Stack sx={{ pl: 4, mt: 1 }}>
						<TextField
							label={__('Custom URL', TEXT_DOMAIN)}
							type="url"
							size="small"
							placeholder="https://example.com"
							value={userUrl || ''}
							onChange={handleUrlChange}
							disabled={
								!enabled ||
								options !== 'custom'
							}
							fullWidth
						/>
					</Stack>
					
				</RadioGroup>
			</FormControl>
		</Stack>
	);
}