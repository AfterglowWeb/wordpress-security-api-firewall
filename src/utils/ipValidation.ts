// @utils/ip-validation.ts

const IPV4_OCTET = '(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
const IPV4_REGEX = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}$`);

const IPV6_SEGMENT = '[0-9a-fA-F]{1,4}';
const IPV6_PATTERN = [
  `(${IPV6_SEGMENT}:){7}${IPV6_SEGMENT}`,
  `(${IPV6_SEGMENT}:){1,7}:`,
  `(${IPV6_SEGMENT}:){1,6}:${IPV6_SEGMENT}`,
  `(${IPV6_SEGMENT}:){1,5}(:${IPV6_SEGMENT}){1,2}`,
  `(${IPV6_SEGMENT}:){1,4}(:${IPV6_SEGMENT}){1,3}`,
  `(${IPV6_SEGMENT}:){1,3}(:${IPV6_SEGMENT}){1,4}`,
  `(${IPV6_SEGMENT}:){1,2}(:${IPV6_SEGMENT}){1,5}`,
  `${IPV6_SEGMENT}:((:${IPV6_SEGMENT}){1,6})`,
  `:((:${IPV6_SEGMENT}){1,7}|:)`,
].join('|');
const IPV6_REGEX = new RegExp(`^(${IPV6_PATTERN})$`);

export function isValidIpOrCidr(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const [address, prefix] = trimmed.split('/');

  if (prefix !== undefined && !/^\d{1,3}$/.test(prefix)) {
    return false;
  }

  if (IPV4_REGEX.test(address)) {
    if (prefix === undefined) return true;
    const bits = Number(prefix);
    return bits >= 0 && bits <= 32;
  }

  if (IPV6_REGEX.test(address)) {
    if (prefix === undefined) return true;
    const bits = Number(prefix);
    return bits >= 0 && bits <= 128;
  }

  return false;
}

export function findInvalidIpLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isValidIpOrCidr(line));
}

export function isValidOrigin(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    const normalized = trimmed.replace(/\/$/, '');
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === normalized;
  } catch {
    return false;
  }
}