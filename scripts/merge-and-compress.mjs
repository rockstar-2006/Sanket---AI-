/**
 * Merges textures from man.glb (original colored model) 
 * into Waving Gesture.glb (rigged + animated, but no textures)
 * then compresses the result with Draco.
 */
import { NodeIO } from '@gltf-transform/core';
import { draco, textureCompress } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync } from 'fs';

const ORIGINAL  = 'D:/Matri/model/man.glb';           // has textures, no rig
const ANIMATED  = 'D:/Matri/model/Waving Gesture.glb'; // has rig+anim, no textures
const OUTPUT    = 'D:/Matri/public/model/man.glb';

// ── Read both GLBs as raw JSON + binary ──────────────────────────────────────
function readGlb(path) {
  const data = readFileSync(path);
  const jsonLen = data.readUInt32LE(12);
  const json = JSON.parse(data.slice(20, 20 + jsonLen).toString('utf8'));
  // Binary chunk starts at byte 20 + jsonLen + 8 (chunk header)
  const binOffset = 20 + jsonLen + 8;
  const bin = binOffset < data.length ? data.slice(binOffset) : Buffer.alloc(0);
  return { json, bin, data };
}

const orig = readGlb(ORIGINAL);
const anim = readGlb(ANIMATED);

console.log('Original - images:', orig.json.images?.length, 'materials:', orig.json.materials?.length);
console.log('Animated - images:', anim.json.images?.length, 'materials:', anim.json.materials?.length, 'anims:', anim.json.animations?.length, 'skins:', anim.json.skins?.length);

// ── Copy images + textures + material pbr from original into animated ────────
const animJson = JSON.parse(JSON.stringify(anim.json)); // deep clone
const origJson = orig.json;

// The animated GLB's buffer holds skin/geometry data
// The original's buffer holds texture image data
// We need to merge both buffers and update bufferView offsets

const animBinLen = anim.json.buffers?.[0]?.byteLength ?? 0;
const origBinLen = orig.json.buffers?.[0]?.byteLength ?? 0;

// Merge binary: anim first, then orig
const mergedBin = Buffer.concat([anim.bin.slice(0, animBinLen), orig.bin.slice(0, origBinLen)]);

// Fix orig bufferViews: shift byteOffset by animBinLen
const origBufferViews = (origJson.bufferViews || []).map(bv => ({
  ...bv,
  byteOffset: (bv.byteOffset || 0) + animBinLen,
}));

// Append orig bufferViews to anim
const animBvCount = (animJson.bufferViews || []).length;
animJson.bufferViews = [...(animJson.bufferViews || []), ...origBufferViews];

// Copy images with updated bufferView indices
const origImages = (origJson.images || []).map(img => ({
  ...img,
  bufferView: img.bufferView + animBvCount,
}));
animJson.images = origImages;

// Copy textures with updated image source indices  
animJson.textures = origJson.textures || [];
// (texture.source indices already match since we reset images array)

// Copy samplers
animJson.samplers = origJson.samplers || [];

// Copy material PBR data (textures) from original to animated material
if (origJson.materials?.length && animJson.materials?.length) {
  const origMat = origJson.materials[0].pbrMetallicRoughness;
  animJson.materials[0].pbrMetallicRoughness = {
    ...animJson.materials[0].pbrMetallicRoughness,
    ...origMat,
  };
  // Copy other material properties
  if (origJson.materials[0].normalTexture)
    animJson.materials[0].normalTexture = origJson.materials[0].normalTexture;
  if (origJson.materials[0].occlusionTexture)
    animJson.materials[0].occlusionTexture = origJson.materials[0].occlusionTexture;
}

// Update merged buffer size
animJson.buffers = [{ byteLength: mergedBin.length }];

// ── Rebuild GLB binary ───────────────────────────────────────────────────────
function buildGlb(json, bin) {
  const jsonStr    = JSON.stringify(json);
  const jsonBytes  = Buffer.from(jsonStr, 'utf8');
  // JSON chunk must be 4-byte aligned, padded with spaces
  const jsonPad    = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunk  = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]);

  // BIN chunk must be 4-byte aligned, padded with zeros
  const binPad     = (4 - (bin.length % 4)) % 4;
  const binChunk   = Buffer.concat([bin, Buffer.alloc(binPad, 0x00)]);

  const totalLen = 12 + 8 + jsonChunk.length + (bin.length > 0 ? 8 + binChunk.length : 0);
  const out = Buffer.alloc(totalLen);
  let off = 0;

  // GLB header
  out.writeUInt32LE(0x46546C67, off); off += 4; // magic 'glTF'
  out.writeUInt32LE(2,          off); off += 4; // version
  out.writeUInt32LE(totalLen,   off); off += 4; // total length

  // JSON chunk
  out.writeUInt32LE(jsonChunk.length, off); off += 4;
  out.writeUInt32LE(0x4E4F534A,       off); off += 4; // 'JSON'
  jsonChunk.copy(out, off); off += jsonChunk.length;

  // BIN chunk
  if (bin.length > 0) {
    out.writeUInt32LE(binChunk.length, off); off += 4;
    out.writeUInt32LE(0x004E4942,      off); off += 4; // 'BIN\0'
    binChunk.copy(out, off);
  }

  return out;
}

console.log('Merging textures into animated GLB...');
const mergedGlb = buildGlb(animJson, mergedBin);
console.log('Merged size:', (mergedGlb.length / 1024 / 1024).toFixed(2), 'MB');

// Write temp merged file
writeFileSync('D:/Matri/model/man_merged_temp.glb', mergedGlb);

// ── Compress with Draco + texture compression ────────────────────────────────
console.log('Compressing with Draco...');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'sharp': sharp,
  });

const doc = await io.read('D:/Matri/model/man_merged_temp.glb');

await doc.transform(
  draco({ method: 'edgebreaker' }),
);

const compressed = await io.writeBinary(doc);
writeFileSync(OUTPUT, compressed);

const finalSize = compressed.byteLength;
console.log('Final size:', (finalSize / 1024 / 1024).toFixed(2), 'MB');
console.log('Saved to:', OUTPUT);

// Cleanup temp
import { unlinkSync } from 'fs';
try { unlinkSync('D:/Matri/model/man_merged_temp.glb'); } catch(e) {}
