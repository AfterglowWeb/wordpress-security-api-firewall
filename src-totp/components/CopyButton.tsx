import { useState } from '@wordpress/element';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { usePortalContainer } from '@contexts/PortalContainerContext';
import { __ } from '@wordpress/i18n';
import type { SxProps, Theme } from '@mui/material/styles';

interface CopyButtonProps {
  toCopy: string;
  sx?: SxProps<Theme>;
}

function copyToClipboard(text: string): boolean {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).catch(() => {
    });
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  }

  document.body.removeChild(textarea);
  return succeeded;
}

export default function CopyButton({ toCopy, sx = {} }: CopyButtonProps) {
  const portalContainer = usePortalContainer();
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const ok = copyToClipboard(toCopy || '');
    setCopyFailed(!ok);
    setCopyFeedback(true);
  };

  return (
    <>
      <Tooltip slotProps={{ popper: { container: portalContainer } }} title={__('Copy', 'bromate-security-api-firewall')}>
        <IconButton size="small" onClick={handleCopy} sx={{ p: 0.25, ...sx }}>
          <ContentCopyIcon sx={{ fontSize: 'inherit' }} />
        </IconButton>
      </Tooltip>
      <Snackbar
        open={copyFeedback}
        autoHideDuration={2000}
        onClose={() => setCopyFeedback(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setCopyFeedback(false)}
          severity={copyFailed ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {copyFailed
            ? __('Copy failed — please select and copy manually.', 'bromate-security-api-firewall')
            : __('Copied to clipboard', 'bromate-security-api-firewall')}
        </Alert>
      </Snackbar>
    </>
  );
}