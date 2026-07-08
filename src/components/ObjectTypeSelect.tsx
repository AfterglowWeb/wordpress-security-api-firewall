import { useState, useEffect, useCallback } from '@wordpress/element';

import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { usePortalContainer } from '@contexts/PortalContainerContext';
import { apiRequest } from '@services/api';

interface WpObject {
  value:    string;
  label:    string;
  type:     'post_type' | 'taxonomy';
  public:   boolean;
  _builtin: boolean;
  source?:  string;
}

interface OptionItem {
  value:      string;
  label:      string;
  secondary?: string;
}

interface GroupHeader  { groupLabel: string }
interface SubHeader    { subGroupLabel: string }

type OptionEntry = GroupHeader | SubHeader | OptionItem;

const GROUP_LABELS: Record<string, string> = {
  post_type: 'Post Types',
  taxonomy:  'Taxonomies',
};

function buildOptions(items: WpObject[]): OptionEntry[] {
  const result: OptionEntry[] = [];

  for (const typeKey of ['post_type', 'taxonomy'] as const) {
    const group = items.filter((i) => i.type === typeKey);
    if (!group.length) continue;

    result.push({ groupLabel: GROUP_LABELS[typeKey] ?? typeKey });

    const pub  = group.filter((i) =>  i.public);
    const priv = group.filter((i) => !i.public);
    const useSubGroups = pub.length > 0 && priv.length > 0;

    const pushItems = (list: WpObject[], subLabel: string) => {
      if (useSubGroups) result.push({ subGroupLabel: subLabel });
      list.forEach((item) =>
        result.push({
          value:     item.value,
          label:     item.label,
          secondary: item.source ?? (item._builtin ? 'builtin' : 'custom'),
        })
      );
    };

    if (pub.length)  pushItems(pub,  'Public');
    if (priv.length) pushItems(priv, 'Private');
  }

  return result;
}

function renderOptions(options: OptionEntry[], selected: string[]) {
  return options.map((opt, i) => {
    if ('groupLabel' in opt) {
      return (
        <ListSubheader key={`g-${opt.groupLabel}`} sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: '28px' }}>
          {opt.groupLabel}
        </ListSubheader>
      );
    }
    if ('subGroupLabel' in opt) {
      return (
        <ListSubheader key={`sg-${opt.subGroupLabel}-${i}`} sx={{ pl: 3, fontSize: '0.75rem', lineHeight: '24px', letterSpacing: 0.4 }}>
          {opt.subGroupLabel}
        </ListSubheader>
      );
    }
    return (
      <MenuItem key={opt.value} value={opt.value} sx={{ pl: 4 }}>
        <Checkbox size="small" checked={selected.includes(opt.value)} sx={{ py: 0 }} />
        <ListItemText primary={opt.label} secondary={opt.secondary ?? null} />
      </MenuItem>
    );
  });
}

interface Props {
  label:    string;
  value:    string[];
  onChange: (value: string[]) => void;
}

export default function ObjectTypeSelect({ label, value, onChange }: Props): JSX.Element | null {
  const [objects,  setObjects]  = useState<WpObject[]>([]);
  const [loading,  setLoading]  = useState(true);
  const portalContainer = usePortalContainer();

  useEffect(() => {
    apiRequest<WpObject[]>('bromate_wordpress_objects_options')
      .then(setObjects)
      .catch(() => {/* optionally show error */})
      .finally(() => setLoading(false));
  }, []);

  const options = buildOptions(objects);

  const handleChipDelete = useCallback((chipValue: string) => {
    const newValue = value.filter((val) => val !== chipValue);
    onChange(newValue);
  }, [value, onChange]);

  const handleChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    onChange(event.target.value as string[]);
  }, [onChange]);

  const renderValue = useCallback((selected: string[]) => {
    if (!Array.isArray(selected) || selected.length === 0) {
      return null;
    }

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {selected.map((val) => {
          const option = objects.find((o) => o.value === val);
          return option ? (
            <Chip
              key={val}
              label={option.label}
              size="small"
              onDelete={() => handleChipDelete(val)}
              onMouseDown={(e) => {
                // Prevent the Select from opening when clicking the chip
                e.stopPropagation();
              }}
            />
          ) : null;
        })}
      </Box>
    );
  }, [objects, handleChipDelete]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={value}
        onChange={(e) => onChange(e.target.value as string[])}
        input={<OutlinedInput label={label} />}
        renderValue={renderValue}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 48 * 9 + 8,
              width: 250,
            },
          },
          container: portalContainer,
        }}
      >
        {renderOptions(options, value)}
      </Select>
    </FormControl>
  );
}