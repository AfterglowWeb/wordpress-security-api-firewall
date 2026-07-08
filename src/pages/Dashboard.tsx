import { useMemo, useState } from '@wordpress/element';
import { Box, Grid, Paper, Typography, Stack, Switch, Chip, Card, CardContent, useTheme } from '@mui/material';
import type { SecurityModule } from '@app-types/modules';

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

export default function Dashboard(): JSX.Element {
	const theme = useTheme();

	const stats = useMemo(
		() => [
			{
				title: 'Blocked Requests',
				value: 1284,
				description: 'Last 7 days',
				bgColor: theme.palette.warning.main
			},
			{
				title: 'Active IP Blocks',
				value: 37,
				description: 'Currently blacklisted IPs',
				bgColor: theme.palette.error.light
			},
			{
				title: 'Rate Limit Violations',
				value: 92,
				description: 'Auto-blacklist triggers',
				bgColor: theme.palette.error.main
			},
			{
				title: 'Protected Routes',
				value: 14,
				description: 'Secured REST endpoints',
				bgColor: theme.palette.success.light
			},
		],
		[]
	);

	const [modules, setModules] = useState<SecurityModule[]>([
		{
			key: 'authentication',
			title: 'REST API Auth.',
			description: 'REST API JWT & Application Password protection',
			enabled: true,
		},
		{
			key: 'firewall',
			title: 'Firewall',
			description: 'Rate Limiting, IP filtering, CIDR, GeoIP blocking',
			enabled: true,
		},
		{
			key: 'routes',
			title: 'Routes Control',
			description: 'Protect or disable REST routes',
			enabled: false,
		},
		{
			key: 'wordpress',
			title: 'WordPress Hardening',
			description: 'Disable XML-RPC, embeds, RSS, etc.',
			enabled: true,
		},
		{
			key: 'logs',
			title: 'Logs',
			description: 'Security events & violation tracking',
			enabled: true,
		},
	]);

	const toggleModule = (key: SecurityModule['key']) => {
		setModules((prev) =>
			prev.map((m) =>
				m.key === key ? { ...m, enabled: !m.enabled } : m
			)
		);
	};

	const enabledCount = useMemo(
		() => modules.filter((m) => m.enabled).length,
		[modules]
	);

	return (
        <Stack display="flex" flexDirection="column" gap={3}>

			<Card elevation={0}>
			<CardContent>
				<Typography variant="h6" mb={2}>
					Security Modules
				</Typography>
				<Grid container spacing={2}>
					{modules.map((module) => (
						<Grid size={4}>
						<Paper
							elevation={0}
							sx={{
								p: 2,
								borderRadius: 2,
								border:`1px solid ${theme.palette.grey[300]}`,
								opacity: module.enabled ? 1 : 0.5,
								transition: '0.2s',
							}}
							key={module.key}
						>
							<Stack
								direction="row"
								alignItems="center"
								justifyContent="space-between"
								flexWrap="wrap"
							>
								<Typography fontWeight={600}>
									{module.title}
								</Typography>

								<Switch
									checked={module.enabled}
									onChange={() => toggleModule(module.key)}
								/>
							</Stack>

							<Typography
								variant="body2"
								color="text.secondary"
								mt={1}
							>
								{module.description}
							</Typography>

							<Box mt={2}>
								<Chip
									size="small"
									label={module.enabled ? 'Enabled' : 'Disabled'}
									color={module.enabled ? 'success' : 'default'}
								/>
							</Box>
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
						{stats.map((stat) => (
							<StatCard {...stat} />
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