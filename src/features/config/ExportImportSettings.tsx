import { useState, useCallback, useRef, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { apiRequest } from '@services/api';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import type { ConfigSettings, ExportFormat } from '@app-types/config';

interface ExportResponse {
  message: string;
  download_url?: string;
  filename?: string;
  size?: number;
}

interface ImportResponse {
  message: string;
}

type ImportPayload =
  | { type: 'json'; settings: string }
  | { type: 'csv'; filename: string; csv: string }
  | { type: 'zip'; filename: string; archive: string };

interface ExportImportSettingsProps {
  settings: ConfigSettings;
  onChange: <K extends keyof ConfigSettings>(key: K, value: ConfigSettings[K]) => void
}

function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Clean up exported files after download
async function cleanupExportFiles(filenames: string[]): Promise<void> {
  try {
    await apiRequest('bromate_cleanup_export_files', { filenames });
  } catch (error) {
    // Silent cleanup - don't show errors to user
    console.warn('Failed to cleanup export files:', error);
  }
}

const ACCEPTED_EXTENSIONS = ['.json', '.csv', '.zip'];

export default function ExportImportSettings({ settings, onChange }: ExportImportSettingsProps): JSX.Element {
  const { openDialog } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [exportedFiles, setExportedFiles] = useState<string[]>([]);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Auto-cleanup files when component unmounts
  useEffect(() => {
    return () => {
      if (exportedFiles.length > 0) {
        cleanupExportFiles(exportedFiles);
      }
    };
  }, [exportedFiles]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const response: ExportResponse = await apiRequest<ExportResponse>(
        'bromate_update_and_export_settings',
        settings
      );

      if (response.download_url) {
        downloadFile(response.download_url, response.filename || 'export.zip');

        // Track the filename for cleanup (remove duplicates)
        if (response.filename) {
          setExportedFiles(prev => prev.filter(f => f !== response.filename));
        }

        setSnackbar({
          open: true,
          message: response.message || __('Export complete.', 'bromate-security-api-firewall'),
          severity: 'success',
        });

        // Schedule cleanup after download (give time for download to start)
        setTimeout(() => {
          if (response.filename) {
            cleanupExportFiles([response.filename]);
            setExportedFiles(prev => prev.filter(f => f !== response.filename));
          }
        }, 10000); // Clean up after 10 seconds
      } else {
        throw new Error(__('No download URL received.', 'bromate-security-api-firewall'));
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : __('Failed to export settings.', 'bromate-security-api-firewall'),
        severity: 'error',
      });
    } finally {
      setExporting(false);
    }
  }, [settings]);

  const importDialogContent = useCallback((payload: ImportPayload): string => {
    if (payload.type === 'json') {
      return __(
        'This will overwrite your current plugin settings with the content of this file. This cannot be undone. Continue?',
        'bromate-security-api-firewall'
      );
    }
    return __(
      'This will import data from this file and may overwrite existing entries. This cannot be undone. Continue?',
      'bromate-security-api-firewall'
    );
  }, []);

  const applyImport = useCallback((payload: ImportPayload) => {
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Import data?', 'bromate-security-api-firewall'),
      content: importDialogContent(payload),
      confirmLabel: __('Import', 'bromate-security-api-firewall'),
      onConfirm: async () => {
        setImporting(true);
        try {
          const response = await apiRequest<ImportResponse>('bromate_import_settings', payload);
          setSnackbar({
            open: true,
            message: response.message || __('Import completed.', 'bromate-security-api-firewall'),
            severity: 'success',
          });
        } catch (error) {
          setSnackbar({
            open: true,
            message: error instanceof Error ? error.message : __('Failed to import.', 'bromate-security-api-firewall'),
            severity: 'error',
          });
        } finally {
          setImporting(false);
        }
      },
    });
  }, [openDialog, importDialogContent]);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        // Strip the "data:<mime>;base64," prefix added by readAsDataURL
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;

    const name = file.name.toLowerCase();

    if (name.endsWith('.json')) {
      try {
        const text = await readFileAsText(file);
        JSON.parse(text); // validate before sending
        applyImport({ type: 'json', settings: text });
      } catch {
        setSnackbar({
          open: true,
          message: __('This file is not valid JSON.', 'bromate-security-api-firewall'),
          severity: 'error',
        });
      }
      return;
    }

    if (name.endsWith('.csv')) {
      try {
        const text = await readFileAsText(file);
        if (!text.trim()) {
          throw new Error('empty');
        }
        applyImport({ type: 'csv', filename: file.name, csv: text });
      } catch {
        setSnackbar({
          open: true,
          message: __('Unable to read this CSV file.', 'bromate-security-api-firewall'),
          severity: 'error',
        });
      }
      return;
    }

    if (name.endsWith('.zip')) {
      try {
        const base64 = await readFileAsBase64(file);
        applyImport({ type: 'zip', filename: file.name, archive: base64 });
      } catch {
        setSnackbar({
          open: true,
          message: __('Unable to read this archive.', 'bromate-security-api-firewall'),
          severity: 'error',
        });
      }
      return;
    }

    setSnackbar({
      open: true,
      message: __('Please select a .json, .csv or .zip file.', 'bromate-security-api-firewall'),
      severity: 'error',
    });
  }, [applyImport]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
    e.target.value = '';
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    void handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  return (
    <Paper sx={{ p: 2 }} elevation={0}>
      <Stack spacing={3} maxWidth={500}>

        <Stack>
          <Typography variant="h6">
            {__('Export / Import', 'bromate-security-api-firewall')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {__('Back up or restore plugin settings and database tables.', 'bromate-security-api-firewall')}<br />
            {__('(JWT, 2FA and reCAPTCHA keys are never included.', 'bromate-security-api-firewall')}
          </Typography>
        </Stack>

        <Stack spacing={1}>
          <Stack>
            <Typography variant="body1" fontWeight={500}>
              {__('Export', 'bromate-security-api-firewall')}
            </Typography>
          </Stack>

          <FormControlLabel
            label={<Stack spacing={0}>
              <Typography variant="body1">
                {__('Include sensitive data', 'bromate-security-api-firewall')}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {__('JWT config, authorized users', 'bromate-security-api-firewall')}
              </Typography>
            </Stack>}
            control={
              <Checkbox
                size="small"
                checked={settings.config_export_include_sensitive_data}
                onChange={(e) => onChange('config_export_include_sensitive_data', e.target.checked)}
              />
            }
          />

          <FormControlLabel
            label={__('Include REST API routes tree', 'bromate-security-api-firewall')}
            control={
              <Checkbox
                size="small"
                checked={settings.config_export_include_routes_tree}
                onChange={(e) => onChange('config_export_include_routes_tree', e.target.checked)}
              />
            }
          />

          <Stack pl={1.5} direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <FormControlLabel
              label={__('Include IP entries table', 'bromate-security-api-firewall')}
              control={
                <Checkbox
                  size="small"
                  checked={settings.config_export_include_ip_entries}
                  onChange={(e) => onChange('config_export_include_ip_entries', e.target.checked)}
                />
              }
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={settings.config_export_ip_entries_format || 'csv'}
              onChange={(_, val) => onChange('config_export_ip_entries_format', val)}
              disabled={!settings.config_export_include_ip_entries}
            >
              <ToggleButton value="csv">CSV</ToggleButton>
              <ToggleButton value="json">JSON</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack pl={1.5} direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <FormControlLabel
              label={__('Include Logs table', 'bromate-security-api-firewall')}
              control={
                <Checkbox
                  size="small"
                  checked={settings.config_export_include_log_entries}
                  onChange={(e) => onChange('config_export_include_log_entries', e.target.checked)}
                />
              }
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={settings.config_export_log_entries_format || 'csv'}
              onChange={(_, val) => onChange('config_export_log_entries_format', val)}
              disabled={!settings.config_export_include_log_entries}
            >
              <ToggleButton value="csv">CSV</ToggleButton>
              <ToggleButton value="json">JSON</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack
            flexDirection="row"
            gap={2}
            alignItems="center"
          >
            <Stack sx={{display:'block'}}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                disabled={exporting}
                sx={{minWidth:150}}
              >
                {exporting ? __('Exporting…', 'bromate-security-api-firewall') : __('Export', 'bromate-security-api-firewall')}
              </Button>
            </Stack>
          </Stack>

        </Stack>

        <Stack
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          sx={{
            p: 3,
            borderRadius: '8px',
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'divider',
            bgcolor: dragActive ? 'action.hover' : 'transparent',
            transition: 'all .15s ease',
            textAlign: 'center',
            gap: 1,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight:250,
          }}
        >
          <Stack gap={1}>
            <Typography variant="body1" fontWeight={500}>
              {__('Import', 'bromate-security-api-firewall')}
            </Typography>
            <Typography variant="caption" component={"p"} color="text.secondary">
              {__('Drag and drop a .json, .csv or .zip export here', 'bromate-security-api-firewall')}<br/>
              {__('or click on Choose file', 'bromate-security-api-firewall')}
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              disabled={importing}
              sx={{minWidth:150}}
            >
              {importing ? __('Importing…', 'bromate-security-api-firewall') : __('Choose file', 'bromate-security-api-firewall')}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                hidden
                onChange={handleFileInputChange}
              />
            </Button>
          </Stack>
        </Stack>

      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}