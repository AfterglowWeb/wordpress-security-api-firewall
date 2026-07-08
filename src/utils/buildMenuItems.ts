// utils/buildMenuItems.ts

import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { PanelDefinition, PanelKey } from '@app-types/navigation';

import LockOutlinedIcon          from '@mui/icons-material/LockOutlined';
import SpeedOutlinedIcon         from '@mui/icons-material/SpeedOutlined';
import AccountTreeOutlinedIcon   from '@mui/icons-material/AccountTreeOutlined';
import ShieldOutlinedIcon        from '@mui/icons-material/ShieldOutlined';
import DataObjectIcon from '@mui/icons-material/DataObject';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import ManageHistoryOutlinedIcon from '@mui/icons-material/ManageHistoryOutlined';

type IconComponent = ComponentType<SvgIconProps>;

const ICON_MAP: Record<string, IconComponent> = {
    dashboard:     SpaceDashboardOutlinedIcon,
    lock:          LockOutlinedIcon,
    speed:         SpeedOutlinedIcon,
    route:         AccountTreeOutlinedIcon,
    shield:        ShieldOutlinedIcon,
    data_object:   DataObjectIcon,
    wordpress:     AdminPanelSettingsOutlinedIcon,
    world:         VpnLockIcon,
    logs: ManageHistoryOutlinedIcon,
};

export interface MenuItemAction {
    type: 'item';
    key: PanelKey;
    label: string;
    icon: IconComponent | undefined;
    hidden?: boolean;
    disabled?: boolean;
    badge?: boolean;
    pendingBadge?: boolean;
    secondary?: string;
    pl?: number;
    action?: () => void;
}

export interface MenuSection {
    type: 'section';
    label?: string;
    hidden?: boolean;
}

export type MenuItem = MenuSection | MenuItemAction;

export function buildMenuItems( panels: PanelDefinition[] ): MenuItem[] {
    return panels.map( ( panel ): MenuItemAction => ( {
        type:  'item',
        key:   panel.key,
        label: panel.label,
        icon:  ICON_MAP[ panel.icon ],
    } ) );
}