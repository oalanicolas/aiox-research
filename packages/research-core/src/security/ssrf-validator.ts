const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

export function assertSafeFetchUrl(rawUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`blocked protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new Error(`blocked hostname: ${hostname}`);
  }

  if (isBlockedIpv4(hostname) || isBlockedIpv6(hostname)) {
    throw new Error(`blocked private address: ${hostname}`);
  }

  return parsed;
}

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split('.');

  if (parts.length !== 4) {
    return false;
  }

  const octets = parts.map((part) => Number.parseInt(part, 10));

  if (octets.some((octet, index) => !/^\d+$/.test(parts[index]) || octet < 0 || octet > 255)) {
    return false;
  }

  const [a, b] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}
