import { useCallback } from '@wordpress/element';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { usePortalContainer } from '@contexts/PortalContainerContext';

export default function DownloadJsonButton( { data, filename = 'result.json', sx = {} } ) {
	const { __ } = wp.i18n || {};
  	const portalContainer = usePortalContainer();

	const handleDownload = useCallback( () => {
		const text = typeof data === 'string' ? data : JSON.stringify( data, null, 2 );
		const blob = new Blob( [ text ], { type: 'application/json' } );
		const url = URL.createObjectURL( blob );
		const anchor = document.createElement( 'a' );
		anchor.href = url;
		anchor.download = filename;
		anchor.click();
		URL.revokeObjectURL( url );
	}, [ data, filename ] );

	return (
		<Tooltip slotProps={{ popper: { container: portalContainer } }} title={ __( 'Download JSON', 'bromate-security-api-firewall' ) }>
			<IconButton size="small" onClick={ handleDownload } sx={ { p: 0.25, ...sx } }>
				<SaveAltIcon sx={ { fontSize: 14 } } />
			</IconButton>
		</Tooltip>
	);
}
