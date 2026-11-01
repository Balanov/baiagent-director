export const OWN_ECOSYSTEM_DOMAINS = Object.freeze([
  'balanov.pro',
  'baiagent.ru',
  '2aos.ru',
  'attractor.network',
  'paritet.dev',
  'startpervyh.ru',
  'antonkids.ru',
]);

export function ownEcosystemHostname(value) {
  const input = String(value ?? '').trim();
  if (!input || /[\u0000-\u0020]/.test(input)) return '';
  try {
    const candidate = input.startsWith('//') ? `https:${input}` : /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    return OWN_ECOSYSTEM_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`)) ? hostname : '';
  } catch {
    return '';
  }
}

export function isOwnEcosystemWebsite(value) {
  return Boolean(ownEcosystemHostname(value));
}
