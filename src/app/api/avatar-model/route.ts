import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get('file') || 'masc_vroid.vrm';

    const candidatePaths = [
      path.join(process.cwd(), 'public', fileParam),
      path.join(process.cwd(), 'public', 'model', fileParam),
      path.join(process.cwd(), 'model', fileParam),
      path.join('D:\\Matri\\model', fileParam),
    ];

    let foundPath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      return NextResponse.json(
        { error: `Avatar model file not found. Checked: ${candidatePaths.join(', ')}` },
        { status: 404 }
      );
    }

    // Also auto-copy to public/masc_vroid.vrm if not already there
    const publicDest = path.join(process.cwd(), 'public', 'masc_vroid.vrm');
    if (!fs.existsSync(publicDest) && foundPath !== publicDest) {
      try {
        fs.copyFileSync(foundPath, publicDest);
      } catch (e) {
        console.warn('Could not copy to public:', e);
      }
    }

    const stat = fs.statSync(foundPath);
    const fileBuffer = fs.readFileSync(foundPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Length': stat.size.toString(),
        'Content-Type': fileParam.endsWith('.vrm') || fileParam.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
