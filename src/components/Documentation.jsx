import { useEffect, useMemo, useState } from '@wordpress/element';
import { useDocumentation } from '@contexts/DocumentationContext';

import Drawer from '@mui/material/Drawer';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';

export default function Documentation( { page } ) {
	const { __ } = wp.i18n || {};
	const { open, openDoc, closeDoc, currentLocation, docs } =
		useDocumentation();

	const [ menuAnchorEl, setMenuAnchorEl ] = useState( null );
	const currentDoc = useMemo(
		() => docs.find( ( doc ) => doc.slug === currentLocation?.page ),
		[ docs, currentLocation ]
	);

	useEffect( () => {
		if ( ! currentLocation?.anchor ) {
			return;
		}

		const el = document.getElementById( currentLocation.anchor );
		if ( el ) {
			el.scrollIntoView( { behavior: 'smooth', block: 'start' } );
		}
	}, [ currentLocation, currentDoc ] );

	return (
		<>
			<IconButton onClick={ () => openDoc( { page } ) }>
				<HelpOutlineOutlinedIcon />
			</IconButton>
			<Drawer
				anchor="right"
				open={ open }
				onClose={ closeDoc }
				sx={ {
					'& .MuiDrawer-paper': {
						height: {
							sm: 'calc(100% - 46px)',
							md: 'calc(100% - 32px)',
						},
						mt: { sm: '46px', md: '32px' },
						boxSizing: 'border-box',
						width: '100%',
						maxWidth: 600,
					},
				} }
			>
				<Toolbar>
					<IconButton
						size="small"
						onClick={ ( e ) => setMenuAnchorEl( e.currentTarget ) }
					>
						<MenuIcon />
					</IconButton>

					<Typography variant="h6" sx={ { flexGrow: 1 } }>
						{ __( 'Documentation', 'bromate-security-api-firewall' ) }
					</Typography>

					<IconButton onClick={ closeDoc }>
						<CloseIcon />
					</IconButton>
				</Toolbar>

				{ currentDoc && (
					<Card
						sx={ {
							p: 2,
							height: 'calc(100% - 96px)',
							overflow: 'scroll',
						} }
					>
						<CardContent
							sx={ { overflow: 'auto' } }
							dangerouslySetInnerHTML={ {
								__html: currentDoc.html,
							} }
						/>
					</Card>
				) }

				<Menu
					anchorEl={ menuAnchorEl }
					open={ Boolean( menuAnchorEl ) }
					onClose={ () => setMenuAnchorEl( null ) }
				>
					{ docs.map( ( doc ) => (
						<MenuItem
							key={ doc.slug }
							selected={ currentDoc?.slug === doc.slug }
							onClick={ () => openDoc( { page: doc.slug } ) }
						>
							<ListItemText primary={ doc.title } />
						</MenuItem>
					) ) }
				</Menu>
			</Drawer>
		</>
	);
}
