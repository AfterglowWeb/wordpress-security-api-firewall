import { useState, useEffect, useMemo } from '@wordpress/element';
import { Box, Stack, Typography, Chip } from '@mui/material';
import * as Flags from 'country-flag-icons/react/3x2';
import { IpAPI } from '@services/ip';

interface BlockedCountriesSummaryProps {
  codes: string[];
}

export default function BlockedCountriesSummary({ codes }: BlockedCountriesSummaryProps) {
  const [nameByCode, setNameByCode] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (codes.length === 0) return;

    let cancelled = false;

    IpAPI.getCountries('blacklist')
      .then((res) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        (res.countries || []).forEach((c) => map.set(c.country_code, c.country_name));
        setNameByCode(map);
      })
      .catch(() => { /* fall back to showing codes only */ });

    return () => { cancelled = true; };
  }, [codes.length]);

  const sortedCodes = useMemo(() => [...codes].sort(), [codes]);

  return (
    <Box sx={{ flex: 1, minWidth: 240 }}>
      {sortedCodes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No countries blocked.</Typography>
      ) : (
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          {sortedCodes.map((code) => {
            const Flag = (Flags as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[code];
            return (
              <Chip
                key={code}
                size="small"
                icon={Flag ? <Flag style={{ width: 16, borderRadius: 2 }} /> : undefined}
                label={`${nameByCode.get(code) || code} (${code})`}
              />
            );
          })}
        </Stack>
      )}
    </Box>
  );
}