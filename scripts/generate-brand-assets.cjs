const { createCanvas } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = (...parts) => path.join(root, ...parts);
function rounded(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function background(ctx, size, light = false) {
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  if (light) { gradient.addColorStop(0, '#f8fbff'); gradient.addColorStop(1, '#e7f1ff'); }
  else { gradient.addColorStop(0, '#102c57'); gradient.addColorStop(.56, '#0b56b8'); gradient.addColorStop(1, '#087b83'); }
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size * .8, size * .12, 0, size * .8, size * .12, size * .75);
  glow.addColorStop(0, light ? 'rgba(68,143,255,.22)' : 'rgba(97,203,255,.32)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, size, size);
}
function mark(ctx, cx, cy, scale, dark = false) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.fillStyle = dark ? '#123a70' : '#ffffff';
  ctx.font = '700 112px "Segoe UI", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Ai', 0, 0);
  ctx.fillStyle = '#48d8ad'; ctx.beginPath(); ctx.arc(55, -47, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function png(canvas, file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, canvas.toBuffer('image/png')); }
function bmp(canvas, file) {
  const { width, height } = canvas; const pixels = ctxPixels(canvas); const rowSize = Math.ceil(width * 3 / 4) * 4;
  const dataSize = rowSize * height; const buffer = Buffer.alloc(54 + dataSize);
  buffer.write('BM'); buffer.writeUInt32LE(buffer.length, 2); buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14); buffer.writeInt32LE(width, 18); buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26); buffer.writeUInt16LE(24, 28); buffer.writeUInt32LE(dataSize, 34);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = ((height - 1 - y) * width + x) * 4; const target = 54 + y * rowSize + x * 3;
    buffer[target] = pixels[source + 2]; buffer[target + 1] = pixels[source + 1]; buffer[target + 2] = pixels[source];
  }
  fs.writeFileSync(file, buffer);
}
function ctxPixels(canvas) { return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; }
function ico(pngBuffer, file, size = 256) {
  const header = Buffer.alloc(22); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header[6] = 0; header[7] = 0; header[8] = 0; header[9] = 0; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(pngBuffer.length, 14); header.writeUInt32LE(22, 18);
  fs.writeFileSync(file, Buffer.concat([header, pngBuffer]));
}

const iconCanvas = createCanvas(512, 512); const icon = iconCanvas.getContext('2d');
icon.clearRect(0, 0, 512, 512); rounded(icon, 18, 18, 476, 476, 112); icon.save(); icon.clip(); background(icon, 512); icon.restore();
icon.strokeStyle = 'rgba(255,255,255,.18)'; icon.lineWidth = 3; rounded(icon, 36, 36, 440, 440, 96); icon.stroke();
mark(icon, 256, 265, 2.35);
png(iconCanvas, out('build', 'icon.png')); png(iconCanvas, out('public', 'images', 'app-icon.png'));
const icon256 = createCanvas(256, 256); icon256.getContext('2d').drawImage(iconCanvas, 0, 0, 256, 256);
ico(icon256.toBuffer('image/png'), out('build', 'icon.ico'));
for (const name of ['installerIcon.ico', 'uninstallerIcon.ico', 'installerHeaderIcon.ico']) fs.copyFileSync(out('build', 'icon.ico'), out('build', name));
png(icon256, out('..', 'baiagent-director-android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', 'ic_launcher.png'));
png(icon256, out('android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', 'ic_launcher.png'));

const sidebarCanvas = createCanvas(328, 628); const side = sidebarCanvas.getContext('2d'); background(side, 628);
side.fillStyle = 'rgba(255,255,255,.09)'; rounded(side, 42, 54, 112, 112, 30); side.fill(); mark(side, 98, 111, .72);
side.fillStyle = '#ffffff'; side.textAlign = 'left'; side.font = '700 42px "Segoe UI", Arial';
side.fillText('Ваш бизнес.', 42, 264); side.fillText('Понятные', 42, 316); side.fillText('действия.', 42, 368);
side.fillStyle = '#bce8ff'; side.font = '24px "Segoe UI", Arial';
['Узнать компанию', 'Найти возможности', 'Проверить источники'].forEach((line, index) => {
  side.fillStyle = '#48d8ad'; side.beginPath(); side.arc(49, 447 + index * 48, 5, 0, Math.PI * 2); side.fill();
  side.fillStyle = '#d7edff'; side.fillText(line, 67, 455 + index * 48);
});
const sidebarBmp = createCanvas(164, 314); sidebarBmp.getContext('2d').drawImage(sidebarCanvas, 0, 0, 164, 314);
bmp(sidebarBmp, out('build', 'installerSidebar.bmp')); png(sidebarCanvas, out('artifacts', 'installer-sidebar-preview.png'));

const headerCanvas = createCanvas(600, 228); const header = headerCanvas.getContext('2d'); background(header, 600, true);
header.fillStyle = '#0b56b8'; rounded(header, 30, 59, 108, 108, 27); header.fill(); mark(header, 84, 114, .65);
header.fillStyle = '#15365f'; header.font = '700 46px "Segoe UI", Arial'; header.textAlign = 'left'; header.fillText('BAIagent Director', 165, 130);
const headerBmp = createCanvas(150, 57); headerBmp.getContext('2d').drawImage(headerCanvas, 0, 0, 150, 57);
bmp(headerBmp, out('build', 'installerHeader.bmp')); png(headerCanvas, out('artifacts', 'installer-header-preview.png'));
console.log('Brand assets generated');
