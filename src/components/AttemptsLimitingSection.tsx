import { __ } from '@wordpress/i18n';
import { useNavigation } from '@contexts/NavigationContext';
import {
  Paper,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Box,
  Divider,
} from '@mui/material';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

interface AttemptsLimitingSectionProps {
  prefix: string;
  title: string;
  viewBlockedLabel: string;
  origin: string;
  settings: Record<string, any>; 
  onChange: (key: string, value: any) => void;
}

export default function AttemptsLimitingSection({
  prefix,
  title,
  viewBlockedLabel,
  origin,
  settings,
  onChange,
}: AttemptsLimitingSectionProps): JSX.Element {
  const { navigateGuarded } = useNavigation();

  const isEnabledKey = `${prefix}_limit_enabled`;
  const limitKey = `${prefix}_limit`;
  const windowKey = `${prefix}_limit_window`;
  const blockTimeKey = `${prefix}_violation_block_time`;
  const blacklistKey = `${prefix}_blacklist_after_violations`;

  const isEnabled = settings[isEnabledKey] ?? false;

  return (
    <Paper sx={{ p: 2 }} elevation={0}>
      <Stack flexDirection="column" gap={2}>
        <Stack flexDirection="row" gap={1} alignItems="center">
          <FormControlLabel
            label={__('Enable', 'bromate-security-api-firewall')}
            control={
              <Switch
                checked={isEnabled}
                onChange={(e) => onChange(isEnabledKey, e.target.checked)}
              />
            }
            sx={{ mr: 0, '& .MuiTypography-root': { lineHeight: '2em' } }}
          />
          <Divider orientation="vertical" variant="middle" flexItem />
          <Typography variant="h6">{title}</Typography>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-start">
          <TextField
            label={__('Maximum attempts', 'bromate-security-api-firewall')}
            type="number"
            size="small"
            disabled={!isEnabled}
            value={settings[limitKey] ?? ''}
            onChange={(e) => onChange(limitKey, Number(e.target.value))}
            helperText={__('Number of failed attempts before blocking.', 'bromate-security-api-firewall')}
            sx={{ minWidth: 150 }}
          />
          <TextField
            label={__('Time window (seconds)', 'bromate-security-api-firewall')}
            type="number"
            size="small"
            disabled={!isEnabled}
            value={settings[windowKey] ?? ''}
            onChange={(e) => onChange(windowKey, Number(e.target.value))}
            helperText={__('Time window for counting attempts.', 'bromate-security-api-firewall')}
            sx={{ minWidth: 150 }}
          />
          <TextField
            label={__('Block duration (seconds)', 'bromate-security-api-firewall')}
            type="number"
            size="small"
            disabled={!isEnabled}
            value={settings[blockTimeKey] ?? ''}
            onChange={(e) => onChange(blockTimeKey, Number(e.target.value))}
            helperText={__('How long to block the user?', 'bromate-security-api-firewall')}
            sx={{ minWidth: 150 }}
          />
          <TextField
            label={__('Blacklist after (num. of blocks)', 'bromate-security-api-firewall')}
            type="number"
            size="small"
            disabled={!isEnabled}
            value={settings[blacklistKey] ?? ''}
            onChange={(e) => onChange(blacklistKey, Number(e.target.value))}
            helperText={__('0 = never add to the blacklist.', 'bromate-security-api-firewall')}
            sx={{ minWidth: 160 }}
          />
        </Stack>

        {isEnabled && (
          <Box>
            <Button
              size="small"
              disableElevation
              variant="outlined"
              onClick={() => navigateGuarded('firewall', { entry_origin: origin })}
              endIcon={<KeyboardArrowRightIcon fontSize="inherit" />}
            >
              {viewBlockedLabel}
            </Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}