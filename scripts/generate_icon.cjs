const { createCanvas } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve(__dirname, '..', 'build');
fs.mkdirSync(output, { recursive: true });
const canvas = createCanvas(512, 512);
const context = canvas.getContext('2d');
context.fillStyle = '#176b87';
context.fillRect(0, 0, 512, 512);
context.beginPath();
context.roundRect(34, 34, 444, 444, 108);
context.fillStyle = '#1d7d9b';
context.fill();
context.lineWidth = 5;
context.strokeStyle = '#79d8eb';
context.stroke();
context.beginPath();
context.arc(256, 256, 140, 0, Math.PI * 2);
context.lineWidth = 18;
context.strokeStyle = '#b9f2f7';
context.stroke();
context.beginPath();
context.arc(256, 256, 80, 0, Math.PI * 2);
context.fillStyle = '#f5fbff';
context.fill();
context.beginPath();
context.arc(256, 256, 36, 0, Math.PI * 2);
context.fillStyle = '#176b87';
context.fill();
context.fillStyle = '#b9f2f7';
for (const [x, y, width, height] of [[66, 242, 60, 28], [386, 242, 60, 28], [242, 66, 28, 60], [242, 386, 28, 60]]) {
  context.beginPath();
  context.roundRect(x, y, width, height, 12);
  context.fill();
}
const target = path.join(output, 'icon.png');
fs.writeFileSync(target, canvas.toBuffer('image/png'));
console.log(target);
