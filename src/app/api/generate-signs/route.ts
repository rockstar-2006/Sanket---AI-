import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parquetReadObjects } from '@/lib/hyparquet.mjs';
import {
  SignKinematicsSolver,
  buildCompactFrameRigJson,
  ParsedFrameLandmarks,
  LandmarkPoint,
} from '@/lib/signKinematics';

export async function GET(req: NextRequest) {
  try {
    const datasetDir = 'D:\\Matri\\Dataset';
    const outputDir = path.join(process.cwd(), 'public', 'signs');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (!fs.existsSync(datasetDir)) {
      return NextResponse.json({ error: `Dataset directory not found at ${datasetDir}` }, { status: 404 });
    }

    const categories = fs.readdirSync(datasetDir).filter((f) => {
      return fs.statSync(path.join(datasetDir, f)).isDirectory();
    });

    const generatedClips: { word: string; duration: number; frames: number; file: string; take: string }[] = [];
    const solver = new SignKinematicsSolver();

    for (const word of categories) {
      const wordFolder = path.join(datasetDir, word);
      const parquetFiles = fs.readdirSync(wordFolder).filter((f) => f.endsWith('.parquet'));

      if (!parquetFiles.length) continue;

      // Pick clean representative take
      const preferredTake = parquetFiles.find((f) => f.includes('0046') || f.includes('9985') || f.includes('0029') || f.includes('0006')) || parquetFiles[0];
      const parquetPath = path.join(wordFolder, preferredTake);

      const fileBuffer = fs.readFileSync(parquetPath);
      const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

      const rows = (await parquetReadObjects({ file: arrayBuffer })) as any[];
      if (!rows || !rows.length) continue;

      // Group landmarks by frame
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

      // Solve kinematics per frame directly from dataset video
      solver.reset();
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

      const cleanWord = word.toLowerCase().trim();

      // Write pure motion capture frame rig JSON
      const frameRigJson = buildCompactFrameRigJson(cleanWord, solvedFrames, preferredTake);
      const frameRigFileName = `frames_${cleanWord}.json`;
      const frameRigFilePath = path.join(outputDir, frameRigFileName);
      fs.writeFileSync(frameRigFilePath, JSON.stringify(frameRigJson));

      generatedClips.push({
        word: cleanWord,
        duration: frameRigJson.durationSec,
        frames: solvedFrames.length,
        file: `/signs/${frameRigFileName}`,
        take: preferredTake,
      });
    }

    // Write manifest index
    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ signs: generatedClips, updatedAt: new Date().toISOString() }, null, 2)
    );

    return NextResponse.json({
      success: true,
      message: `Successfully extracted ${generatedClips.length} pure video motion capture sign animations from dataset!`,
      clips: generatedClips,
    });
  } catch (error: any) {
    console.error('[SignGenerator] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}



