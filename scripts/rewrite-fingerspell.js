const fs = require("fs");

// ─── Real angle data → ext values ─────────────────────────────────────────────
const LETTER_DATA = {
  A: { thumb:0.111, index:0.884, middle:0.942, ring:0.963, pinky:0.962 },
  B: { thumb:0.164, index:0.409, middle:0.428, ring:0.423, pinky:0.333 },
  C: { thumb:0.870, index:0.912, middle:0.927, ring:0.924, pinky:0.911 },
  D: { thumb:0.117, index:0.070, middle:0.686, ring:0.726, pinky:0.704 },
  E: { thumb:0.118, index:0.193, middle:0.716, ring:0.745, pinky:0.696 },
  F: { thumb:0.092, index:0.043, middle:0.037, ring:0.793, pinky:0.565 },
  G: { thumb:0.140, index:0.918, middle:0.939, ring:0.906, pinky:0.818 },
  H: { thumb:0.024, index:0.015, middle:0.013, ring:0.014, pinky:0.024 },
  I: { thumb:0.976, index:0.977, middle:0.988, ring:0.987, pinky:0.984 },
  J: { thumb:1.000, index:1.000, middle:1.000, ring:1.000, pinky:1.000 },
  K: { thumb:0.032, index:0.058, middle:0.670, ring:0.695, pinky:0.630 },
  L: { thumb:0.998, index:0.998, middle:0.998, ring:0.998, pinky:0.998 },
  M: { thumb:0.165, index:0.044, middle:0.021, ring:0.389, pinky:0.341 },
  N: { thumb:0.137, index:0.025, middle:0.013, ring:0.531, pinky:0.383 },
  O: { thumb:0.990, index:0.993, middle:0.993, ring:0.993, pinky:0.993 },
  P: { thumb:0.023, index:0.018, middle:0.652, ring:0.692, pinky:0.566 },
  Q: { thumb:0.994, index:0.996, middle:0.997, ring:0.997, pinky:0.996 },
  R: { thumb:0.519, index:0.516, middle:0.499, ring:0.498, pinky:0.504 },
  S: { thumb:0.249, index:0.618, middle:0.582, ring:0.708, pinky:0.240 },
  T: { thumb:0.243, index:0.018, middle:0.626, ring:0.669, pinky:0.661 },
  U: { thumb:0.996, index:0.996, middle:0.998, ring:0.998, pinky:0.998 },
  V: { thumb:0.980, index:0.977, middle:0.977, ring:0.994, pinky:0.993 },
  W: { thumb:0.439, index:0.422, middle:0.427, ring:0.420, pinky:0.423 },
  X: { thumb:0.342, index:0.209, middle:0.813, ring:0.880, pinky:0.898 },
  Y: { thumb:0.115, index:0.040, middle:0.645, ring:0.683, pinky:0.684 },
  Z: { thumb:0.083, index:0.021, middle:0.020, ring:0.034, pinky:0.043 },
};

const newSrc = `/**
 * Procedural 3D Fingerspelling Animation Engine
 * Generates anatomically accurate 3D landmark sequences (Pose + Hand Articulation)
 * for letters A-Z in Indian Sign Language fingerspelling.
 *
 * Finger extension values (ext) are derived from real measured joint angles in:
 *   D:/Matri/letter dataset/hand_angles_datasets.csv  (31,926 samples, all 26 letters)
 *   ext = 1 - (avg_angle / 180):  0 = fully curled, 1 = fully straight
 */

import { FrameLandmarks, Landmark3D, lerp } from './motionSmoothing';

// ─── Real-data-driven letter specs (from hand_angles_datasets.csv) ─────────────
// Each value is ext: 0.0 = fully curled, 1.0 = fully straight
interface LetterExtSpec {
  thumb: number;   // ext 0-1
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  // Optional wrist offset for letters that tilt the hand (G, H, P, Q, Z)
  wristOffsetY?: number;
  // Dynamic motion trajectory for J and Z (wrist movement in normalized units)
  motionTrajectory?: Array<{ x: number; y: number; z: number }>;
}

const LETTER_SPECS: Record<string, LetterExtSpec> = {
  A: { thumb:0.111, index:0.884, middle:0.942, ring:0.963, pinky:0.962 },
  B: { thumb:0.164, index:0.409, middle:0.428, ring:0.423, pinky:0.333 },
  C: { thumb:0.870, index:0.912, middle:0.927, ring:0.924, pinky:0.911 },
  D: { thumb:0.117, index:0.070, middle:0.686, ring:0.726, pinky:0.704 },
  E: { thumb:0.118, index:0.193, middle:0.716, ring:0.745, pinky:0.696 },
  F: { thumb:0.092, index:0.043, middle:0.037, ring:0.793, pinky:0.565 },
  G: { thumb:0.140, index:0.918, middle:0.939, ring:0.906, pinky:0.818, wristOffsetY: -0.02 },
  H: { thumb:0.024, index:0.015, middle:0.013, ring:0.014, pinky:0.024, wristOffsetY: -0.02 },
  I: { thumb:0.976, index:0.977, middle:0.988, ring:0.987, pinky:0.984 },
  J: { thumb:1.000, index:1.000, middle:1.000, ring:1.000, pinky:1.000,
       motionTrajectory: [
         { x: 0, y: 0, z: 0 },
         { x: 0.005, y: 0.015, z: 0 },
         { x: -0.015, y: 0.025, z: -0.01 },
         { x: -0.025, y: 0.010, z: -0.02 },
         { x: -0.020, y: -0.005, z: -0.01 },
       ] },
  K: { thumb:0.032, index:0.058, middle:0.670, ring:0.695, pinky:0.630 },
  L: { thumb:0.998, index:0.998, middle:0.998, ring:0.998, pinky:0.998 },
  M: { thumb:0.165, index:0.044, middle:0.021, ring:0.389, pinky:0.341 },
  N: { thumb:0.137, index:0.025, middle:0.013, ring:0.531, pinky:0.383 },
  O: { thumb:0.990, index:0.993, middle:0.993, ring:0.993, pinky:0.993 },
  P: { thumb:0.023, index:0.018, middle:0.652, ring:0.692, pinky:0.566, wristOffsetY: 0.025 },
  Q: { thumb:0.994, index:0.996, middle:0.997, ring:0.997, pinky:0.996, wristOffsetY: 0.025 },
  R: { thumb:0.519, index:0.516, middle:0.499, ring:0.498, pinky:0.504 },
  S: { thumb:0.249, index:0.618, middle:0.582, ring:0.708, pinky:0.240 },
  T: { thumb:0.243, index:0.018, middle:0.626, ring:0.669, pinky:0.661 },
  U: { thumb:0.996, index:0.996, middle:0.998, ring:0.998, pinky:0.998 },
  V: { thumb:0.980, index:0.977, middle:0.977, ring:0.994, pinky:0.993 },
  W: { thumb:0.439, index:0.422, middle:0.427, ring:0.420, pinky:0.423 },
  X: { thumb:0.342, index:0.209, middle:0.813, ring:0.880, pinky:0.898 },
  Y: { thumb:0.115, index:0.040, middle:0.645, ring:0.683, pinky:0.684 },
  Z: { thumb:0.083, index:0.021, middle:0.020, ring:0.034, pinky:0.043,
       motionTrajectory: [
         { x: -0.02, y: -0.01, z: 0 },
         { x: 0.02, y: -0.01, z: 0 },
         { x: -0.015, y: 0.02, z: 0 },
         { x: 0.02, y: 0.02, z: 0 },
       ] },
};

// ─── Hand Geometry Builder ─────────────────────────────────────────────────────
// Builds 21 MediaPipe hand landmarks for a given letter ext spec.
// Coordinate convention: x increases right, y increases DOWN (toward fingers), z toward camera.
// Wrist = joint[0], palm knuckles = [5,9,13,17], fingertips = [8,12,16,20], thumb tip = [4].
function buildHandLandmarks(
  spec: LetterExtSpec,
  wristBase: Landmark3D,
  motionOffset = { x: 0, y: 0, z: 0 }
): Landmark3D[] {
  const joints: Landmark3D[] = new Array(21);

  const wX = wristBase.x + motionOffset.x;
  const wY = wristBase.y + (spec.wristOffsetY || 0) + motionOffset.y;
  const wZ = wristBase.z + motionOffset.z;

  joints[0] = { x: wX, y: wY, z: wZ };

  // Palm knuckle (MCP) positions relative to wrist
  // Positive Y = downward (toward fingertips) — matches real MediaPipe data
  const knuckles = [
    { x: -0.022, y: 0.020, z: -0.008 }, // Thumb CMC [1]
    { x: -0.016, y: 0.048, z: -0.006 }, // Index  MCP [5]
    { x:  0.000, y: 0.052, z:  0.000 }, // Middle MCP [9]
    { x:  0.016, y: 0.048, z:  0.006 }, // Ring   MCP [13]
    { x:  0.026, y: 0.040, z:  0.010 }, // Pinky  MCP [17]
  ];

  // Finger segment lengths: [MCP→PIP, PIP→DIP, DIP→Tip] in normalized units
  const segLens = [
    [0.026, 0.019, 0.015], // Index
    [0.028, 0.021, 0.016], // Middle
    [0.025, 0.018, 0.015], // Ring
    [0.020, 0.015, 0.013], // Pinky
  ];

  // Build one finger: 3 segments, all going downward (+Y) when straight, curling back (-Y) when folded
  const buildFinger = (baseIdx: number, knuckle: typeof knuckles[0], ext: number, segs: number[]) => {
    const mcp: Landmark3D = { x: wX + knuckle.x, y: wY + knuckle.y, z: wZ + knuckle.z };
    joints[baseIdx] = mcp;

    const curl = 1 - ext; // 0=straight, 1=fully curled

    // PIP: when straight → goes down (+Y); when curled → goes back up and toward palm
    const pip: Landmark3D = {
      x: mcp.x,
      y: mcp.y + segs[0] * (ext * 0.9 - curl * 0.15),
      z: mcp.z + segs[0] * (curl * 0.55 - ext * 0.02),
    };
    joints[baseIdx + 1] = pip;

    // DIP: continues same curl direction
    const dip: Landmark3D = {
      x: pip.x,
      y: pip.y + segs[1] * (ext * 0.9 - curl * 0.35),
      z: pip.z + segs[1] * (curl * 0.55 - ext * 0.02),
    };
    joints[baseIdx + 2] = dip;

    // Tip: final segment
    const tip: Landmark3D = {
      x: dip.x,
      y: dip.y + segs[2] * (ext * 0.9 - curl * 0.35),
      z: dip.z + segs[2] * (curl * 0.45 - ext * 0.02),
    };
    joints[baseIdx + 3] = tip;
  };

  buildFinger(5,  knuckles[1], spec.index,  segLens[0]);
  buildFinger(9,  knuckles[2], spec.middle, segLens[1]);
  buildFinger(13, knuckles[3], spec.ring,   segLens[2]);
  buildFinger(17, knuckles[4], spec.pinky,  segLens[3]);

  // Thumb: CMC → MCP → IP → Tip
  const cmc: Landmark3D = { x: wX + knuckles[0].x, y: wY + knuckles[0].y, z: wZ + knuckles[0].z };
  joints[1] = cmc;

  const tExt = spec.thumb; // 0 = folded, 1 = extended
  const tCurl = 1 - tExt;

  // Thumb extends SIDEWAYS (negative X = toward thumb side) and slightly upward
  joints[2] = { x: cmc.x - 0.018 * tExt - 0.006 * tCurl, y: cmc.y - 0.016 * tExt + 0.010 * tCurl, z: cmc.z - 0.010 };
  joints[3] = { x: cmc.x - 0.030 * tExt + 0.002 * tCurl, y: cmc.y - 0.028 * tExt + 0.015 * tCurl, z: cmc.z - 0.012 };
  joints[4] = { x: cmc.x - 0.040 * tExt + 0.010 * tCurl, y: cmc.y - 0.036 * tExt + 0.018 * tCurl, z: cmc.z - 0.014 };

  return joints;
}

// ─── Frame Generator ───────────────────────────────────────────────────────────
export function generateFingerspellFrames(letterChar: string, totalFrames = 14): FrameLandmarks[] {
  const char = (letterChar || 'A').toUpperCase().charAt(0);
  const spec = LETTER_SPECS[char] || LETTER_SPECS['A'];

  // Base signing pose: right arm raised, hand at upper chest level
  const basePose: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  basePose[0]  = { x: 0.50, y: 0.18, z: -0.03 }; // Nose
  basePose[2]  = { x: 0.53, y: 0.16, z: -0.03 }; // Left eye
  basePose[5]  = { x: 0.47, y: 0.16, z: -0.03 }; // Right eye
  basePose[7]  = { x: 0.56, y: 0.18, z:  0.00 }; // Left ear
  basePose[8]  = { x: 0.44, y: 0.18, z:  0.00 }; // Right ear
  basePose[11] = { x: 0.62, y: 0.32, z:  0.00 }; // Left shoulder
  basePose[12] = { x: 0.38, y: 0.32, z:  0.00 }; // Right shoulder
  basePose[23] = { x: 0.56, y: 0.68, z:  0.00 }; // Left hip
  basePose[24] = { x: 0.44, y: 0.68, z:  0.00 }; // Right hip
  basePose[13] = { x: 0.66, y: 0.48, z:  0.02 }; // Left elbow (arm at rest)
  basePose[15] = { x: 0.60, y: 0.60, z: -0.02 }; // Left wrist (arm at rest)

  // Right arm raised to signing position (in front of upper chest, slightly right)
  basePose[14] = { x: 0.34, y: 0.44, z:  0.02 }; // Right elbow
  const rightWristBase: Landmark3D = { x: 0.43, y: 0.36, z: -0.03 }; // Right wrist
  basePose[16] = { ...rightWristBase };

  // Left resting hand (open, at left hip)
  const leftHand: Landmark3D[] = Array.from({ length: 21 }, (_, i) => ({
    x: basePose[15].x + (i === 0 ? 0 : ((i % 5) - 2) * 0.007),
    y: basePose[15].y + (i === 0 ? 0 : Math.floor(i / 5) * 0.010),
    z: -0.01,
  }));

  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const progress = f / Math.max(totalFrames - 1, 1);

    // Subtle presentation pulse (hand breathes slightly)
    const pulse = Math.sin(progress * Math.PI) * 0.004;

    let motionOffset = { x: 0, y: pulse, z: 0 };

    if (spec.motionTrajectory && spec.motionTrajectory.length > 0) {
      const traj = spec.motionTrajectory;
      const rawIdx = progress * (traj.length - 1);
      const idx0 = Math.min(Math.floor(rawIdx), traj.length - 2);
      const t = rawIdx - idx0;
      motionOffset = {
        x: lerp(traj[idx0].x, traj[idx0 + 1].x, t),
        y: lerp(traj[idx0].y, traj[idx0 + 1].y, t) + pulse,
        z: lerp(traj[idx0].z, traj[idx0 + 1].z, t),
      };
    }

    const framePose: Landmark3D[] = basePose.map(p => ({ ...p }));
    framePose[16] = {
      x: rightWristBase.x + motionOffset.x,
      y: rightWristBase.y + motionOffset.y,
      z: rightWristBase.z + motionOffset.z,
    };

    const rightHand = buildHandLandmarks(spec, {
      x: rightWristBase.x + motionOffset.x,
      y: rightWristBase.y + motionOffset.y,
      z: rightWristBase.z + motionOffset.z,
    });

    frames.push({
      poseLandmarks: framePose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: null,
    });
  }

  return frames;
}
`;

fs.writeFileSync("d:/Matri/src/lib/fingerspellingEngine.ts", newSrc, "utf8");
console.log("Rewrote fingerspellingEngine.ts with real angle data");
