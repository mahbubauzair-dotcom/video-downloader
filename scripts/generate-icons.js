import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcData = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePNG(width, height, isMaskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines
  // Each scanline: 1 byte filter (0) + width * 4 bytes RGBA
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.35 : 0.42);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter: none

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep sleek slate background (#0f172a)
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      // Indigo/Purple circular glow
      if (dist < radius) {
        const t = dist / radius;
        // Gradient from indigo (#6366f1) to slate
        r = Math.round(99 * (1 - t * 0.7) + 15 * t * 0.7);
        g = Math.round(102 * (1 - t * 0.7) + 23 * t * 0.7);
        b = Math.round(241 * (1 - t * 0.7) + 42 * t * 0.7);
      }

      // Download arrow shape in center
      // Center arrow: stem from cy - radius*0.4 to cy + radius*0.2, width radius*0.2
      // Arrowhead from cy + radius*0.2 to cy + radius*0.45
      const arrowWidth = radius * 0.22;
      const isStem = Math.abs(dx) <= arrowWidth && dy >= -radius * 0.45 && dy <= radius * 0.15;
      const arrowHeadY = dy - radius * 0.15;
      const isHead = arrowHeadY >= 0 && arrowHeadY <= radius * 0.35 && Math.abs(dx) <= (radius * 0.45 - arrowHeadY * 0.85);

      // Bottom bar
      const isBar = dy >= radius * 0.45 && dy <= radius * 0.58 && Math.abs(dx) <= radius * 0.55;

      if (isStem || isHead || isBar) {
        r = 255;
        g = 255;
        b = 255;
        a = 255;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePNG(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePNG(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePNG(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePNG(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), generatePNG(32, 32, false));

console.log('PWA PNG Icons successfully generated!');
