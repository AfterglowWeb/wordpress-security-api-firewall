import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import OutlinedInput from '@mui/material/OutlinedInput';
import Chip from '@mui/material/Chip';
import InputLabel from '@mui/material/InputLabel';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemText from '@mui/material/ListItemText';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { SelectChangeEvent } from '@mui/material/Select';
import { SxProps, Theme } from '@mui/material/styles';

import { usePortalContainer } from '@contexts/PortalContainerContext';

export interface OptionType<T extends string = string> {
  value: T;
  label: string;
  groupLabel?: string;
  subGroupLabel?: string;
  secondary?: string;
}

interface MultipleSelectProps<T extends string = string> {
  disabled?: boolean;
  label: string;
  name: string;
  value: T[];
  options: OptionType<T>[];
  onChange: (value: T[]) => void;
  helperText?: string;
  sx?: SxProps<Theme>;
}

export default function MultipleSelect<T extends string = string>({
  disabled = false,
  label,
  name,
  value = [],
  options = [],
  onChange,
  helperText = '',
  sx = {},
}: MultipleSelectProps<T>): JSX.Element {
  const portalContainer = usePortalContainer();

  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: 48 * 9 + 8,
        width: 250,
      },
    },
    container: portalContainer,
  };

  const safeValue = Array.isArray(value) ? value : [];
  const flatOptions = options.filter((o) => o.value !== undefined);

  const handleChange = (event: SelectChangeEvent<T[]>) => {
    const { value: selectedValues } = event.target;
    const newValue = typeof selectedValues === 'string' 
      ? selectedValues.split(',') as T[]
      : selectedValues;
    onChange(newValue);
  };

  return (
    <FormControl sx={sx} disabled={disabled} fullWidth>
      <InputLabel id={`${name}-label`}>{label}</InputLabel>
      <Select
        labelId={`${name}-label`}
        id={name}
        name={name}
        multiple
        value={safeValue}
        onChange={handleChange}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {Array.isArray(selected) && selected.map((val) => {
              const option = flatOptions.find((o) => o.value === val);
              return option ? (
                <Chip key={val} label={option.label} size="small" />
              ) : null;
            })}
          </Box>
        )}
        MenuProps={MenuProps}
      >
        {options.map((option, index) => {
          if (option.groupLabel) {
            return (
              <ListSubheader
                disableSticky
                key={`group-${option.groupLabel}`}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  lineHeight: '28px',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'text.primary',
                  bgcolor: 'action.hover',
                }}
              >
                {option.groupLabel}
              </ListSubheader>
            );
          }

          if (option.subGroupLabel) {
            return (
              <ListSubheader
                disableSticky
                key={`subgroup-${option.subGroupLabel}-${index}`}
                sx={{
                  pl: 3,
                  fontSize: '0.7rem',
                  lineHeight: '24px',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  color: 'text.secondary',
                }}
              >
                {option.subGroupLabel}
              </ListSubheader>
            );
          }

          return option?.value !== undefined && option?.label ? (
            <MenuItem
              key={option.value}
              value={option.value}
              sx={option.groupLabel ? { pl: 4 } : {}}
            >
              <ListItemText
                primary={option.label}
                secondary={option.secondary ?? null}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{
                  variant: 'caption',
                }}
              />
            </MenuItem>
          ) : null;
        })}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}