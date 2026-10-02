import { NextResponse } from 'next/server';
import fs from 'fs';
import readline from 'readline';

export async function GET() {
  try {
    const csvPath = 'D:\\Matri\\letter dataset\\hand_angles_datasets.csv';
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const labelCounts: Record<string, number> = {};
    let totalRows = 0;
    let bothHandsCount = 0;
    let singleHandCount = 0;
    let isHeader = true;
    let sampleRowByLabel: Record<string, any> = {};

    for await (const line of rl) {
      if (isHeader) {
        isHeader = false;
        continue;
      }
      if (!line.trim()) continue;
      totalRows++;
      const parts = line.split(',');
      const label = parts[0];
      const bothHands = parts[1];
      labelCounts[label] = (labelCounts[label] || 0) + 1;
      if (bothHands === '1') bothHandsCount++;
      else singleHandCount++;

      if (!sampleRowByLabel[label]) {
        sampleRowByLabel[label] = {
          label,
          both_hands: Number(bothHands),
          thumb_Left: Number(parts[2]),
          index_finger_Left: Number(parts[3]),
          middle_finger_Left: Number(parts[4]),
          ring_finger_Left: Number(parts[5]),
          pinky_Left: Number(parts[6]),
          palm_angle_Left_left: Number(parts[7]),
          palm_angle_Left_right: Number(parts[8]),
          hand_Left_ground_angle: Number(parts[9]),
          thumb_Right: Number(parts[10]),
          index_finger_Right: Number(parts[11]),
          middle_finger_Right: Number(parts[12]),
          ring_finger_Right: Number(parts[13]),
          pinky_Right: Number(parts[14]),
          palm_angle_Right_left: Number(parts[15]),
          palm_angle_Right_right: Number(parts[16]),
          hand_Right_ground_angle: Number(parts[17]),
        };
      }
    }

    return NextResponse.json({
      totalRows,
      bothHandsCount,
      singleHandCount,
      uniqueLabels: Object.keys(labelCounts).sort(),
      labelCounts,
      samples: sampleRowByLabel,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
