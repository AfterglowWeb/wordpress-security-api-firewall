/**
 * formatDate( dateString, dateFormat, timeFormat )
 *
 * Formats a MySQL datetime string ("2026-02-27 15:30:00") using WordPress
 * date_format / time_format settings, which use PHP date() tokens.
 *
 * PHP tokens are converted to dayjs equivalents before formatting so the
 * output matches what WordPress itself would show in the admin.
 *
 * Usage:
 *   const { adminData } = useAdminData();
 *   formatDate( entry.date_created, adminData.date_format, adminData.time_format );
 */

import dayjs from 'dayjs';

// PHP date token → dayjs format token mapping.
// Tokens absent from this map are treated as PHP literals and wrapped in [].
const PHP_TO_DAYJS = {
	// Day
	d: 'DD', // 01–31
	D: 'ddd', // Mon–Sun
	j: 'D', // 1–31  (no leading zero)
	l: 'dddd', // Monday–Sunday
	N: 'E', // 1 (Mon)–7 (Sun)
	S: '', // Ordinal suffix (st/nd/rd/th) — not supported; omit silently
	w: 'd', // 0 (Sun)–6 (Sat)
	// Month
	F: 'MMMM', // January–December
	m: 'MM', // 01–12
	M: 'MMM', // Jan–Dec
	n: 'M', // 1–12  (no leading zero)
	// Year
	Y: 'YYYY', // 2026
	y: 'YY', // 26
	// Time
	a: 'a', // am/pm
	A: 'A', // AM/PM
	g: 'h', // 1–12  (no leading zero, 12-hour)
	G: 'H', // 0–23  (no leading zero, 24-hour)
	h: 'hh', // 01–12 (12-hour)
	H: 'HH', // 00–23 (24-hour)
	i: 'mm', // 00–59 (minutes)
	s: 'ss', // 00–59 (seconds)
	v: 'SSS', // milliseconds
	// Timezone
	O: 'ZZ', // +0200
	P: 'Z', // +02:00
	T: 'z', // UTC, EST…
	// Unix
	U: 'X', // Unix timestamp
};

/**
 * Convert a PHP date() format string to a dayjs format string.
 *
 * PHP backslash-escapes a character to make it literal (e.g. \Y → "Y").
 * dayjs uses [text] for literals.
 * All characters not in the PHP token map are treated as literals.
 *
 * @param {string} phpFormat
 * @return {string}
 */
function phpFormatToDayjs( phpFormat ) {
	let result = '';
	let i = 0;

	while ( i < phpFormat.length ) {
		const ch = phpFormat[ i ];

		if ( ch === '\\' && i + 1 < phpFormat.length ) {
			// Backslash-escaped literal character
			result += `[${ phpFormat[ i + 1 ] }]`;
			i += 2;
			continue;
		}

		if ( Object.prototype.hasOwnProperty.call( PHP_TO_DAYJS, ch ) ) {
			result += PHP_TO_DAYJS[ ch ];
		} else {
			// Not a PHP token — wrap as dayjs literal to avoid misinterpretation
			result += `[${ ch }]`;
		}

		i++;
	}

	return result;
}

/**
 * @param {string} dateString   MySQL datetime, e.g. "2026-02-27 15:30:00"
 * @param {string} [dateFormat] WordPress date_format (PHP tokens), e.g. "F j, Y"
 * @param {string} [timeFormat] WordPress time_format (PHP tokens), e.g. "g:i a"
 * @return {string}
 */
export default function formatDate( dateString, dateFormat, timeFormat ) {
	if ( ! dateString ) {
		return '—';
	}

	const d = dayjs( dateString );
	if ( ! d.isValid() ) {
		return dateString;
	}

	if ( ! dateFormat && ! timeFormat ) {
		return d.format( 'YYYY-MM-DD HH:mm' );
	}

	const parts = [];
	if ( dateFormat ) {
		parts.push( d.format( phpFormatToDayjs( dateFormat ) ) );
	}
	if ( timeFormat ) {
		parts.push( d.format( phpFormatToDayjs( timeFormat ) ) );
	}
	return parts.join( ' ' );
}
