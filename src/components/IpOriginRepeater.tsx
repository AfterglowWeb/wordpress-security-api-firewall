import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Stack, TextField, IconButton, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { isValidIpOrCidr, isValidOrigin } from '@app-utils/ipValidation';

export interface IpOriginRow {
  key: string;
  ip: string;
  referrer: string;
  expires_at: string;
}

let rowCounter = 0;
export function createEmptyRow(): IpOriginRow {
  rowCounter += 1;
  return { key: `row-${Date.now()}-${rowCounter}`, ip: '', referrer: '', expires_at: '' };
}

interface IpOriginRepeaterProps {
  rows: IpOriginRow[];
  onChange: (rows: IpOriginRow[]) => void;
  disabled?: boolean;
  onValidityChange?: (hasErrors: boolean) => void;
}

export default function IpOriginRepeater({
  rows, onChange, disabled, onValidityChange,
}: IpOriginRepeaterProps): JSX.Element {
  const [errors, setErrors] = useState<Record<string, { ip?: string; referrer?: string, expires_at?: string }>>({});

  const reportValidity = (errs: typeof errors) => {
    onValidityChange?.(Object.values(errs).some((e) => e.ip || e.referrer));
  };

  const updateRow = (key: string, field: 'ip' | 'referrer' | 'expires_at', value: string) => {
    onChange(rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const removeRow = (key: string) => {
    onChange(rows.filter((r) => r.key !== key));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      reportValidity(next);
      return next;
    });
  };

  const addRow = () => onChange([...rows, createEmptyRow()]);

  const handleIpBlur = (row: IpOriginRow) => {
    const trimmed = row.ip.trim();
    const message = trimmed && !isValidIpOrCidr(trimmed)
      ? __('Invalid IP or CIDR', 'bromate-security-api-firewall')
      : undefined;
    setErrors((prev) => {
      const next = { ...prev, [row.key]: { ...prev[row.key], ip: message } };
      reportValidity(next);
      return next;
    });
  };

  const handleReferrerBlur = (row: IpOriginRow) => {
    const trimmed = row.referrer.trim();
    const message = trimmed && !isValidOrigin(trimmed)
      ? __('Enter a valid origin, e.g. https://app.example.com', 'bromate-security-api-firewall')
      : undefined;
    setErrors((prev) => {
      const next = { ...prev, [row.key]: { ...prev[row.key], referrer: message } };
      reportValidity(next);
      return next;
    });
  };

  return (
    <Stack spacing={1.5}>
      {rows.map((row) => (
        <Stack key={row.key} direction="row" spacing={1} alignItems="flex-start">
          <TextField
            label={__('IP / CIDR', 'bromate-security-api-firewall')}
            placeholder="203.0.113.1"
            value={row.ip}
            onChange={(e) => updateRow(row.key, 'ip', e.target.value)}
            onBlur={() => handleIpBlur(row)}
            size="small"
            disabled={disabled}
            error={Boolean(errors[row.key]?.ip)}
            helperText={errors[row.key]?.ip}
            sx={{ flex: 1 }}
          />
          <TextField
            label={__('Allowed origin (optional)', 'bromate-security-api-firewall')}
            placeholder="https://app.example.com"
            value={row.referrer}
            onChange={(e) => updateRow(row.key, 'referrer', e.target.value)}
            onBlur={() => handleReferrerBlur(row)}
            size="small"
            disabled={disabled}
            error={Boolean(errors[row.key]?.referrer)}
            helperText={errors[row.key]?.referrer}
            sx={{ flex: 1 }}
          />

           <TextField
            label={__('Expires at (optional)', 'bromate-security-api-firewall')}
            type="datetime-local"
            value={row.expires_at ?? ''}
            onChange={(e) => updateRow(row.key, 'expires_at', e.target.value)}
            size="small" 
            disabled={disabled}
            helperText={__('Leave empty for no expiration', 'bromate-security-api-firewall')}
            sx={{ flex: 1, maxWidth:200}}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          
          <IconButton onClick={() => removeRow(row.key)} disabled={disabled} size="small" sx={{ mt: 0.5 }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Stack direction="row">
        <Button size="small" startIcon={<AddIcon />} onClick={addRow} disabled={disabled}>
          {__('Add IP', 'bromate-security-api-firewall')}
        </Button>
      </Stack>
    </Stack>
  );
}