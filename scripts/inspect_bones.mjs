import fs from 'fs';
import path from 'path';

const modelDir = path.join(process.cwd(), 'model');
const publicModelDir = path.join(process.cwd(), 'public', 'model');

if (!fs.existsSync(publicModelDir)) {
  fs.mkdirSync(publicModelDir, { recursive: true });
}

// 1. Copy mans.fbx to public/model/mans.fbx
const srcFbx = path.join(modelDir, 'mans.fbx');
const destFbx = path.join(publicModelDir, 'mans.fbx');

if (fs.existsSync(srcFbx)) {
  fs.copyFileSync(srcFbx, destFbx);
  console.log(`[OK] Copied mans.fbx -> public/model/mans.fbx (${(fs.statSync(destFbx).size / 1024 / 1024).toFixed(2)} MB)`);
}

// 2. Scan mans.fbx binary for bone strings
if (fs.existsSync(srcFbx)) {
  const buf = fs.readFileSync(srcFbx);
  const str = buf.toString('latin1');
  const matches = str.match(/mixamorig[A-Za-z0-9_:]+/g) || [];
  const uniqueBones = Array.from(new Set(matches.map(b => b.replace(/^mixamorig[_:]?/i, ''))));

  console.log(`\n=== MANS.FBX BONE AUDIT ===`);
  console.log(`Total bones detected: ${uniqueBones.length}`);
  console.log(`Bones:`, uniqueBones);
  
  const thumbs = uniqueBones.filter(b => /thumb/i.test(b));
  console.log(`Thumb bones found (${thumbs.length}):`, thumbs);
  
  const fingers = uniqueBones.filter(b => /thumb|index|middle|ring|pinky/i.test(b));
  console.log(`All finger bones found (${fingers.length}):`, fingers);
}
