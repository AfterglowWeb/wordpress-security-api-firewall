import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CopyButton from '@components/CopyButton';

export default function DataPanel( { label, data, labelColor = 'text.secondary', bgcolor, status } ) {
	const text = data !== undefined ? JSON.stringify( data, null, 2 ) : '—';

	const statusColor =
		status >= 200 && status < 300
			? 'success'
			: status >= 400
			? 'error'
			: 'default';

	return (
		<Stack flex={ 1 } spacing={ 1 } sx={ { minWidth: 0 } }>
			<Stack direction="row" spacing={ 1 } alignItems="center">
				<Typography variant="subtitle2" fontWeight={ 600 } color={ labelColor } sx={ { flex: 1 } }>
					{ label }
				</Typography>
				{ status && (
					<Chip
						label={ status }
						size="small"
						color={ statusColor }
						variant="outlined"
						sx={ { fontFamily: 'monospace', fontWeight: 700 } }
					/>
				) }
				<CopyButton toCopy={ text } />
			</Stack>
			<Box
				component="pre"
				sx={ {
					p: 2,
					bgcolor: bgcolor || 'grey.50',
					borderRadius: 1,
					overflowX: 'auto',
					fontSize: '0.72rem',
					lineHeight: 1.5,
					m: 0,
					whiteSpace: 'pre-wrap',
					wordBreak: 'break-all',
					maxHeight: 400,
					overflowY: 'auto',
				} }
			>
				{ text }
			</Box>
		</Stack>
	);
}
