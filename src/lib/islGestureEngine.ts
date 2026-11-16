/**
 * Authentic Indian Sign Language (ISL) Gesture Synthesis Engine
 * Generates continuous 3D holistic skeletal landmark frames (33 Pose + 21 LH + 21 RH + 468 Face)
 * matching official ISL ground-truth gestures.
 *
 * Produces anatomically natural, fleshy, expressive hand postures that match
 * Apple 3D Memoji / WhatsApp emoji aesthetics instead of wireframe sticks.
 */

import { FrameLandmarks, Landmark3D, lerp, generateSmoothBridge } from './motionSmoothing';
import { generateFingerspellFrames } from './fingerspellingEngine';

// Default upper body pose skeleton (MediaPipe Holistic 33 format)
function createBasePose(): Landmark3D[] {
  const p: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  p[0]  = { x: 0.50, y: 0.20, z: -0.04 }; // Nose
  p[2]  = { x: 0.53, y: 0.18, z: -0.04 }; // Left eye
  p[5]  = { x: 0.47, y: 0.18, z: -0.04 }; // Right eye
  p[7]  = { x: 0.56, y: 0.20, z:  0.00 }; // Left ear
  p[8]  = { x: 0.44, y: 0.20, z:  0.00 }; // Right ear
  p[11] = { x: 0.62, y: 0.32, z:  0.00 }; // Left shoulder
  p[12] = { x: 0.38, y: 0.32, z:  0.00 }; // Right shoulder
  p[13] = { x: 0.66, y: 0.48, z:  0.02 }; // Left elbow (rest)
  p[14] = { x: 0.34, y: 0.48, z:  0.02 }; // Right elbow (rest)
  p[15] = { x: 0.59, y: 0.60, z: -0.02 }; // Left wrist (rest)
  p[16] = { x: 0.41, y: 0.60, z: -0.02 }; // Right wrist (rest)
  p[23] = { x: 0.56, y: 0.68, z:  0.00 }; // Left hip
  p[24] = { x: 0.44, y: 0.68, z:  0.00 }; // Right hip
  return p;
}

// Generate animated facial landmark loop (smiling / nodding mouth mesh)
function createFaceMesh(nose: Landmark3D, mouthOpen = 0.0, smile = 0.5): Landmark3D[] {
  const face: Landmark3D[] = Array.from({ length: 468 }, () => ({ ...nose }));
  const MOUTH_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];
  const mouthCenterY = nose.y + 0.055;

  MOUTH_INDICES.forEach((idx, i) => {
    const angle = (i / MOUTH_INDICES.length) * Math.PI * 2;
    const width = 0.024 + smile * 0.006;
    const height = 0.010 + mouthOpen * 0.012;
    face[idx] = {
      x: nose.x + Math.cos(angle) * width,
      y: mouthCenterY + Math.sin(angle) * height,
      z: nose.z - 0.01,
    };
  });
  return face;
}

/**
 * Natural 21-Joint 3D Hand Pose Generator
 * Generates physiologically graceful, curved fingers with anatomical palm proportions.
 */
export function buildNaturalHandPose(
  wristPos: [number, number, number],
  fingerCurls: [number, number, number, number, number], // [thumb, index, middle, ring, pinky] 0 = curled into fist, 1 = extended
  handRotation: [number, number, number] = [0, 0, 0],
  isLeftHand = false
): Landmark3D[] {
  const points: Landmark3D[] = [];
  const [wx, wy, wz] = wristPos;

  // Joint 0: Wrist
  points.push({ x: wx, y: wy, z: wz });

  // Natural human hand finger base spread angles & segment lengths
  const fingerConfigs = [
    { baseAngle: 0.68, length: 0.11, curl: fingerCurls[0] }, // Thumb
    { baseAngle: 0.25, length: 0.15, curl: fingerCurls[1] }, // Index
    { baseAngle: 0.04, length: 0.16, curl: fingerCurls[2] }, // Middle
    { baseAngle: -0.18, length: 0.14, curl: fingerCurls[3] }, // Ring
    { baseAngle: -0.38, length: 0.11, curl: fingerCurls[4] }, // Pinky
  ];

  const mirrorX = isLeftHand ? -1 : 1;

  fingerConfigs.forEach((cfg) => {
    const angle = cfg.baseAngle * mirrorX + handRotation[2];
    const curl = Math.max(0, Math.min(1, cfg.curl)); // 1 = straight, 0 = tucked into palm

    // 4 segments per finger: MCP [1], PIP [2], DIP [3], TIP [4]
    for (let seg = 1; seg <= 4; seg++) {
      const segRatio = seg / 4;
      const straightExt = cfg.length * segRatio;
      const bendFactor = (1 - curl) * segRatio * 0.08;

      const px = wx + Math.sin(angle) * straightExt;
      const py = wy - Math.cos(angle) * straightExt * (0.35 + 0.65 * curl); // -Y is UP in MediaPipe
      const pz = wz + bendFactor + (handRotation[1] * segRatio * 0.06);

      points.push({ x: px, y: py, z: pz });
    }
  });

  return points;
}

// Resting natural hand posture (relaxed fingers)
function createRestHand(wrist: Landmark3D, isLeft: boolean): Landmark3D[] {
  return buildNaturalHandPose(
    [wrist.x, wrist.y, wrist.z],
    [0.3, 0.2, 0.2, 0.2, 0.2], // Relaxed soft curl
    [0, 0, 0],
    isLeft
  );
}

/**
 * Generate 3D ISL Sign Landmark Sequence for a verified vocabulary word
 */
export function generateISLGestureFrames(
  word: string,
  totalFrames = 72
): FrameLandmarks[] {
  const clean = word.toLowerCase().trim().replace(/[^a-z]/g, '');

  switch (clean) {
    case 'hello':
    case 'hi':
    case 'hey':
    case 'greetings':
      return generateHelloFrames(totalFrames);

    case 'thankyou':
    case 'thanks':
      return generateThankYouFrames(totalFrames);

    case 'goodmorning':
      return generateGoodMorningFrames(totalFrames);

    case 'goodafternoon':
      return generateGoodAfternoonFrames(totalFrames);

    case 'goodevening':
      return generateGoodEveningFrames(totalFrames);

    case 'goodnight':
      return generateGoodNightFrames(totalFrames);

    case 'howareyou':
      return generateHowAreYouFrames(totalFrames);

    case 'alright':
    case 'ok':
    case 'okay':
      return generateAlrightFrames(totalFrames);

    case 'pleased':
    case 'namaste':
      return generatePleasedFrames(totalFrames);

    case 'doctor':
      return generateDoctorFrames(totalFrames);

    case 'hospital':
      return generateHospitalFrames(totalFrames);

    case 'yes':
      return generateYesFrames(totalFrames);

    case 'no':
      return generateNoFrames(totalFrames);

    case 'car':
    case 'drive':
      return generateCarFrames(totalFrames);

    case 'house':
      return generateHouseFrames(totalFrames);

    case 'help':
      return generateHelpFrames(totalFrames);

    case 'book':
      return generateBookFrames(totalFrames);

    case 'water':
      return generateWaterFrames(totalFrames);

    case 'food':
    case 'eat':
      return generateFoodFrames(totalFrames);

    case 'medicine':
      return generateMedicineFrames(totalFrames);

    case 'pain':
      return generatePainFrames(totalFrames);

    case 'fever':
      return generateFeverFrames(totalFrames);

    case 'emergency':
      return generateEmergencyFrames(totalFrames);

    case 'time':
      return generateTimeFrames(totalFrames);

    case 'family':
      return generateFamilyFrames(totalFrames);

    default: {
      if (clean.length <= 1) {
        return generateFingerspellFrames(clean.charAt(0) || 'A', totalFrames);
      }
      const letters = clean.toUpperCase().split('');
      const perLetterFrames = Math.max(18, Math.floor(totalFrames / letters.length));
      const allFrames: FrameLandmarks[] = [];
      let lastFrame: FrameLandmarks | null = null;
      for (const char of letters) {
        const letterFrames = generateFingerspellFrames(char, perLetterFrames);
        if (lastFrame) {
          const bridge = generateSmoothBridge(lastFrame, letterFrames[0], 4);
          allFrames.push(...bridge);
        }
        allFrames.push(...letterFrames);
        lastFrame = letterFrames[letterFrames.length - 1];
      }
      return allFrames;
    }
  }
}

// ─── 1. HELLO / HI ──────────────────────────────────────────────────────────
function generateHelloFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    // Smooth, friendly wave at temple
    const wave = Math.sin(t * Math.PI * 4) * 0.04 * (t > 0.15 && t < 0.85 ? 1 : 0);

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.38 + wave, env), lerp(0.60, 0.28, env), -0.06],
      [1.0, 1.0, 1.0, 1.0, 1.0], // Open flat hand
      [0.0, 0.0, wave * 0.6],
      false
    );

    const leftHand = createRestHand(pose[15], true);
    pose[16] = rightHand[0];
    pose[0].x = 0.50 + 0.01 * env;
    const face = createFaceMesh(pose[0], 0.15 * env, 0.9 * env);

    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 2. THANK YOU ───────────────────────────────────────────────────────────
function generateThankYouFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const touchT = t < 0.4 ? Math.sin((t / 0.4) * (Math.PI / 2)) : t < 0.85 ? 1.0 : Math.cos(((t - 0.85) / 0.15) * (Math.PI / 2));
    const forwardT = t < 0.4 ? 0 : t < 0.85 ? Math.sin(((t - 0.4) / 0.45) * (Math.PI / 2)) : touchT;

    const wx = lerp(0.41, lerp(0.48, 0.46, forwardT), touchT);
    const wy = lerp(0.60, lerp(0.32, 0.38, forwardT), touchT);
    const wz = lerp(-0.02, lerp(-0.04, -0.14, forwardT), touchT);

    const rightHand = buildNaturalHandPose(
      [wx, wy, wz],
      [0.9, 1.0, 1.0, 1.0, 1.0], // Flat hand touching chin, then opening forward
      [forwardT * 0.4, 0, -forwardT * 0.2],
      false
    );

    const leftHand = createRestHand(pose[15], true);
    pose[16] = rightHand[0];
    pose[0].y = 0.20 + 0.015 * forwardT;
    const face = createFaceMesh(pose[0], 0.15 * forwardT, 0.90 * forwardT);

    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 3. GOOD MORNING ────────────────────────────────────────────────────────
function generateGoodMorningFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const sunRise = Math.sin(t * Math.PI) * 0.16;

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.44, env), lerp(0.60, 0.45 - sunRise, env), -0.06],
      [1.0, 1.0, 1.0, 1.0, 1.0], // Open spread sun
      [0, 0, 0.2],
      false
    );

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.54, env), lerp(0.60, 0.48, env), -0.04],
      [0.8, 1.0, 1.0, 1.0, 1.0], // Horizontal base
      [0, 0, 1.5],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.1, 0.8 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 4. GOOD AFTERNOON ──────────────────────────────────────────────────────
function generateGoodAfternoonFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.48, env), lerp(0.60, 0.24, env), -0.06],
      [0.9, 1.0, 1.0, 1.0, 1.0],
      [0, 0, 0],
      false
    );
    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.52, env), lerp(0.60, 0.44, env), -0.04],
      [0.8, 1.0, 1.0, 1.0, 1.0],
      [0, 0, 1.5],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.7 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 5. GOOD EVENING ────────────────────────────────────────────────────────
function generateGoodEveningFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const sunSet = Math.sin(t * Math.PI) * 0.12;

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.46, env), lerp(0.60, 0.36 + sunSet, env), -0.06],
      [0.8, 1.0, 1.0, 1.0, 1.0],
      [0, 0, -1.2],
      false
    );
    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.54, env), lerp(0.60, 0.46, env), -0.04],
      [0.8, 1.0, 1.0, 1.0, 1.0],
      [0, 0, 1.5],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.6 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 6. GOOD NIGHT ──────────────────────────────────────────────────────────
function generateGoodNightFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.42, env), lerp(0.60, 0.30, env), -0.06],
      [0.8, 1.0, 1.0, 1.0, 1.0],
      [0, 0, -0.6],
      false
    );
    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.44, env), lerp(0.60, 0.32, env), -0.05],
      [0.8, 1.0, 1.0, 1.0, 1.0],
      [0, 0, 0.6],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    pose[0].x = 0.50 - 0.02 * env;
    const face = createFaceMesh(pose[0], 0.0, 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 7. HOW ARE YOU ─────────────────────────────────────────────────────────
function generateHowAreYouFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.38, env), lerp(0.60, 0.42, env), -0.10],
      [0.9, 1.0, 1.0, 1.0, 1.0],
      [0.3, 0, -0.2],
      false
    );
    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.62, env), lerp(0.60, 0.42, env), -0.10],
      [0.9, 1.0, 1.0, 1.0, 1.0],
      [0.3, 0, 0.2],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.1 * env, 0.7 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 8. ALRIGHT / OK ────────────────────────────────────────────────────────
function generateAlrightFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const nod = Math.sin(t * Math.PI * 4) * 0.015 * env;

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.40, env), lerp(0.60, 0.34, env), -0.06],
      [0.3, 0.3, 1.0, 1.0, 1.0], // OK circle loop
      [0, 0, 0],
      false
    );
    const leftHand = createRestHand(pose[15], true);
    pose[16] = rightHand[0];
    pose[0].y = 0.20 + nod;
    const face = createFaceMesh(pose[0], 0.1 * env, 0.95 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 9. NAMASTE / PLEASED ───────────────────────────────────────────────────
function generatePleasedFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Both hands meeting vertically at chest in pranam
    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.485, env), lerp(0.60, 0.40, env), -0.05],
      [0.9, 1.0, 1.0, 1.0, 0.9],
      [0, -0.2, -0.1],
      false
    );
    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.515, env), lerp(0.60, 0.40, env), -0.05],
      [0.9, 1.0, 1.0, 1.0, 0.9],
      [0, 0.2, 0.1],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    pose[0].y = 0.20 + 0.015 * env;
    const face = createFaceMesh(pose[0], 0.05, 0.9 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 10. DOCTOR: Left Wrist Held Steady, Right Fingers Tap Radial Pulse ─────
function generateDoctorFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    // Distinct, rhythmic 2-pulse tap on inner wrist
    const tap = Math.pow(Math.sin(t * Math.PI * 4), 4) * 0.035 * (t > 0.2 && t < 0.8 ? 1 : 0);

    // Left arm resting stably in front of chest, palm facing up
    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.54, env), lerp(0.60, 0.42, env), -0.05],
      [0.8, 0.9, 0.9, 0.9, 0.8], // Open palm resting upward
      [0.4, 0.2, 1.3],
      true
    );

    // Right fingers coming down directly on top of left inner wrist
    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.52, env), lerp(0.60, 0.36 + tap, env), -0.06],
      [0.1, 1.0, 1.0, 0.1, 0.1], // Index & Middle extended together to feel pulse
      [0.2, 0.1, -0.8],
      false
    );

    pose[15] = leftHand[0];
    pose[16] = rightHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.6 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 11. HOSPITAL: Left Arm Folded, Right Fingers Draw Red Cross (+) ────────
function generateHospitalFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Left arm folded horizontally across chest
    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.48, env), lerp(0.60, 0.42, env), -0.04],
      [0.8, 0.9, 0.9, 0.9, 0.8],
      [0, 0, 1.4],
      true
    );

    // Right hand draws a distinct Red Cross (+) on left upper arm:
    // Phase 1 (0.20 - 0.50): Vertical stroke down
    // Phase 2 (0.55 - 0.85): Horizontal stroke across
    let crossX = 0.56;
    let crossY = 0.30;
    if (t < 0.52) {
      const vProg = Math.max(0, Math.min(1, (t - 0.20) / 0.30));
      crossY = lerp(0.24, 0.36, vProg);
    } else {
      const hProg = Math.max(0, Math.min(1, (t - 0.55) / 0.30));
      crossX = lerp(0.50, 0.62, hProg);
      crossY = 0.30;
    }

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, crossX, env), lerp(0.60, crossY, env), -0.07],
      [0.1, 1.0, 1.0, 0.1, 0.1], // Index & middle extended
      [0.2, 0, -0.4],
      false
    );

    pose[15] = leftHand[0];
    pose[16] = rightHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 12. YES ────────────────────────────────────────────────────────────────
function generateYesFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const nod = Math.sin(t * Math.PI * 4) * 0.03 * env;

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.42, env), lerp(0.60, 0.38 + nod, env), -0.07],
      [0.1, 0.1, 0.1, 0.1, 0.1], // Closed fist nodding
      [nod * 5, 0, 0],
      false
    );

    const leftHand = createRestHand(pose[15], true);
    pose[16] = rightHand[0];
    pose[0].y = 0.20 + nod * 0.8;
    const face = createFaceMesh(pose[0], 0.1 * env, 0.8 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 13. NO ─────────────────────────────────────────────────────────────────
function generateNoFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const snap = Math.sin(t * Math.PI * 4);
    const curl = snap > 0 ? 0.9 : 0.1;

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.42, env), lerp(0.60, 0.38, env), -0.07],
      [0.7, 1.0 - curl * 0.7, 1.0 - curl * 0.7, 0.1, 0.1],
      [0, 0, 0],
      false
    );

    const leftHand = createRestHand(pose[15], true);
    pose[16] = rightHand[0];
    pose[0].x = 0.50 + Math.sin(t * Math.PI * 4) * 0.008 * env;
    const face = createFaceMesh(pose[0], 0.0, 0.3);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 14. CAR / DRIVE ────────────────────────────────────────────────────────
function generateCarFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const steer = Math.sin(t * Math.PI * 4) * 0.045 * env;

    // Both hands in fists holding steering wheel at 10 and 2 o'clock
    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.42, env) - steer * 0.4, lerp(0.60, 0.40 + steer, env), -0.08],
      [0.1, 0.1, 0.1, 0.1, 0.1], // Closed fist grip
      [0, 0, steer * 0.8],
      false
    );

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.58, env) - steer * 0.4, lerp(0.60, 0.40 - steer, env), -0.08],
      [0.1, 0.1, 0.1, 0.1, 0.1], // Closed fist grip
      [0, 0, steer * 0.8],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 15. HOUSE ──────────────────────────────────────────────────────────────
function generateHouseFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Both hands meeting symmetrically at 45° to form a triangular roof (/\)
    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.46, env), lerp(0.60, 0.38, env), -0.06],
      [0.9, 1.0, 1.0, 1.0, 0.9],
      [0, 0, -0.65], // Angled inward
      false
    );

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.54, env), lerp(0.60, 0.38, env), -0.06],
      [0.9, 1.0, 1.0, 1.0, 0.9],
      [0, 0, 0.65], // Angled inward meeting at apex
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 16. HELP ───────────────────────────────────────────────────────────────
function generateHelpFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const lift = Math.sin(t * Math.PI * 2) * 0.035 * env;

    // Left hand open palm up support base
    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.50, env), lerp(0.60, 0.46 - lift, env), -0.06],
      [0.85, 0.95, 0.95, 0.95, 0.85],
      [0.3, 0, 1.4],
      true
    );

    // Right hand thumbs-up fist placed on top of left palm
    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.50, env), lerp(0.60, 0.38 - lift, env), -0.06],
      [0.95, 0.1, 0.1, 0.1, 0.1], // Thumbs-up fist
      [0, 0, 0],
      false
    );

    pose[15] = leftHand[0];
    pose[16] = rightHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.6 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 17. BOOK ───────────────────────────────────────────────────────────────
function generateBookFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const sway = Math.sin(t * Math.PI) * 0.02;

    // Both open hands touching at pinky edges like an open book
    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.46 + sway, env), lerp(0.60, 0.40, env), -0.06],
      [0.85, 0.95, 0.95, 0.95, 0.9],
      [0.2, -0.2, 0.2],
      false
    );

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.54 - sway, env), lerp(0.60, 0.40, env), -0.06],
      [0.85, 0.95, 0.95, 0.95, 0.9],
      [0.2, 0.2, -0.2],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 18. WATER ──────────────────────────────────────────────────────────────
function generateWaterFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const tap = Math.sin(t * Math.PI * 4) * 0.025 * (t > 0.25 && t < 0.8 ? 1 : 0);

    // Three fingers upright in W shape tapping gently against chin twice
    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.48, env), lerp(0.60, 0.30 + tap, env), -0.07],
      [0.1, 0.95, 0.95, 0.95, 0.1], // W-shape
      [0, 0, 0],
      false
    );

    const leftHand = createRestHand(pose[15], true);
    pose[16] = rightHand[0];
    const face = createFaceMesh(pose[0], 0.1 * env, 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 19. FOOD / EAT ─────────────────────────────────────────────────────────
function generateFoodFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const feed = Math.sin(t * Math.PI * 4) * 0.035 * (t > 0.2 && t < 0.85 ? 1 : 0);

    // Right fingertips grouped together brought to mouth twice
    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.49, env), lerp(0.60, 0.32 - feed, env), -0.08],
      [0.5, 0.5, 0.5, 0.5, 0.5], // Grouped fingertips
      [0.2, 0, 0],
      false
    );

    const leftHand = createRestHand(pose[15], true);
    pose[16] = rightHand[0];
    const face = createFaceMesh(pose[0], 0.2 * (feed > 0 ? 1 : 0), 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 20. MEDICINE ───────────────────────────────────────────────────────────
function generateMedicineFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const circleX = Math.cos(t * Math.PI * 6) * 0.02 * env;
    const circleY = Math.sin(t * Math.PI * 6) * 0.015 * env;

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.52, env), lerp(0.60, 0.42, env), -0.06],
      [0.8, 1.0, 1.0, 1.0, 0.8],
      [0.4, 0, 1.2],
      true
    );

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.50 + circleX, env), lerp(0.60, 0.38 + circleY, env), -0.07],
      [0.2, 0.2, 1.0, 0.2, 0.2], // Middle finger crushing pill
      [0, 0, -0.6],
      false
    );

    pose[15] = leftHand[0];
    pose[16] = rightHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 21. PAIN ───────────────────────────────────────────────────────────────
function generatePainFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const jab = Math.sin(t * Math.PI * 6) * 0.025 * env;

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.44 + jab, env), lerp(0.60, 0.38, env), -0.06],
      [0.1, 1.0, 0.1, 0.1, 0.1], // Index pointing inward
      [0, 0, -1.2],
      false
    );

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.56 - jab, env), lerp(0.60, 0.38, env), -0.06],
      [0.1, 1.0, 0.1, 0.1, 0.1], // Index pointing inward
      [0, 0, 1.2],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.15, 0.1);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 22. FEVER ──────────────────────────────────────────────────────────────
function generateFeverFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.50, env), lerp(0.60, 0.18, env), -0.05],
      [0.8, 1.0, 1.0, 1.0, 0.9], // Back of hand on forehead
      [0.3, 0, -0.4],
      false
    );

    const leftHand = createRestHand(pose[15], true);
    pose[16] = rightHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.2);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 23. EMERGENCY ──────────────────────────────────────────────────────────
function generateEmergencyFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const shake = Math.sin(t * Math.PI * 10) * 0.025 * env;

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.38 + shake, env), lerp(0.60, 0.34 + shake, env), -0.08],
      [1.0, 1.0, 1.0, 1.0, 1.0], // Wide open hands
      [0, 0, 0.3],
      false
    );

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.62 - shake, env), lerp(0.60, 0.34 - shake, env), -0.08],
      [1.0, 1.0, 1.0, 1.0, 1.0],
      [0, 0, -0.3],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.2, 0.2);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 24. TIME ───────────────────────────────────────────────────────────────
function generateTimeFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const tap = Math.sin(t * Math.PI * 4) * 0.02 * (t > 0.25 && t < 0.8 ? 1 : 0);

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.52, env), lerp(0.60, 0.42, env), -0.06],
      [0.1, 0.1, 0.1, 0.1, 0.1], // Closed fist representing watch wrist
      [0, 0, 1.4],
      true
    );

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.52, env), lerp(0.60, 0.36 + tap, env), -0.06],
      [0.1, 1.0, 0.1, 0.1, 0.1], // Index tapping watch
      [0, 0, -0.6],
      false
    );

    pose[15] = leftHand[0];
    pose[16] = rightHand[0];
    const face = createFaceMesh(pose[0], 0.05, 0.5 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}

// ─── 25. FAMILY ─────────────────────────────────────────────────────────────
function generateFamilyFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const circle = Math.sin(t * Math.PI * 2);

    const rightHand = buildNaturalHandPose(
      [lerp(0.41, 0.45 - circle * 0.04, env), lerp(0.60, 0.40, env), -0.06],
      [0.3, 0.3, 0.9, 0.9, 0.9], // F circle joining
      [0, 0, 0],
      false
    );

    const leftHand = buildNaturalHandPose(
      [lerp(0.59, 0.55 + circle * 0.04, env), lerp(0.60, 0.40, env), -0.06],
      [0.3, 0.3, 0.9, 0.9, 0.9],
      [0, 0, 0],
      true
    );

    pose[16] = rightHand[0];
    pose[15] = leftHand[0];
    const face = createFaceMesh(pose[0], 0.1 * env, 0.8 * env);
    frames.push({ poseLandmarks: pose, leftHandLandmarks: leftHand, rightHandLandmarks: rightHand, faceLandmarks: face });
  }
  return frames;
}
