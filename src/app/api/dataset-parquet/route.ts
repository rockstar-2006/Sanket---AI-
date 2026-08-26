import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parquetReadObjects } from '@/lib/hyparquet.mjs';

export interface FrameLandmarksPayload {
  frameIndex: number;
  timeSec: number;
  poseLandmarks: { x: number; y: number; z: number }[] | null;
  rightHandLandmarks: { x: number; y: number; z: number }[] | null;
  leftHandLandmarks: { x: number; y: number; z: number }[] | null;
  faceLandmarks: { x: number; y: number; z: number }[] | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let fileParam = searchParams.get('file') || 'goodafternoon/MVI_0046.parquet';

    // Replace .mov with .parquet if user passed .mov path
    if (fileParam.endsWith('.mov')) {
      fileParam = fileParam.replace(/\.mov$/, '.parquet');
    }

    const safeRelPath = fileParam.replace(/^(\.\.[\/\\])+/, '');
    const parquetPath = path.join('D:\\Matri\\Dataset', safeRelPath);

    if (!fs.existsSync(parquetPath)) {
      return NextResponse.json({ error: `Parquet file not found at ${parquetPath}` }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(parquetPath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );
    const rows = (await parquetReadObjects({ file: arrayBuffer })) as any[];

    if (!rows || !rows.length) {
      return NextResponse.json({ error: 'Parquet file is empty' }, { status: 400 });
    }

    // Group landmarks by frame
    const frameMap = new Map<
      number,
      {
        pose: { x: number; y: number; z: number }[];
        leftHand: { x: number; y: number; z: number }[];
        rightHand: { x: number; y: number; z: number }[];
        face: { x: number; y: number; z: number }[];
      }
    >();

    rows.forEach((r: any) => {
      const frameIdx = Number(r.frame);
      if (!frameMap.has(frameIdx)) {
        frameMap.set(frameIdx, { pose: [], leftHand: [], rightHand: [], face: [] });
      }
      const bucket = frameMap.get(frameIdx)!;
      const pt = {
        x: isNaN(r.x) || r.x === null ? 0 : Number(r.x),
        y: isNaN(r.y) || r.y === null ? 0 : Number(r.y),
        z: isNaN(r.z) || r.z === null ? 0 : Number(r.z),
      };

      const landmarkIdx = Number(r.landmark_index);
      if (r.type === 'pose') bucket.pose[landmarkIdx] = pt;
      else if (r.type === 'left_hand') bucket.leftHand[landmarkIdx] = pt;
      else if (r.type === 'right_hand') bucket.rightHand[landmarkIdx] = pt;
      else if (r.type === 'face') bucket.face[landmarkIdx] = pt;
    });

    const sortedFrameIndices = Array.from(frameMap.keys()).sort((a, b) => a - b);
    const frames: FrameLandmarksPayload[] = sortedFrameIndices.map((fIdx, i) => {
      const bucket = frameMap.get(fIdx)!;
      const hasRH = bucket.rightHand.length === 21 && bucket.rightHand.some((p) => p && (p.x !== 0 || p.y !== 0));
      const hasLH = bucket.leftHand.length === 21 && bucket.leftHand.some((p) => p && (p.x !== 0 || p.y !== 0));
      const hasPose = bucket.pose.length >= 33 && bucket.pose.some((p) => p && (p.x !== 0 || p.y !== 0));
      const hasFace = bucket.face.length >= 200 && bucket.face.some((p) => p && (p.x !== 0 || p.y !== 0));

      return {
        frameIndex: fIdx,
        timeSec: Math.round((i / 30.0) * 1000) / 1000,
        poseLandmarks: hasPose ? bucket.pose : null,
        rightHandLandmarks: hasRH ? bucket.rightHand : null,
        leftHandLandmarks: hasLH ? bucket.leftHand : null,
        faceLandmarks: hasFace ? bucket.face : null,
      };
    });

    return NextResponse.json({
      file: safeRelPath,
      totalFrames: frames.length,
      durationSec: Math.round(((frames.length - 1) / 30.0) * 100) / 100,
      frames,
    });
  } catch (err: any) {
    console.error('Error reading parquet:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
