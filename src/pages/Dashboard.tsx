import { useMemo, useState, useEffect } from '@wordpress/element';
import { Box, Grid, Paper, Typography, Stack, Chip, Card, CardContent, useTheme, CircularProgress, Skeleton } from '@mui/material';
import type { SecurityModule } from '@app-types/modules';
import { SettingsAPI } from '@services/settings';

type StatCardProps = {
	title: string;
	value: string | number;
	description?: string;
	bgColor?: string;
};

function StatCard({ title, value, description, bgColor }: StatCardProps) {
	return (
		<Paper
			elevation={0}
			sx={{
				p: 2,
				borderRadius: 2,
				height: '100%',
				color:'white',
				fontWeight:600,
				backgroundColor: bgColor ? bgColor : 'transparent',
			}}
		>
			<Stack spacing={1}>
				<Typography variant="subtitle2">
					{title}
				</Typography>

				<Typography variant="h4" fontWeight={800}>
					{value}
				</Typography>

				{description && (
					<Typography variant="body2">
						{description}
					</Typography>
				)}
			</Stack>
		</Paper>
	);
}

const getGroupEnabledStatus = (settings: Record<string, any>, groupKeys: string[]): boolean => {
	return groupKeys.some(key => !!settings[key] === true);
};

export default function Dashboard(): JSX.Element {
	const theme = useTheme();
	const [settings, setSettings] = useState<Record<string, any>>({});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchSettings = async () => {
			try {
				const response = await SettingsAPI.readOptions();
				if (response) {
					setSettings(response);
				}
			} catch (error) {
				console.error('Failed to fetch settings:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchSettings();
	}, []);

	const securityModules = useMemo<SecurityModule[]>(() => {
		return [

			{
				key: 'firewall',
				title: 'Firewall',
				description: 'Rate Limiting, IP filtering, CIDR, GeoIP blocking, redirect front',
				enabled: !!settings.rate_limit_enabled,
			},
			{
				key: 'wordpress',
				title: 'Global Security',
				description: 'Disable XML-RPC, embeds, RSS, etc.',
				enabled: getGroupEnabledStatus(settings, [
					'disable_xmlrpc',
					'disable_comments',
					'disable_pingbacks',
					'disable_atom_rss',
					'disable_sitemap',
					'disable_emoji_scripts',
					'disable_theme_editor',
					'harden_wpconfig_file_permissions',
					'harden_uploads_dir_permissions',
					'http_headers_secure',
					'http_headers_compression'
				]),
			},
			{
				key: 'login-hardening',
				title: 'Login Security',
				description: 'Rate limiting, reCAPTCHA, 2FA, salt rotation',
				enabled: getGroupEnabledStatus(settings, [
					'login_rate_limit_enabled',
					'login_recaptcha_enabled',
					'login_totp_enabled',
					'salt_rotation_enabled',
					'redirect_front_enabled'
				]),
			},
			{
				key: 'authentication',
				title: 'REST API Authentication',
				description: 'JWT & Application Password protection',
				enabled: !!settings.auth_control_enabled,
			},
			{
				key: 'routes',
				title: 'REST API Routes Control',
				description: 'Protect or disable REST routes',
				enabled: !!settings.routes_policy_enabled,
			},
			{
				key: 'logs',
				title: 'Logs',
				description: 'Security events & violation tracking',
				enabled: false,
			},
		];
	}, [settings]);

	const enabledCount = useMemo(
		() => securityModules.filter((m) => m.enabled).length,
		[securityModules]
	);

	const stats = useMemo(
		() => [
			{
				title: 'Blocked Requests',
				value: settings.total_blocked_requests || 1284,
				description: 'Last 7 days',
				bgColor: theme.palette.warning.main
			},
			{
				title: 'Active IP Blocks',
				value: settings.active_ip_blocks || 37,
				description: 'Currently blacklisted IPs',
				bgColor: theme.palette.error.light
			},
			{
				title: 'Rate Limit Violations',
				value: settings.rate_limit_violations || 92,
				description: 'Auto-blacklist triggers',
				bgColor: theme.palette.error.main
			},
			{
				title: 'Protected Routes',
				value: settings.protected_routes || 14,
				description: 'Secured REST endpoints',
				bgColor: theme.palette.success.light
			},
		],
		[settings, theme]
	);

	if (loading) {
		return (
			<Stack spacing={3}>
				<Skeleton variant="rectangular" width={'100%'} height={330} />
				<Skeleton variant="rectangular" width={'100%'} height={630} />
			</Stack>
		);
	}

	return (
		<Stack display="flex" flexDirection="column" gap={3}>
			<Card elevation={0}>
				<CardContent>
					<Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
						<Typography variant="h6">
							Security Modules
						</Typography>
						<Chip 
							label={`${enabledCount} / ${securityModules.length} Enabled`}
							color="primary"
							variant="outlined"
							size="small"
						/>
					</Stack>
					<Grid container spacing={2}>
						{securityModules.map((securityModule) => (
							<Grid size={4} key={securityModule.key}>
								<Paper
									elevation={0}
									sx={{
										p: 2,
										borderRadius: 2,
										border:`1px solid ${theme.palette.grey[300]}`,
										opacity: securityModule.enabled ? 1 : 0.6,
										transition: '0.2s',
										backgroundColor: securityModule.enabled ? theme.palette.background.paper : theme.palette.grey[50],
									}}
								>
									<Stack
										direction="row"
										alignItems="center"
										justifyContent="space-between"
										flexWrap="wrap"
									>
										<Typography fontWeight={600}>
											{securityModule.title}
										</Typography>

										<Chip
											size="small"
											variant="outlined"
											label={securityModule.enabled ? 'Enabled' : 'Disabled'}
											color={securityModule.enabled ? 'success' : 'default'}
											sx={{ fontWeight: 500 }}
										/>
									</Stack>

									<Typography
										variant="body2"
										color="text.secondary"
										mt={1}
									>
										{securityModule.description}
									</Typography>

									{securityModule.key === 'wordpress' && securityModule.enabled && (
										<Box mt={1}>
											<Typography variant="caption" color="text.secondary">
												Some global security options are active.
											</Typography>
										</Box>
									)}

									{securityModule.key === 'login-hardening' && securityModule.enabled && (
										<Box mt={1}>
											<Typography variant="caption" color="text.secondary">
												Some login security options are active
											</Typography>
										</Box>
									)}
								</Paper>
							</Grid>
						))}
					</Grid>
				</CardContent>
			</Card>

			<Card elevation={0}>
				<CardContent>
					<Typography variant="h6" mb={2}>
						Stats
					</Typography>

					<Grid container spacing={2}>
						{stats.map((stat, index) => (
							<Grid key={index} size={3}>
								<StatCard {...stat} />
							</Grid>
						))}
					</Grid>

					<Box mt={4}>
						<Paper
							elevation={0}
							sx={{
								p: 2,
								borderRadius: 2,
								border:`1px solid ${theme.palette.grey[300]}`,
								minHeight: 300,
							}}
						>
							<Typography variant="h6" gutterBottom>
								Activity Overview
							</Typography>

							<Typography variant="body2" color="text.secondary">
								(Charts will be connected to rate limiting + authentication events)
							</Typography>
						</Paper>
					</Box>
				</CardContent>
			</Card>
		</Stack>
	);
}