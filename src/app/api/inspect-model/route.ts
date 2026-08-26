import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const glbPath = path.join(process.cwd(), 'public', 'model', 'man.glb');
    const buffer = fs.readFileSync(glbPath);

    const jsonLength = buffer.readUInt32LE(12);
    const jsonChunk = buffer.slice(20, 20 + jsonLength).toString('utf8');
    const gltf = JSON.parse(jsonChunk);

    const nodes = gltf.nodes || [];
    const skins = gltf.skins || [];

    const joints = skins[0]?.joints ? skins[0].joints.map((j: number) => nodes[j]?.name) : [];
    const allNodeNames = nodes.map((n: any) => n.name);

    return NextResponse.json({
      totalNodes: nodes.length,
      jointsCount: joints.length,
      joints,
      allNodeNames,
      animations: gltf.animations?.map((a: any) => a.name) || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
