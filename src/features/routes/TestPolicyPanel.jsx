import { useState, useEffect } from '@wordpress/element';
import { useAdminData } from '@contexts/AdminDataContext';
import CopyButton from '@components/CopyButton';
import DownloadJsonButton from '@components/DownloadJsonButton';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Toolbar from '@mui/material/Toolbar';

import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function StatusBadge( { status } ) {
	return (
		<Chip
			label={ status || '—' }
			size="small"
			variant="outlined"
		/>
	);
}

function DataPanel( { label, data, bgcolor, downloadFilename } ) {
	const bodyText = data?.body !== undefined
		? JSON.stringify( data.body, null, 2 )
		: '—';
	return (
		<Box sx={ { flex: 1, minWidth: 0 } }>
			<Stack
				direction="row"
				spacing={ 1 }
				alignItems="center"
				sx={ { mb: 0.5 } }
			>
				<Typography variant="caption" fontWeight={ 600 } sx={ { flex: 1 } }>
					{ label }
				</Typography>
				{ data?.status && <Chip label={ data.status || '—' } size="small" variant="outlined"/> }
				<CopyButton toCopy={ bodyText } />
				{ data?.body !== undefined && (
					<DownloadJsonButton data={ data.body } filename={ downloadFilename || 'result.json' } />
				) }
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
				{ bodyText }
			</Box>
		</Box>
	);
}

export default function TestPolicyPanel( {
	route,
	method,
	hasUsers = false,
	onClose,
	onNavigate,
} ) {
	const { adminData } = useAdminData();
	const { proNonce } = useLicense();
	const { selectedApplicationId } = useApplication();
	const nonce = proNonce || adminData.nonce;
	const { __ } = wp.i18n || {};

	const [ loading, setLoading ] = useState( false );
	const [ results, setResults ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ fullView, setFullView ] = useState( false );

	useEffect( () => {
		if ( ! route ) return;
		runTest();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ route, method ] );

	const handleClose = () => {
		setResults( null );
		setError( null );
		onClose();
	};

	const runTest = async () => {
		setLoading( true );
		setError( null );
		setResults( null );

		try {
			const params = {
				action: 'run_policy_test',
				nonce,
				route,
				method,
				bypass_users: '1',
				has_users: hasUsers ? '1' : '0',
				application_id: selectedApplicationId || '',
			};

			const response = await fetch( adminData.ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type':
						'application/x-www-form-urlencoded; charset=UTF-8',
				},
				body: new URLSearchParams( params ),
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
		if ( test?.pass === true ) {
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
		if ( test?.pass === null ) {
			return (
				<Typography
					variant="caption"
					color="text.secondary"
					fontWeight={ 600 }
				>
					{ __( '—', 'bromate-security-api-firewall' ) }
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

	const buildHeadersSent = ( result ) => {
		const info = result.curl_info;
		if ( ! info ) return null;
		const isProtected = result.policy?.protect;
		const lines = [ 'Content-Type: application/json' ];
		if ( isProtected && info.auth_type && info.auth_type.method !== 'none' && info.auth_type.login ) {
			lines.push( `Authorization: Basic <${ info.auth_type.login }:<password>>` );
		}
		return lines.join( '\n' );
	};

	const buildCurlSnippet = ( result ) => {
		const info = result.curl_info;
		if ( ! info || ! info.rest_url ) return null;

		const url = info.rest_url;
		const m = result.method.toUpperCase();
		const isProtected = result.policy?.protect;

		const lines = [ `curl -X ${ m } "${ url }"` ];
		lines.push( '  -H "Content-Type: application/json"' );

		if ( isProtected && info.auth_type && info.auth_type.method !== 'none' ) {
			if ( info.auth_type.login ) {
				lines.push( `  -u "${ info.auth_type.login }:<app_password_or_password>"` );
			}
		}

		if ( m !== 'GET' && m !== 'DELETE' ) {
			const resultBody = result.result_data?.body;
			const missingParams = resultBody?.code === 'rest_missing_callback_param'
				? ( resultBody?.data?.params || [] )
				: [];
			if ( missingParams.length > 0 ) {
				const bodyObj = {};
				missingParams.forEach( p => { bodyObj[ p ] = `<${ p }>`; } );
				lines.push( `  -d '${ JSON.stringify( bodyObj ) }'` );
			} else {
				lines.push( "  -d '{}'" );
			}
		}

		return lines.join( ' \\\n' );
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
									variant="outlined"
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
							alignItems="center"
							sx={ { mb: 1.5 } }
						>
							<Chip
								label={
									result.policy.state
										? __( 'Enabled', 'bromate-security-api-firewall' )
										: __( 'Disabled', 'bromate-security-api-firewall' )
								}
								size="small"
								variant="outlined"
							/>
							<Chip
								label={
									result.policy.protect
										? __( 'Protected', 'bromate-security-api-firewall' )
										: __( 'Public', 'bromate-security-api-firewall' )
								}
								size="small"
								variant="outlined"
							/>
							{ result.policy.rate_limit && (
								<Chip
									label={ `${ result.policy.rate_limit } req/${ result.policy.rate_limit_time }s` }
									size="small"
									variant="outlined"
								/>
							) }
							{ result.model && (
								<Stack direction="row" alignItems="center" spacing={ 0.5 }>
									<Chip
										label={ result.model.title }
										size="small"
										variant="outlined"
									/>
									{ onNavigate && (
										<IconButton
											size="small"
											onClick={ () => onNavigate( 5 ) }
											sx={ { opacity: 0.7 } }
										>
											<AccountTreeOutlinedIcon fontSize="small" />
										</IconButton>
									) }
								</Stack>
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
								downloadFilename={ `raw-${ result.method }-${ result.route.replace( /\//g, '-' ) }.json` }
								bgcolor="grey.50"
							/>
							<DataPanel
								label={ __( 'Result', 'bromate-security-api-firewall' ) }
								data={ result.result_data }
								downloadFilename={ `result-${ result.method }-${ result.route.replace( /\//g, '-' ) }.json` }
								bgcolor={ ( theme ) =>
									theme.palette.mode === 'dark'
										? 'rgba(99, 132, 255, 0.08)'
										: 'rgba(25, 118, 210, 0.04)'
								}
							/>
						</Stack>

						{ ( () => {
							const curlSnippet = buildCurlSnippet( result );
							const headersSent = buildHeadersSent( result );
							if ( ! curlSnippet && ! headersSent ) return null;
							const preStyle = {
								p: 1.5,
								borderRadius: 1,
								overflowX: 'auto',
								fontSize: '0.68rem',
								lineHeight: 1.6,
								m: 0,
								whiteSpace: 'pre',
							};
							return (
								<Stack direction="row" spacing={ 1.5 } sx={ { mt: 1.5 } }>
									{ headersSent && (
										<Box sx={ { flex: 1, minWidth: 0 } }>
											<Stack direction="row" spacing={ 1 } alignItems="center" sx={ { mb: 0.5 } }>
												<Typography variant="caption" fontWeight={ 600 } sx={ { flex: 1 } }>
													{ __( 'Headers sent', 'bromate-security-api-firewall' ) }
												</Typography>
												<CopyButton toCopy={ headersSent } />
											</Stack>
											<Box component="pre" sx={ { ...preStyle, bgcolor: 'grey.100', color: 'grey.800' } }>
												{ headersSent }
											</Box>
										</Box>
									) }
									{ curlSnippet && (
										<Box sx={ { flex: 1, minWidth: 0 } }>
											<Stack direction="row" spacing={ 1 } alignItems="center" sx={ { mb: 0.5 } }>
												<Typography variant="caption" fontWeight={ 600 } sx={ { flex: 1 } }>
													{ __( 'Replicate with curl', 'bromate-security-api-firewall' ) }
												</Typography>
												<CopyButton toCopy={ curlSnippet } />
											</Stack>
											<Box component="pre" sx={ { ...preStyle, bgcolor: 'grey.900', color: 'grey.100' } }>
												{ curlSnippet }
											</Box>
										</Box>
									) }
								</Stack>
							);
						} )() }
					</Box>
				) ) }
			</Stack>
		);
	};

	return (
		<Stack>
			<Toolbar
			direction="row"
			alignItems="center"
			disableGutters
			>
				<Stack
				direction="row"
				gap={ 2 }
				alignItems="center"
				>
					<IconButton
					size="small"
					onClick={ handleClose }
					>
						<ArrowBackIcon />
					</IconButton>

					<Divider orientation="vertical" flexItem />

					<Chip
					label={ method }
					size="small"
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

					<Divider orientation="vertical" flexItem />

					<Stack direction="row" gap={ 2 } alignItems="center">

						<Button
							variant="contained"
							size="small"
							disableElevation
							onClick={ runTest }
							disabled={ loading }
							startIcon={
								loading ? (
									<CircularProgress size={ 14 } />
								) : (
									<PlayArrowIcon />
								)
							}
							sx={ { textTransform: 'none' } }
						>
						{ loading
							? __( 'Running…', 'bromate-security-api-firewall' )
						: __( 'Re-run', 'bromate-security-api-firewall' ) }
						</Button>

							{ results && (
								<>
									<Divider orientation="vertical" flexItem />
									<IconButton
										size="small"
										onClick={ () => setFullView( true ) }
										title={ __( 'Expand results', 'bromate-security-api-firewall' ) }
									>
										<OpenInFullIcon fontSize="small" />
									</IconButton>
								</>
							) }

						</Stack>
						
					</Stack>

					<Stack flex={ 1 } />

				</Toolbar>
			
			{ error && <Alert severity="error">{ error }</Alert> }

			{ renderResults() }

			{ /* Full-view Dialog */ }
			<Dialog
				open={ fullView }
				onClose={ () => setFullView( false ) }
				maxWidth="xl"
				fullWidth
				PaperProps={ { sx: { height: '90vh' } } }
			>
				<DialogTitle sx={ { display: 'flex', alignItems: 'center', gap: 1, py: 1 } }>
					<Chip label={ method } size="small" />
					<Typography variant="body2" sx={ { fontFamily: 'monospace', flex: 1 } }>{ route }</Typography>
					<IconButton size="small" onClick={ () => setFullView( false ) }>
						<CloseIcon fontSize="small" />
					</IconButton>
				</DialogTitle>
				<DialogContent sx={ { display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 2 } }>
					{ results && results.map( ( result, index ) => (
						<Stack key={ index } direction="row" spacing={ 2 } sx={ { flex: 1, minHeight: 0 } }>
							<Box sx={ { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } }>
								<Stack direction="row" spacing={ 1 } alignItems="center" sx={ { mb: 0.5 } }>
									<Typography variant="caption" fontWeight={ 600 } sx={ { flex: 1 } }>
										{ __( 'Raw', 'bromate-security-api-firewall' ) }
									</Typography>
									{ result.raw_data?.status && <Chip
										label={ result.raw_data.status || '' }
										size="small"
										variant="outlined"
									/> }
									<CopyButton toCopy={ JSON.stringify( result.raw_data?.body, null, 2 ) } />
									<DownloadJsonButton data={ result.raw_data?.body } filename={ `raw-${ result.method }.json` } />
								</Stack>
								<Box component="pre" sx={ { flex: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, overflowY: 'auto', fontSize: '0.7rem', lineHeight: 1.5, m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }>
									{ result.raw_data?.body !== undefined ? JSON.stringify( result.raw_data.body, null, 2 ) : '—' }
								</Box>
							</Box>
							<Divider orientation="vertical" flexItem />
							<Box sx={ { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } }>
								<Stack direction="row" spacing={ 1 } alignItems="center" sx={ { mb: 0.5 } }>
									<Typography variant="caption" fontWeight={ 600 } sx={ { flex: 1 } }>
										{ __( 'Result', 'bromate-security-api-firewall' ) }
									</Typography>
									{ result.result_data?.status && <Chip
										label={ result.result_data.status || '' }
										size="small"
										variant="outlined"
									/> }
									<CopyButton toCopy={ JSON.stringify( result.result_data?.body, null, 2 ) } />
									<DownloadJsonButton data={ result.result_data?.body } filename={ `result-${ result.method }.json` } />
								</Stack>
								<Box component="pre" sx={ { flex: 1, p: 1.5, bgcolor: ( theme ) => theme.palette.mode === 'dark' ? 'rgba(99,132,255,0.08)' : 'rgba(25,118,210,0.04)', borderRadius: 1, overflowY: 'auto', fontSize: '0.7rem', lineHeight: 1.5, m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }>
									{ result.result_data?.body !== undefined ? JSON.stringify( result.result_data.body, null, 2 ) : '—' }
								</Box>
							</Box>
						</Stack>
					) ) }
				</DialogContent>
			</Dialog>
		</Stack>
	);
}
