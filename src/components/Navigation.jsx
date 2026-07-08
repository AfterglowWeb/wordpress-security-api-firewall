import { useState, useCallback } from '@wordpress/element';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { __ } from '@wordpress/i18n';

import { useNavigation } from '@contexts/NavigationContext';
import { SettingsAPI } from '@services/settings';

import AppBar from '@mui/material/AppBar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import MenuIcon from '@mui/icons-material/Menu';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';

import AppIdentity from './AppIdentity';

export const DRAWER_WIDTH = 220;
export const APP_BAR_HEIGHT = 75;
export const APP_FOOTER_HEIGHT = 40;
export const WP_ADMIN_BAR_HEIGHT_DESKTOP = 32;
export const WP_ADMIN_BAR_HEIGHT_MOBILE = 46;
export const WP_MENU_WIDTH_MD = 36;
export const WP_MENU_WIDTH_LG = 160;

export default function Navigation({children}) {
    const theme = useTheme();
    const isMobile = useMediaQuery( theme.breakpoints.down( 'md' ) );
    const [ mobileOpen, setMobileOpen ] = useState( false );

    const { panel, menuItems, navigateGuarded } = useNavigation();

    const activeMenuItem =
        menuItems.find( ( m ) => ! m.hidden && 'key' in m && m.key === panel )
        ?? menuItems.find( ( m ) => 'key' in m && m.key === panel )
        ?? null;

    return (
        <Box sx={{
			position:'relative',
			}}>
		 <AppBar
            elevation={ 0 }
            sx={ {
                '&.MuiAppBar-root': {
                    position: 'relative',
                    width: '100%'
                },
            } }
            >
                <Toolbar
                    variant="dense"
					disableGutters={true}
                    sx={ {
                        bgcolor: 'background.paper',
                        borderBottom: 1,
                        borderColor: 'divider',
                        pr: 3,
						pl:0,
                        height: { xs: 'auto', xl: APP_BAR_HEIGHT },
                        minHeight: APP_BAR_HEIGHT,
                        overflow: 'hidden',
                        gap: 2,
                    } }
                >
					<AppIdentity />
   
                    { isMobile && (
                        <IconButton
                            edge="start"
                            onClick={ () => setMobileOpen( true ) }
                            sx={ { mr: 1, color: 'text.primary' } }
                        >
                            <MenuIcon />
                        </IconButton>
                    ) }

                    <Stack direction="row" alignItems="center" gap={ 2 }>
                        <Stack minWidth={ 150 }>
                            <Typography
                                variant="h6"
                                fontWeight={ 600 }
                                color="text.primary"
                                sx={ { lineHeight: 1.2 } }
                            >
                                { activeMenuItem && 'label' in activeMenuItem ? activeMenuItem.label : '' }
                            </Typography>
                        </Stack>
                    </Stack>

                    <Stack flex={ 1 } />

                </Toolbar>
            </AppBar>

            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                <Drawer
                    variant={ isMobile ? 'temporary' : 'permanent' }
                    anchor="left"
                    open={ isMobile ? mobileOpen : true }
                    onClose={ () => setMobileOpen( false ) }
                    sx={ {
                        '.MuiPaper-root': {
                            width: DRAWER_WIDTH,
                            top: {xs:WP_ADMIN_BAR_HEIGHT_MOBILE,lg:WP_ADMIN_BAR_HEIGHT_DESKTOP},
                            position: 'sticky',
                            height: {
                                xs:`calc(100vh - ${ WP_ADMIN_BAR_HEIGHT_MOBILE }px)`,
                                lg:`calc(100vh - ${ WP_ADMIN_BAR_HEIGHT_DESKTOP }px)`
                            },
                            overflowY: 'auto',
                        },
                    } }
                >

                    <List component="nav" disablePadding sx={ { pb: 4 } }>
                        { menuItems.map( ( item, index ) => {
                            if ( item.hidden ) return null;

                            if ( item.type === 'section' ) {
                                return (
                                    <Stack
                                        sx={ { mt: index === 1 ? 0 : 2 } }
                                        key={ `section-${ index }` }
                                    >
                                        { index !== 0 && <Divider /> }
                                        { item.label ? (
                                            <Typography
                                                variant="caption"
                                                sx={ {
                                                    display: 'block',
                                                    px: 2,
                                                    mb: 1,
                                                    mt: 2,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    fontSize: '0.7rem',
                                                    color: 'text.secondary',
                                                } }
                                            >
                                                { item.label }
                                            </Typography>
                                        ) : (
                                            <Stack py={ 1 } />
                                        ) }
                                    </Stack>
                                );
                            }

                            const Icon = item.icon;
                            const isActive = panel === item.key;

                            return (
                                <ListItemButton
                                    key={ item.key }
                                    selected={ isActive }
                                    sx={ { pl: item.pl ?? 3, pr: 3 } }
                                    disabled={ !! item.disabled }
                                    onClick={ () => {
                                        if ( item.action ) {
                                            item.action();
                                        } else {
                                            navigateGuarded( item.key );
                                        }
                                        setMobileOpen( false );
                                    } }
                                >
                                    { Icon && (
                                        <ListItemIcon sx={ { px: 1, minWidth: 32 } }>
                                            { item.pendingBadge ? (
                                                <Badge
                                                    badgeContent={ <PendingOutlinedIcon sx={ { fontSize: 10 } } /> }
                                                    color="default"
                                                    sx={ {
                                                        '& .MuiBadge-badge': {
                                                            backgroundColor: 'grey.400',
                                                            color: 'white',
                                                            padding: '2px',
                                                        },
                                                    } }
                                                >
                                                    <Icon color={ isActive ? 'primary' : undefined } fontSize="small" />
                                                </Badge>
                                            ) : (
                                                <Badge color="error" variant="dot" invisible={ ! item.badge }>
                                                    <Icon color={ isActive ? 'primary' : undefined } fontSize="small" />
                                                </Badge>
                                            ) }
                                        </ListItemIcon>
                                    ) }
                                    <ListItemText
                                        sx={ {
                                            '& .MuiListItemText-primary': {
                                                lineHeight: 'normal',
                                                color: isActive ? 'primary.main' : 'text.primary',
                                            },
                                        } }
                                        primary={ item.label }
                                        secondary={
                                            item.secondary && (
                                                <Typography variant="caption" color="text.secondary">
                                                    { item.secondary }
                                                </Typography>
                                            )
                                        }
                                    />
                                </ListItemButton>
                            );
                        } ) }
                    </List>
                </Drawer>
                <Box component="main" sx={{ flex: 1, overflow: 'auto', p:3 }}>
                    {children}
                </Box>
            </Box>
        </Box>
    );
}