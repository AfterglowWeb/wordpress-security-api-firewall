import { useState } from '@wordpress/element';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function CopyButton( { toCopy, sx = {} } ) {
	const [ copyFeedback, setCopyFeedback ] = useState( false );
	const { __ } = wp.i18n || {};
	const handleCopy = ( e ) => {
		e.stopPropagation();
		navigator.clipboard.writeText( toCopy || '' );
		setCopyFeedback( true );
	};

	return (
		<>
			<Tooltip title="Copy">
				<IconButton
					size="small"
					onClick={ handleCopy }
					sx={ { p: 0.25, ...sx } }
				>
					<ContentCopyIcon sx={ { fontSize: 14 } } />
				</IconButton>
			</Tooltip>
			<Snackbar
				open={ copyFeedback }
				autoHideDuration={ 2000 }
				onClose={ () => setCopyFeedback( false ) }
				anchorOrigin={ { vertical: 'center', horizontal: 'center' } }
			>
				<Alert
					onClose={ () => setCopyFeedback( false ) }
					severity="success"
					sx={ { width: '100%' } }
				>
					{ __( 'Copied to clipboard', 'bromate-security-api-firewall' ) }
				</Alert>
			</Snackbar>
		</>
	);
}
