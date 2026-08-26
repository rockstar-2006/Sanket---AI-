import { NodeIO } from '@gltf-transform/core';
import { draco } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { writeFileSync, statSync } from 'fs';
import draco3d from 'draco3d';

const input  = 'D:/Matri/model/Waving Gesture.glb';
const output = 'D:/Matri/public/model/man.glb';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });

console.log('Reading GLB...');
const doc = await io.read(input);

console.log('Compressing with Draco...');
await doc.transform(
  draco({ method: 'edgebreaker' })
);

console.log('Writing compressed GLB...');
const glb = await io.writeBinary(doc);
writeFileSync(output, glb);

const inSize  = statSync(input).size;
const outSize = glb.byteLength;
console.log(`Input:  ${(inSize  / 1024 / 1024).toFixed(2)} MB`);
console.log(`Output: ${(outSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Reduction: ${(100 - (outSize/inSize)*100).toFixed(1)}%`);
