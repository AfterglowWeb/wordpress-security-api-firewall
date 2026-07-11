import { useRoutePolicyTreeContext } from '@contexts/RoutePolicyTreeContext';

import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';

import BlockIcon  from '@mui/icons-material/Block';
import LockIcon   from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import ShieldIcon from '@mui/icons-material/Shield';

import { useTreeItem } from '@mui/x-tree-view/useTreeItem';
import {
  TreeItemContent,
  TreeItemIconContainer,
  TreeItemGroupTransition,
  TreeItemLabel,
  TreeItemRoot,
  type TreeItemProps,
} from '@mui/x-tree-view/TreeItem';
import { TreeItemIcon } from '@mui/x-tree-view/TreeItemIcon';
import { usePortalContainer } from '@contexts/PortalContainerContext';

function PermissionBadge({ type }: { type?: string }) {
  if (!type) return null;
    const portalContainer = usePortalContainer();

  if (type === 'public')    return <Tooltip slotProps={{ popper: { container: portalContainer } }} title="Public route"><PublicIcon fontSize="inherit" sx={{ color: 'success.main' }} /></Tooltip>;
  if (type === 'forbidden') return <Tooltip slotProps={{ popper: { container: portalContainer } }} title="Always forbidden"><BlockIcon fontSize="inherit" sx={{ color: 'error.main' }} /></Tooltip>;
  return <Tooltip slotProps={{ popper: { container: portalContainer } }} title={`${type} route`}><ShieldIcon fontSize="inherit" sx={{ color: 'warning.main' }} /></Tooltip>;
}

export default function RouteTreeItem(props: TreeItemProps) {
  const { id, itemId, label, disabled, children } = props;
  const portalContainer = usePortalContainer();

  const { toggleSetting, getNode } = useRoutePolicyTreeContext();
  const node = getNode(itemId);

  const {
    getRootProps,
    getContentProps,
    getIconContainerProps,
    getLabelProps,
    getGroupTransitionProps,
    status,
  } = useTreeItem({ id, itemId, label, disabled, children });

  if (!node) return null;

  const isMethod            = node.isMethod === true;
  const isDisabled          = node.settings?.disabled?.value    ?? false;
  const isProtect           = node.settings?.protect?.value     ?? false;
  const isInheritedDisabled = node.settings?.disabled?.inherited ?? false;
  const isInheritedProtect  = node.settings?.protect?.inherited  ?? false;
  const isCustom            = node.settings?.custom ?? false;

  return (
    <TreeItemRoot {...getRootProps()}>
      <TreeItemContent
        {...getContentProps()}
        sx={{
          opacity: isDisabled ? 0.5 : 1,
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <TreeItemIconContainer {...getIconContainerProps()}>
          <TreeItemIcon status={status} />
        </TreeItemIconContainer>

        <TreeItemLabel {...getLabelProps()} sx={{ flexGrow: 1}} />

        {isMethod && <PermissionBadge type={node.permission?.type} />}

        {isCustom && (
          <Chip label="custom" size="small" variant="outlined"
            sx={{ height: 16, ml: 0.5 }} />
        )}

        <Stack
          direction="row" alignItems="center" spacing={0.5} sx={{ ml: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip slotProps={{popper:{container: portalContainer}}} title={isInheritedDisabled ? 'Disabled (inherited)' : 'Disable route'}>
            <Stack direction="row" alignItems="center" spacing={0.25}>
              <BlockIcon fontSize="inherit"
                sx={{ color: isDisabled ? 'error.main' : 'text.disabled' }} />
              <Switch
                size="small"
                checked={isDisabled}
                onChange={() => toggleSetting(itemId, 'disabled')}
                onClick={(e) => e.stopPropagation()}
                disabled={isInheritedDisabled}
              />
            </Stack>
          </Tooltip>

          <Tooltip slotProps={{popper:{container: portalContainer}}} title={isDisabled ? 'Route is disabled' : (isInheritedProtect ? 'Protected (inherited)' : 'Restrict to authorized users')}>
            <Stack direction="row" alignItems="center" spacing={0.25}>
              <LockIcon fontSize="inherit"
                sx={{ color: isProtect ? 'warning.main' : 'text.disabled' }} />
              <Switch
                size="small"
                checked={isProtect}
                onChange={() => toggleSetting(itemId, 'protect')}
                onClick={(e) => e.stopPropagation()}
                disabled={isInheritedProtect || isDisabled}
              />
            </Stack>
          </Tooltip>
        </Stack>

      </TreeItemContent>

      {children && <TreeItemGroupTransition {...getGroupTransitionProps()} />}
    </TreeItemRoot>
  );
}