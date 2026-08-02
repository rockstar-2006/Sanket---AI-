import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const brainDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\f324475a-fd47-4bde-8216-d1a34be0477c';
    const publicDir = path.join(process.cwd(), 'public');

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const mappings: Record<string, string> = {
      'sanket_hero_meeting_1785653877810.jpg': 'sanket_hero_meeting.jpg',
      'sanket_dashboard_1785654948717.jpg': 'sanket_dashboard.jpg',
      'sanket_solutions_1785654960839.jpg': 'sanket_solutions.jpg',
      'img_sign_candidate_1785655295052.jpg': 'img_sign_candidate.jpg',
      'img_hr_interviewer_1785655307428.jpg': 'img_hr_interviewer.jpg',
      'img_doctor_telehealth_1785655321718.jpg': 'img_doctor_telehealth.jpg',
      'img_student_viva_1785655333601.jpg': 'img_student_viva.jpg',
      'img_govt_verification_1785655347362.jpg': 'img_govt_verification.jpg',
      'img_device_privacy_1785655358032.jpg': 'img_device_privacy.jpg',
      'img_subtitles_bubble_1785655375252.jpg': 'img_subtitles_bubble.jpg',
      'img_instant_invite_1785655388430.jpg': 'img_instant_invite.jpg',
    };

    const copiedFiles: string[] = [];

    Object.entries(mappings).forEach(([srcName, destName]) => {
      const srcPath = path.join(brainDir, srcName);
      const destPath = path.join(publicDir, destName);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        copiedFiles.push(destName);
      }
    });

    return NextResponse.json({ success: true, copiedFiles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
