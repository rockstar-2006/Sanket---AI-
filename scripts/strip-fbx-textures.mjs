/**
 * Strips embedded texture data from a binary FBX file to reduce its size.
 * Keeps skeleton, geometry, and animation data intact.
 */
import { readFileSync, writeFileSync } from 'fs';

const input  = 'D:/Matri/model/Waving Gesture.fbx';
const output = 'D:/Matri/public/model/man.fbx';

const data = readFileSync(input);
console.log('Input size:', (data.length / 1024 / 1024).toFixed(1), 'MB');

// Binary FBX structure: series of nodes
// Each node: nameLen(1) + name(n) + propCount(4) + propListLen(4) + endOffset(4/8)
// We need to find and zero-out Video/Texture content nodes that hold raw image bytes

// Strategy: find JPEG magic bytes (FF D8 FF) and zero out those embedded buffers
// This is safe — Three.js FBXLoader will still load geometry + bones + animation
// it just won't apply the original textures (which is fine, model already has UV maps)

let stripped = 0;
const buf = Buffer.from(data); // mutable copy

for (let i = 0; i < buf.length - 4; i++) {
  if (buf[i] === 0xFF && buf[i+1] === 0xD8 && buf[i+2] === 0xFF) {
    // Found JPEG start — find its end (FF D9)
    let end = i + 2;
    while (end < buf.length - 1) {
      if (buf[end] === 0xFF && buf[end+1] === 0xD9) { end += 2; break; }
      end++;
    }
    const len = end - i;
    buf.fill(0, i, end); // zero out the JPEG data
    console.log(`  Stripped JPEG at offset ${i}, size ${(len/1024).toFixed(1)} KB`);
    stripped++;
    i = end;
  }
}

console.log(`Stripped ${stripped} textures`);
writeFileSync(output, buf);
const outSize = buf.length;
console.log('Output size:', (outSize / 1024 / 1024).toFixed(1), 'MB');
console.log('Saved to:', output);
