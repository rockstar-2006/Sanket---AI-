import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('file') || 'masc_vroid.vrm';
    const filePath = path.join(process.cwd(), 'public', fileName);
    const buffer = fs.readFileSync(filePath);

    const jsonLength = buffer.readUInt32LE(12);
    const jsonChunk = buffer.slice(20, 20 + jsonLength).toString('utf8');
    const gltf = JSON.parse(jsonChunk);

    const nodes = gltf.nodes || [];
    const skins = gltf.skins || [];
    const vrm = gltf.extensions?.VRM || gltf.extensions?.VRMC_vrm;

    return NextResponse.json({
      extensions: Object.keys(gltf.extensions || {}),
      humanoidBones: vrm?.humanoid?.humanBones || vrm?.humanoid,
      totalNodes: nodes.length,
      sampleNodes: nodes.slice(0, 30).map((n: any) => n.name),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
