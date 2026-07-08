import { useState, useEffect, useMemo } from '@wordpress/element';
import {
  Box, Stack, Typography, TextField, Checkbox,
  FormControlLabel, Chip, Button, CircularProgress,
} from '@mui/material';
import * as Flags from 'country-flag-icons/react/3x2';
import { IpAPI } from '@services/ip';

interface CountryBlockPanelProps {
  initialBlocked: string[];
  onSave: (codes: string[]) => Promise<void> | void;
  onClose: () => void;
}

interface CountryRow {
  code: string;
  name: string;
}

export default function CountryBlockPanel({ initialBlocked, onSave, onClose }: CountryBlockPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<string[]>(initialBlocked);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    IpAPI.getCountries('blacklist')
      .then((res) => {
        if (cancelled) return;
        const rows = (res.countries || []).map((c) => ({ code: c.country_code, name: c.country_name }));
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setCountries(rows);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const nameByCode = useMemo(() => {
    const map = new Map<string, string>();
    countries.forEach((c) => map.set(c.code, c.name));
    return map;
  }, [countries]);

  const pendingSet = useMemo(() => new Set(pending), [pending]);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [countries, search]);

  const toggle = (code: string) => {
    setPending((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const remove = (code: string) => {
    setPending((prev) => prev.filter((c) => c !== code));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(pending);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} flexWrap="wrap">
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="h6" mb={1}>Blocked countries</Typography>
          {pending.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No countries blocked.</Typography>
          ) : (
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              {pending.map((code) => {
                const Flag = (Flags as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[code];
                return (
                  <Chip
                    key={code}
                    size="small"
                    onDelete={() => remove(code)}
                    icon={Flag ? <Flag style={{ width: 16, borderRadius: 2 }} /> : undefined}
                    label={`${nameByCode.get(code) || code} (${code})`}
                  />
                );
              })}
            </Stack>
          )}
        </Box>

        <Stack direction="row" gap={1} sx={{ flexShrink: 0 }}>
          <Button
            variant="contained"
            size="small"
            disableElevation
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Stack>

      <TextField
        label="Search countries"
        size="small"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 1,
          }}
        >
          {filteredCountries.map(({ code, name }) => {
            const Flag = (Flags as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[code];
            const isBlocked = pendingSet.has(code);

            return (
              <FormControlLabel
                key={code}
                control={<Checkbox size="small" checked={isBlocked} onChange={() => toggle(code)} />}
                label={
                  <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
                    {Flag && (
                      <Flag style={{ width: 20, borderRadius: 2, boxShadow: '0px 0px 3px rgba(0,0,0,0.3)', flexShrink: 0 }} />
                    )}
                    <Typography variant="caption" fontFamily="monospace" sx={{ flexShrink: 0 }}>
                      {code}
                    </Typography>
                    <Box sx={{ flex: 1, maxWidth: 200 }}>
                      <Typography variant="body2" noWrap>{name}</Typography>
                    </Box>
                  </Stack>
                }
                sx={{ mr: 0, minWidth: 0, maxWidth: '100%' }}
              />
            );
          })}
        </Box>
      )}
    </Stack>
  );
}