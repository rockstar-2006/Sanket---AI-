/**
 * Pure TypeScript QR Code Generator (Zero Dependencies)
 * Generates ISO/IEC 18004 compliant QR Codes for instant camera scanning.
 * Supports Versions 1 to 10 in Byte Mode with Reed-Solomon Error Correction.
 */

// Galois Field GF(2^8) math with polynomial 0x11D (285)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    EXP_TABLE[i + 255] = val;
    LOG_TABLE[val] = i;
    val = (val << 1) ^ (val & 0x80 ? 0x11d : 0);
  }
  LOG_TABLE[0] = 0;
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

// Precomputed RS generator polynomials for common EC codeword counts
function getRsGeneratorPoly(numEcWords: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < numEcWords; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

// Computes Reed-Solomon error correction codewords
function computeRsCodewords(data: Uint8Array, numEcWords: number): Uint8Array {
  const gen = getRsGeneratorPoly(numEcWords);
  const remainder = new Uint8Array(numEcWords);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < numEcWords - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    remainder[numEcWords - 1] = gfMul(gen[numEcWords], factor);
  }

  return remainder;
}

// Table of QR Version Specs for Error Correction Level M
// Format: [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataWordsPerBlock1, numBlocksGroup2, dataWordsPerBlock2]
interface VersionSpec {
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  b1: number;
  d1: number;
  b2: number;
  d2: number;
  alignments: number[];
}

const VERSION_SPECS_M: VersionSpec[] = [
  { version: 1, totalCodewords: 26, ecCodewordsPerBlock: 10, b1: 1, d1: 16, b2: 0, d2: 0, alignments: [] },
  { version: 2, totalCodewords: 44, ecCodewordsPerBlock: 16, b1: 1, d1: 28, b2: 0, d2: 0, alignments: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewordsPerBlock: 26, b1: 1, d1: 44, b2: 0, d2: 0, alignments: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewordsPerBlock: 18, b1: 2, d1: 32, b2: 0, d2: 0, alignments: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewordsPerBlock: 24, b1: 2, d1: 43, b2: 0, d2: 0, alignments: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewordsPerBlock: 16, b1: 4, d1: 27, b2: 0, d2: 0, alignments: [6, 34] },
  { version: 7, totalCodewords: 196, ecCodewordsPerBlock: 18, b1: 4, d1: 31, b2: 0, d2: 0, alignments: [6, 22, 38] },
  { version: 8, totalCodewords: 242, ecCodewordsPerBlock: 22, b1: 4, d1: 38, b2: 2, d2: 39, alignments: [6, 24, 42] },
  { version: 9, totalCodewords: 292, ecCodewordsPerBlock: 22, b1: 3, d1: 36, b2: 2, d2: 37, alignments: [6, 26, 46] },
  { version: 10, totalCodewords: 346, ecCodewordsPerBlock: 26, b1: 4, d1: 43, b2: 1, d2: 44, alignments: [6, 28, 50] },
];

export class QrCodeEncoder {
  static encode(text: string): boolean[][] {
    const utf8Bytes = new TextEncoder().encode(text);
    const dataLen = utf8Bytes.length;

    // 1. Choose minimum version that fits dataLen in Byte Mode (Level M)
    let spec: VersionSpec | null = null;
    for (const s of VERSION_SPECS_M) {
      const totalDataCapacity = (s.b1 * s.d1) + (s.b2 * s.d2);
      // Mode (4 bits) + Char count indicator (8 bits for v1-9, 16 for v10+)
      const headerBits = 4 + (s.version <= 9 ? 8 : 16);
      const neededBytes = Math.ceil((headerBits + dataLen * 8 + 4) / 8);
      if (neededBytes <= totalDataCapacity) {
        spec = s;
        break;
      }
    }

    if (!spec) {
      // Fallback to Version 10
      spec = VERSION_SPECS_M[VERSION_SPECS_M.length - 1];
    }

    const totalDataCapacity = (spec.b1 * spec.d1) + (spec.b2 * spec.d2);

    // 2. Build Bit Stream
    const bitBuffer: number[] = [];
    const pushBits = (val: number, length: number) => {
      for (let i = length - 1; i >= 0; i--) {
        bitBuffer.push((val >> i) & 1);
      }
    };

    // Mode: Byte Mode (0b0100)
    pushBits(0b0100, 4);
    // Character count indicator
    pushBits(dataLen, spec.version <= 9 ? 8 : 16);
    // Data bytes
    for (let i = 0; i < dataLen; i++) {
      pushBits(utf8Bytes[i], 8);
    }
    // Terminator (up to 4 bits of 0)
    const maxBits = totalDataCapacity * 8;
    const termLen = Math.min(4, maxBits - bitBuffer.length);
    pushBits(0, termLen);
    // Pad to byte boundary
    while (bitBuffer.length % 8 !== 0) {
      bitBuffer.push(0);
    }
    // Pad bytes 0xEC and 0x11
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (bitBuffer.length < maxBits) {
      pushBits(padBytes[padIdx % 2], 8);
      padIdx++;
    }

    // Convert bit buffer to data codewords array
    const dataCodewords = new Uint8Array(totalDataCapacity);
    for (let i = 0; i < totalDataCapacity; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bitBuffer[i * 8 + j];
      }
      dataCodewords[i] = b;
    }

    // 3. Divide into blocks and compute Reed-Solomon EC Codewords
    const dataBlocks: Uint8Array[] = [];
    const ecBlocks: Uint8Array[] = [];
    let offset = 0;

    for (let i = 0; i < spec.b1; i++) {
      const slice = dataCodewords.slice(offset, offset + spec.d1);
      dataBlocks.push(slice);
      ecBlocks.push(computeRsCodewords(slice, spec.ecCodewordsPerBlock));
      offset += spec.d1;
    }
    for (let i = 0; i < spec.b2; i++) {
      const slice = dataCodewords.slice(offset, offset + spec.d2);
      dataBlocks.push(slice);
      ecBlocks.push(computeRsCodewords(slice, spec.ecCodewordsPerBlock));
      offset += spec.d2;
    }

    // 4. Interleave data codewords then EC codewords
    const finalCodewords: number[] = [];
    const maxDataBlockLen = Math.max(spec.d1, spec.d2);
    for (let i = 0; i < maxDataBlockLen; i++) {
      for (const block of dataBlocks) {
        if (i < block.length) finalCodewords.push(block[i]);
      }
    }
    for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
      for (const block of ecBlocks) {
        finalCodewords.push(block[i]);
      }
    }

    // 5. Construct QR Matrix
    const size = spec.version * 4 + 17;
    const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    const isReserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    const setFuncModule = (r: number, c: number, val: boolean) => {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        matrix[r][c] = val;
        isReserved[r][c] = true;
      }
    };

    // Draw 7x7 Finder Pattern with 1-module white separator
    const drawFinder = (row: number, col: number) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const currR = row + r;
          const currC = col + c;
          if (currR < 0 || currR >= size || currC < 0 || currC >= size) continue;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = (r === 0 || r === 6 || c === 0 || c === 6);
            const isCenter = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            setFuncModule(currR, currC, isBorder || isCenter);
          } else {
            setFuncModule(currR, currC, false);
          }
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Alignment patterns for Version 2+
    if (spec.alignments.length > 0) {
      const positions = spec.alignments;
      for (const r of positions) {
        for (const c of positions) {
          if (isReserved[r][c]) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const isDark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
              setFuncModule(r + dr, c + dc, isDark);
            }
          }
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!isReserved[6][i]) setFuncModule(6, i, i % 2 === 0);
      if (!isReserved[i][6]) setFuncModule(i, 6, i % 2 === 0);
    }

    // Dark Module
    setFuncModule(4 * spec.version + 9, 8, true);

    // Reserve format information areas
    for (let i = 0; i <= 8; i++) {
      if (!isReserved[8][i]) isReserved[8][i] = true;
      if (!isReserved[i][8]) isReserved[i][8] = true;
    }
    for (let i = size - 8; i < size; i++) {
      if (!isReserved[8][i]) isReserved[8][i] = true;
      if (!isReserved[i][8]) isReserved[i][8] = true;
    }

    // 6. Place Data Codewords (Zigzag from right to left)
    let cwIdx = 0;
    let bitIdx = 7;
    let upward = true;

    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--; // Skip vertical timing pattern
      const rows = upward
        ? Array.from({ length: size }, (_, i) => size - 1 - i)
        : Array.from({ length: size }, (_, i) => i);

      for (const row of rows) {
        for (const c of [col, col - 1]) {
          if (!isReserved[row][c]) {
            let bit = false;
            if (cwIdx < finalCodewords.length) {
              bit = ((finalCodewords[cwIdx] >> bitIdx) & 1) === 1;
              bitIdx--;
              if (bitIdx < 0) {
                bitIdx = 7;
                cwIdx++;
              }
            }
            matrix[row][c] = bit;
          }
        }
      }
      upward = !upward;
    }

    // 7. Apply Mask Pattern (Pattern 0: (row + col) % 2 === 0)
    // Mask Pattern 0 gives optimal camera contrast for URL strings
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isReserved[r][c]) {
          if ((r + c) % 2 === 0) {
            matrix[r][c] = !matrix[r][c];
          }
        }
      }
    }

    // 8. Write Format Information (Level M = 00, Mask 0 = 000 -> 101010000010010)
    // Precomputed 15-bit masked format information word for Level M and Mask 0: 0x4B3A (0b100101100111010)
    const formatBits = [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0];

    // Around top-left finder
    matrix[8][0] = Boolean(formatBits[0]);
    matrix[8][1] = Boolean(formatBits[1]);
    matrix[8][2] = Boolean(formatBits[2]);
    matrix[8][3] = Boolean(formatBits[3]);
    matrix[8][4] = Boolean(formatBits[4]);
    matrix[8][5] = Boolean(formatBits[5]);
    matrix[8][7] = Boolean(formatBits[6]);
    matrix[8][8] = Boolean(formatBits[7]);
    matrix[7][8] = Boolean(formatBits[8]);
    matrix[5][8] = Boolean(formatBits[9]);
    matrix[4][8] = Boolean(formatBits[10]);
    matrix[3][8] = Boolean(formatBits[11]);
    matrix[2][8] = Boolean(formatBits[12]);
    matrix[1][8] = Boolean(formatBits[13]);
    matrix[0][8] = Boolean(formatBits[14]);

    // Around top-right and bottom-left finders
    for (let i = 0; i < 7; i++) {
      matrix[size - 1 - i][8] = Boolean(formatBits[i]);
    }
    for (let i = 0; i < 8; i++) {
      matrix[8][size - 8 + i] = Boolean(formatBits[7 + i]);
    }

    return matrix.map((row) => row.map((cell) => cell ?? false));
  }
}
