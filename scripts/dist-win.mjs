import { resolve } from 'node:path';
import { Arch, Platform, build } from 'electron-builder';

delete process.env.ELECTRON_RUN_AS_NODE;
const signed = process.argv.includes('--signed');
const enterprise = process.argv.includes('--enterprise');
const store = process.argv.includes('--store');
const target = store ? 'appx' : process.env.BAIAGENT_WINDOWS_TARGET || 'nsis';
const output = resolve(process.env.BAIAGENT_WINDOWS_OUTPUT || (store ? 'release-store' : signed ? 'release-signed' : enterprise ? 'release-enterprise' : 'release'));
const electronDist = process.env.BAIAGENT_ELECTRON_DIST
  ? resolve(process.env.BAIAGENT_ELECTRON_DIST)
  : undefined;
const certificateSubjectName = process.env.BAIAGENT_WIN_CERT_SUBJECT?.trim();
const certificateSha1 = process.env.BAIAGENT_WIN_CERT_SHA1?.replace(/\s/g, '').toUpperCase();
const timestampUrl = process.env.BAIAGENT_WIN_TIMESTAMP_URL || 'http://timestamp.digicert.com';
const storeIdentityName = process.env.BAIAGENT_STORE_IDENTITY_NAME?.trim();
const storePublisher = process.env.BAIAGENT_STORE_PUBLISHER?.trim();

if (store && (signed || enterprise)) {
  throw new Error('Store build cannot be combined with --signed or --enterprise.');
}
if (store && (!storeIdentityName || !storePublisher)) {
  throw new Error('Store build requires BAIAGENT_STORE_IDENTITY_NAME and BAIAGENT_STORE_PUBLISHER copied exactly from Partner Center → Product management → View app identity details.');
}
if (storeIdentityName && !/^[a-zA-Z0-9.-]{3,50}$/.test(storeIdentityName)) {
  throw new Error('BAIAGENT_STORE_IDENTITY_NAME must be 3–50 characters using only letters, digits, dots and hyphens.');
}
if (signed && !certificateSubjectName) {
  throw new Error('Signed build requires BAIAGENT_WIN_CERT_SUBJECT with the exact certificate Subject from the Windows certificate store.');
}
if (signed && certificateSha1 && !/^[A-F0-9]{40}$/.test(certificateSha1)) {
  throw new Error('BAIAGENT_WIN_CERT_SHA1 must be a 40-character SHA-1 certificate thumbprint.');
}
if (signed && !['http:', 'https:'].includes(new URL(timestampUrl).protocol)) {
  throw new Error('BAIAGENT_WIN_TIMESTAMP_URL must be an HTTP or HTTPS RFC 3161 timestamp endpoint.');
}

await build({
  targets: Platform.WINDOWS.createTarget([target], Arch.x64),
  config: {
    directories: { output },
    electronDist,
    ...(enterprise ? {
      appId: 'pro.balanov.enterprise.advisor',
      productName: 'Balanov.PRO Enterprise',
      executableName: 'Balanov.PRO Enterprise',
      extraMetadata: { productName: 'Balanov.PRO Enterprise' },
      files: [
        'dist-enterprise/**/*',
        '!dist-enterprise/downloads/**/*',
        '!dist-enterprise/xray/downloads/**/*',
        'electron/**/*',
        'shared/**/*',
        'package.json',
      ],
      nsis: {
        artifactName: 'Balanov-PRO-Enterprise-Setup-Windows-${version}-${arch}.${ext}',
        shortcutName: 'Balanov.PRO Enterprise',
        menuCategory: 'Balanov.PRO',
      },
    } : {}),
    ...(store ? {
      appx: {
        identityName: storeIdentityName,
        publisher: storePublisher,
      },
    } : {}),
    ...(signed ? {
      win: {
        forceCodeSigning: true,
        signtoolOptions: {
          certificateSubjectName,
          ...(certificateSha1 ? { certificateSha1 } : {}),
          signingHashAlgorithms: ['sha256'],
          rfc3161TimeStampServer: timestampUrl,
        },
      },
    } : {}),
  },
});
console.log(`Windows ${target} ${signed ? 'signed ' : ''}build completed: ${output}`);
