import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'public');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type); const body = Buffer.concat([name, data]); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([length, body, crc]); }
function png(width, height, pixels) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function blend(pixels, width, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= width || y >= pixels.length / width / 4) return;
  const i = (y * width + x) * 4, a = Math.max(0, Math.min(1, alpha));
  for (let c = 0; c < 3; c += 1) pixels[i + c] = Math.round(pixels[i + c] * (1 - a) + color[c] * a);
  pixels[i + 3] = 255;
}
function render(width, height, { maskable = false, splash = false } = {}) {
  const pixels = Buffer.alloc(width * height * 4); const min = Math.min(width, height), cx = width / 2, cy = height / 2;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4, radial = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / (min * 0.82));
    pixels[i] = 7 + Math.round(radial * 9); pixels[i + 1] = 9 + Math.round(radial * 8); pixels[i + 2] = 16 + Math.round(radial * 17); pixels[i + 3] = 255;
  }
  const logoScale = splash ? min * 0.16 : min * (maskable ? 0.29 : 0.34), logoY = cy - (splash ? min * 0.04 : 0);
  const line = (x1, y1, x2, y2, thickness, color, alpha = 1) => {
    const left = Math.floor(Math.min(x1, x2) - thickness * 3), right = Math.ceil(Math.max(x1, x2) + thickness * 3), top = Math.floor(Math.min(y1, y2) - thickness * 3), bottom = Math.ceil(Math.max(y1, y2) + thickness * 3), vx = x2 - x1, vy = y2 - y1, length2 = vx * vx + vy * vy;
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) { const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / length2)); const distance = Math.hypot(x - (x1 + t * vx), y - (y1 + t * vy)); if (distance < thickness * 3) blend(pixels, width, x, y, color, Math.max(0, 1 - distance / (thickness * 3)) * alpha * .2); if (distance < thickness) blend(pixels, width, x, y, color, Math.max(0, 1 - distance / thickness) * alpha); }
  };
  const hexRadius = logoScale * .24, dx = hexRadius * 1.76, dy = hexRadius * 1.52;
  for (const [gx, gy] of [[-.5,-.64],[.5,-.64],[-1,0],[0,0],[1,0],[.5,.64]]) {
    const hx = cx + gx * dx, hy = logoY + gy * dy, points = Array.from({ length: 6 }, (_, index) => [hx + Math.cos(index * Math.PI / 3) * hexRadius, hy + Math.sin(index * Math.PI / 3) * hexRadius]);
    for (let index = 0; index < 6; index += 1) line(...points[index], ...points[(index + 1) % 6], Math.max(2, logoScale * .018), index < 3 ? [105,235,255] : [157,140,255], .92);
  }
  const coreX = cx, coreY = logoY, core = logoScale * .075;
  for (let y = Math.floor(coreY - core * 3); y <= coreY + core * 3; y += 1) for (let x = Math.floor(coreX - core * 3); x <= coreX + core * 3; x += 1) { const qx = Math.abs(x + .5 - coreX), qy = Math.abs(y + .5 - coreY), d = Math.hypot(qx, qy); if (d < core * 3) blend(pixels, width, x, y, [94,225,255], Math.max(0, 1 - d / (core * 3)) * .32); if (qx <= core * Math.sqrt(3) / 2 && qy + qx / Math.sqrt(3) <= core) blend(pixels, width, x, y, [225,252,255], 1); }
  if (!maskable && !splash) {
    const radius = min * .21;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const dx = Math.max(radius - x, 0, x - (width - radius)), dy = Math.max(radius - y, 0, y - (height - radius)); if (dx * dx + dy * dy > radius * radius) pixels[(y * width + x) * 4 + 3] = 0; }
  }
  return png(width, height, pixels);
}

await mkdir(output, { recursive: true });
for (const [name, width, height, options] of [
  ['icon-192.png', 192, 192, {}], ['icon-512.png', 512, 512, {}],
  ['icon-maskable-192.png', 192, 192, { maskable: true }], ['icon-maskable-512.png', 512, 512, { maskable: true }],
  ['apple-touch-icon-180.png', 180, 180, { maskable: true }],
  ['splash-1170x2532.png', 1170, 2532, { splash: true }], ['splash-2048x2732.png', 2048, 2732, { splash: true }]
]) await writeFile(path.join(output, name), render(width, height, options));
