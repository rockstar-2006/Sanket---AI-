import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get('file') || 'goodafternoon/MVI_0046.mov';
    
    // Clean and validate path to prevent directory traversal
    const safeRelPath = fileParam.replace(/^(\.\.[\/\\])+/, '');
    const videoPath = path.join('D:\\Matri\\Dataset', safeRelPath);

    if (!fs.existsSync(videoPath)) {
      return NextResponse.json({ error: `Video file not found at ${videoPath}` }, { status: 404 });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const fileStream = fs.createReadStream(videoPath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(stream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'video/quicktime',
        },
      });
    } else {
      const fileStream = fs.createReadStream(videoPath);
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/quicktime',
        },
      });
    }
  } catch (error: any) {
    console.error('[DatasetVideo] Error streaming video:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
