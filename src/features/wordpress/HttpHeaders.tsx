import { useState, useCallback, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';

import { apiRequest } from '@services/api';

type HeaderOption = {
	type: 'boolean' | 'string' | 'integer';
	label: string;
	default: any;
	options?: string[];
	min?: number;
	max?: number;
};

type SecureHeaders = {
	x_powered_by: boolean;
	server: boolean;
	x_generator: boolean;
	referrer_policy: string;
	cross_origin_resource_policy: string;
	x_content_type_options: boolean;
	x_frame_options: boolean;
	strict_transport_security: boolean;
	content_security_policy: string;
	permissions_policy: string;
};

type CachingHeaders = {
	no_cache: boolean;
	no_store: boolean;
	must_revalidate: boolean;
	public: boolean;
	private: boolean;
	max_age: number;
	pragma_no_cache: boolean;
	expires: number;
};

type HeadersOptions = {
	secure_headers: Record<string, HeaderOption>;
	caching_headers: Record<string, HeaderOption>;
	headers_compression: boolean;
};

type HttpHeadersProps = {
	secureEnabled: boolean;
    cachingEnabled: boolean;
	compressionEnabled: boolean;
	onSecureChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onCachingChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onCompressionChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onSettingsChange: (settings: any) => void;
};

export default function HttpHeaders({ 
	secureEnabled, 
	compressionEnabled,
    cachingEnabled,
	onSecureChange,
	onCachingChange,
	onCompressionChange,
	onSettingsChange
}: HttpHeadersProps) {
	const [loading, setLoading] = useState(true);
	const [options, setOptions] = useState<HeadersOptions | null>(null);
	const [secureHeaders, setSecureHeaders] = useState<SecureHeaders>({
		x_powered_by: true,
		server: true,
		x_generator: true,
		referrer_policy: 'strict-origin-when-cross-origin',
		cross_origin_resource_policy: 'same-site',
		x_content_type_options: true,
		x_frame_options: true,
		strict_transport_security: true,
		content_security_policy: '',
		permissions_policy: '',
	});
	const [cachingHeaders, setCachingHeaders] = useState<CachingHeaders>({
		no_cache: false,
		no_store: true,
		must_revalidate: false,
		public: false,
		private: false,
		max_age: 0,
		pragma_no_cache: true,
		expires: 0,
	});

	// Load headers options
	useEffect(() => {
		const loadOptions = async () => {
			try {
				const data = await apiRequest<HeadersOptions>('bromate_get_headers_options');
				setOptions(data);
				
				// Load secure headers
				if (data.secure_headers) {
					const secureValues: any = {};
					Object.keys(data.secure_headers).forEach(key => {
						secureValues[key] = data.secure_headers[key].default;
					});
					setSecureHeaders(secureValues);
				}
				
				// Load caching headers
				if (data.caching_headers) {
					const cachingValues: any = {};
					Object.keys(data.caching_headers).forEach(key => {
						cachingValues[key] = data.caching_headers[key].default;
					});
					setCachingHeaders(cachingValues);
				}
			} catch (error) {
				console.error('Failed to load headers options:', error);
			} finally {
				setLoading(false);
			}
		};
		
		loadOptions();
	}, []);

	useEffect(() => {
		onSettingsChange({
			http_headers_secure_options: secureHeaders,
			http_headers_caching_options: cachingHeaders,
		});
	}, [secureHeaders, cachingHeaders, onSettingsChange]);

	const handleSecureFieldChange = useCallback((field: keyof SecureHeaders) => {
		return (event: React.ChangeEvent<HTMLInputElement>) => {
			const value = event.target.type === 'checkbox' 
				? (event.target as HTMLInputElement).checked 
				: event.target.value;
			setSecureHeaders(prev => ({ ...prev, [field]: value }));
		};
	}, []);

	const handleCachingFieldChange = useCallback((field: keyof CachingHeaders) => {
		return (event: React.ChangeEvent<HTMLInputElement>) => {
			const value = event.target.type === 'checkbox' 
				? event.target.checked 
				: parseInt(event.target.value, 10) || 0;
			setCachingHeaders(prev => ({ ...prev, [field]: value }));
		};
	}, []);

	const renderBooleanField = (key: string, option: HeaderOption, value: boolean, onChange: any, disabled: boolean) => (
		<FormControl key={key} fullWidth size="small" disabled={disabled}>
			<FormControlLabel
				control={
					<Switch
						checked={value}
						onChange={onChange}
						name={key}
						size="small"
					/>
				}
				label={option.label}
			/>
		</FormControl>
	);

	const renderSelectField = (key: string, option: HeaderOption, value: string, onChange: any, disabled: boolean) => (
		<FormControl key={key} fullWidth size="small" disabled={disabled}>
			<FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
				{option.label}
			</FormLabel>
			<Select
				value={value}
				onChange={onChange}
				name={key}
				size="small"
			>
				{option.options?.map((opt) => (
					<MenuItem key={opt} value={opt}>
						{opt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
					</MenuItem>
				))}
			</Select>
		</FormControl>
	);

	const renderTextField = (key: string, option: HeaderOption, value: string, onChange: any, disabled: boolean) => (
		<FormControl key={key} fullWidth size="small" disabled={disabled}>
			<FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
				{option.label}
			</FormLabel>
			<TextField
				value={value}
				onChange={onChange}
				name={key}
				multiline
				rows={3}
				placeholder={option.default || ''}
				size="small"
				fullWidth
			/>
		</FormControl>
	);

	const renderIntegerField = (key: string, option: HeaderOption, value: number, onChange: any, disabled: boolean) => (
		<FormControl key={key} fullWidth size="small" disabled={disabled}>
			<FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
				{option.label}
			</FormLabel>
			<TextField
				type="number"
				value={value}
				onChange={onChange}
				name={key}
				slotProps={{
                    htmlInput:{
                        min: option.min || 0,
                        max: option.max || 31536000,
                        step: 1,
                    }
				}}
				size="small"
				fullWidth
			/>
		</FormControl>
	);

	const renderSecureHeaderField = (key: string, option: HeaderOption) => {
		const value = secureHeaders[key as keyof SecureHeaders];
		const disabled = !secureEnabled;

		switch (option.type) {
			case 'boolean':
				return renderBooleanField(
					key, 
					option, 
					value as boolean,
					handleSecureFieldChange(key as keyof SecureHeaders),
                    disabled as boolean, 
				);
			case 'string':
				if (option.options) {
					return renderSelectField(
						key,
						option,
						value as string,
						handleSecureFieldChange(key as keyof SecureHeaders),
                        disabled as boolean, 
					);
				}
				return renderTextField(
					key,
					option,
					value as string,
					handleSecureFieldChange(key as keyof SecureHeaders),
                    disabled as boolean, 
				);
			default:
				return null;
		}
	};

	const renderCachingHeaderField = (key: string, option: HeaderOption) => {
		const value = cachingHeaders[key as keyof CachingHeaders];
		const disabled = !cachingEnabled;

		switch (option.type) {
			case 'boolean':
				return renderBooleanField(
					key,
					option,
					value as boolean,
					handleCachingFieldChange(key as keyof CachingHeaders),
                    disabled as boolean, 
				);
			case 'integer':
				return renderIntegerField(
					key,
					option,
					value as number,
					handleCachingFieldChange(key as keyof CachingHeaders),
                    disabled as boolean, 
				);
			default:
				return null;
		}
	};

	if (loading || !options) {
		return (
			<Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
				<Typography variant="body2" color="textSecondary">
					{__('Loading headers options...', 'bromate-security-api-firewall')}
				</Typography>
			</Box>
		);
	}

	return (
		<Stack spacing={3}>

			{/* Secure Headers Configuration */}
            <Paper sx={{ p: 2 }} elevation={0}>
                <Stack flexDirection="column" gap={2}>
                    
                    <Stack flexDirection="row" gap={1} alignItems="center">
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={secureEnabled}
                                    name="http_headers_secure"
                                    onChange={onSecureChange}
                                />
                            }
                            label={__('Enable', 'bromate-security-api-firewall')}
                            sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
                        />
                        <Divider orientation="vertical" variant="middle" flexItem />
                        <Typography variant="h6">
                            {__('Secure HTTP Headers', 'bromate-security-api-firewall')}
                        </Typography>
                    </Stack>
                    
                    <Grid container spacing={2}>
                        {/* Remove Headers Section */}
                        <Grid size={12}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                {__('Remove Sensitive Headers', 'bromate-security-api-firewall')}
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                                {['x_powered_by', 'server', 'x_generator'].map((key) => {
                                    const option = options.secure_headers[key];
                                    if (!option) return null;
                                    return renderSecureHeaderField(key, option);
                                })}
                            </Stack>
                        </Grid>

                        {/* Policy Headers */}
                        <Grid size={{xs:12,md:6}}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                {__('Policy Headers', 'bromate-security-api-firewall')}
                            </Typography>
                            <Stack spacing={2}>
                                {['referrer_policy', 'cross_origin_resource_policy'].map((key) => {
                                    const option = options.secure_headers[key];
                                    if (!option) return null;
                                    return renderSecureHeaderField(key, option);
                                })}
                            </Stack>
                        </Grid>

                        {/* Security Options */}
                        <Grid size={{xs:12,md:6}}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                {__('Security Options', 'bromate-security-api-firewall')}
                            </Typography>
                            <Stack spacing={1}>
                                {['x_content_type_options', 'x_frame_options', 'strict_transport_security'].map((key) => {
                                    const option = options.secure_headers[key];
                                    if (!option) return null;
                                    return renderSecureHeaderField(key, option);
                                })}
                            </Stack>
                        </Grid>

                        {/* CSP and Permissions */}
                        <Grid size={{xs:12,md:6}}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                {__('Content Security & Permissions', 'bromate-security-api-firewall')}
                            </Typography>
                            <Stack spacing={2}>
                                {['content_security_policy', 'permissions_policy'].map((key) => {
                                    const option = options.secure_headers[key];
                                    if (!option) return null;
                                    return renderSecureHeaderField(key, option);
                                })}
                            </Stack>
                        </Grid>
                    </Grid>
                </Stack>
            </Paper>
		
			{/* Caching Headers Configuration */}
			<Paper sx={{ p: 2 }} elevation={0}>
				<Stack flexDirection="column" gap={2}>
                    <Stack flexDirection="row" gap={1} alignItems="center">
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={cachingEnabled}
                                    name="http_headers_caching"
                                    onChange={onCachingChange}
                                />
                            }
                            label={__('Enable', 'bromate-security-api-firewall')}
                            sx={{mr:0, '& .MuiTypography-root': {lineHeight:'2em'}}}
                        />
                        <Divider orientation="vertical" variant="middle" flexItem />
                        <Typography variant="h6">
                            {__('Caching Headers', 'bromate-security-api-firewall')}
                        </Typography>
                    </Stack>
					
					<Grid container spacing={2}>
						<Grid size={{xs:12,md:6}}>
							<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
								{__('Cache Control Directives', 'bromate-security-api-firewall')}
							</Typography>
							<Stack spacing={1}>
								{['no_cache', 'no_store', 'must_revalidate', 'public', 'private'].map((key) => {
									const option = options.caching_headers[key];
									if (!option) return null;
									return renderCachingHeaderField(key, option);
								})}
							</Stack>
						</Grid>
						
						<Grid size={{xs:12,md:6}}>
							<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
								{__('Cache Duration', 'bromate-security-api-firewall')}
							</Typography>
							<Stack spacing={2}>
								{['max_age', 'expires'].map((key) => {
									const option = options.caching_headers[key];
									if (!option) return null;
									return renderCachingHeaderField(key, option);
								})}
								{['pragma_no_cache'].map((key) => {
									const option = options.caching_headers[key];
									if (!option) return null;
									return renderCachingHeaderField(key, option);
								})}
							</Stack>
						</Grid>
					</Grid>

					<FormControl>
						<FormControlLabel
							control={
								<Switch
									checked={compressionEnabled}
									name="http_headers_compression"
									onChange={onCompressionChange}
								/>
							}
							label={__('Enforce Compression HTTP Headers', 'bromate-security-api-firewall')}
						/>
					</FormControl>
				</Stack>
			</Paper>
		</Stack>
	);
}