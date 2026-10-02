/**
 * Procedural 3D Fingerspelling Animation Engine
 * Generates anatomically accurate 3D landmark sequences (Pose + Dual Hand Articulation)
 * for letters A-Z matching the official Indian Sign Language (ISL) Ground Truth Chart.
 *
 * Ground Truth Reference (Chart):
 *   A: Two fists, index fingers extended upward touching at tips like a tent /\
 *   B: Both hands touch index and thumb into two circular loops (8 / eyeglasses)
 *   C: Single hand curved in a smooth 'C' arc facing viewer
 *   D: Left index upright (stem), Right thumb and index form loop touching it (letter 'd')
 *   E: Left index points up at an angle, Right index touches it
 *   F: Both hands extend index & middle, crossing over each other (# / X)
 *   G: Two closed fists stacked vertically (Right fist directly on top of Left fist)
 *   H: Flat right palm sweeps across flat left palm
 *   I: Fist with PINKY finger pointing straight UP
 *   J: Index finger tracing a 'J' hook trajectory
 *   K: Left index upright (stem), Right index points at angle touching its midpoint ('K')
 *   L: Fist with Index straight UP and Thumb horizontal at 90°, forming clean 'L'
 *   M: Left hand 3 fingers horizontal (index, middle, ring), Right hand supports underneath
 *   N: Left hand 2 fingers horizontal (index, middle), Right hand supports underneath
 *   O: All fingers and thumb curved touching at tips in an 'O' circle
 *   P: Left index upright, Right thumb and index form circle touching top of left index ('p')
 *   Q: Right hand forms 'O' circle, Left index touches bottom of circle ('q')
 *   R: Left hand flat horizontal, Right index hooks over left hand edge
 *   S: Both hands closed fists, with pinkies interlocked
 *   T: Left index points straight UP (stem), Right index horizontal resting ON TOP of it (crossbar 'T')
 *   U: Fist with INDEX and PINKY both pointing straight UP (two vertical prongs of 'U')
 *   V: Fist with INDEX and MIDDLE fingers extended in upright 'V' victory sign
 *   W: Both hands upright with fingers spread and interlaced forming 3 peaks of 'W'
 *   X: Both index fingers extended and crossed over each other ('X')
 *   Y: Left index upright, Right hand forms 'V' touching left index ('Y')
 *   Z: Left hand flat angled palm, Right hand touches across forming 'Z' zigzag
 */

import { FrameLandmarks, Landmark3D, lerp } from './motionSmoothing';

export interface HandPoseSpec {
  groundAngle: number; // 90 = vertical up, 0 = horizontal across, -90 = down
  thumb: number;       // 0 = curled into fist, 1 = extended
  index: number;       // 0 = curled, 1 = extended
  middle: number;      // 0 = curled, 1 = extended
  ring: number;        // 0 = curled, 1 = extended
  pinky: number;       // 0 = curled, 1 = extended
  thumbMode?: 'fist' | 'horizontal_bar' | 'loop_index' | 'spread' | 'curve_c' | 'flat_hand';
  isCurvedC?: boolean; // smooth C curve for fingers
  isVSign?: boolean;   // splay index medially and middle laterally in a clean V
  isInterlockedPinky?: boolean; // pinky curves medially to interlock fists (S)
}

export interface LetterPoseConfig {
  bothHands: boolean;
  right: HandPoseSpec;
  left: HandPoseSpec;
  rightWrist: { x: number; y: number; z: number };
  leftWrist: { x: number; y: number; z: number };
  rightElbow?: { x: number; y: number; z: number };
  leftElbow?: { x: number; y: number; z: number };
  motionTrajectory?: Array<{ x: number; y: number; z: number }>;
}

// ─── 26 Letter Configurations Exactly Replicating the ISL Chart ─────────────
export const ISL_LETTER_CONFIGS: Record<string, LetterPoseConfig> = {
  // A: Two fists, index fingers extended up and touching at tips like a tent /\
  A: {
    bothHands: true,
    left:  { groundAngle: 62, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 62, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.55, y: 0.44, z: -0.03 },
    rightWrist: { x: 0.45, y: 0.44, z: -0.03 },
    leftElbow:  { x: 0.65, y: 0.49, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.49, z: 0.02 },
  },

  // B: Both hands form distinct side-by-side circular loops touching at the middle (B eyeglasses / 8)
  B: {
    bothHands: true,
    left:  { groundAngle: 75, thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'loop_index' },
    right: { groundAngle: 75, thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'loop_index' },
    leftWrist:  { x: 0.55, y: 0.43, z: -0.03 },
    rightWrist: { x: 0.45, y: 0.43, z: -0.03 },
    leftElbow:  { x: 0.65, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.48, z: 0.02 },
  },

  // C: Single hand (Right) curved in a smooth 'C' arc facing forward
  C: {
    bothHands: false,
    left:  { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 80, thumb: 0.8, index: 0.7, middle: 0.7, ring: 0.7, pinky: 0.7, isCurvedC: true, thumbMode: 'curve_c' },
    leftWrist:  { x: 0.60, y: 0.60, z: -0.02 },
    rightWrist: { x: 0.46, y: 0.41, z: -0.04 },
  },

  // D: Left index upright (stem of 'd'), Right thumb and index form loop touching it
  D: {
    bothHands: true,
    left:  { groundAngle: 90, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 75, thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'loop_index' },
    leftWrist:  { x: 0.52, y: 0.44, z: -0.03 },
    rightWrist: { x: 0.45, y: 0.41, z: -0.03 },
    leftElbow:  { x: 0.64, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.34, y: 0.47, z: 0.02 },
  },

  // E: Left index points up at angle, Right index touches it
  E: {
    bothHands: true,
    left:  { groundAngle: 75, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 45, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.53, y: 0.43, z: -0.03 },
    rightWrist: { x: 0.45, y: 0.43, z: -0.03 },
    leftElbow:  { x: 0.64, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.47, z: 0.02 },
  },

  // F: Both hands extend index & middle, crossing over each other (# / X)
  F: {
    bothHands: true,
    left:  { groundAngle: 20, thumb: 0, index: 1, middle: 1, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 75, thumb: 0, index: 1, middle: 1, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.53, y: 0.42, z: -0.02 },
    rightWrist: { x: 0.47, y: 0.42, z: -0.04 }, // In front in Z to cross over cleanly
    leftElbow:  { x: 0.64, y: 0.47, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.46, z: 0.02 },
  },

  // G: Two closed fists stacked vertically (Right fist directly on top of Left fist)
  G: {
    bothHands: true,
    left:  { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.50, y: 0.46, z: -0.03 },  // Bottom fist
    rightWrist: { x: 0.50, y: 0.38, z: -0.03 },  // Top fist stacked directly above
    leftElbow:  { x: 0.65, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.44, z: 0.02 },
  },

  // H: Flat right palm sweeps across flat left palm
  H: {
    bothHands: true,
    left:  { groundAngle: 90, thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, thumbMode: 'flat_hand' },
    right: { groundAngle: 12, thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, thumbMode: 'flat_hand' },
    leftWrist:  { x: 0.54, y: 0.42, z: -0.02 },
    rightWrist: { x: 0.44, y: 0.41, z: -0.04 }, // slightly in front in Z to stroke across
    leftElbow:  { x: 0.65, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.33, y: 0.47, z: 0.02 },
    motionTrajectory: [
      { x: -0.020, y: 0.000, z: 0 },
      { x: -0.010, y: 0.000, z: 0 },
      { x:  0.005, y: 0.000, z: 0 },
      { x:  0.020, y: 0.000, z: 0 },
      { x:  0.010, y: 0.000, z: 0 },
    ],
  },

  // I: Fist with PINKY finger pointing straight UP
  I: {
    bothHands: false,
    left:  { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 1, thumbMode: 'fist' },
    leftWrist:  { x: 0.60, y: 0.60, z: -0.02 },
    rightWrist: { x: 0.47, y: 0.41, z: -0.04 },
  },

  // J: Index finger tracing a 'J' hook trajectory
  J: {
    bothHands: false,
    left:  { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 90, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.60, y: 0.60, z: -0.02 },
    rightWrist: { x: 0.46, y: 0.41, z: -0.04 },
    motionTrajectory: [
      { x:  0.000, y:  0.000, z: 0 },
      { x:  0.005, y: -0.015, z: 0 },
      { x:  0.002, y: -0.026, z: 0 },
      { x: -0.016, y: -0.028, z: 0 },
      { x: -0.026, y: -0.015, z: 0 },
      { x: -0.022, y: -0.004, z: 0 },
    ],
  },

  // K: Left index upright (stem), Right index touches midpoint at angle ('K')
  K: {
    bothHands: true,
    left:  { groundAngle: 90, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 55, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.53, y: 0.44, z: -0.03 },
    rightWrist: { x: 0.45, y: 0.43, z: -0.03 },
    leftElbow:  { x: 0.64, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.47, z: 0.02 },
  },

  // L: Index points straight UP (90°), Thumb extends horizontally at 90° forming clean 'L'
  L: {
    bothHands: false,
    left:  { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 90, thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'horizontal_bar' },
    leftWrist:  { x: 0.60, y: 0.60, z: -0.02 },
    rightWrist: { x: 0.46, y: 0.41, z: -0.04 },
  },

  // M: Left hand 3 fingers horizontal (index, middle, ring), Right hand supports underneath
  M: {
    bothHands: true,
    left:  { groundAngle: 10, thumb: 0, index: 1, middle: 1, ring: 1, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 85, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.54, y: 0.40, z: -0.03 },
    rightWrist: { x: 0.48, y: 0.45, z: -0.03 },
    leftElbow:  { x: 0.64, y: 0.47, z: 0.02 },
    rightElbow: { x: 0.36, y: 0.48, z: 0.02 },
  },

  // N: Left hand 2 fingers horizontal (index, middle), Right hand supports underneath
  N: {
    bothHands: true,
    left:  { groundAngle: 10, thumb: 0, index: 1, middle: 1, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 85, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.54, y: 0.40, z: -0.03 },
    rightWrist: { x: 0.48, y: 0.45, z: -0.03 },
    leftElbow:  { x: 0.64, y: 0.47, z: 0.02 },
    rightElbow: { x: 0.36, y: 0.48, z: 0.02 },
  },

  // O: All fingers and thumb curved touching at tips in an 'O' circle
  O: {
    bothHands: false,
    left:  { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 85, thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'loop_index' },
    leftWrist:  { x: 0.60, y: 0.60, z: -0.02 },
    rightWrist: { x: 0.47, y: 0.41, z: -0.04 },
  },

  // P: Left index upright (stem), Right thumb and index form circle touching top of left index ('p')
  P: {
    bothHands: true,
    left:  { groundAngle: 90, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 75, thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'loop_index' },
    leftWrist:  { x: 0.53, y: 0.44, z: -0.03 },
    rightWrist: { x: 0.45, y: 0.37, z: -0.03 },
    leftElbow:  { x: 0.64, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.46, z: 0.02 },
  },

  // Q: Right hand forms 'O' circle, Left index touches bottom of circle ('q')
  Q: {
    bothHands: true,
    left:  { groundAngle: 75, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 80, thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'loop_index' },
    leftWrist:  { x: 0.50, y: 0.46, z: -0.03 },
    rightWrist: { x: 0.48, y: 0.39, z: -0.03 },
    leftElbow:  { x: 0.64, y: 0.49, z: 0.02 },
    rightElbow: { x: 0.36, y: 0.46, z: 0.02 },
  },

  // R: Left hand flat horizontal, Right index hooks over left hand edge
  R: {
    bothHands: true,
    left:  { groundAngle: 10, thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, thumbMode: 'flat_hand' },
    right: { groundAngle: 75, thumb: 0, index: 0.65, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.53, y: 0.43, z: -0.02 },
    rightWrist: { x: 0.47, y: 0.39, z: -0.04 }, // Hooked over top edge
    leftElbow:  { x: 0.64, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.36, y: 0.47, z: 0.02 },
  },

  // S: Both hands closed fists, with pinkies interlocked
  S: {
    bothHands: true,
    left:  { groundAngle: 85, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 1, thumbMode: 'fist', isInterlockedPinky: true },
    right: { groundAngle: 85, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 1, thumbMode: 'fist', isInterlockedPinky: true },
    leftWrist:  { x: 0.53, y: 0.43, z: -0.02 },
    rightWrist: { x: 0.47, y: 0.43, z: -0.04 },
    leftElbow:  { x: 0.65, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.48, z: 0.02 },
  },

  // T: Left index points straight UP (stem), Right index horizontal resting ON TOP of it (crossbar 'T')
  T: {
    bothHands: true,
    left:  { groundAngle: 90, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 10, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.52, y: 0.44, z: -0.03 }, // Stem pointing straight up
    rightWrist: { x: 0.44, y: 0.36, z: -0.03 }, // Crossbar resting horizontally right on top of stem
    leftElbow:  { x: 0.64, y: 0.47, z: 0.02 },
    rightElbow: { x: 0.33, y: 0.45, z: 0.02 },
  },

  // U: Fist with INDEX and PINKY both pointing straight UP (two vertical prongs of 'U')
  U: {
    bothHands: false,
    left:  { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 90, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 1, thumbMode: 'fist' },
    leftWrist:  { x: 0.60, y: 0.60, z: -0.02 },
    rightWrist: { x: 0.46, y: 0.41, z: -0.04 },
  },

  // V: Fist with INDEX and MIDDLE fingers extended in upright 'V' victory sign (with natural finger splay)
  V: {
    bothHands: false,
    left:  { groundAngle: 90, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 90, thumb: 0, index: 1, middle: 1, ring: 0, pinky: 0, thumbMode: 'fist', isVSign: true },
    leftWrist:  { x: 0.60, y: 0.60, z: -0.02 },
    rightWrist: { x: 0.46, y: 0.41, z: -0.04 },
  },

  // W: Both hands upright with fingers spread and interlaced forming 3 peaks of 'W'
  W: {
    bothHands: true,
    left:  { groundAngle: 85, thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, thumbMode: 'spread' },
    right: { groundAngle: 85, thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, thumbMode: 'spread' },
    leftWrist:  { x: 0.53, y: 0.43, z: -0.03 },
    rightWrist: { x: 0.47, y: 0.43, z: -0.03 },
    leftElbow:  { x: 0.65, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.48, z: 0.02 },
  },

  // X: Both index fingers extended and crossed over each other ('X')
  X: {
    bothHands: true,
    left:  { groundAngle: 65, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 45, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.53, y: 0.43, z: -0.02 },
    rightWrist: { x: 0.47, y: 0.43, z: -0.04 }, // In front in Z so index fingers cross cleanly
    leftElbow:  { x: 0.64, y: 0.47, z: 0.02 },
    rightElbow: { x: 0.36, y: 0.47, z: 0.02 },
  },

  // Y: Left index upright, Right hand forms 'V' touching left index ('Y')
  Y: {
    bothHands: true,
    left:  { groundAngle: 90, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    right: { groundAngle: 60, thumb: 0, index: 1, middle: 1, ring: 0, pinky: 0, thumbMode: 'fist', isVSign: true },
    leftWrist:  { x: 0.53, y: 0.44, z: -0.02 },
    rightWrist: { x: 0.46, y: 0.41, z: -0.04 },
    leftElbow:  { x: 0.64, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.47, z: 0.02 },
  },

  // Z: Left hand flat angled palm, Right hand index traces 'Z' zigzag across it
  Z: {
    bothHands: true,
    left:  { groundAngle: 80, thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, thumbMode: 'flat_hand' },
    right: { groundAngle: 40, thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, thumbMode: 'fist' },
    leftWrist:  { x: 0.53, y: 0.43, z: -0.02 },
    rightWrist: { x: 0.45, y: 0.42, z: -0.04 },
    leftElbow:  { x: 0.64, y: 0.48, z: 0.02 },
    rightElbow: { x: 0.35, y: 0.47, z: 0.02 },
    motionTrajectory: [
      { x:  0.000, y:  0.000, z: 0 },
      { x:  0.015, y: -0.008, z: 0 },
      { x: -0.015, y: -0.018, z: 0 },
      { x:  0.015, y: -0.024, z: 0 },
    ],
  },
};

// ─── Procedural Hand Geometry Builder ────────────────────────────────────────
// Builds 21 MediaPipe hand landmarks with authentic anatomical spatial alignment.
function buildHandLandmarks(
  spec: HandPoseSpec,
  wrist: Landmark3D,
  isLeftHand: boolean,
  motionOffset = { x: 0, y: 0, z: 0 }
): Landmark3D[] {
  const joints: Landmark3D[] = new Array(21);

  const wX = wrist.x + motionOffset.x;
  const wY = wrist.y + motionOffset.y;
  const wZ = wrist.z + motionOffset.z;

  joints[0] = { x: wX, y: wY, z: wZ };

  // Calculate pointing orientation from groundAngle:
  // 90 deg = vertical UPWARD (-Y in MediaPipe screen space)
  // 0 deg = horizontal INWARD across chest (+X for right hand, -X for left hand)
  const angleRad = ((spec.groundAngle || 90) * Math.PI) / 180;
  const rawDirX = Math.cos(angleRad) * (isLeftHand ? -1 : 1);
  const rawDirY = -Math.sin(angleRad); // -Y is UPWARD
  const dirLen = Math.hypot(rawDirX, rawDirY) || 1;
  const dX = rawDirX / dirLen;
  const dY = rawDirY / dirLen;

  // Medial direction (perpendicular to pointing direction, pointing toward body center / thumb side):
  // When pointing UP (dX=0, dY=-1):
  // For Right Hand: Medial is +X (viewer's right)
  // For Left Hand: Medial is -X (viewer's left)
  const medX = -dY * (isLeftHand ? -1 : 1);
  const medY = dX * (isLeftHand ? -1 : 1);

  // Lateral direction (pointing away from body center, towards pinky side)
  const latX = -medX;
  const latY = -medY;

  // Normal vector facing viewer (toward camera = -Z)
  const normZ = -1.0;

  // Palm knuckle (MCP) placements relative to wrist
  const palmScale = 0.038;
  const knuckles = [
    { len: palmScale * 0.42, med: 0.016,  lat: 0 },      // Thumb CMC [1]
    { len: palmScale * 0.95, med: 0.009,  lat: 0 },      // Index MCP  [5]
    { len: palmScale * 1.00, med: 0.000,  lat: 0 },      // Middle MCP [9]
    { len: palmScale * 0.92, med: 0,      lat: 0.009 },  // Ring MCP   [13]
    { len: palmScale * 0.82, med: 0,      lat: 0.018 },  // Pinky MCP  [17]
  ];

  // Finger segment lengths: [MCP→PIP, PIP→DIP, DIP→Tip]
  const fingerLens = [
    [0.034, 0.024, 0.018], // Index
    [0.038, 0.026, 0.020], // Middle
    [0.034, 0.022, 0.018], // Ring
    [0.026, 0.018, 0.014], // Pinky
  ];

  // Knuckle MCP positions
  const getMCP = (k: typeof knuckles[0]): Landmark3D => {
    const latOffset = (k.med ? medX * k.med : 0) + (k.lat ? latX * k.lat : 0);
    const latOffsetY = (k.med ? medY * k.med : 0) + (k.lat ? latY * k.lat : 0);
    return {
      x: wX + dX * k.len + latOffset,
      y: wY + dY * k.len + latOffsetY,
      z: wZ + normZ * 0.004,
    };
  };

  // Construct each four-joint finger (MCP -> PIP -> DIP -> Tip)
  const buildFinger = (baseIdx: number, k: typeof knuckles[0], ext: number, segs: number[]) => {
    const mcp = getMCP(k);
    joints[baseIdx] = mcp;

    const curl = 1.0 - Math.min(1.0, Math.max(0.0, ext));

    if (spec.isCurvedC) {
      // Smooth C-curve arc
      const arc0 = 0.7;
      const arc1 = 0.5;
      const arc2 = 0.3;
      joints[baseIdx + 1] = {
        x: mcp.x + dX * segs[0] * arc0,
        y: mcp.y + dY * segs[0] * arc0,
        z: mcp.z + normZ * (segs[0] * 0.4),
      };
      joints[baseIdx + 2] = {
        x: joints[baseIdx + 1].x + dX * segs[1] * arc1,
        y: joints[baseIdx + 1].y + dY * segs[1] * arc1,
        z: joints[baseIdx + 1].z + normZ * (segs[1] * 0.5),
      };
      joints[baseIdx + 3] = {
        x: joints[baseIdx + 2].x + dX * segs[2] * arc2,
        y: joints[baseIdx + 2].y + dY * segs[2] * arc2,
        z: joints[baseIdx + 2].z + normZ * (segs[2] * 0.4),
      };
      return;
    }

    if (baseIdx === 5 && spec.thumbMode === 'loop_index') {
      // Arched index finger loop forming upper half of the circular ring
      const pip: Landmark3D = {
        x: mcp.x + dX * segs[0] * 0.85 + latX * 0.006,
        y: mcp.y + dY * segs[0] * 0.85 + latY * 0.006,
        z: mcp.z + normZ * 0.006,
      };
      joints[baseIdx + 1] = pip;

      const dip: Landmark3D = {
        x: pip.x + dX * segs[1] * 0.35 + medX * 0.018,
        y: pip.y + dY * segs[1] * 0.35 + medY * 0.018,
        z: pip.z + normZ * 0.008,
      };
      joints[baseIdx + 2] = dip;

      const tip: Landmark3D = {
        x: dip.x - dX * segs[2] * 0.20 + medX * 0.016,
        y: dip.y - dY * segs[2] * 0.20 + medY * 0.016,
        z: dip.z + normZ * 0.004,
      };
      joints[baseIdx + 3] = tip;
      return;
    }

    // Calculate anatomical lateral splay for this specific finger
    let fingerFan = 0; // negative = medial (toward body center), positive = lateral (away from body)
    if (spec.isVSign) {
      if (baseIdx === 5) fingerFan = -0.22; // Index splays medially
      if (baseIdx === 9) fingerFan = 0.22;  // Middle splays laterally
    } else if (spec.thumbMode === 'spread') {
      // Natural fan spread for W / open hand
      if (baseIdx === 5) fingerFan = -0.16; // Index medially
      if (baseIdx === 9) fingerFan = 0.00;  // Middle stays centered
      if (baseIdx === 13) fingerFan = 0.16; // Ring laterally
      if (baseIdx === 17) fingerFan = 0.32; // Pinky fans outward
    } else if (spec.isInterlockedPinky && baseIdx === 17) {
      fingerFan = -0.32; // Pinky curves medially to interlock
    }

    const fanVecX = fingerFan > 0 ? latX * fingerFan : medX * -fingerFan;
    const fanVecY = fingerFan > 0 ? latY * fingerFan : medY * -fingerFan;
    const fDirX = dX + fanVecX;
    const fDirY = dY + fanVecY;
    const fLen = Math.hypot(fDirX, fDirY) || 1;
    const fdX = fDirX / fLen;
    const fdY = fDirY / fLen;

    // Standard finger: extends along fdX, fdY when ext=1, folds tightly into fist when curl=1
    const pip: Landmark3D = {
      x: mcp.x + fdX * segs[0] * (ext * 0.98 + curl * 0.25),
      y: mcp.y + fdY * segs[0] * (ext * 0.98 + curl * 0.25),
      z: mcp.z + normZ * (curl * 0.022 - ext * 0.004),
    };
    joints[baseIdx + 1] = pip;

    const dip: Landmark3D = {
      x: pip.x + fdX * segs[1] * (ext * 0.98 - curl * 0.45),
      y: pip.y + fdY * segs[1] * (ext * 0.98 - curl * 0.45),
      z: pip.z + normZ * (curl * 0.016 - ext * 0.003),
    };
    joints[baseIdx + 2] = dip;

    const tip: Landmark3D = {
      x: dip.x + fdX * segs[2] * (ext * 0.98 - curl * 0.50),
      y: dip.y + fdY * segs[2] * (ext * 0.98 - curl * 0.50),
      z: dip.z - normZ * (curl * 0.012),
    };
    joints[baseIdx + 3] = tip;
  };

  buildFinger(5,  knuckles[1], spec.index,  fingerLens[0]);
  buildFinger(9,  knuckles[2], spec.middle, fingerLens[1]);
  buildFinger(13, knuckles[3], spec.ring,   fingerLens[2]);
  buildFinger(17, knuckles[4], spec.pinky,  fingerLens[3]);

  // Thumb: CMC [1] -> MCP [2] -> IP [3] -> Tip [4]
  const cmc = getMCP(knuckles[0]);
  joints[1] = cmc;

  const mode = spec.thumbMode || (spec.thumb > 0.5 ? 'horizontal_bar' : 'fist');

  if (mode === 'horizontal_bar') {
    // Pure horizontal L-bar extending perpendicular to index
    joints[2] = {
      x: cmc.x + medX * 0.018 + dX * 0.004,
      y: cmc.y + medY * 0.018 + dY * 0.004,
      z: cmc.z - 0.004,
    };
    joints[3] = {
      x: joints[2].x + medX * 0.020,
      y: joints[2].y + medY * 0.020,
      z: joints[2].z - 0.004,
    };
    joints[4] = {
      x: joints[3].x + medX * 0.018,
      y: joints[3].y + medY * 0.018,
      z: joints[3].z - 0.004,
    };
  } else if (mode === 'loop_index') {
    // Thumb curves upward to meet index tip forming lower half of circular ring
    const indexTip = joints[8] || joints[5];
    joints[2] = {
      x: cmc.x + medX * 0.018 - dX * 0.004,
      y: cmc.y + medY * 0.018 - dY * 0.004,
      z: cmc.z + normZ * 0.006,
    };
    joints[3] = {
      x: joints[2].x + medX * 0.014 + dX * 0.014,
      y: joints[2].y + medY * 0.014 + dY * 0.014,
      z: cmc.z + normZ * 0.008,
    };
    joints[4] = {
      x: indexTip.x,
      y: indexTip.y,
      z: indexTip.z,
    };
  } else if (mode === 'curve_c') {
    // Smooth C curve
    joints[2] = {
      x: cmc.x + medX * 0.018 - dX * 0.006,
      y: cmc.y + medY * 0.018 - dY * 0.006,
      z: cmc.z + normZ * 0.010,
    };
    joints[3] = {
      x: joints[2].x + medX * 0.014 + dX * 0.006,
      y: joints[2].y + medY * 0.014 + dY * 0.006,
      z: joints[2].z + normZ * 0.015,
    };
    joints[4] = {
      x: joints[3].x + medX * 0.008 + dX * 0.010,
      y: joints[3].y + medY * 0.008 + dY * 0.010,
      z: joints[3].z + normZ * 0.012,
    };
  } else if (mode === 'flat_hand') {
    // Thumb lies neatly alongside the palm and index finger
    joints[2] = {
      x: cmc.x + dX * 0.016 + medX * 0.006,
      y: cmc.y + dY * 0.016 + medY * 0.006,
      z: cmc.z - 0.002,
    };
    joints[3] = {
      x: joints[2].x + dX * 0.018 + medX * 0.004,
      y: joints[2].y + dY * 0.018 + medY * 0.004,
      z: joints[2].z - 0.002,
    };
    joints[4] = {
      x: joints[3].x + dX * 0.016 + medX * 0.002,
      y: joints[3].y + dY * 0.016 + medY * 0.002,
      z: joints[3].z - 0.002,
    };
  } else if (mode === 'spread') {
    // Open flat spread: thumb extends at a natural 30-degree angle from the index finger
    const spreadX = dX * 0.75 + medX * 0.65;
    const spreadY = dY * 0.75 + medY * 0.65;
    const sLen = Math.hypot(spreadX, spreadY) || 1;
    const sDirX = spreadX / sLen;
    const sDirY = spreadY / sLen;

    joints[2] = {
      x: cmc.x + sDirX * 0.018,
      y: cmc.y + sDirY * 0.018,
      z: cmc.z - 0.003,
    };
    joints[3] = {
      x: joints[2].x + sDirX * 0.018,
      y: joints[2].y + sDirY * 0.018,
      z: joints[2].z - 0.003,
    };
    joints[4] = {
      x: joints[3].x + sDirX * 0.016,
      y: joints[3].y + sDirY * 0.016,
      z: joints[3].z - 0.003,
    };
  } else {
    // Clenched fist: Thumb folds across front of curled fingers
    joints[2] = {
      x: cmc.x + medX * 0.010 + dX * 0.010,
      y: cmc.y + medY * 0.010 + dY * 0.010,
      z: cmc.z + normZ * 0.012,
    };
    joints[3] = {
      x: joints[2].x + latX * 0.010 + dX * 0.008,
      y: joints[2].y + latY * 0.010 + dY * 0.008,
      z: joints[2].z + normZ * 0.014,
    };
    joints[4] = {
      x: joints[3].x + latX * 0.012,
      y: joints[3].y + latY * 0.012,
      z: joints[3].z + normZ * 0.008,
    };
  }

  return joints;
}

// ─── Authentic ISL Letter Educational Descriptions ───────────────────────────
export interface ISLLetterDescription {
  letter: string;
  name: string;
  handshape: string;
  notes: string;
  twoHanded: boolean;
}

export const ISL_LETTER_DESCRIPTIONS: Record<string, ISLLetterDescription> = {
  A: {
    letter: 'A',
    name: 'Letter A',
    handshape: 'Two closed fists with index fingers extended up and touching at tips in a tent (/\\)',
    notes: 'Symmetrical tent apex; index tips touch at midline of chest.',
    twoHanded: true,
  },
  B: {
    letter: 'B',
    name: 'Letter B',
    handshape: 'Thumbs and index fingers form two circular loops touching side-by-side (eyeglasses / figure-8)',
    notes: 'Both hands form round rings touching at the center; other fingers folded into palm.',
    twoHanded: true,
  },
  C: {
    letter: 'C',
    name: 'Letter C',
    handshape: 'Dominant right hand curved in a smooth circular "C" arc facing the viewer',
    notes: 'Single hand; fingers and thumb form open C profile facing forward.',
    twoHanded: false,
  },
  D: {
    letter: 'D',
    name: 'Letter D',
    handshape: 'Left index upright stem; Right hand forms circular loop touching the stem (lowercase d)',
    notes: 'Left hand provides vertical stem; right hand forms round bowl.',
    twoHanded: true,
  },
  E: {
    letter: 'E',
    name: 'Letter E',
    handshape: 'Left index points up at an angle; Right index finger touches it (arrowhead shape)',
    notes: 'Index finger to index finger contact at upper quadrant.',
    twoHanded: true,
  },
  F: {
    letter: 'F',
    name: 'Letter F',
    handshape: 'Both hands extend index and middle fingers, crossing over each other (# / X)',
    notes: 'Dominant hand crosses in front of non-dominant fingers.',
    twoHanded: true,
  },
  G: {
    letter: 'G',
    name: 'Letter G',
    handshape: 'Two closed fists stacked vertically (Dominant right fist directly on top of left fist)',
    notes: 'Right fist rests directly on top of left fist at center chest.',
    twoHanded: true,
  },
  H: {
    letter: 'H',
    name: 'Letter H',
    handshape: 'Flat right palm sweeps horizontally across flat vertical left palm',
    notes: 'Right hand strokes smoothly across left open palm with thumb aligned.',
    twoHanded: true,
  },
  I: {
    letter: 'I',
    name: 'Letter I',
    handshape: 'Closed fist with PINKY finger extended straight UP',
    notes: 'Single hand; thumb folded across front of clenched fingers.',
    twoHanded: false,
  },
  J: {
    letter: 'J',
    name: 'Letter J',
    handshape: 'Index finger traces a dynamic "J" hook trajectory downward and curving up',
    notes: 'Traces the letter J curve in the air.',
    twoHanded: false,
  },
  K: {
    letter: 'K',
    name: 'Letter K',
    handshape: 'Left index upright stem; Right index touches its midpoint at an angle',
    notes: 'Forms the branching diagonal arm of letter K.',
    twoHanded: true,
  },
  L: {
    letter: 'L',
    name: 'Letter L',
    handshape: 'Index finger straight UP; Thumb extended horizontally at 90° (clean right-angle L)',
    notes: 'Single hand facing camera forming letter L.',
    twoHanded: false,
  },
  M: {
    letter: 'M',
    name: 'Letter M',
    handshape: 'Left hand 3 horizontal fingers (index, middle, ring); Right index touches underneath',
    notes: 'Represents the three downward vertical strokes of letter M.',
    twoHanded: true,
  },
  N: {
    letter: 'N',
    name: 'Letter N',
    handshape: 'Left hand 2 horizontal fingers (index, middle); Right index touches underneath',
    notes: 'Represents the two downward vertical strokes of letter N.',
    twoHanded: true,
  },
  O: {
    letter: 'O',
    name: 'Letter O',
    handshape: 'Thumb and fingers curved meeting at tips to form an "O" circle facing viewer',
    notes: 'Single hand forming open circular aperture.',
    twoHanded: false,
  },
  P: {
    letter: 'P',
    name: 'Letter P',
    handshape: 'Left index upright stem; Right thumb and index form loop touching top of stem',
    notes: 'Forms lowercase letter p.',
    twoHanded: true,
  },
  Q: {
    letter: 'Q',
    name: 'Letter Q',
    handshape: 'Right hand forms O circle; Left index touches bottom of circle (lowercase q)',
    notes: 'Forms lowercase letter q.',
    twoHanded: true,
  },
  R: {
    letter: 'R',
    name: 'Letter R',
    handshape: 'Left hand flat horizontal; Right index finger hooks over the top edge',
    notes: 'Right hooked finger over horizontal left palm.',
    twoHanded: true,
  },
  S: {
    letter: 'S',
    name: 'Letter S',
    handshape: 'Both hands closed fists with pinky fingers interlocked at center',
    notes: 'Interlocked pinky hooks between fists.',
    twoHanded: true,
  },
  T: {
    letter: 'T',
    name: 'Letter T',
    handshape: 'Left index points straight UP; Right index horizontal resting ON TOP as crossbar',
    notes: 'Forms clear capital T crossbar.',
    twoHanded: true,
  },
  U: {
    letter: 'U',
    name: 'Letter U',
    handshape: 'Fist with INDEX and PINKY both pointing straight UP (two vertical prongs of U)',
    notes: 'Horns / U configuration with middle and ring fingers curled into palm.',
    twoHanded: false,
  },
  V: {
    letter: 'V',
    name: 'Letter V',
    handshape: 'Fist with INDEX and MIDDLE fingers extended in upright "V" victory sign',
    notes: 'Classic victory / peace V handshape.',
    twoHanded: false,
  },
  W: {
    letter: 'W',
    name: 'Letter W',
    handshape: 'Both hands upright with fingers spread (trident / 3 peaks of W)',
    notes: 'Symmetrical open spread hands forming letter W.',
    twoHanded: true,
  },
  X: {
    letter: 'X',
    name: 'Letter X',
    handshape: 'Both index fingers extended and crossing each other in the center (X)',
    notes: 'Crossed index finger intersection.',
    twoHanded: true,
  },
  Y: {
    letter: 'Y',
    name: 'Letter Y',
    handshape: 'Left index upright stem; Right hand forms V sign touching top of left index',
    notes: 'Forms branching letter Y.',
    twoHanded: true,
  },
  Z: {
    letter: 'Z',
    name: 'Letter Z',
    handshape: 'Left hand flat angled palm; Right index traces "Z" zigzag path across it',
    notes: 'Dynamic zigzag path traced on left palm.',
    twoHanded: true,
  },
};

// ─── Frame Generator ─────────────────────────────────────────────────────────
export function generateFingerspellFrames(letterChar: string, totalFrames = 26): FrameLandmarks[] {
  const char = (letterChar || 'A').toUpperCase().charAt(0);
  const config = ISL_LETTER_CONFIGS[char] || ISL_LETTER_CONFIGS['A'];

  // Base signing posture (MediaPipe Holistic 33 pose landmarks)
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

  // 1. Position Right Arm & Wrist
  const defaultRightWrist: Landmark3D = { ...config.rightWrist };
  const defaultRightElbow: Landmark3D = config.rightElbow
    ? { ...config.rightElbow }
    : { x: 0.34, y: 0.46, z: 0.02 };
  basePose[14] = defaultRightElbow;
  basePose[16] = defaultRightWrist;

  // 2. Position Left Arm & Wrist
  let defaultLeftWrist: Landmark3D;
  let defaultLeftElbow: Landmark3D;
  if (config.bothHands) {
    defaultLeftWrist = { ...config.leftWrist };
    defaultLeftElbow = config.leftElbow
      ? { ...config.leftElbow }
      : { x: 0.64, y: 0.46, z: 0.02 };
    basePose[13] = defaultLeftElbow;
    basePose[15] = defaultLeftWrist;
  } else {
    defaultLeftWrist = { x: 0.60, y: 0.60, z: -0.02 }; // Resting at hip
    defaultLeftElbow = { x: 0.66, y: 0.48, z: 0.02 };
    basePose[13] = defaultLeftElbow;
    basePose[15] = defaultLeftWrist;
  }

  const frames: FrameLandmarks[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const progress = f / Math.max(totalFrames - 1, 1);

    // 3-Phase Cinematic Signing Envelope:
    // Phase 1 (0 to 16%): Smooth natural ease-in from anticipation posture
    // Phase 2 (16% to 88%): Stable ground-truth ISL presentation with micro-sway and stroke execution
    // Phase 3 (88% to 100%): Clean hold / bridge settle
    let easeIn = 1.0;
    if (progress < 0.16) {
      const tIn = progress / 0.16;
      easeIn = tIn * tIn * (3 - 2 * tIn); // smoothstep
    }
    // Gentle natural anticipation rise of hands into sign posture
    const entryOffsetY = (1.0 - easeIn) * 0.016;

    // Organic micro-breathing sway (alive human presence, not static mannequin)
    const pulse = Math.sin(progress * Math.PI) * 0.0025;

    let motionOffsetR = { x: 0, y: entryOffsetY + pulse, z: 0 };
    if (config.motionTrajectory && config.motionTrajectory.length > 0) {
      const traj = config.motionTrajectory;
      // Map active stroke window between 18% and 85% of total duration
      let strokeProgress = 0;
      if (progress > 0.85) {
        strokeProgress = 1.0;
      } else if (progress > 0.18) {
        const rawT = (progress - 0.18) / (0.85 - 0.18);
        strokeProgress = rawT * rawT * (3 - 2 * rawT); // smooth cubic stroke speed
      }
      const rawIdx = strokeProgress * (traj.length - 1);
      const idx0 = Math.min(Math.floor(rawIdx), traj.length - 2);
      const t = rawIdx - idx0;
      motionOffsetR = {
        x: lerp(traj[idx0].x, traj[idx0 + 1].x, t),
        y: lerp(traj[idx0].y, traj[idx0 + 1].y, t) + entryOffsetY + pulse,
        z: lerp(traj[idx0].z, traj[idx0 + 1].z, t),
      };
    }

    const framePose: Landmark3D[] = basePose.map(p => ({ ...p }));
    framePose[16] = {
      x: defaultRightWrist.x + motionOffsetR.x,
      y: defaultRightWrist.y + motionOffsetR.y,
      z: defaultRightWrist.z + motionOffsetR.z,
    };

    if (config.bothHands) {
      framePose[15] = {
        x: defaultLeftWrist.x,
        y: defaultLeftWrist.y + entryOffsetY + pulse * 0.5,
        z: defaultLeftWrist.z,
      };
    }

    // Build Right Hand Landmarks
    const rightHand = buildHandLandmarks(config.right, {
      x: defaultRightWrist.x + motionOffsetR.x,
      y: defaultRightWrist.y + motionOffsetR.y,
      z: defaultRightWrist.z + motionOffsetR.z,
    }, false);

    // Build Left Hand Landmarks
    let leftHand: Landmark3D[];
    if (config.bothHands) {
      leftHand = buildHandLandmarks(config.left, {
        x: defaultLeftWrist.x,
        y: defaultLeftWrist.y + entryOffsetY + pulse * 0.5,
        z: defaultLeftWrist.z,
      }, true);
    } else {
      // Natural resting hand at hip
      leftHand = Array.from({ length: 21 }, (_, i) => ({
        x: defaultLeftWrist.x + (i === 0 ? 0 : ((i % 5) - 2) * 0.007),
        y: defaultLeftWrist.y + (i === 0 ? 0 : Math.floor(i / 5) * 0.009),
        z: defaultLeftWrist.z,
      }));
    }

    frames.push({
      poseLandmarks: framePose,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      faceLandmarks: null,
    });
  }

  return frames;
}
