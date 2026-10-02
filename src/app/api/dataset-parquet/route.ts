import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parquetReadObjects } from '@/lib/hyparquet.mjs';
import { generateFingerspellFrames } from '@/lib/fingerspellingEngine';

export interface FrameLandmarksPayload {
  frameIndex: number;
  timeSec: number;
  poseLandmarks: { x: number; y: number; z: number }[] | null;
  rightHandLandmarks: { x: number; y: number; z: number }[] | null;
  leftHandLandmarks: { x: number; y: number; z: number }[] | null;
  faceLandmarks: { x: number; y: number; z: number }[] | null;
}

function formatCategoryName(name: string): string {
  if (name.toLowerCase() === 'days_and_time') return 'Days & Time';
  if (name.toLowerCase() === 'means_of_transportation') return 'Means of Transportation';
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || searchParams.get('list');

    // If listing words and files
    if (action === 'list' || action === 'true') {
      const datasetDir = 'D:\\Matri\\Dataset';
      if (!fs.existsSync(datasetDir)) {
        return NextResponse.json({ error: `Dataset directory not found at ${datasetDir}` }, { status: 404 });
      }

      const entries = fs.readdirSync(datasetDir, { withFileTypes: true });
      const topDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      interface ScannedWord {
        category: string;
        word: string;
        fullPath: string;
        count: number;
        files: string[];
      }

      const words: ScannedWord[] = [];
      const categoriesSet = new Set<string>();

      for (const topName of topDirs) {
        const topPath = path.join(datasetDir, topName);
        let topEntries: fs.Dirent[] = [];
        try {
          topEntries = fs.readdirSync(topPath, { withFileTypes: true });
        } catch {
          continue;
        }

        // 1. Direct parquet files inside top folder (e.g. hello, goodmorning, etc.)
        const directParquets = topEntries
          .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.parquet'))
          .map((e) => e.name)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (directParquets.length > 0) {
          const category = 'Greetings & Basics';
          categoriesSet.add(category);
          words.push({
            category,
            word: topName,
            fullPath: topName,
            count: directParquets.length,
            files: directParquets.map((f) => `${topName}/${f}`),
          });
        }

        // 2. Subdirectories inside top folder (e.g. adjectives/happy, animals/cat, etc.)
        const subDirs = topEntries.filter((e) => e.isDirectory()).map((e) => e.name);
        for (const subName of subDirs) {
          const subDirPath = path.join(topPath, subName);
          let subParquets: string[] = [];
          try {
            subParquets = fs.readdirSync(subDirPath)
              .filter((f) => f.toLowerCase().endsWith('.parquet'))
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
          } catch {
            continue;
          }

          if (subParquets.length > 0) {
            const category = formatCategoryName(topName);
            categoriesSet.add(category);
            words.push({
              category,
              word: subName,
              fullPath: `${topName}/${subName}`,
              count: subParquets.length,
              files: subParquets.map((f) => `${topName}/${subName}/${f}`),
            });
          }
        }
      }

      // Sort words alphabetically by word name
      words.sort((a, b) => a.word.localeCompare(b.word));

      const categories = Array.from(categoriesSet).sort((a, b) => {
        if (a === 'Greetings & Basics') return -1;
        if (b === 'Greetings & Basics') return 1;
        return a.localeCompare(b);
      });

      return NextResponse.json({
        totalWords: words.length,
        totalCategories: categories.length,
        totalFiles: words.reduce((acc, w) => acc + w.count, 0),
        categories,
        words,
      });
    }

    let fileParam = searchParams.get('file');
    const wordParam = searchParams.get('word');

    // If word parameter passed, auto-resolve to its first parquet take
    if (wordParam && !fileParam) {
      const target = wordParam.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const datasetDir = 'D:\\Matri\\Dataset';
      
      // Check root folders first
      const directDir = path.join(datasetDir, target);
      if (fs.existsSync(directDir) && fs.statSync(directDir).isDirectory()) {
        const files = fs.readdirSync(directDir).filter(f => f.toLowerCase().endsWith('.parquet'));
        if (files.length > 0) {
          fileParam = `${target}/${files[0]}`;
        }
      }

      // Check categories
      if (!fileParam && fs.existsSync(datasetDir)) {
        const topDirs = fs.readdirSync(datasetDir, { withFileTypes: true }).filter(e => e.isDirectory());
        for (const td of topDirs) {
          const subDir = path.join(datasetDir, td.name, target);
          if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
            const files = fs.readdirSync(subDir).filter(f => f.toLowerCase().endsWith('.parquet'));
            if (files.length > 0) {
              fileParam = `${td.name}/${target}/${files[0]}`;
              break;
            }
          }
        }
      }

      // If word is not found in dataset folders, generate procedural fingerspelling frames
      if (!fileParam) {
        const targetChar = wordParam.trim().charAt(0);
        const letterFrames = generateFingerspellFrames(targetChar, 26);
        return NextResponse.json({
          file: `fingerspell_${targetChar.toUpperCase()}`,
          totalFrames: letterFrames.length,
          durationSec: Math.round(((letterFrames.length - 1) / 30.0) * 100) / 100,
          frames: letterFrames.map((f, i) => ({
            frameIndex: i,
            timeSec: Math.round((i / 30.0) * 1000) / 1000,
            poseLandmarks: f.poseLandmarks,
            rightHandLandmarks: f.rightHandLandmarks,
            leftHandLandmarks: f.leftHandLandmarks,
            faceLandmarks: f.faceLandmarks,
          })),
        });
      }
    }

    if (!fileParam) {
      fileParam = 'goodafternoon/MVI_0046.parquet';
    }

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
