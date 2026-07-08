// components/SaveButton.tsx
import { useState, useCallback } from '@wordpress/element';
import { Button, Snackbar, Alert } from '@mui/material';
import { useDialog, DIALOG_TYPES } from '@contexts/DialogContext';
import ConfirmDialog from '@components/ConfirmDialog';

export interface SaveButtonMessages {
  confirmTitle: string;
  confirmContent: string;
  confirmLabel: string;
  successMessage: string;
  errorMessage: string;
  saveLabel: string;
  savingLabel: string;
}

interface SaveButtonProps {
  onSave: () => Promise<void>;
  disabled?: boolean;
  messages: SaveButtonMessages;
}

export default function SaveButton({ onSave, disabled, messages }: SaveButtonProps) {
  const { openDialog } = useDialog();
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave();
      setSnackbar({ open: true, message: messages.successMessage, severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: messages.errorMessage, severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [onSave, messages]);

  const handleClick = useCallback(() => {
    openDialog({
      type: DIALOG_TYPES.CONFIRM,
      title: messages.confirmTitle,
      content: messages.confirmContent,
      confirmLabel: messages.confirmLabel,
      onConfirm: doSave,
    });
  }, [openDialog, messages, doSave]);

  return (
    <>
      <Button
        variant="contained"
        disableElevation
        onClick={handleClick}
        disabled={disabled || saving}
      >
        {saving ? messages.savingLabel : messages.saveLabel}
      </Button>

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

      <ConfirmDialog />
    </>
  );
}