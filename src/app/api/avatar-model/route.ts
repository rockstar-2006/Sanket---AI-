import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function getSearchDirectories(): string[] {
  return [
    path.join(process.cwd(), 'model'),
    'D:\\Matri\\model',
    'D:/Matri/model',
    path.join(process.cwd(), 'public', 'model'),
    'D:\\Matri\\public\\model',
    'D:/Matri/public/model',
  ];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 1. List available models in D:/Matri/model and public/model
  if (searchParams.get('list') === 'true' || searchParams.get('info') === 'true') {
    const modelExtensions = new Set(['.fbx', '.glb', '.gltf']);
    const foundModels = new Map<string, { filename: string; name: string; sizeMb: string; ext: string; url: string; path: string }>();

    for (const dir of getSearchDirectories()) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const ext = path.extname(f).toLowerCase();
            if (modelExtensions.has(ext)) {
              try {
                const fullPath = path.join(dir, f);
                const stat = fs.statSync(fullPath);
                if (stat.isFile() && !foundModels.has(f.toLowerCase())) {
                  const sizeMb = (stat.size / 1024 / 1024).toFixed(2);
                  let displayName = f;
                  if (f.toLowerCase() === 'mans.fbx') displayName = 'Mans (Primary 65-Bone Rig)';
                  else if (f.toLowerCase() === 'mans.glb') displayName = 'Mans (Optimized Fast GLB)';
                  else if (f.toLowerCase() === 'passive_marker_man.fbx') displayName = 'Passive Marker Man (Studio Rig)';
                  else if (f.toLowerCase() === 'man.glb') displayName = 'Standard Humanoid (GLB)';

                  foundModels.set(f.toLowerCase(), {
                    filename: f,
                    name: displayName,
                    sizeMb: `${sizeMb} MB`,
                    ext: ext.replace('.', ''),
                    url: `/api/avatar-model?file=${encodeURIComponent(f)}`,
                    path: fullPath,
                  });
                }
              } catch {
                // ignore stat error
              }
            }
          }
        } catch {
          // ignore readdir error
        }
      }
    }

    const modelsList = Array.from(foundModels.values());
    return new Response(JSON.stringify({ models: modelsList, total: modelsList.length }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Specific file requested via ?file=<name>
  const requestedFile = searchParams.get('file');
  if (requestedFile) {
    const safeName = path.basename(requestedFile);
    let targetPath = '';

    for (const dir of getSearchDirectories()) {
      const candidate = path.join(dir, safeName);
      if (fs.existsSync(candidate)) {
        targetPath = candidate;
        break;
      }
    }

    if (!targetPath) {
      console.warn(`[Avatar-API] Requested model not found: ${safeName}`);
      return new Response(`Model "${safeName}" not found`, { status: 404 });
    }

    const stat = fs.statSync(targetPath);
    const ext = path.extname(safeName).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.glb') contentType = 'model/gltf-binary';
    else if (ext === '.gltf') contentType = 'model/gltf+json';

    console.log(`[Avatar-API] Serving model ${safeName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    const nodeStream = fs.createReadStream(targetPath);
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  }

  // 3. Check if client requested GLB format
  if (searchParams.get('format') === 'glb') {
    const glbCandidates = [
      path.join(process.cwd(), 'public', 'model', 'mans.glb'),
      path.join(process.cwd(), 'model', 'mans.glb'),
      'D:\\Matri\\model\\mans.glb',
      'D:\\Matri\\public\\model\\mans.glb',
    ];
    for (const p of glbCandidates) {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        const nodeStream = fs.createReadStream(p);
        const webStream = Readable.toWeb(nodeStream);
        return new Response(webStream as any, {
          headers: {
            'Content-Type': 'model/gltf-binary',
            'Content-Length': stat.size.toString(),
            'Content-Disposition': 'inline; filename="mans.glb"',
            'Cache-Control': 'public, max-age=604800, immutable',
          },
        });
      }
    }
    return new Response('mans.glb not found yet', { status: 404 });
  }

  // 4. Default: serve mans.fbx
  const candidates = [
    path.join(process.cwd(), 'model', 'mans.fbx'),
    'D:\\Matri\\model\\mans.fbx',
    'D:/Matri/model/mans.fbx',
    path.join(process.cwd(), 'public', 'model', 'mans.fbx'),
  ];

  let chosenPath = '';
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      chosenPath = c;
      break;
    }
  }

  if (!chosenPath) {
    console.error('[Avatar-API] D:/Matri/model/mans.fbx not found in candidates:', candidates);
    return new Response('mans.fbx not found', { status: 404 });
  }

  const stat = fs.statSync(chosenPath);
  console.log(`[Avatar-API] Serving default mans.fbx from ${chosenPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  const nodeStream = fs.createReadStream(chosenPath);
  const webStream = Readable.toWeb(nodeStream);

  return new Response(webStream as any, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size.toString(),
      'Content-Disposition': 'inline; filename="mans.fbx"',
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadName = searchParams.get('upload') || 'mans.glb';
    const safeName = path.basename(uploadName);

    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 500) {
      return new Response(JSON.stringify({ error: 'Invalid or empty model file buffer' }), { status: 400 });
    }

    const publicDir = path.join(process.cwd(), 'public', 'model');
    const modelDir = path.join(process.cwd(), 'model');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(path.join(publicDir, safeName), buffer);
    fs.writeFileSync(path.join(modelDir, safeName), buffer);

    console.log(`[Avatar-API] Saved model ${safeName} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    return new Response(JSON.stringify({ success: true, filename: safeName, size: arrayBuffer.byteLength }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Avatar-API] Failed to save model:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
