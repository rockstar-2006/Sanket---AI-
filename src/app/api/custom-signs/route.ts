import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

function ensureDirectory() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

// GET: Retrieve all saved custom signs
export async function GET(req: NextRequest) {
  try {
    ensureDirectory();
    const { searchParams } = new URL(req.url);
    const signId = searchParams.get('id');
    const token = searchParams.get('token');

    const files = fs.readdirSync(STORAGE_DIR).filter((f) => f.endsWith('.json'));
    const signs: CustomSignRecord[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(STORAGE_DIR, file), 'utf-8');
        const data = JSON.parse(content) as CustomSignRecord;
        if (signId && data.id === signId) {
          return NextResponse.json(data);
        }
        if (token && data.token.toLowerCase() === token.toLowerCase()) {
          return NextResponse.json(data);
        }
        signs.push(data);
      } catch (err) {
        console.warn('Error reading custom sign file:', file, err);
      }
    }

    return NextResponse.json({ total: signs.length, signs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list custom signs' }, { status: 500 });
  }
}

// POST: Save a new converted 3D sign
export async function POST(req: NextRequest) {
  try {
    ensureDirectory();
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
      createdAt: new Date().toISOString(),
      frames: body.frames,
    };

    const filePath = path.join(STORAGE_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(signRecord, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Sign '${signRecord.label}' converted and saved successfully.`,
      sign: signRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save custom sign' }, { status: 500 });
  }
}

// DELETE: Remove a custom sign
export async function DELETE(req: NextRequest) {
  try {
    ensureDirectory();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing sign ID' }, { status: 400 });
    }

    const filePath = path.join(STORAGE_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ success: true, message: `Sign ${id} deleted.` });
    }

    return NextResponse.json({ error: 'Sign not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete sign' }, { status: 500 });
  }
}
