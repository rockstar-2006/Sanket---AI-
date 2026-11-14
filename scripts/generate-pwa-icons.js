/**
 * Generates valid PNG icons for PWA compliance (192x192, 512x512, 180x180)
 * Uses standard Node.js built-ins (zlib, fs, path) - Zero external dependencies!
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG chunk validation
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, body, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;
  const rawBytesPerLine = 1 + width * 4; // 1 filter byte + RGBA
  const rawData = Buffer.alloc(rawBytesPerLine * height);

  // Colors
  const bgR = 15, bgG = 23, bgB = 42; // #0f172a (Dark Slate)
  const fgR = 249, fgG = 115, fgB = 22; // #f97316 (Orange Accent)
  const cyR = 56, cyG = 189, cyB = 248; // #38bdf8 (Cyan Accent)

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;
  const camHalfW = width * 0.22;
  const camHalfH = height * 0.16;

  for (let y = 0; y < height; y++) {
    const lineOffset = y * rawBytesPerLine;
    rawData[lineOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = bgR, g = bgG, b = bgB, a = 255;

      // Rounded outer border ring
      if (Math.abs(dist - radius) < (width * 0.02)) {
        r = cyR; g = cyG; b = cyB; a = 220;
      }
      // Camera body rectangle in center
      else if (Math.abs(dx + width * 0.05) < camHalfW && Math.abs(dy) < camHalfH) {
        r = 30; g = 41; b = 59; // #1e293b
      }
      // Camera lens triangle / cone
      else if (dx > width * 0.16 && dx < width * 0.32 && Math.abs(dy) < (dx - width * 0.14) * 0.9 && Math.abs(dy) < height * 0.15) {
        r = fgR; g = fgG; b = fgB; // Orange lens
      }
      // Hand silhouette center indicator
      else if (Math.abs(dx + width * 0.05) < width * 0.09 && Math.abs(dy) < height * 0.09) {
        r = 255; g = 255; b = 255; // White hand symbol
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Header chunk (IHDR)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // Color type 6: RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // No interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', zlib.deflateSync(rawData));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[180, 192, 512].forEach(size => {
  const fileName = size === 180 ? 'apple-touch-icon.png' : `icon-${size}x${size}.png`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, generatePng(size));
  console.log(`Generated PWA icon: ${fileName} (${size}x${size})`);
});
console.log('✅ All PWA PNG icons generated successfully!');
