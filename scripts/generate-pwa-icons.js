/**
 * Generates official Sanket AI PNG icons (192x192, 512x512, 180x180)
 * Renders the new "Sanket Nexus" Monogram (Flowing "S" Ribbon + AI Nexus + Soundwaves)
 * Uses standard Node.js built-ins (zlib, fs, path) - Zero external dependencies!
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for valid PNG chunk generation
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

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function generateSanketIconPng(size) {
  const width = size;
  const height = size;
  const rawBytesPerLine = 1 + width * 4;
  const rawData = Buffer.alloc(rawBytesPerLine * height);

  const cx = width / 2;
  const cy = height / 2;
  const cornerRadius = width * 0.24;

  // Geometry parameters for the "S" Ribbon
  const rTopCx = cx + width * 0.02;
  const rTopCy = cy - height * 0.16;
  const rTopRad = width * 0.22;

  const rBotCx = cx - width * 0.02;
  const rBotCy = cy + height * 0.16;
  const rBotRad = width * 0.22;

  const ribbonThickness = width * 0.115;
  const halfRibbon = ribbonThickness / 2;

  for (let y = 0; y < height; y++) {
    const lineOffset = y * rawBytesPerLine;
    rawData[lineOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;

      // Squircle distance check for rounded app icon
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const limit = width / 2;
      let inBounds = false;

      if (ax <= limit - cornerRadius && ay <= limit) {
        inBounds = true;
      } else if (ay <= limit - cornerRadius && ax <= limit) {
        inBounds = true;
      } else {
        const cdx = ax - (limit - cornerRadius);
        const cdy = ay - (limit - cornerRadius);
        if (cdx * cdx + cdy * cdy <= cornerRadius * cornerRadius) {
          inBounds = true;
        }
      }

      // Default transparent outside squircle
      if (!inBounds) {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // ─── 1. Deep Space Navy Background Gradient (#0F172A to #020617) ───
      const vGrad = y / height;
      let r = Math.round(15 * (1 - vGrad) + 2 * vGrad);
      let g = Math.round(23 * (1 - vGrad) + 6 * vGrad);
      let b = Math.round(42 * (1 - vGrad) + 23 * vGrad);
      let a = 255;

      // Soft ambient radial glow in the center
      const centerDist = Math.hypot(dx, dy);
      if (centerDist < width * 0.42) {
        const glowFactor = (1 - centerDist / (width * 0.42)) * 0.24;
        r = Math.min(255, Math.round(r + 249 * glowFactor));
        g = Math.min(255, Math.round(g + 115 * glowFactor));
        b = Math.min(255, Math.round(b + 22 * glowFactor));
      }

      // ─── 2. Top Ribbon of 'S' (Solar Orange to Amber #FF7A00 -> #F97316) ───
      const dTop = Math.abs(Math.hypot(x - rTopCx, y - rTopCy) - rTopRad);
      const angleTop = Math.atan2(y - rTopCy, x - rTopCx); // -PI to PI
      const isTopArc = (dTop <= halfRibbon) && (angleTop < 0.35 * Math.PI && angleTop > -1.15 * Math.PI);

      if (isTopArc) {
        const gradT = (angleTop + Math.PI) / (1.5 * Math.PI);
        r = Math.round(255 * (1 - gradT) + 249 * gradT);
        g = Math.round(122 * (1 - gradT) + 115 * gradT);
        b = Math.round(0 * (1 - gradT) + 22 * gradT);
      }

      // ─── 3. Bottom Ribbon of 'S' (Amber to Sunset Orange #FBBF24 -> #EA580C) ───
      const dBot = Math.abs(Math.hypot(x - rBotCx, y - rBotCy) - rBotRad);
      const angleBot = Math.atan2(y - rBotCy, x - rBotCx);
      const isBotArc = (dBot <= halfRibbon) && ((angleBot > -0.35 * Math.PI && angleBot < Math.PI) || angleBot < -0.85 * Math.PI);

      if (isBotArc) {
        const gradB = (angleBot + Math.PI / 2) / (1.5 * Math.PI);
        r = Math.round(251 * (1 - gradB) + 234 * gradB);
        g = Math.round(191 * (1 - gradB) + 88 * gradB);
        b = Math.round(36 * (1 - gradB) + 12 * gradB);
      }

      // ─── 4. Diagonal Bridge Ribbon of 'S' ───
      const bridgeDist = distToSegment(
        x, y, 
        cx - width * 0.16, cy - height * 0.05, 
        cx + width * 0.16, cy + height * 0.05
      );
      if (bridgeDist <= halfRibbon) {
        r = 249; g = 115; b = 22; // Vibrant Orange
      }

      // ─── 5. Audio Wave Frequencies on Right (3 Vertical Sound Bars) ───
      const waveX = cx + width * 0.36;
      const barW = width * 0.022;

      // Bar 1
      if (Math.abs(x - (waveX - barW * 2.2)) < barW / 2 && Math.abs(dy) < height * 0.07) {
        r = 251; g = 191; b = 36;
      }
      // Bar 2 (Taller center bar)
      else if (Math.abs(x - waveX) < barW / 2 && Math.abs(dy) < height * 0.13) {
        r = 249; g = 115; b = 22;
      }
      // Bar 3
      else if (Math.abs(x - (waveX + barW * 2.2)) < barW / 2 && Math.abs(dy) < height * 0.05) {
        r = 251; g = 191; b = 36;
      }

      // ─── 6. ISL Gesture Landmark Nodes on Left (3 Cyan Tracking Dots) ───
      const dotX = cx - width * 0.36;
      const dot1Dist = Math.hypot(x - dotX, y - (cy - height * 0.09));
      const dot2Dist = Math.hypot(x - (dotX - width * 0.03), y - cy);
      const dot3Dist = Math.hypot(x - dotX, y - (cy + height * 0.09));

      if (dot1Dist <= width * 0.02 || dot2Dist <= width * 0.026 || dot3Dist <= width * 0.02) {
        r = 56; g = 189; b = 248; // Electric Cyan
      }

      // ─── 7. Center AI Translation Nexus ───
      const nexusDist = Math.hypot(dx, dy);

      // Cyan pulse halo
      if (nexusDist < width * 0.095) {
        const nexusGlow = (1 - nexusDist / (width * 0.095));
        r = Math.round(r * (1 - nexusGlow) + 56 * nexusGlow);
        g = Math.round(g * (1 - nexusGlow) + 189 * nexusGlow);
        b = Math.round(b * (1 - nexusGlow) + 248 * nexusGlow);
      }

      // Bright white core diamond / star
      if (Math.abs(dx) + Math.abs(dy) <= width * 0.046) {
        r = 255; g = 255; b = 255; // Core White
      }

      // Electric cyan center spark
      if (nexusDist <= width * 0.016) {
        r = 6; g = 182; b = 212; // #06b6d4
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

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate PWA icons with the new Sanket AI Logo
[180, 192, 512].forEach(size => {
  const fileName = size === 180 ? 'apple-touch-icon.png' : `icon-${size}x${size}.png`;
  const filePath = path.join(iconsDir, fileName);
  const pngBuffer = generateSanketIconPng(size);
  fs.writeFileSync(filePath, pngBuffer);
  console.log(`Generated official Sanket PWA icon: ${fileName} (${size}x${size})`);

  // Also write to public root for maximum compatibility with all browsers
  if (size === 180) {
    fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngBuffer);
  } else if (size === 192) {
    fs.writeFileSync(path.join(publicDir, 'icon-192x192.png'), pngBuffer);
  } else if (size === 512) {
    fs.writeFileSync(path.join(publicDir, 'icon-512x512.png'), pngBuffer);
  }
});

console.log('✅ All Sanket AI PWA icons successfully generated with the new logo!');
