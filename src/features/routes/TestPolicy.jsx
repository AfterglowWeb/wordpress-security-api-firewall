import { useState } from '@wordpress/element';
import { useAdminData } from '../../../contexts/AdminDataContext';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const METHOD_COLOR = {
	GET: 'primary',
	POST: 'success',
	PUT: 'warning',
	PATCH: 'warning',
	DELETE: 'error',
};

function StatusBadge( { status } ) {
	const color =
		status >= 200 && status < 300
			? 'success'
			: status >= 400
			? 'error'
			: 'default';
	return (
		<Chip
			label={ status || '—' }
			size="small"
			color={ color }
			variant="outlined"
			sx={ { fontFamily: 'monospace', fontWeight: 700 } }
		/>
	);
}

function DataPanel( { label, data, bgcolor } ) {
	return (
		<Box sx={ { flex: 1, minWidth: 0 } }>
			<Stack
				direction="row"
				spacing={ 1 }
				alignItems="center"
				sx={ { mb: 0.5 } }
			>
				<Typography variant="caption" fontWeight={ 600 }>
					{ label }
				</Typography>
				{ data?.status && <StatusBadge status={ data.status } /> }
			</Stack>
			<Box
				component="pre"
				sx={ {
					p: 1.5,
					bgcolor: bgcolor || 'grey.50',
					borderRadius: 1,
					overflowX: 'auto',
					fontSize: '0.68rem',
					lineHeight: 1.5,
					m: 0,
					whiteSpace: 'pre-wrap',
					wordBreak: 'break-all',
					maxHeight: 260,
					overflowY: 'auto',
				} }
			>
				{ data?.body !== undefined
					? JSON.stringify( data.body, null, 2 )
					: '—' }
			</Box>
		</Box>
	);
}

export default function TestPolicy( {
	route,
	method,
	hasChildren = false,
	hasUsers = false,
} ) {
	const { adminData } = useAdminData();
	const { __ } = wp.i18n || {};

	const [ open, setOpen ] = useState( false );
	const [ loading, setLoading ] = useState( false );
	const [ results, setResults ] = useState( null );
	const [ error, setError ] = useState( null );

	const [ testSubRoutes, setTestSubRoutes ] = useState( false );
	const [ bypassUsers, setBypassUsers ] = useState( false );

	const handleOpen = ( e ) => {
		e.stopPropagation();
		setOpen( true );
		setResults( null );
		setError( null );
	};

	const handleClose = () => {
		setOpen( false );
	};

	const runTest = async () => {
		setLoading( true );
		setError( null );
		setResults( null );

		try {
			const response = await fetch( adminData.ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type':
						'application/x-www-form-urlencoded; charset=UTF-8',
				},
				body: new URLSearchParams( {
					action: 'run_policy_test',
					nonce: adminData.nonce,
					route,
					method,
					test_sub_routes: testSubRoutes ? '1' : '0',
					bypass_users: bypassUsers ? '1' : '0',
				} ),
			} );

			const result = await response.json();

			if ( result?.success ) {
				setResults( result.data );
			} else {
				setError(
					result?.data?.message ||
						__( 'Test failed', 'bromate-security-api-firewall' )
				);
			}
		} catch ( err ) {
			setError(
				err.message || __( 'Network error', 'bromate-security-api-firewall' )
			);
		} finally {
			setLoading( false );
		}
	};

	const getTestLabel = ( name ) => {
		switch ( name ) {
			case 'disabled':
				return __( 'Disabled', 'bromate-security-api-firewall' );
			case 'auth':
				return __( 'Auth', 'bromate-security-api-firewall' );
			case 'rate_limit':
				return __( 'Rate limit', 'bromate-security-api-firewall' );
			default:
				return name;
		}
	};

	const renderTestStatus = ( test ) => {
		if ( test?.skip ) {
			return (
				<Typography variant="caption" color="text.disabled">
					{ __( 'N/A', 'bromate-security-api-firewall' ) }
				</Typography>
			);
		}
		if ( test?.pass ) {
			return (
				<Typography
					variant="caption"
					color="success.main"
					fontWeight={ 600 }
				>
					{ __( 'Pass', 'bromate-security-api-firewall' ) }
				</Typography>
			);
		}
		return (
			<Typography
				variant="caption"
				color="error.main"
				fontWeight={ 600 }
			>
				{ __( 'Fail', 'bromate-security-api-firewall' ) }
			</Typography>
		);
	};

	const renderResults = () => {
		if ( ! results || results.length === 0 ) return null;

		return (
			<Stack spacing={ 3 } sx={ { mt: 1 } }>
				{ results.map( ( result, index ) => (
					<Box key={ index }>
						{ results.length > 1 && (
							<Stack
								direction="row"
								spacing={ 1 }
								alignItems="center"
								sx={ { mb: 1.5 } }
							>
								<Chip
									label={ result.method }
									size="small"
									color={
										METHOD_COLOR[ result.method ] || 'default'
									}
								/>
								<Typography
									variant="body2"
									sx={ { fontFamily: 'monospace' } }
								>
									{ result.route }
								</Typography>
							</Stack>
						) }

						<Stack
							direction="row"
							spacing={ 0.5 }
							flexWrap="wrap"
							sx={ { mb: 1.5 } }
						>
							<Chip
								label={
									result.policy.state
										? __( 'Enabled', 'bromate-security-api-firewall' )
										: __( 'Disabled', 'bromate-security-api-firewall' )
								}
								size="small"
								color={ result.policy.state ? 'success' : 'error' }
								variant="outlined"
							/>
							<Chip
								label={
									result.policy.protect
										? __( 'Protected', 'bromate-security-api-firewall' )
										: __( 'Public', 'bromate-security-api-firewall' )
								}
								size="small"
								color={ result.policy.protect ? 'warning' : 'default' }
								variant="outlined"
							/>
							{ result.policy.rate_limit && (
								<Chip
									label={ `${ result.policy.rate_limit } req/${ result.policy.rate_limit_time }s` }
									size="small"
									color="info"
									variant="outlined"
								/>
							) }
						</Stack>

						<Table
							size="small"
							sx={ {
								mb: 2,
								'& td, & th': {
									borderLeft: 0,
									borderRight: 0,
									px: 1,
								},
							} }
						>
							<TableBody>
								{ Object.entries( result.tests ).map(
									( [ name, test ] ) => (
										<TableRow key={ name }>
											<TableCell sx={ { pl: 0 } }>
												<Typography variant="caption" color="text.primary">
													{ getTestLabel( name ) }
												</Typography>
											</TableCell>
											<TableCell sx={ { width: 60 } }>
												{ renderTestStatus( test ) }
											</TableCell>
											<TableCell
												sx={ {
													pr: 0,
													color: 'text.secondary',
													fontSize: '0.72rem',
												} }
											>
												{ test?.skip ? test.reason : test?.message }
											</TableCell>
										</TableRow>
									)
								) }
							</TableBody>
						</Table>

						<Stack direction="row" spacing={ 1.5 }>
							<DataPanel
								label={ __( 'Raw', 'bromate-security-api-firewall' ) }
								data={ result.raw_data }
								bgcolor="grey.50"
							/>
							<DataPanel
								label={ __( 'Result', 'bromate-security-api-firewall' ) }
								data={ result.result_data }
								bgcolor={ ( theme ) =>
									theme.palette.mode === 'dark'
										? 'rgba(99, 132, 255, 0.08)'
										: 'rgba(25, 118, 210, 0.04)'
								}
							/>
						</Stack>
					</Box>
				) ) }
			</Stack>
		);
	};

	return (
		<>
			<Button
				variant="text"
				size="small"
				onClick={ handleOpen }
				startIcon={ <PlayArrowIcon /> }
				sx={ { minWidth: 'auto', textTransform: 'none' } }
			>
				{ __( 'Test', 'bromate-security-api-firewall' ) }
			</Button>

			<Drawer
				anchor="right"
				open={ open }
				onClose={ handleClose }
				onClick={ ( e ) => e.stopPropagation() }
				PaperProps={ {
					sx: {
						width: { xs: '100%', sm: 560, md: 680 },
						display: 'flex',
						flexDirection: 'column',
					},
				} }
			>
				<Stack
					direction="row"
					alignItems="center"
					sx={ {
						px: 2.5,
						py: 1.5,
						borderBottom: 1,
						borderColor: 'divider',
						flexShrink: 0,
					} }
				>
					<Stack
						direction="row"
						spacing={ 1 }
						alignItems="center"
						sx={ { flex: 1, mr: 1, overflow: 'hidden' } }
					>
						<Chip
							label={ method }
							size="small"
							color={ METHOD_COLOR[ method ] || 'default' }
						/>
						<Typography
							variant="body2"
							sx={ {
								fontFamily: 'monospace',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							} }
						>
							{ route }
						</Typography>
					</Stack>
					<IconButton size="small" onClick={ handleClose }>
						<CloseIcon fontSize="small" />
					</IconButton>
				</Stack>

				<Box sx={ { flex: 1, overflowY: 'auto', p: 2.5 } }>
					<Stack spacing={ 2 }>
						{ ( hasChildren || hasUsers ) && (
							<Stack spacing={ 0.5 }>
								{ hasChildren && (
									<FormControlLabel
										control={
											<Checkbox
												checked={ testSubRoutes }
												onChange={ ( e ) =>
													setTestSubRoutes(
														e.target.checked
													)
												}
												size="small"
											/>
										}
										label={ __(
											'Include sub-routes',
											'bromate-security-api-firewall'
										) }
									/>
								) }
								{ hasUsers && (
									<FormControlLabel
										control={
											<Checkbox
												checked={ bypassUsers }
												onChange={ ( e ) =>
													setBypassUsers(
														e.target.checked
													)
												}
												size="small"
											/>
										}
										label={ __(
											'Bypass users settings',
											'bromate-security-api-firewall'
										) }
									/>
								) }
								<Divider sx={ { mt: 0.5 } } />
							</Stack>
						) }

						{ error && <Alert severity="error">{ error }</Alert> }

						{ renderResults() }
					</Stack>
				</Box>

				<Stack
					direction="row"
					justifyContent="flex-end"
					spacing={ 1 }
					sx={ {
						px: 2.5,
						py: 1.5,
						borderTop: 1,
						borderColor: 'divider',
						flexShrink: 0,
					} }
				>
					<Button onClick={ handleClose } disabled={ loading }>
						{ __( 'Close', 'bromate-security-api-firewall' ) }
					</Button>
					<Button
						variant="contained"
						onClick={ runTest }
						disabled={ loading }
						startIcon={
							loading ? (
								<CircularProgress size={ 16 } />
							) : (
								<PlayArrowIcon />
							)
						}
					>
						{ loading
							? __( 'Running…', 'bromate-security-api-firewall' )
							: __( 'Run Test', 'bromate-security-api-firewall' ) }
					</Button>
				</Stack>
			</Drawer>
		</>
	);
}
