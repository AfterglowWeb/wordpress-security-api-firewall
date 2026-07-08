import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import AppTheme from '@totp-contexts/AppTheme';


interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | JSX.Element;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'info' | 'success';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  portalContainer?: HTMLElement | null;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'primary',
  loading = false,
  onConfirm,
  onCancel,
  portalContainer,
}: ConfirmDialogProps) {
  return (
    <AppTheme>
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      container={portalContainer}
      disableEscapeKeyDown={loading}
    >
      <DialogTitle sx={{ pb: 1 }}>
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button
          onClick={onCancel}
          disabled={loading}
          variant="outlined"
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={confirmColor}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
    </AppTheme>
  );
}