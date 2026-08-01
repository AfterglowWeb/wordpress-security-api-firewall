import { useState, useRef, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  Box,
  TextField,
  Popper,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Chip,
  Typography,
  ClickAwayListener,
  FormControl,
  InputLabel,
  useTheme
} from '@mui/material';
import { usePortalContainer } from '@contexts/PortalContainerContext';

type BaseOption = {
  value: string;
  label: string;
  groupLabel?: string;
  severity?: 'info' | 'warning' | 'error';
  disabled?: boolean;
};

type Props<T extends string = string> = {
  label: string;
  value: T[];
  options: BaseOption[];
  onChange: (value: T[]) => void;
  disabled?: boolean;
  name?: string;
  size?: 'small' | 'medium';
};

const SEVERITY_COLORS: Record<string, { main: string; light: string; outlined: string; bg: string }> = {
  info: {
    main: '#1565c0',
    light: '#e3f2fd',
    outlined: '#1565c0',
    bg: '#e3f2fd',
  },
  warning: {
    main: '#e65100',
    light: '#fff3e0',
    outlined: '#e65100',
    bg: '#fff3e0',
  },
  error: {
    main: '#c62828',
    light: '#ffebee',
    outlined: '#c62828',
    bg: '#ffebee',
  },
};

function SeverityChip({ severity }: { severity: string }): JSX.Element {

  return (
    <Chip
      label={severity}
      size="small"
      color={severity as 'info' | 'warning' | 'error'}
      variant="outlined"
      sx={{
        height: '18px',
        fontSize: '0.625rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        '& .MuiChip-label': {
          px: 0.75,
          py: 0,
        },
      }}
    />
  );
}

export default function MultipleSelect<T extends string = string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  name,
  size = 'small',
}: Props<T>): JSX.Element {
  const theme = useTheme();
  const portalContainer = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const searchableOptions = options.filter(o => o.value !== '');

  const filteredOptions = search
    ? searchableOptions.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : searchableOptions;

  const isSelected = useCallback(
    (val: string): boolean => value.includes(val as T),
    [value]
  );

  const handleToggle = useCallback(
    (val: string) => {
      if (disabled) return;
      const option = options.find(o => o.value === val);
      if (option?.disabled) return;

      if (isSelected(val)) {
        onChange(value.filter(v => v !== val) as T[]);
      } else {
        onChange([...value, val] as T[]);
      }
    },
    [disabled, options, value, onChange, isSelected]
  );

  const handleDelete = useCallback(
    (val: string) => {
      if (disabled) return;
      onChange(value.filter(v => v !== val) as T[]);
    },
    [disabled, value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !search && value.length > 0) {
        const lastVal = value[value.length - 1];
        handleDelete(lastVal);
      }
    },
    [search, value, handleDelete]
  );

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const selectedEl = listRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [open]);

  const selectedChips = value
    .map(val => options.find(o => o.value === val))
    .filter((o): o is BaseOption => !!o);

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <FormControl fullWidth size={size} disabled={disabled}>
        <InputLabel>{label}</InputLabel>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            minHeight: size === 'small' ? 40 : 52,
            alignItems: 'center',
            border: '1px solid',
            borderColor: open ? theme.palette.primary.main : theme.palette.divider,
            borderRadius: 1,
            px: 1,
            py: 0.5,
            cursor: disabled ? 'not-allowed' : 'text',
            backgroundColor: disabled
              ? theme.palette.action.disabledBackground
              : theme.palette.background.paper,
            '&:hover': {
              borderColor: disabled ? undefined : theme.palette.text.primary,
            },
            transition: 'border-color 200ms',
          }}
          onClick={() => !disabled && setOpen(true)}
        >
          {selectedChips.map(option => {
            const severity = option.severity;

            return (
              <Chip
                key={option.value}
                label={option.label}
                size="small"
                color={severity as 'info' | 'warning' | 'error' }
                onDelete={() => handleDelete(option.value)}
                sx={{
                  height: size === 'small' ? 24 : 28,
                  fontSize: '0.75rem',                  
                }}
              />
            );
          })}
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => !disabled && setOpen(true)}
            placeholder={value.length === 0 ? label : ''}
            disabled={disabled}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '0.875rem',
              flex: 1,
              minWidth: 60,
              padding: '4px 0',
              backgroundColor: 'transparent',
              color: theme.palette.text.primary,
            }}
            tabIndex={-1}
          />
        </Box>

        <Popper
          open={open}
          anchorEl={inputRef.current?.parentElement}
          placement="bottom-start"
          style={{ zIndex: theme.zIndex.modal + 1 }}
          container={portalContainer}
        >
          <Paper
            elevation={8}
            sx={{
              mt: 0.5,
              maxHeight: 320,
              width: '100%',
              minWidth: 250,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder={__('Search...', 'bromate-security-api-firewall')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.875rem',
                  },
                }}
              />
            </Box>
            <List
              ref={listRef}
              sx={{
                py: 0,
                maxHeight: 260,
                overflow: 'auto',
              }}
              dense
            >
              {filteredOptions.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={__('No options found', 'bromate-security-api-firewall')}
                    slotProps={{primary:{
                            fontSize: '0.875rem',
                       }}}
                  />
                </ListItem>
              )}
              {options.map(option => {
                if (option.value === '') {
                  // Group header
                  const hasVisibleItems = filteredOptions.some(
                    o => o.groupLabel === option.groupLabel
                  );
                  if (!hasVisibleItems && search) return null;
                  return (
                    <ListItem
                      key={`group-${option.label}`}
                      sx={{
                        py: 0.75,
                        px: 2,
                        backgroundColor: theme.palette.action.hover,
                      }}
                    >
                      <ListItemText
                        primary={option.label}
                        slotProps={{primary:{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'text.secondary',
                       }}}
                      />
                    </ListItem>
                  );
                }

                // Check if this option should be visible (filter)
                if (search && !option.label.toLowerCase().includes(search.toLowerCase())) {
                  return null;
                }

                const selected = isSelected(option.value);
                const isDisabled = disabled || option.disabled;

                return (
                  <ListItem
                    key={option.value}
                    onClick={() => handleToggle(option.value)}
                    sx={{
                      py: 0.25,
                      px: 1.5,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
                      backgroundColor: selected
                        ? theme.palette.action.selected
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: isDisabled
                          ? undefined
                          : selected
                            ? theme.palette.action.selected
                            : theme.palette.action.hover,
                      },
                    }}
                    data-selected={selected}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox
                        edge="start"
                        checked={selected}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                        disabled={isDisabled}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={option.label}
                      disableTypography={isDisabled}
                      slotProps={{primary:{
                            fontSize: '0.875rem',
                            color: isDisabled ? 'text.disabled' : 'text.primary',
                       }}}
                    />
                    {option.severity && (
                      <SeverityChip severity={option.severity} />
                    )}
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Popper>
      </FormControl>
    </ClickAwayListener>
  );
}