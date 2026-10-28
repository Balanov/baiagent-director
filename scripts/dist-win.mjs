import { resolve } from 'node:path';
import { Arch, Platform, build } from 'electron-builder';

delete process.env.ELECTRON_RUN_AS_NODE;
const signed = process.argv.includes('--signed');
const target = process.env.BAIAGENT_WINDOWS_TARGET || 'nsis';
const output = resolve(process.env.BAIAGENT_WINDOWS_OUTPUT || (signed ? 'release-signed' : 'release'));
const electronDist = process.env.BAIAGENT_ELECTRON_DIST
  ? resolve(process.env.BAIAGENT_ELECTRON_DIST)
  : undefined;
const certificateSubjectName = process.env.BAIAGENT_WIN_CERT_SUBJECT?.trim();
const certificateSha1 = process.env.BAIAGENT_WIN_CERT_SHA1?.replace(/\s/g, '').toUpperCase();
const timestampUrl = process.env.BAIAGENT_WIN_TIMESTAMP_URL || 'http://timestamp.digicert.com';

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
