import { useState, useCallback, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { apiRequest } from '@services/api';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';

interface ExportPayload {
  exported_at: string;
  plugin: string;
  settings: Record<string, unknown>;
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export default function ExportImportSettings(): JSX.Element {
  const { openDialog } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const payload = await apiRequest<ExportPayload>('bromate_export_settings');
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(payload, `bromate-security-api-firewall-settings-${date}.json`);
      setSnackbar({
        open: true,
        message: __('Settings exported.', 'bromate-security-api-firewall'),
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : __('Failed to export settings.', 'bromate-security-api-firewall'),
        severity: 'error',
      });
    } finally {
      setExporting(false);
    }
  }, []);

  const applyImport = useCallback((rawText: string) => {
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: __('Import settings?', 'bromate-security-api-firewall'),
      content: __(
        'This will overwrite your current plugin settings with the content of this file. This cannot be undone. Continue?',
        'bromate-security-api-firewall'
      ),
      confirmLabel: __('Import', 'bromate-security-api-firewall'),
      onConfirm: async () => {
        setImporting(true);
        try {
          await apiRequest('bromate_import_settings', { settings: rawText });
          setSnackbar({
            open: true,
            message: __('Settings imported successfully. Reload the page to see the changes.', 'bromate-security-api-firewall'),
            severity: 'success',
          });
        } catch (error) {
          setSnackbar({
            open: true,
            message: error instanceof Error ? error.message : __('Failed to import settings.', 'bromate-security-api-firewall'),
            severity: 'error',
          });
        } finally {
          setImporting(false);
        }
      },
    });
  }, [openDialog]);

  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setSnackbar({
        open: true,
        message: __('Please select a .json file.', 'bromate-security-api-firewall'),
        severity: 'error',
      });
      return;
    }

    try {
      const text = await readFileAsText(file);
      JSON.parse(text); // Validate it's actually JSON before sending it onward.
      applyImport(text);
    } catch {
      setSnackbar({
        open: true,
        message: __('This file is not valid JSON.', 'bromate-security-api-firewall'),
        severity: 'error',
      });
    }
  }, [applyImport]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
    e.target.value = ''; // Allow re-selecting the same file later.
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
          {__('Export / Import plugin settings', 'bromate-security-api-firewall')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {__('Back up all plugin settings or restore them from a previously exported file.', 'bromate-security-api-firewall')}
        </Typography>
        </Stack>


        <Stack 
        flexDirection="row"
        gap={2}
        alignItems="center"
        >
          <Stack>
            <Typography variant="body2" fontWeight={500}>
              {__('Export settings', 'bromate-security-api-firewall')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {__('Downloads a .json file.', 'bromate-security-api-firewall')}
            </Typography>
          </Stack>
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
          <Typography variant="body2" fontWeight={500}>
            {__('Import settings', 'bromate-security-api-firewall')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {__('Drag and drop a .json file here or', 'bromate-security-api-firewall')}
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
              accept="application/json,.json"
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