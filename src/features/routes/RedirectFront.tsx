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

import type { RoutesSettings, RedirectFrontOptions } from '@app-types/routes';

const TEXT_DOMAIN = 'bromate-security-api-firewall';

interface RedirectFrontProps {
	enabled: boolean;
	options: RedirectFrontOptions;
	userUrl: string;
	onChange: (key: keyof RoutesSettings, value: any) => void;
}

export default function RedirectFront({
	enabled,
	options,
	userUrl,
	onChange,
}: RedirectFrontProps): JSX.Element {
	const getSelectedRedirectOption = useCallback((): RedirectFrontOptions => {
		return options || '404';
	}, [options]);

	const handleRedirectChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const value = event.target.value as RedirectFrontOptions;
			onChange('redirect_front_options', value);
		},
		[onChange]
	);

	const setField = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const { name, value, checked, type } = event.target;
			const val = type === 'checkbox' ? checked : value;
			onChange(name as keyof RoutesSettings, val);
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
					onChange={setField}
					/>
					}
					sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
				/>
				<Divider orientation="vertical" variant="middle" flexItem />
				<Stack>
				<Typography variant="h6">{__('Redirect Front', 'bromate-security-api-firewall')}</Typography>
				<Typography variant="caption" color="text.secondary">
					{__('Turn WordPress into an Application resource only', TEXT_DOMAIN)}
				</Typography>
				</Stack>
			</Stack>

			<FormControl
				component="fieldset"
				disabled={!enabled}
				sx={{ display: 'block' }}
			>
				<RadioGroup
					value={getSelectedRedirectOption()}
					onChange={handleRedirectChange}
				>
					<FormControlLabel
						value="404"
						control={<Radio size="small" />}
						label={__('404 Not Found Response', TEXT_DOMAIN)}
					/>
					<FormControlLabel
						value="login"
						control={<Radio size="small" />}
						label={__('WordPress Login URL', TEXT_DOMAIN)}
					/>
					<FormControlLabel
						value="custom"
						control={<Radio size="small" />}
						label={__('Custom URL', TEXT_DOMAIN)}
					/>

					<Stack sx={{ pl: 4, mt: 1 }}>
						<TextField
							label={__('Custom URL', TEXT_DOMAIN)}
							type="url"
							size="small"
							name="redirect_front_user_url"
							placeholder="https://example.com"
							value={userUrl}
							onChange={setField as any}
							disabled={
								!enabled ||
								getSelectedRedirectOption() !== 'custom'
							}
							fullWidth
							helperText={__('Full URL with protocol and domain', TEXT_DOMAIN)}
						/>
					</Stack>
				</RadioGroup>
			</FormControl>
		</Stack>
	);
}