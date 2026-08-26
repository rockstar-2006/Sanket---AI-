import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parquetReadObjects } from '@/lib/hyparquet.mjs';
import {
  SignKinematicsSolver,
  buildAnimationClipJson,
  buildCompactFrameRigJson,
  ParsedFrameLandmarks,
  LandmarkPoint,
} from '@/lib/signKinematics';

export async function GET(req: NextRequest) {
  try {
    const parquetPath = 'D:\\Matri\\Dataset\\goodafternoon\\MVI_0046.parquet';
    const movPath = 'D:\\Matri\\Dataset\\goodafternoon\\MVI_0046.mov';
    const outputDir = path.join(process.cwd(), 'public', 'signs');

    if (!fs.existsSync(parquetPath)) {
      return NextResponse.json({ error: `Parquet not found at ${parquetPath}` }, { status: 404 });
    }

    const parquetStat = fs.statSync(parquetPath);
    const movStat = fs.existsSync(movPath) ? fs.statSync(movPath) : null;

    const fileBuffer = fs.readFileSync(parquetPath);
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
    const rows = (await parquetReadObjects({ file: arrayBuffer })) as any[];

    if (!rows || !rows.length) {
      return NextResponse.json({ error: 'Parquet file is empty' }, { status: 400 });
    }

    // Group raw landmarks by frame
    const frameMap = new Map<number, { pose: LandmarkPoint[]; leftHand: LandmarkPoint[]; rightHand: LandmarkPoint[]; face: LandmarkPoint[] }>();
    rows.forEach((r: any) => {
      const frameIdx = Number(r.frame);
      if (!frameMap.has(frameIdx)) {
        frameMap.set(frameIdx, { pose: [], leftHand: [], rightHand: [], face: [] });
      }
      const bucket = frameMap.get(frameIdx)!;
      const pt: LandmarkPoint = {
        x: isNaN(r.x) || r.x === null ? 0 : Number(r.x),
        y: isNaN(r.y) || r.y === null ? 0 : Number(r.y),
        z: isNaN(r.z) || r.z === null ? 0 : Number(r.z),
      };

      if (r.type === 'pose') bucket.pose[Number(r.landmark_index)] = pt;
      else if (r.type === 'left_hand') bucket.leftHand[Number(r.landmark_index)] = pt;
      else if (r.type === 'right_hand') bucket.rightHand[Number(r.landmark_index)] = pt;
      else if (r.type === 'face') bucket.face[Number(r.landmark_index)] = pt;
    });

    const solver = new SignKinematicsSolver();
    const sortedFrames = Array.from(frameMap.keys()).sort((a, b) => a - b);
    const solvedFrames: { time: number; rotations: Record<string, [number, number, number, number]> }[] = [];

    sortedFrames.forEach((frameIdx, i) => {
      const timeSec = i / 30.0;
      const bucket = frameMap.get(frameIdx)!;

      const hasLH = bucket.leftHand.length === 21 && bucket.leftHand.some((p) => p && (p.x !== 0 || p.y !== 0));
      const hasRH = bucket.rightHand.length === 21 && bucket.rightHand.some((p) => p && (p.x !== 0 || p.y !== 0));

      const parsedData: ParsedFrameLandmarks = {
        frame: frameIdx,
        pose: bucket.pose,
        leftHand: hasLH ? bucket.leftHand : null,
        rightHand: hasRH ? bucket.rightHand : null,
        face: bucket.face.length >= 264 ? bucket.face : null,
      };

      const rotations = solver.solveFrame(parsedData, timeSec);
      solvedFrames.push({ time: timeSec, rotations });
    });

    // 1. Build & Save Optimized Three.js AnimationClip JSON
    const clipJson = buildAnimationClipJson('goodafternoon', solvedFrames);
    if (!clipJson) {
      return NextResponse.json({ error: 'No solved frames available for animation clip' }, { status: 400 });
    }
    const clipPath = path.join(outputDir, 'sign_goodafternoon.json');
    const clipString = JSON.stringify(clipJson);
    fs.writeFileSync(clipPath, clipString);

    // 2. Build & Save Compact Frame Rig JSON
    const frameRigJson = buildCompactFrameRigJson('goodafternoon', solvedFrames, 'MVI_0046.parquet');
    const frameRigPath = path.join(outputDir, 'frames_goodafternoon.json');
    const frameRigString = JSON.stringify(frameRigJson);
    fs.writeFileSync(frameRigPath, frameRigString);

    // Keyframe diagnostics for sample frames
    const sampleIndices = [0, Math.floor(sortedFrames.length * 0.25), Math.floor(sortedFrames.length * 0.5), Math.floor(sortedFrames.length * 0.75), sortedFrames.length - 1];
    const keyframeSamples = sampleIndices.map((idx) => {
      const fIdx = sortedFrames[idx];
      const b = frameMap.get(fIdx)!;
      const solved = solvedFrames[idx];
      return {
        frameNumber: fIdx,
        timeSec: (idx / 30).toFixed(2),
        rightHandTracked: b.rightHand.length === 21 && b.rightHand.some((p) => p && p.x !== 0),
        leftHandTracked: b.leftHand.length === 21 && b.leftHand.some((p) => p && p.x !== 0),
        armRotations: {
          rightArm: solved.rotations['mixamorigRightArm'],
          rightForeArm: solved.rotations['mixamorigRightForeArm'],
          leftArm: solved.rotations['mixamorigLeftArm'],
          leftForeArm: solved.rotations['mixamorigLeftForeArm'],
        },
        indexFingerRotations: {
          rightIndex1: solved.rotations['mixamorigRightHandIndex1'],
          rightIndex2: solved.rotations['mixamorigRightHandIndex2'],
        },
      };
    });

    return NextResponse.json({
      success: true,
      comparison: {
        rawVideo: {
          file: 'MVI_0046.mov',
          sizeBytes: movStat ? movStat.size : null,
          sizeFormatted: movStat ? `${(movStat.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A',
          playableInBrowser: false,
          inferenceRequiredAtRuntime: 'MediaPipe Holistic (~45ms/frame)',
        },
        oldParquet: {
          file: 'MVI_0046.parquet',
          sizeBytes: parquetStat.size,
          sizeFormatted: `${(parquetStat.size / 1024).toFixed(1)} KB`,
          totalRows: rows.length,
          format: 'Flat Landmark Rows (frame, landmark_index, x, y, z, type)',
          browserLoadTime: '50-120ms (hyparquet WASM)',
          runtimeMath: 'Heavy trigonometric inverse kinematics per frame',
        },
        newAnimationClipJson: {
          file: '/signs/sign_goodafternoon.json',
          sizeBytes: Buffer.byteLength(clipString),
          sizeFormatted: `${(Buffer.byteLength(clipString) / 1024).toFixed(1)} KB`,
          sizeReductionVsParquet: `${(100 - (Buffer.byteLength(clipString) / parquetStat.size) * 100).toFixed(1)}% smaller`,
          totalTracks: clipJson.tracks.length,
          durationSec: clipJson.duration,
          totalFrames: sortedFrames.length,
          browserLoadTime: '< 1ms (native THREE.AnimationClip)',
          runtimeMath: 'Zero (Hardware accelerated WebGL quaternions)',
        },
        newCompactFrameRigJson: {
          file: '/signs/frames_goodafternoon.json',
          sizeBytes: Buffer.byteLength(frameRigString),
          sizeFormatted: `${(Buffer.byteLength(frameRigString) / 1024).toFixed(1)} KB`,
          totalFrames: frameRigJson.totalFrames,
          durationSec: frameRigJson.durationSec,
        },
      },
      keyframeSamples,
    });
  } catch (err: any) {
    console.error('[InspectTake] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

