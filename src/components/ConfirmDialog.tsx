import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { useDialog, DIALOG_TYPES } from '../contexts/DialogContext';

const TEXT_DOMAIN = 'bromate-security-api-firewall';

export default function ConfirmDialog(): JSX.Element {
    const { dialog, closeDialog, resetDialog } = useDialog();
    const { open, type, title, content, confirmLabel, cancelLabel, onConfirm, onCancel, autoClose } = dialog;

    useEffect(() => {
        if (!open || !autoClose || autoClose <= 0) return;

        const timer = setTimeout(closeDialog, autoClose);
        return () => clearTimeout(timer);
    }, [open, autoClose, closeDialog]);

    const handleClose = (_: unknown, reason?: string) => {
        if (reason === 'backdropClick' && type === DIALOG_TYPES.LOADING) return;
        onCancel?.();
        resetDialog();
        closeDialog();
    };

    const handleConfirm = () => {
        closeDialog();
        onConfirm?.();
    };

    const getIcon = (): JSX.Element | null => {
        switch (type) {
            case DIALOG_TYPES.SUCCESS:
                return <InfoOutlinedIcon color="success" sx={{ fontSize: 48 }} />;
            case DIALOG_TYPES.ERROR:
                return <ErrorOutlineIcon color="error"   sx={{ fontSize: 48 }} />;
            case DIALOG_TYPES.INFO:
                return <InfoOutlinedIcon color="info"    sx={{ fontSize: 48 }} />;
            default:
                return null;
        }
    };

    const getDefaultTitle = (): string => {
        switch (type) {
            case DIALOG_TYPES.SUCCESS: return __('Success',      TEXT_DOMAIN);
            case DIALOG_TYPES.ERROR:   return __('Error',        TEXT_DOMAIN);
            case DIALOG_TYPES.INFO:    return __('Information',  TEXT_DOMAIN);
            case DIALOG_TYPES.LOADING: return __('Please wait…', TEXT_DOMAIN);
            default:                   return __('Confirm',      TEXT_DOMAIN);
        }
    };

    const renderContent = (): JSX.Element | null => {
        if (type === DIALOG_TYPES.LOADING) {
            return (
                <Stack spacing={2} sx={{ py: 2 }}>
                    {content && <DialogContentText>{content}</DialogContentText>}
                    <LinearProgress />
                </Stack>
            );
        }

        const icon = getIcon();

        if (icon) {
            return (
                <Stack alignItems="center" spacing={2} sx={{ py: 1 }}>
                    {icon}
                    {content && (
                        <DialogContentText textAlign="center">{content}</DialogContentText>
                    )}
                </Stack>
            );
        }

        return content ? <DialogContentText>{content}</DialogContentText> : null;
    };

    const renderActions = (): JSX.Element | null => {
        if (type === DIALOG_TYPES.LOADING) return null;

        if (
            type === DIALOG_TYPES.SUCCESS ||
            type === DIALOG_TYPES.ERROR   ||
            type === DIALOG_TYPES.INFO
        ) {
            return (
                <DialogActions>
                    <Button onClick={handleClose} color="primary" variant="contained">
                        {confirmLabel ?? __('OK', TEXT_DOMAIN)}
                    </Button>
                </DialogActions>
            );
        }

        return (
            <DialogActions>
                <Button onClick={handleClose} color="inherit" variant="outlined">
                    {cancelLabel ?? __('Cancel', TEXT_DOMAIN)}
                </Button>
                <Button onClick={handleConfirm} color="primary" variant="contained" disableElevation>
                    {confirmLabel ?? __('Confirm', TEXT_DOMAIN)}
                </Button>
            </DialogActions>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            disablePortal
            aria-labelledby="dialog-title"
            maxWidth="xs"
            fullWidth
            sx={{ '&': { pl: { xs: 0, md: '160px' } } }}
        >
            <DialogTitle id="dialog-title">{title || getDefaultTitle()}</DialogTitle>
            <DialogContent>{renderContent()}</DialogContent>
            {renderActions()}
        </Dialog>
    );
}