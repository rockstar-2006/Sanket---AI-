import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CustomSignRecord {
  id: string;
  token: string;
  label: string;
  category: string;
  description: string;
  totalFrames: number;
  durationSec: number;
  createdAt: string;
  frames: {
    frameIndex: number;
    timeSec: number;
    rightHand: { x: number; y: number; z: number }[] | null;
    leftHand: { x: number; y: number; z: number }[] | null;
  }[];
}

const STORAGE_DIR = path.join(process.cwd(), 'public', 'custom_signs');
const TMP_STORAGE_DIR = path.join(os.tmpdir(), 'sanket_custom_signs');

// Global in-memory cache to guarantee persistence across server requests even on ephemeral containers
const globalSignsCache: Map<string, CustomSignRecord> =
  (globalThis as any).__sanketCustomSignsCache || new Map<string, CustomSignRecord>();
(globalThis as any).__sanketCustomSignsCache = globalSignsCache;

function ensureDirectories() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  } catch {}
  try {
    if (!fs.existsSync(TMP_STORAGE_DIR)) {
      fs.mkdirSync(TMP_STORAGE_DIR, { recursive: true });
    }
  } catch {}
}

function readSignsFromDir(dir: string, map: Map<string, CustomSignRecord>) {
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(dir, file), 'utf-8');
          const data = JSON.parse(content) as CustomSignRecord;
          if (data && data.id) {
            map.set(data.id, data);
            globalSignsCache.set(data.id, data);
          }
        } catch {}
      }
    }
  } catch {}
}

// GET: Retrieve all saved custom signs
export async function GET(req: NextRequest) {
  try {
    ensureDirectories();
    const { searchParams } = new URL(req.url);
    const signId = searchParams.get('id');
    const token = searchParams.get('token');

    const signMap = new Map<string, CustomSignRecord>();

    // 1. Read from in-memory cache first
    globalSignsCache.forEach((sign, id) => {
      signMap.set(id, sign);
    });

    // 2. Read from primary public directory
    readSignsFromDir(STORAGE_DIR, signMap);

    // 3. Read from temporary container directory
    readSignsFromDir(TMP_STORAGE_DIR, signMap);

    const signs = Array.from(signMap.values());

    if (signId) {
      const found = signMap.get(signId);
      if (found) return NextResponse.json(found);
      return NextResponse.json({ error: 'Sign not found' }, { status: 404 });
    }

    if (token) {
      const found = signs.find((s) => s.token.toLowerCase() === token.toLowerCase());
      if (found) return NextResponse.json(found);
      return NextResponse.json({ error: 'Sign not found' }, { status: 404 });
    }

    return NextResponse.json({ total: signs.length, signs });
  } catch (err: any) {
    // If disk read failed completely, still return in-memory cache
    const fallbackSigns = Array.from(globalSignsCache.values());
    return NextResponse.json({ total: fallbackSigns.length, signs: fallbackSigns });
  }
}

// POST: Save a new converted 3D sign
export async function POST(req: NextRequest) {
  try {
    ensureDirectories();
    const body = await req.json();

    if (!body.token || !body.frames || body.frames.length === 0) {
      return NextResponse.json({ error: 'Missing required sign token or frame landmarks' }, { status: 400 });
    }

    const cleanToken = body.token.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const id = body.id || `custom_${cleanToken}_${Date.now()}`;

    const signRecord: CustomSignRecord = {
      id,
      token: cleanToken,
      label: body.label || body.token.toUpperCase(),
      category: body.category || 'Custom',
      description: body.description || 'Converted from video via Sanket AI 3D Motion Studio',
      totalFrames: body.frames.length,
      durationSec: body.durationSec || Number(((body.frames.length - 1) / 30).toFixed(2)),
      createdAt: body.createdAt || new Date().toISOString(),
      frames: body.frames,
    };

    // 1. Save in memory cache immediately
    globalSignsCache.set(id, signRecord);

    // 2. Write to primary public storage
    let written = false;
    try {
      const filePath = path.join(STORAGE_DIR, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(signRecord, null, 2), 'utf-8');
      written = true;
    } catch (fsErr) {
      console.warn('[CustomSigns API] Primary storage write warning:', fsErr);
    }

    // 3. Write to temporary container storage as backup
    try {
      const tmpPath = path.join(TMP_STORAGE_DIR, `${id}.json`);
      fs.writeFileSync(tmpPath, JSON.stringify(signRecord, null, 2), 'utf-8');
      written = true;
    } catch (tmpErr) {
      console.warn('[CustomSigns API] Temp storage write warning:', tmpErr);
    }

    return NextResponse.json({
      success: true,
      message: `Sign '${signRecord.label}' converted and saved successfully.`,
      sign: signRecord,
      diskPersisted: written,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save custom sign' }, { status: 500 });
  }
}

// DELETE: Remove a custom sign
export async function DELETE(req: NextRequest) {
  try {
    ensureDirectories();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing sign ID' }, { status: 400 });
    }

    // 1. Remove from in-memory cache
    globalSignsCache.delete(id);

    // 2. Remove from primary storage
    try {
      const filePath = path.join(STORAGE_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}

    // 3. Remove from temporary storage
    try {
      const tmpPath = path.join(TMP_STORAGE_DIR, `${id}.json`);
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {}

    return NextResponse.json({ success: true, message: `Sign ${id} deleted.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete sign' }, { status: 500 });
  }
}
