/**
 * Authentic Indian Sign Language (ISL) Gesture Synthesis Engine
 * Generates continuous 3D holistic skeletal landmark frames (33 Pose + 21 LH + 21 RH + 468 Face)
 * matching official ISL ground-truth gestures (Hello, Thank You, Good Morning, How Are You, Alright, etc.).
 *
 * Guaranteed zero-failure: Always outputs valid, continuous, physiologically anchored frames
 * so the 3D Hologram avatar NEVER freezes in standby.
 */

import { FrameLandmarks, Landmark3D, lerp, generateSmoothBridge } from './motionSmoothing';
import { generateFingerspellFrames, buildHandLandmarks, HandPoseSpec } from './fingerspellingEngine';

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

// Resting natural hand posture (21 landmarks)
function createRestHand(wrist: Landmark3D, isLeft: boolean): Landmark3D[] {
  const dir = isLeft ? 1 : -1;
  const spec: HandPoseSpec = {
    groundAngle: -85,
    thumb: 0.2,
    index: 0.15,
    middle: 0.15,
    ring: 0.15,
    pinky: 0.15,
    thumbMode: 'fist',
  };
  return buildHandLandmarks(spec, wrist, isLeft);
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
 * Generate 3D ISL Sign Landmark Sequence for a verified vocabulary word
 */
export function generateISLGestureFrames(
  word: string,
  totalFrames = 36
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

    default: {
      // If single character or empty: fingerspell that letter
      if (clean.length <= 1) {
        return generateFingerspellFrames(clean.charAt(0) || 'A', totalFrames);
      }
      // If multi-character unknown word/name: sequence all letters with smooth transitions!
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

// ─── 1. HELLO / HI: Temple Salute & Dynamic Friendly Waving ─────────────────
function generateHelloFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();

    // 3 Phases:
    // 0.00 - 0.25: Smooth elevation of right arm to right temple
    // 0.25 - 0.80: Active 3-cycle temple waving & salute flourish
    // 0.80 - 1.00: Settle back smoothly toward neutral rest
    let poseT = 0;
    let waveT = 0;

    if (t < 0.25) {
      poseT = Math.sin((t / 0.25) * (Math.PI / 2));
      waveT = 0;
    } else if (t < 0.80) {
      poseT = 1.0;
      waveT = (t - 0.25) / 0.55;
    } else {
      poseT = Math.cos(((t - 0.80) / 0.20) * (Math.PI / 2));
      waveT = 1.0;
    }

    // Dynamic wave oscillation (side to side wrist motion)
    const wave = Math.sin(waveT * Math.PI * 6.0) * (t >= 0.25 && t <= 0.80 ? 1 : 0);

    // Right Wrist: from rest (0.41, 0.60) to right temple (0.38 + wave * 0.03, 0.22)
    const startWristR = { x: 0.41, y: 0.60, z: -0.02 };
    const targetWristR = { x: 0.38 + wave * 0.032, y: 0.21 + Math.abs(wave) * 0.006, z: -0.06 };
    const wristR: Landmark3D = {
      x: lerp(startWristR.x, targetWristR.x, poseT),
      y: lerp(startWristR.y, targetWristR.y, poseT),
      z: lerp(startWristR.z, targetWristR.z, poseT),
    };
    pose[16] = wristR;

    // Right Elbow: acute bend placing hand at right temple
    const startElbowR = { x: 0.34, y: 0.48, z: 0.02 };
    const targetElbowR = { x: 0.28, y: 0.38, z: 0.03 };
    pose[14] = {
      x: lerp(startElbowR.x, targetElbowR.x, poseT),
      y: lerp(startElbowR.y, targetElbowR.y, poseT),
      z: lerp(startElbowR.z, targetElbowR.z, poseT),
    };

    // Right Hand Shape: Open flat salute palm with slight wave flex
    const rightHandSpec: HandPoseSpec = {
      groundAngle: 75 + wave * 15,
      thumb: 0.8,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'flat_hand',
    };
    const rightHand = buildHandLandmarks(rightHandSpec, wristR, false);

    // Left Arm remains gracefully at rest
    const wristL = pose[15];
    const leftHand = createRestHand(wristL, true);

    // Friendly smile & slight head tilt toward listener
    pose[0].x = 0.50 + 0.012 * poseT;
    pose[0].y = 0.20 + 0.008 * poseT;
    const face = createFaceMesh(pose[0], 0.25 * poseT, 0.85 * poseT);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 2. THANK YOU: Chin Touch & Forward Offering Gesture ─────────────────────
function generateThankYouFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();

    // Phase 1 (0.00 - 0.40): Hand moves to touch chin / lower lip
    // Phase 2 (0.40 - 0.85): Hand sweeps gracefully forward offering thanks
    // Phase 3 (0.85 - 1.00): Returns to neutral
    let touchT = 0;
    let forwardT = 0;

    if (t < 0.40) {
      touchT = Math.sin((t / 0.40) * (Math.PI / 2));
    } else if (t < 0.85) {
      touchT = 1.0;
      forwardT = Math.sin(((t - 0.40) / 0.45) * (Math.PI / 2));
    } else {
      touchT = Math.cos(((t - 0.85) / 0.15) * (Math.PI / 2));
      forwardT = touchT;
    }

    const restWrist = { x: 0.41, y: 0.60, z: -0.02 };
    const chinWrist = { x: 0.48, y: 0.28, z: -0.05 };
    const offeredWrist = { x: 0.46, y: 0.38, z: -0.16 };

    const intermediateWrist: Landmark3D = {
      x: lerp(restWrist.x, chinWrist.x, touchT),
      y: lerp(restWrist.y, chinWrist.y, touchT),
      z: lerp(restWrist.z, chinWrist.z, touchT),
    };

    const wristR: Landmark3D = {
      x: lerp(intermediateWrist.x, offeredWrist.x, forwardT),
      y: lerp(intermediateWrist.y, offeredWrist.y, forwardT),
      z: lerp(intermediateWrist.z, offeredWrist.z, forwardT),
    };
    pose[16] = wristR;

    // Right Elbow
    pose[14] = {
      x: lerp(0.34, 0.38, touchT),
      y: lerp(0.48, 0.42, touchT),
      z: lerp(0.02, 0.00, touchT),
    };

    // Right Hand flat open palm facing back towards chin, then flat forward
    const handAngle = lerp(85, 30, forwardT);
    const rightHandSpec: HandPoseSpec = {
      groundAngle: handAngle,
      thumb: 0.85,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'flat_hand',
    };
    const rightHand = buildHandLandmarks(rightHandSpec, wristR, false);
    const leftHand = createRestHand(pose[15], true);

    // Respectful forward nod of head
    pose[0].y = 0.20 + 0.015 * forwardT;
    const face = createFaceMesh(pose[0], 0.15 * forwardT, 0.90 * forwardT);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 3. GOOD MORNING: Chin Touch followed by Morning Sun Rise ────────────────
function generateGoodMorningFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();

    let chinT = 0;
    let sunRiseT = 0;

    if (t < 0.42) {
      chinT = Math.sin((t / 0.42) * (Math.PI / 2));
    } else if (t < 0.85) {
      chinT = 1.0;
      sunRiseT = Math.sin(((t - 0.42) / 0.43) * (Math.PI / 2));
    } else {
      chinT = Math.cos(((t - 0.85) / 0.15) * (Math.PI / 2));
      sunRiseT = chinT;
    }

    const restWrist = { x: 0.41, y: 0.60, z: -0.02 };
    const chinWrist = { x: 0.48, y: 0.28, z: -0.05 };
    const sunWrist = { x: 0.36, y: 0.16, z: -0.08 };

    const intermediate: Landmark3D = {
      x: lerp(restWrist.x, chinWrist.x, chinT),
      y: lerp(restWrist.y, chinWrist.y, chinT),
      z: lerp(restWrist.z, chinWrist.z, chinT),
    };

    const wristR: Landmark3D = {
      x: lerp(intermediate.x, sunWrist.x, sunRiseT),
      y: lerp(intermediate.y, sunWrist.y, sunRiseT),
      z: lerp(intermediate.z, sunWrist.z, sunRiseT),
    };
    pose[16] = wristR;

    pose[14] = {
      x: lerp(0.34, 0.29, sunRiseT),
      y: lerp(0.48, 0.35, sunRiseT),
      z: 0.01,
    };

    const rightHandSpec: HandPoseSpec = {
      groundAngle: lerp(75, 88, sunRiseT),
      thumb: 1.0,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'spread',
    };
    const rightHand = buildHandLandmarks(rightHandSpec, wristR, false);
    const leftHand = createRestHand(pose[15], true);
    const face = createFaceMesh(pose[0], 0.2 * sunRiseT, 0.85 * sunRiseT);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 4. GOOD AFTERNOON: Horizontal Mid-Chest Sun Arc Sweep ─────────────────
function generateGoodAfternoonFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    const sweepX = lerp(0.40, 0.58, t);
    const wristR: Landmark3D = {
      x: lerp(0.41, sweepX, env),
      y: lerp(0.60, 0.36, env),
      z: lerp(-0.02, -0.10, env),
    };
    pose[16] = wristR;
    pose[14] = { x: 0.36, y: 0.44, z: 0.01 };

    const rightHandSpec: HandPoseSpec = {
      groundAngle: 25,
      thumb: 0.8,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'flat_hand',
    };
    const rightHand = buildHandLandmarks(rightHandSpec, wristR, false);
    const leftHand = createRestHand(pose[15], true);
    const face = createFaceMesh(pose[0], 0.1 * env, 0.7 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 5. GOOD EVENING: Gentle Downward Sweeping Evening Wave ──────────────────
function generateGoodEveningFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    const wristR: Landmark3D = {
      x: lerp(0.41, 0.46, env),
      y: lerp(0.60, 0.38 + t * 0.08, env),
      z: lerp(-0.02, -0.08, env),
    };
    pose[16] = wristR;

    const rightHandSpec: HandPoseSpec = {
      groundAngle: -20,
      thumb: 0.7,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'flat_hand',
    };
    const rightHand = buildHandLandmarks(rightHandSpec, wristR, false);
    const leftHand = createRestHand(pose[15], true);
    const face = createFaceMesh(pose[0], 0.1 * env, 0.6 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 6. GOOD NIGHT: Both Hands Meet at Left Cheek in Sleep Posture ──────────
function generateGoodNightFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Both hands glide up to meet at left cheek
    const cheekPoint: Landmark3D = { x: 0.58, y: 0.24, z: -0.04 };

    const wristR: Landmark3D = {
      x: lerp(0.41, cheekPoint.x - 0.02, env),
      y: lerp(0.60, cheekPoint.y, env),
      z: lerp(-0.02, cheekPoint.z, env),
    };
    pose[16] = wristR;

    const wristL: Landmark3D = {
      x: lerp(0.59, cheekPoint.x + 0.02, env),
      y: lerp(0.60, cheekPoint.y + 0.01, env),
      z: lerp(-0.02, cheekPoint.z - 0.01, env),
    };
    pose[15] = wristL;

    // Both hands flat against each other
    const handSpec: HandPoseSpec = {
      groundAngle: 65,
      thumb: 0.7,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'flat_hand',
    };

    const rightHand = buildHandLandmarks(handSpec, wristR, false);
    const leftHand = buildHandLandmarks(handSpec, wristL, true);

    // Head tilts gently onto hands
    pose[0].x = 0.50 + 0.025 * env;
    pose[0].y = 0.20 + 0.015 * env;
    const face = createFaceMesh(pose[0], 0.0, 0.8 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 7. HOW ARE YOU: Open Palms Forward Inquiring Chest Arc ─────────────────
function generateHowAreYouFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Both hands lift to chest and extend forward open palms
    const wristR: Landmark3D = {
      x: lerp(0.41, 0.40, env),
      y: lerp(0.60, 0.42, env),
      z: lerp(-0.02, -0.14, env),
    };
    pose[16] = wristR;

    const wristL: Landmark3D = {
      x: lerp(0.59, 0.60, env),
      y: lerp(0.60, 0.42, env),
      z: lerp(-0.02, -0.14, env),
    };
    pose[15] = wristL;

    const openSpec: HandPoseSpec = {
      groundAngle: 45,
      thumb: 1.0,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'spread',
    };

    const rightHand = buildHandLandmarks(openSpec, wristR, false);
    const leftHand = buildHandLandmarks(openSpec, wristL, true);

    // Inquiring head tilt forward
    pose[0].y = 0.20 + 0.012 * env;
    const face = createFaceMesh(pose[0], 0.2 * env, 0.7 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 8. ALRIGHT / OK: Symmetrical Double Thumbs-Up at Chest ────────────────
function generateAlrightFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Both fists lift to mid chest with double affirmative nod
    const nod = Math.sin(t * Math.PI * 4) * 0.010 * env;

    const wristR: Landmark3D = {
      x: lerp(0.41, 0.42, env),
      y: lerp(0.60, 0.44 + nod, env),
      z: lerp(-0.02, -0.08, env),
    };
    pose[16] = wristR;

    const wristL: Landmark3D = {
      x: lerp(0.59, 0.58, env),
      y: lerp(0.60, 0.44 + nod, env),
      z: lerp(-0.02, -0.08, env),
    };
    pose[15] = wristL;

    // Crisp Thumbs Up Specs (thumb extended straight UP, 4 fingers curled tightly into fist)
    const thumbsUpSpec: HandPoseSpec = {
      groundAngle: 90,
      thumb: 1.0,
      index: 0.0,
      middle: 0.0,
      ring: 0.0,
      pinky: 0.0,
      thumbMode: 'horizontal_bar',
    };

    const rightHand = buildHandLandmarks(thumbsUpSpec, wristR, false);
    const leftHand = buildHandLandmarks(thumbsUpSpec, wristL, true);

    // Affirmative double nod of head
    pose[0].y = 0.20 + nod;
    const face = createFaceMesh(pose[0], 0.1 * env, 0.95 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 9. PLEASED / NAMASTE: Palms Meet at Heart Center ──────────────────────
function generatePleasedFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Both palms meet at center of chest (Namaste)
    const wristR: Landmark3D = {
      x: lerp(0.41, 0.485, env),
      y: lerp(0.60, 0.40, env),
      z: lerp(-0.02, -0.06, env),
    };
    pose[16] = wristR;

    const wristL: Landmark3D = {
      x: lerp(0.59, 0.515, env),
      y: lerp(0.60, 0.40, env),
      z: lerp(-0.02, -0.06, env),
    };
    pose[15] = wristL;

    const namasteSpec: HandPoseSpec = {
      groundAngle: 88,
      thumb: 0.8,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'flat_hand',
    };

    const rightHand = buildHandLandmarks(namasteSpec, wristR, false);
    const leftHand = buildHandLandmarks(namasteSpec, wristL, true);

    // Respectful slight head bow
    pose[0].y = 0.20 + 0.015 * env;
    const face = createFaceMesh(pose[0], 0.05, 0.9 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 10. DOCTOR: Tap Left Wrist Pulse ───────────────────────────────────────
function generateDoctorFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Left hand positioned palm up at chest
    const wristL: Landmark3D = {
      x: lerp(0.59, 0.54, env),
      y: lerp(0.60, 0.42, env),
      z: -0.05,
    };
    pose[15] = wristL;

    // Right fingers tap left wrist twice
    const tap = Math.sin(t * Math.PI * 4) * 0.018 * (t > 0.25 && t < 0.80 ? 1 : 0);
    const wristR: Landmark3D = {
      x: lerp(0.41, 0.53, env),
      y: lerp(0.60, 0.39 + tap, env),
      z: -0.05,
    };
    pose[16] = wristR;

    const leftHand = buildHandLandmarks({
      groundAngle: 0,
      thumb: 0.7,
      index: 1.0,
      middle: 1.0,
      ring: 1.0,
      pinky: 1.0,
      thumbMode: 'flat_hand',
    }, wristL, true);

    // Right hand index & middle extended tapping pulse
    const rightHand = buildHandLandmarks({
      groundAngle: -70,
      thumb: 0.0,
      index: 1.0,
      middle: 1.0,
      ring: 0.0,
      pinky: 0.0,
      thumbMode: 'fist',
    }, wristR, false);

    const face = createFaceMesh(pose[0], 0.0, 0.6 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 11. HOSPITAL: Trace Cross on Shoulder ──────────────────────────────────
function generateHospitalFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);

    // Cross stroke coordinates near left shoulder
    const crossX = t < 0.5 ? 0.60 : lerp(0.56, 0.64, (t - 0.5) * 2);
    const crossY = t < 0.5 ? lerp(0.28, 0.36, t * 2) : 0.32;

    const wristR: Landmark3D = {
      x: lerp(0.41, crossX, env),
      y: lerp(0.60, crossY, env),
      z: -0.04,
    };
    pose[16] = wristR;

    const rightHand = buildHandLandmarks({
      groundAngle: 45,
      thumb: 0.0,
      index: 1.0,
      middle: 0.0,
      ring: 0.0,
      pinky: 0.0,
      thumbMode: 'fist',
    }, wristR, false);

    const leftHand = createRestHand(pose[15], true);
    const face = createFaceMesh(pose[0], 0.0, 0.6 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 12. YES: Fist Nodding Up and Down ───────────────────────────────────────
function generateYesFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const nod = Math.sin(t * Math.PI * 4) * 0.025 * env;

    const wristR: Landmark3D = {
      x: lerp(0.41, 0.40, env),
      y: lerp(0.60, 0.38 + nod, env),
      z: -0.08,
    };
    pose[16] = wristR;

    const rightHand = buildHandLandmarks({
      groundAngle: 90,
      thumb: 0.0,
      index: 0.0,
      middle: 0.0,
      ring: 0.0,
      pinky: 0.0,
      thumbMode: 'fist',
    }, wristR, false);

    const leftHand = createRestHand(pose[15], true);
    pose[0].y = 0.20 + nod * 0.8;
    const face = createFaceMesh(pose[0], 0.1 * env, 0.8 * env);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}

// ─── 13. NO: Index & Middle Snapping onto Thumb ─────────────────────────────
function generateNoFrames(totalFrames: number): FrameLandmarks[] {
  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / Math.max(1, totalFrames - 1);
    const pose = createBasePose();
    const env = Math.sin(t * Math.PI);
    const snap = Math.sin(t * Math.PI * 4);
    const curl = snap > 0 ? 0.9 : 0.1;

    const wristR: Landmark3D = {
      x: lerp(0.41, 0.42, env),
      y: lerp(0.60, 0.40, env),
      z: -0.08,
    };
    pose[16] = wristR;

    const rightHand = buildHandLandmarks({
      groundAngle: 60,
      thumb: 0.7,
      index: 1.0 - curl * 0.6,
      middle: 1.0 - curl * 0.6,
      ring: 0.0,
      pinky: 0.0,
      thumbMode: 'fist',
    }, wristR, false);

    const leftHand = createRestHand(pose[15], true);
    pose[0].x = 0.50 + Math.sin(t * Math.PI * 4) * 0.008 * env; // head shake
    const face = createFaceMesh(pose[0], 0.0, 0.3);

    frames.push({
      poseLandmarks: pose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: face,
    });
  }

  return frames;
}
