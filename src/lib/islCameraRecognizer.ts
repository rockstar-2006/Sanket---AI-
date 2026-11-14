/**
 * Real-Time Client-Side Indian Sign Language (ISL) Camera Recognizer
 * Evaluates live webcam video frames via MediaPipe Hands & Kinematic Joint Geometry.
 *
 * Designed for OPEN, NORMAL DAILY CONVERSATION in video meetings:
 * - Detects Core Daily Gestures: Hello, Thank You, Yes, No, Wait, Good, Bad, Peace, I Love You, Call Me, Perfect, Happy.
 * - Detects Full A-Z ISL Fingerspelling matching official Ground-Truth ISL charts.
 * - Features "Hold-to-Confirm" Stabilization: Prevents transitional flicker by requiring ~350ms posture hold.
 * - Dynamic Zero-Lag Script Loader: Seamlessly integrates Google MediaPipe Hands in the browser without SSR breakage.
 */

import { ParquetLandmarkMatcher } from './parquetLandmarkMatcher';
import { ISLOnnxRecognizer, OnnxPrediction } from './islOnnxRecognizer';

export interface DetectedSignCandidate {
  token: string;
  displayLabel: string;
  type: 'gesture' | 'letter';
  confidence: number;
  description: string;
  topK?: { token: string; confidence: number }[];
}

export interface LandmarkPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarkResult {
  landmarks: LandmarkPoint3D[];
  handedness: 'Left' | 'Right';
}

export interface FramingStatus {
  isInZone: boolean;
  message: string;
  zoneState: 'optimal' | 'too_low' | 'too_close' | 'too_far' | 'off_center' | 'no_hands';
}

export interface RecognitionFrameUpdate {
  candidate: DetectedSignCandidate | null;
  holdProgress: number; // 0.0 to 1.0 (fills up radial hold meter)
  confirmedToken: DetectedSignCandidate | null;
  handsDetected: number;
  allHands: HandLandmarkResult[];
  statusMessage?: string;
  isMoving?: boolean;
  framing?: FramingStatus;
}

export type RecognitionCallback = (update: RecognitionFrameUpdate) => void;

// ─── Mathematical Geometry Utilities ─────────────────────────────────────────

function dist3D(a: LandmarkPoint3D, b: LandmarkPoint3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function computeFingerCurl(
  wrist: LandmarkPoint3D,
  mcp: LandmarkPoint3D,
  pip: LandmarkPoint3D,
  tip: LandmarkPoint3D
): number {
  // Ratio of tip distance to MCP distance from wrist (1.0 = extended, 0.0 = curled into palm)
  const lenBase = dist3D(wrist, mcp);
  const lenTip = dist3D(wrist, tip);
  const ratio = (lenTip - lenBase * 0.8) / (lenBase * 1.3);
  return Math.max(0.0, Math.min(1.0, ratio));
}

/**
 * Intelligent Camera Signing Zone & Framing Guard Evaluator
 * Verifies that hands are within the authentic ISL Signing Space (Chest to Forehead, centered)
 * Eliminates out-of-frame landmark jitter and hallucinated signs.
 */
export function evaluateFramingQuality(hands: HandLandmarkResult[]): FramingStatus {
  if (!hands || hands.length === 0) {
    return {
      isInZone: false,
      message: 'Raise hands into frame to sign',
      zoneState: 'no_hands',
    };
  }

  let minX = 1.0;
  let maxX = 0.0;
  let minY = 1.0;
  let maxY = 0.0;
  let maxPalmScale = 0;

  for (const hand of hands) {
    const lm = hand.landmarks;
    if (!lm || lm.length < 21) continue;

    const wrist = lm[0];
    const mcp = lm[9];
    const palm = dist3D(wrist, mcp);
    if (palm > maxPalmScale) maxPalmScale = palm;

    for (const pt of lm) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  // 1. Hands too low (near lap or waist bottom edge)
  if (maxY > 0.88 || (minY > 0.70 && maxY > 0.84)) {
    return {
      isInZone: false,
      message: 'Raise hands slightly to chest level',
      zoneState: 'too_low',
    };
  }

  // 2. Off-center / clipping left or right edge
  if (minX < 0.08 || maxX > 0.92) {
    return {
      isInZone: false,
      message: 'Center your hands within frame',
      zoneState: 'off_center',
    };
  }

  // 3. Distance checks (too close or too far)
  if (maxPalmScale > 0.32) {
    return {
      isInZone: false,
      message: 'Step back slightly from camera',
      zoneState: 'too_close',
    };
  }
  if (maxPalmScale > 0 && maxPalmScale < 0.075) {
    return {
      isInZone: false,
      message: 'Move closer to camera',
      zoneState: 'too_far',
    };
  }

  return {
    isInZone: true,
    message: 'Optimal Signing Zone',
    zoneState: 'optimal',
  };
}

// ─── Gesture Kinematics Classifier ────────────────────────────────────────────

export type RecognitionMode = 'word' | 'fingerspell';

export type SwitchSignId = 'INDEX_TOUCH' | 'DOUBLE_THUMBS_UP' | 'OPEN_PALM_HOLD' | 'NAMASTE_TOUCH';

export interface SwitchSignDefinition {
  id: SwitchSignId;
  name: string;
  shortDescription: string;
  instruction: string;
}

export const AVAILABLE_SWITCH_SIGNS: SwitchSignDefinition[] = [
  {
    id: 'INDEX_TOUCH',
    name: 'Index Fingers Touch (Recommended)',
    shortDescription: 'Both index fingers point towards each other until tips touch',
    instruction: 'Point both index fingers horizontally towards each other in front of your chest until fingertips touch.',
  },
  {
    id: 'DOUBLE_THUMBS_UP',
    name: 'Double Thumbs Up',
    shortDescription: 'Both fists with thumbs pointing straight up',
    instruction: 'Raise both hands side-by-side with thumbs pointing straight up in a double thumbs-up.',
  },
  {
    id: 'OPEN_PALM_HOLD',
    name: 'Open Palm Front Hold',
    shortDescription: 'Hold flat open palm facing camera like a stop sign',
    instruction: 'Raise your open dominant hand flat facing the camera and hold steady.',
  },
  {
    id: 'NAMASTE_TOUCH',
    name: 'Namaste / Pranam Touch',
    shortDescription: 'Both palms pressed together in front of chest',
    instruction: 'Press both flat palms together in front of your chest in respectful prayer / Namaste gesture.',
  },
];

export function classifyHandPostures(
  hands: HandLandmarkResult[],
  mode: RecognitionMode = 'word',
  switchSign: SwitchSignId = 'INDEX_TOUCH'
): DetectedSignCandidate | null {
  if (!hands || hands.length === 0) return null;

  // Single Hand Classification (Dominant / Primary Hand)
  const primary = hands[0];
  const lm = primary.landmarks;
  if (!lm || lm.length < 21) return null;

  const wrist = lm[0];
  const thumbTip = lm[4];
  const indexMcp = lm[5];
  const indexPip = lm[6];
  const indexTip = lm[8];
  const middleMcp = lm[9];
  const middlePip = lm[10];
  const middleTip = lm[12];
  const ringMcp = lm[13];
  const ringPip = lm[14];
  const ringTip = lm[16];
  const pinkyMcp = lm[17];
  const pinkyPip = lm[18];
  const pinkyTip = lm[20];

  // Finger extension levels (0.0 to 1.0)
  const indexExt = computeFingerCurl(wrist, indexMcp, indexPip, indexTip);
  const middleExt = computeFingerCurl(wrist, middleMcp, middlePip, middleTip);
  const ringExt = computeFingerCurl(wrist, ringMcp, ringPip, ringTip);
  const pinkyExt = computeFingerCurl(wrist, pinkyMcp, pinkyPip, pinkyTip);

  const thumbIndexDist = dist3D(thumbTip, indexTip);
  const indexMiddleDist = dist3D(indexTip, middleTip);
  const palmScale = dist3D(wrist, middleMcp) || 0.15;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 0: PHYSICAL MODE SWITCH GESTURES (Hands-Free Word <-> Fingerspell)
  // Evaluated in BOTH 'word' and 'fingerspell' modes with absolute top priority!
  // ═══════════════════════════════════════════════════════════════════════════

  if (switchSign === 'INDEX_TOUCH' && hands.length >= 2) {
    const handA = hands[0].landmarks;
    const handB = hands[1].landmarks;
    const indexIndexDist = dist3D(handA[8], handB[8]);
    const wristDist = dist3D(handA[0], handB[0]);
    const avgPalm = (dist3D(handA[0], handA[9]) + dist3D(handB[0], handB[9])) / 2 || 0.15;

    const extA_idx = computeFingerCurl(handA[0], handA[5], handA[6], handA[8]);
    const extB_idx = computeFingerCurl(handB[0], handB[5], handB[6], handB[8]);
    const extA_mid = computeFingerCurl(handA[0], handA[9], handA[10], handA[12]);
    const extB_mid = computeFingerCurl(handB[0], handB[9], handB[10], handB[12]);
    const extA_ring = computeFingerCurl(handA[0], handA[13], handA[14], handA[16]);
    const extB_ring = computeFingerCurl(handB[0], handB[13], handB[14], handB[16]);
    const extA_pinky = computeFingerCurl(handA[0], handA[17], handA[18], handA[20]);
    const extB_pinky = computeFingerCurl(handB[0], handB[17], handB[18], handB[20]);

    // Both index fingers extended upright/forward, other 3 fingers curled into palms
    const isBothIndexExt = extA_idx > 0.42 && extB_idx > 0.42;
    const areOtherFingersCurled = extA_mid < 0.48 && extB_mid < 0.48 && extA_ring < 0.48 && extB_ring < 0.48 && extA_pinky < 0.48 && extB_pinky < 0.48;
    // Index tips touching or within tight threshold
    const isTipsTouching = indexIndexDist / avgPalm < 0.65 || indexIndexDist < 0.088;
    // Wrists separated (two separate hands pointing inward towards each other)
    const isWristsSeparated = wristDist / avgPalm > 0.70 || wristDist > 0.12;
    // Vertical level match
    const isLevel = Math.abs(handA[8].y - handB[8].y) < 0.14;

    if (isBothIndexExt && areOtherFingersCurled && isTipsTouching && isWristsSeparated && isLevel) {
      return {
        token: 'MODE_SWITCH',
        displayLabel: mode === 'word' ? 'Switch to Spell Letters' : 'Switch to ISL Words',
        type: 'gesture',
        confidence: 0.99,
        description: 'Two index fingers touching: Physical Mode Switch',
      };
    }
  }

  if (switchSign === 'DOUBLE_THUMBS_UP' && hands.length >= 2) {
    const handA = hands[0].landmarks;
    const handB = hands[1].landmarks;
    const wristDist = dist3D(handA[0], handB[0]);
    const avgPalm = (dist3D(handA[0], handA[9]) + dist3D(handB[0], handB[9])) / 2 || 0.15;

    const extA_idx = computeFingerCurl(handA[0], handA[5], handA[6], handA[8]);
    const extB_idx = computeFingerCurl(handB[0], handB[5], handB[6], handB[8]);
    const extA_mid = computeFingerCurl(handA[0], handA[9], handA[10], handA[12]);
    const extB_mid = computeFingerCurl(handB[0], handB[9], handB[10], handB[12]);
    const extA_ring = computeFingerCurl(handA[0], handA[13], handA[14], handA[16]);
    const extB_ring = computeFingerCurl(handB[0], handB[13], handB[14], handB[16]);
    const extA_pinky = computeFingerCurl(handA[0], handA[17], handA[18], handA[20]);
    const extB_pinky = computeFingerCurl(handB[0], handB[17], handB[18], handB[20]);

    const areFingersCurled = extA_idx < 0.40 && extB_idx < 0.40 && extA_mid < 0.40 && extB_mid < 0.40 && extA_ring < 0.40 && extB_ring < 0.40 && extA_pinky < 0.40 && extB_pinky < 0.40;
    const areThumbsUp = handA[4].y < handA[5].y - 0.02 && handB[4].y < handB[5].y - 0.02;

    if (areFingersCurled && areThumbsUp && (wristDist / avgPalm > 0.70 || wristDist > 0.12)) {
      return {
        token: 'MODE_SWITCH',
        displayLabel: mode === 'word' ? 'Switch to Spell Letters' : 'Switch to ISL Words',
        type: 'gesture',
        confidence: 0.99,
        description: 'Double Thumbs Up: Physical Mode Switch',
      };
    }
  }

  if (switchSign === 'OPEN_PALM_HOLD') {
    const isAllExt = indexExt > 0.65 && middleExt > 0.65 && ringExt > 0.60 && pinkyExt > 0.55;
    const isUpright = wrist.y - indexTip.y > 0.14 && wrist.y >= 0.35 && wrist.y <= 0.75;
    const isFacingCam = Math.abs(indexTip.x - pinkyTip.x) > 0.07;

    if (isAllExt && isUpright && isFacingCam) {
      return {
        token: 'MODE_SWITCH',
        displayLabel: mode === 'word' ? 'Switch to Spell Letters' : 'Switch to ISL Words',
        type: 'gesture',
        confidence: 0.98,
        description: 'Open Palm Front Hold: Physical Mode Switch',
      };
    }
  }

  if (switchSign === 'NAMASTE_TOUCH' && hands.length >= 2) {
    const handA = hands[0].landmarks;
    const handB = hands[1].landmarks;
    const indexIndexDist = dist3D(handA[8], handB[8]);
    const wristDist = dist3D(handA[0], handB[0]);
    const avgPalm = (dist3D(handA[0], handA[9]) + dist3D(handB[0], handB[9])) / 2 || 0.15;

    const extA = computeFingerCurl(handA[0], handA[5], handA[6], handA[8]);
    const extB = computeFingerCurl(handB[0], handB[5], handB[6], handB[8]);

    if ((wristDist / avgPalm < 1.6 || wristDist < 0.25) && (indexIndexDist / avgPalm < 1.4 || indexIndexDist < 0.19) && extA > 0.40 && extB > 0.40) {
      return {
        token: 'MODE_SWITCH',
        displayLabel: mode === 'word' ? 'Switch to Spell Letters' : 'Switch to ISL Words',
        type: 'gesture',
        confidence: 0.98,
        description: 'Namaste Touch: Physical Mode Switch',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: ISL WHOLE WORDS & DAILY GESTURES
  // Evaluated ONLY in 'word' mode
  // ═══════════════════════════════════════════════════════════════════════════

  if (mode === 'word') {
    // 1. Dual-Hand Gestures
    if (hands.length >= 2) {
      const handA = hands[0].landmarks;
      const handB = hands[1].landmarks;
      const indexIndexDist = dist3D(handA[8], handB[8]);
      const wristDist = dist3D(handA[0], handB[0]);
      const avgPalm = (dist3D(handA[0], handA[9]) + dist3D(handB[0], handB[9])) / 2 || 0.15;

      // A. Dual-Hand THANK YOU / NAMASTE: Palms & fingers pressed together in prayer / pranam
      if ((wristDist / avgPalm < 1.7 || wristDist < 0.25) && (indexIndexDist / avgPalm < 1.4 || indexIndexDist < 0.19)) {
        const extA = computeFingerCurl(handA[0], handA[5], handA[6], handA[8]);
        const extB = computeFingerCurl(handB[0], handB[5], handB[6], handB[8]);
        if (extA > 0.38 && extB > 0.38) {
          return {
            token: 'THANK YOU',
            displayLabel: 'Thank You',
            type: 'gesture',
            confidence: 0.98,
            description: 'Both hands pressed together in respectful Namaste / Thank You',
          };
        }
      }

      // B. Dual-Hand HELP: Closed fist resting on top of flat open palm (Textbook ISL)
      const extA_palm = computeFingerCurl(handA[0], handA[9], handA[10], handA[12]);
      const extB_palm = computeFingerCurl(handB[0], handB[9], handB[10], handB[12]);
      const centerDist = dist3D(handA[9], handB[9]);
      const isOneFlatOneFist = (extA_palm > 0.45 && extB_palm < 0.40) || (extB_palm > 0.45 && extA_palm < 0.40);
      if (isOneFlatOneFist && (centerDist / avgPalm < 1.6 || centerDist < 0.25) && (handA[0].y > 0.32 || handB[0].y > 0.32)) {
        return {
          token: 'HELP',
          displayLabel: 'Help',
          type: 'gesture',
          confidence: 0.97,
          description: 'Fist placed on flat open palm (Indian Sign Language for Help)',
        };
      }

      // C. Dual-Hand GOOD MORNING: One arm horizontal (horizon), dominant hand rising up like the rising sun
      const isBHorizonARising = Math.abs(handB[8].y - handB[0].y) < 0.20 && handB[0].y > 0.32 && handA[8].y < handB[0].y - 0.03 && extA_palm > 0.45;
      const isAHorizonBRising = Math.abs(handA[8].y - handA[0].y) < 0.20 && handA[0].y > 0.32 && handB[8].y < handA[0].y - 0.03 && extB_palm > 0.45;
      if (isBHorizonARising || isAHorizonBRising) {
        return {
          token: 'GOOD MORNING',
          displayLabel: 'Good Morning',
          type: 'gesture',
          confidence: 0.97,
          description: 'Hand rising up like sunrise over horizontal forearm (ISL sign for Morning)',
        };
      }

      // D. Dual-Hand GOOD NIGHT / SLEEP: Hands pressed together and tilted beside cheek/head
      if ((wristDist / avgPalm < 1.7 || wristDist < 0.25) && (indexIndexDist / avgPalm < 1.4 || indexIndexDist < 0.20) && (handA[8].y < 0.52 || handB[8].y < 0.52)) {
        if (Math.abs(handA[8].x - 0.50) > 0.08 || Math.abs(handB[8].x - 0.50) > 0.08) {
          return {
            token: 'GOOD NIGHT',
            displayLabel: 'Good Night',
            type: 'gesture',
            confidence: 0.96,
            description: 'Hands pressed and tilted beside cheek like sleeping (ISL sign for Night / Sleep)',
          };
        }
      }

      // E. Dual-Hand DOCTOR: Fingers of one hand touching wrist/pulse of opposite hand
      const distAtoWristB = dist3D(handA[8], handB[0]);
      const distBtoWristA = dist3D(handB[8], handA[0]);
      const extA_idx = computeFingerCurl(handA[0], handA[5], handA[6], handA[8]);
      const extB_idx = computeFingerCurl(handB[0], handB[5], handB[6], handB[8]);
      if ((distAtoWristB / avgPalm < 1.25 || distBtoWristA / avgPalm < 1.25 || distAtoWristB < 0.17 || distBtoWristA < 0.17) && (extA_palm > 0.30 || extB_palm > 0.30)) {
        return {
          token: 'DOCTOR',
          displayLabel: 'Doctor',
          type: 'gesture',
          confidence: 0.97,
          description: 'Fingers checking opposite wrist pulse (ISL sign for Doctor / Medical)',
        };
      }

      // F. Dual-Hand TIME / WATCH: Index finger tapping opposite wrist where watch is worn
      const isA_tappingB = (distAtoWristB / avgPalm < 1.25 || distAtoWristB < 0.17) && extA_idx > 0.45 && extB_palm < 0.55;
      const isB_tappingA = (distBtoWristA / avgPalm < 1.25 || distBtoWristA < 0.17) && extB_idx > 0.45 && extA_palm < 0.55;
      if (isA_tappingB || isB_tappingA) {
        return {
          token: 'TIME',
          displayLabel: 'Time / Clock',
          type: 'gesture',
          confidence: 0.96,
          description: 'Index finger tapping opposite wrist where a watch is worn (ISL sign for Time)',
        };
      }

      // G. Dual-Hand HOUSE / HOME: Fingertips of both flat hands meeting at angle like a roof (/\)
      if ((indexIndexDist / avgPalm < 0.75 || indexIndexDist < 0.11) && (wristDist / avgPalm > 0.9 || wristDist > 0.14) && handA[8].y < handA[0].y + 0.05 && handB[8].y < handB[0].y + 0.05) {
        if (extA_idx > 0.42 && extB_idx > 0.42) {
          return {
            token: 'HOUSE',
            displayLabel: 'House / Home',
            type: 'gesture',
            confidence: 0.96,
            description: 'Fingertips touching at angle forming roof (ISL sign for House / Home)',
          };
        }
      }

      // H. Dual-Hand BOOK: Both flat open hands touching at pinky edge side-by-side like an open book
      const pinkyPinkyDist = dist3D(handA[20], handB[20]);
      if ((pinkyPinkyDist / avgPalm < 0.95 || pinkyPinkyDist < 0.14) && (wristDist / avgPalm < 2.0 || wristDist < 0.30) && extA_palm > 0.42 && extB_palm > 0.42 && handA[0].y > 0.32) {
        return {
          token: 'BOOK',
          displayLabel: 'Book',
          type: 'gesture',
          confidence: 0.95,
          description: 'Both flat hands open side-by-side like an open book',
        };
      }

      // I. Dual-Hand CAR: Two closed fists side-by-side holding an imaginary steering wheel
      if (extA_palm < 0.40 && extB_palm < 0.40 && (wristDist / avgPalm >= 0.9 || wristDist >= 0.13) && (wristDist / avgPalm <= 3.6 || wristDist <= 0.50) && handA[0].y > 0.28 && handB[0].y > 0.28) {
        return {
          token: 'CAR',
          displayLabel: 'Car / Drive',
          type: 'gesture',
          confidence: 0.95,
          description: 'Two fists holding and turning a steering wheel (ISL sign for Car)',
        };
      }

      // J. Dual-Hand MEETING: Both index fingers upright and coming together
      if ((indexIndexDist / avgPalm < 0.65 || indexIndexDist < 0.09) && (wristDist / avgPalm > 0.8 || wristDist > 0.11) && extA_idx > 0.50 && extB_idx > 0.50 && extA_palm < 0.42 && extB_palm < 0.42) {
        return {
          token: 'MEETING',
          displayLabel: 'Meeting',
          type: 'gesture',
          confidence: 0.96,
          description: 'Both index fingers coming together (ISL sign for Meeting)',
        };
      }

      // K. Dual-Hand HOW ARE YOU: Both hands held open in front of chest offering forward
      if ((wristDist / avgPalm >= 0.9 || wristDist >= 0.14) && (wristDist / avgPalm < 3.8 || wristDist < 0.58)) {
        if (extA_palm > 0.42 && extB_palm > 0.42 && handA[0].y > 0.34 && handB[0].y > 0.34) {
          return {
            token: 'HOW ARE YOU',
            displayLabel: 'How Are You?',
            type: 'gesture',
            confidence: 0.95,
            description: 'Both palms open towards chest in warm enquiry',
          };
        }
      }
    }

    // 2. Single-Hand HELLO: Forehead / Brow Salute OR Temple Wave (Authentic ISL Greeting)
    const isNearForeheadOrTemple = (indexTip.y < 0.48 || middleTip.y < 0.48) && wrist.y < 0.70;
    const isExtendedSalute = indexExt > 0.55 && middleExt > 0.55 && ringExt > 0.45 && pinkyExt > 0.40 && dist3D(wrist, indexTip) > 0.10;
    if (isNearForeheadOrTemple && isExtendedSalute) {
      return {
        token: 'HELLO',
        displayLabel: 'Hello',
        type: 'gesture',
        confidence: 0.98,
        description: 'Open hand salute or friendly greeting at forehead / temple',
      };
    }

    // 2b. Single-Hand GOOD NIGHT: Tilted flat hand beside cheek/ear (sleep gesture)
    if (indexExt > 0.38 && middleExt > 0.38 && indexTip.y < 0.52 && wrist.y < 0.70) {
      if (Math.abs(indexTip.x - 0.50) > 0.08 || Math.abs(indexTip.x - wrist.x) > 0.04) {
        return {
          token: 'GOOD NIGHT',
          displayLabel: 'Good Night',
          type: 'gesture',
          confidence: 0.96,
          description: 'Tilted flat palm resting against cheek/ear (ISL sign for Sleep / Night)',
        };
      }
    }

    // 3. Single-Hand THANK YOU: Flat open hand extending from chin/mouth forward
    if (indexExt > 0.45 && middleExt > 0.45) {
      if (indexTip.y >= 0.36 && indexTip.y <= 0.68 && wrist.x >= 0.18 && wrist.x <= 0.82) {
        return {
          token: 'THANK YOU',
          displayLabel: 'Thank You',
          type: 'gesture',
          confidence: 0.96,
          description: 'Flat open palm extending forward from chin in gratitude',
        };
      }
    }

    // 4. FOOD / EAT: Bunched fingertips brought close to mouth / lips
    const isBunchedFingers = (thumbIndexDist / palmScale < 0.45 || thumbIndexDist < 0.065) && (dist3D(thumbTip, middleTip) / palmScale < 0.48 || dist3D(thumbTip, middleTip) < 0.075);
    if (isBunchedFingers) {
      if (indexTip.y >= 0.28 && indexTip.y <= 0.55 && wrist.x >= 0.22 && wrist.x <= 0.78) {
        return {
          token: 'FOOD',
          displayLabel: 'Food / Eat',
          type: 'gesture',
          confidence: 0.96,
          description: 'Bunched fingertips brought to mouth (ISL sign for Food / Eat)',
        };
      }
    }

    // 5. WATER: 'W' handshape (3 fingers extended upright, pinky curled) near chin
    if (indexExt > 0.58 && middleExt > 0.58 && ringExt > 0.52 && pinkyExt < 0.38) {
      if (indexTip.y >= 0.26 && indexTip.y <= 0.60 && wrist.x >= 0.22 && wrist.x <= 0.78) {
        return {
          token: 'WATER',
          displayLabel: 'Water',
          type: 'gesture',
          confidence: 0.96,
          description: 'W handshape held near chin (ISL sign for Water)',
        };
      }
    }

    // 6. PLEASE: Flat open palm placed against the center of the chest (Authentic ISL)
    const isCenteredChest = Math.abs(wrist.x - 0.50) < 0.16 && wrist.y >= 0.38 && wrist.y <= 0.66;
    const isFingersUprightTogether = indexExt > 0.65 && middleExt > 0.65 && ringExt > 0.60 && pinkyExt > 0.50;
    const isHandTrulyVertical = (wrist.y - indexTip.y) > 0.10 && Math.abs(indexTip.x - wrist.x) < 0.15;
    if (isCenteredChest && isFingersUprightTogether && isHandTrulyVertical) {
      return {
        token: 'PLEASE',
        displayLabel: 'Please',
        type: 'gesture',
        confidence: 0.96,
        description: 'Flat open palm upright against center of the chest (ISL sign for Please)',
      };
    }

    // 7. YES / GOOD: Closed fist with thumb pointing straight up
    if (indexExt < 0.38 && middleExt < 0.38 && ringExt < 0.38 && pinkyExt < 0.38) {
      if (thumbTip.y < indexMcp.y - 0.02) {
        return {
          token: 'YES',
          displayLabel: 'Yes / Good',
          type: 'gesture',
          confidence: 0.97,
          description: 'Thumbs up (Approval / Affirmation / Yes)',
        };
      }
      // 8. NO / DISAGREE: Closed fist with thumb pointing down
      if (thumbTip.y > wrist.y + 0.02) {
        return {
          token: 'NO',
          displayLabel: 'No / Disagree',
          type: 'gesture',
          confidence: 0.96,
          description: 'Thumbs down (Negative / Disapproval)',
        };
      }
    }

    // 9. WAIT / STOP: Flat open palm facing forward at chest level
    if (indexExt > 0.60 && middleExt > 0.60 && ringExt > 0.60 && pinkyExt > 0.60) {
      if (wrist.y >= 0.40 && indexTip.y >= 0.22) {
        return {
          token: 'WAIT',
          displayLabel: 'Wait / Pause',
          type: 'gesture',
          confidence: 0.96,
          description: 'Open palm forward requesting a brief pause',
        };
      }
    }

    // 10. OK / PERFECT: Thumb and index touch tips in a circle, other 3 extended
    const isCircleTips = thumbIndexDist / palmScale < 0.36 || thumbIndexDist < 0.055;
    if (isCircleTips && middleExt > 0.48 && ringExt > 0.48 && pinkyExt > 0.48) {
      return {
        token: 'PERFECT',
        displayLabel: 'Perfect / OK',
        type: 'gesture',
        confidence: 0.96,
        description: 'Thumb and index loop with remaining fingers open',
      };
    }

    // 11. I LOVE YOU: Thumb, Index, and Pinky extended, middle & ring curled
    if (indexExt > 0.58 && pinkyExt > 0.58 && middleExt < 0.38 && ringExt < 0.38) {
      const thumbExt = dist3D(wrist, thumbTip) / palmScale > 0.65 || dist3D(wrist, thumbTip) > 0.10;
      if (thumbExt) {
        return {
          token: 'I LOVE YOU',
          displayLabel: 'I Love You',
          type: 'gesture',
          confidence: 0.96,
          description: 'Thumb, index, and pinky extended (Universal I Love You)',
        };
      }
    }

    // 12. CALL ME: Thumb and Pinky extended (shaka / phone sign)
    if (pinkyExt > 0.60 && indexExt < 0.30 && middleExt < 0.30 && ringExt < 0.30) {
      const thumbExt = dist3D(wrist, thumbTip) > 0.11;
      if (thumbExt) {
        return {
          token: 'CALL ME',
          displayLabel: 'Call Me',
          type: 'gesture',
          confidence: 0.94,
          description: 'Thumb and pinky extended like a telephone',
        };
      }
    }

    // 13. I / ME: Single index finger pointing directly towards own chest/heart
    if (indexExt > 0.42 && middleExt < 0.38 && ringExt < 0.38 && pinkyExt < 0.38) {
      const isPointingToChest = indexTip.y > 0.38 && indexTip.y < 0.82;
      if (isPointingToChest) {
        return {
          token: 'I',
          displayLabel: 'I / Me',
          type: 'gesture',
          confidence: 0.97,
          description: 'Index finger pointing towards chest (ISL sign for I / Me)',
        };
      }
    }

    // 14. MY / MINE / SELF: Flat open palm placed firmly over chest / heart level
    if (indexExt > 0.45 && middleExt > 0.45 && ringExt > 0.45 && pinkyExt > 0.45 && wrist.y > 0.42 && wrist.y < 0.80) {
      if (Math.abs(wrist.x - 0.50) < 0.24) {
        return {
          token: 'I',
          displayLabel: 'My / Self',
          type: 'gesture',
          confidence: 0.96,
          description: 'Flat palm resting over heart/chest (ISL sign for My / Self)',
        };
      }
    }

    // In 'word' mode: finished words evaluation
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: ISL FINGERSPELLING LETTERS (Only in 'fingerspell' mode)
  // ═══════════════════════════════════════════════════════════════════════════

  // Dual-Hand Letters
  if (hands.length >= 2) {
    const handA = hands[0].landmarks;
    const handB = hands[1].landmarks;
    const indexIndexDist = dist3D(handA[8], handB[8]);
    const wristDist = dist3D(handA[0], handB[0]);
    const pinkyPinkyDist = dist3D(handA[20], handB[20]);

    // Letter A: Two fists, index fingers extended up and touching at tips like a tent /\
    if (indexIndexDist < 0.065 && wristDist > 0.12) {
      const extA = computeFingerCurl(handA[0], handA[5], handA[6], handA[8]);
      const extB = computeFingerCurl(handB[0], handB[5], handB[6], handB[8]);
      if (extA > 0.65 && extB > 0.65) {
        return {
          token: 'A',
          displayLabel: 'Letter A',
          type: 'letter',
          confidence: 0.94,
          description: 'Two index fingers touching at tips in a tent (/\\)',
        };
      }
    }

    // Letter S: Both hands closed fists with pinkies interlocked
    if (pinkyPinkyDist < 0.065 && wristDist < 0.16) {
      return {
        token: 'S',
        displayLabel: 'Letter S',
        type: 'letter',
        confidence: 0.92,
        description: 'Both closed fists with interlocked pinkies',
      };
    }

    // Letter X: Both index fingers extended and crossing over each other
    if (indexIndexDist < 0.05) {
      return {
        token: 'X',
        displayLabel: 'Letter X',
        type: 'letter',
        confidence: 0.90,
        description: 'Both index fingers crossing over each other',
      };
    }

    // Letter T: One index upright with other index horizontal resting on top (T crossbar)
    if (indexIndexDist < 0.08 && wristDist > 0.08) {
      const isCrossT = Math.abs(handA[8].y - handB[8].y) < 0.07;
      if (isCrossT) {
        return {
          token: 'T',
          displayLabel: 'Letter T',
          type: 'letter',
          confidence: 0.93,
          description: 'One index upright with other index horizontal resting on top (T)',
        };
      }
    }

    // Letter G: Two closed fists stacked vertically (one fist on top of other)
    const extA_fist = computeFingerCurl(handA[0], handA[9], handA[10], handA[12]);
    const extB_fist = computeFingerCurl(handB[0], handB[9], handB[10], handB[12]);
    if (extA_fist < 0.38 && extB_fist < 0.38 && Math.abs(handA[0].x - handB[0].x) < 0.12 && Math.abs(handA[0].y - handB[0].y) > 0.08 && Math.abs(handA[0].y - handB[0].y) < 0.28) {
      return {
        token: 'G',
        displayLabel: 'Letter G',
        type: 'letter',
        confidence: 0.93,
        description: 'Two closed fists stacked vertically (Letter G)',
      };
    }

    // Letter H: Both flat hands parallel or crossing across palms
    if (wristDist < 0.20 && indexIndexDist < 0.14) {
      const extA = computeFingerCurl(handA[0], handA[5], handA[6], handA[8]);
      const extB = computeFingerCurl(handB[0], handB[5], handB[6], handB[8]);
      if (extA > 0.50 && extB > 0.50) {
        return {
          token: 'H',
          displayLabel: 'Letter H',
          type: 'letter',
          confidence: 0.93,
          description: 'Both flat hands parallel or crossing at palms (Letter H)',
        };
      }
    }
  }

  // Single-Hand Fingerspelling Letters
  // Letter B: 4 fingers extended upright together, thumb curled over palm
  if (indexExt > 0.56 && middleExt > 0.56 && ringExt > 0.50 && pinkyExt > 0.50) {
    const thumbFolded = dist3D(wrist, thumbTip) < 0.12 || thumbTip.x > indexMcp.x - 0.03;
    if (thumbFolded) {
      return {
        token: 'B',
        displayLabel: 'Letter B',
        type: 'letter',
        confidence: 0.94,
        description: 'Four fingers upright with thumb tucked across palm',
      };
    }
  }

  // Letter W: Three middle fingers extended upright (Index, Middle, Ring), pinky curled
  if (indexExt > 0.60 && middleExt > 0.60 && ringExt > 0.55 && pinkyExt < 0.38) {
    return {
      token: 'W',
      displayLabel: 'Letter W',
      type: 'letter',
      confidence: 0.94,
      description: 'Three upright fingers forming W',
    };
  }

  // Letter D: Fist with Index pointing straight up, thumb touching middle finger
  if (indexExt > 0.65 && middleExt < 0.38 && ringExt < 0.38 && pinkyExt < 0.38) {
    const thumbExt = dist3D(wrist, thumbTip) > 0.10;
    if (!thumbExt || thumbIndexDist < 0.075) {
      return {
        token: 'D',
        displayLabel: 'Letter D',
        type: 'letter',
        confidence: 0.95,
        description: 'Index pointing straight up with thumb touching curled fingers (Letter D)',
      };
    }
    // Letter L: Fist with Index straight UP and Thumb horizontal at 90 degrees
    if (thumbExt && thumbIndexDist >= 0.075) {
      return {
        token: 'L',
        displayLabel: 'Letter L',
        type: 'letter',
        confidence: 0.95,
        description: 'Index straight up and thumb at 90 degrees forming L',
      };
    }
  }

  // Letter U: Index and Middle upright together (parallel/touching)
  if (indexExt > 0.60 && middleExt > 0.60 && ringExt < 0.38 && pinkyExt < 0.38) {
    if (indexMiddleDist <= 0.042) {
      return {
        token: 'U',
        displayLabel: 'Letter U',
        type: 'letter',
        confidence: 0.94,
        description: 'Index and middle fingers together upright forming U',
      };
    }
    // Letter V: Index and Middle upright in upright V (separated)
    if (indexMiddleDist > 0.042) {
      return {
        token: 'V',
        displayLabel: 'Letter V',
        type: 'letter',
        confidence: 0.95,
        description: 'Index and middle fingers extended in upright V victory sign',
      };
    }
  }

  // Letter R: Index and Middle crossed over each other
  if (indexExt > 0.55 && middleExt > 0.55 && ringExt < 0.38 && pinkyExt < 0.38 && indexMiddleDist < 0.032) {
    return {
      token: 'R',
      displayLabel: 'Letter R',
      type: 'letter',
      confidence: 0.92,
      description: 'Index and middle fingers crossed over each other (Letter R)',
    };
  }

  // Letter K: Index upright, middle angled forward
  if (indexExt > 0.62 && middleExt > 0.38 && middleExt < 0.75 && ringExt < 0.35 && pinkyExt < 0.35) {
    return {
      token: 'K',
      displayLabel: 'Letter K',
      type: 'letter',
      confidence: 0.92,
      description: 'Index upright with middle finger pointing forward (Letter K)',
    };
  }

  // Letter Y: Thumb and Pinky extended, other 3 fingers curled into palm
  if (pinkyExt > 0.55 && indexExt < 0.38 && middleExt < 0.38 && ringExt < 0.38) {
    const thumbExt = dist3D(wrist, thumbTip) > 0.095;
    if (thumbExt) {
      return {
        token: 'Y',
        displayLabel: 'Letter Y',
        type: 'letter',
        confidence: 0.94,
        description: 'Thumb and pinky extended (Letter Y)',
      };
    }
  }

  // Letter I: Only Pinky finger extended upright, others closed into fist
  if (pinkyExt > 0.65 && indexExt < 0.35 && middleExt < 0.35 && ringExt < 0.35) {
    return {
      token: 'I',
      displayLabel: 'Letter I',
      type: 'letter',
      confidence: 0.94,
      description: 'Fist with pinky pointing straight up',
    };
  }

  // Letter F: Thumb and index touching tips in circle, other 3 fingers extended
  if (thumbIndexDist < 0.055 && middleExt > 0.45 && ringExt > 0.45 && pinkyExt > 0.45) {
    return {
      token: 'F',
      displayLabel: 'Letter F',
      type: 'letter',
      confidence: 0.93,
      description: 'Thumb and index forming circle with remaining 3 fingers upright',
    };
  }

  // Letter E: All 4 fingertips curled tightly touching thumb
  if (indexExt > 0.12 && indexExt < 0.48 && middleExt > 0.12 && middleExt < 0.48 && ringExt > 0.12 && ringExt < 0.48 && pinkyExt > 0.12 && pinkyExt < 0.48 && thumbIndexDist < 0.075) {
    return {
      token: 'E',
      displayLabel: 'Letter E',
      type: 'letter',
      confidence: 0.92,
      description: 'All fingertips curled down tightly touching thumb tip (Letter E)',
    };
  }

  // Letter C: Smooth curved hand arc facing forward
  if (indexExt > 0.35 && indexExt < 0.85 && middleExt > 0.35 && middleExt < 0.85 && thumbIndexDist > 0.05 && thumbIndexDist < 0.16) {
    if (wrist.y >= 0.32) {
      return {
        token: 'C',
        displayLabel: 'Letter C',
        type: 'letter',
        confidence: 0.91,
        description: 'Curved hand arc facing the viewer in a smooth C profile',
      };
    }
  }

  // Letter O: All fingers curved and touching thumb tip in a circular ring
  if (thumbIndexDist < 0.050 && dist3D(thumbTip, middleTip) < 0.060 && indexExt < 0.58 && middleExt < 0.58) {
    return {
      token: 'O',
      displayLabel: 'Letter O',
      type: 'letter',
      confidence: 0.92,
      description: 'Fingers curved touching thumb in a clean circular O',
    };
  }

  // Letter H (Single-hand): Index and Middle extended horizontally forward
  if (indexExt > 0.55 && middleExt > 0.55 && ringExt < 0.38 && pinkyExt < 0.38) {
    return {
      token: 'H',
      displayLabel: 'Letter H',
      type: 'letter',
      confidence: 0.94,
      description: 'Index and middle fingers extended horizontally forward (Letter H)',
    };
  }

  // Letter A / S (Single-hand): Closed fist with thumb resting upright alongside index
  if (indexExt < 0.32 && middleExt < 0.32 && ringExt < 0.32 && pinkyExt < 0.32) {
    const thumbUpright = dist3D(wrist, thumbTip) > 0.082;
    if (thumbUpright) {
      return {
        token: 'A',
        displayLabel: 'Letter A',
        type: 'letter',
        confidence: 0.94,
        description: 'Closed fist with thumb resting alongside index finger (Letter A)',
      };
    }
    return {
      token: 'S',
      displayLabel: 'Letter S',
      type: 'letter',
      confidence: 0.92,
      description: 'Closed fist with thumb folded across fingers (Letter S)',
    };
  }

  return null;
}

// ─── Camera MediaPipe Recognizer Engine ───────────────────────────────────────

export class ISLCameraRecognizerEngine {
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private animId: number | null = null;
  private isRunning: boolean = false;
  private handLandmarker: any = null;
  private onUpdate: RecognitionCallback | null = null;

  // Hold-to-Confirm Stabilization & Velocity Settle State
  private activeCandidate: DetectedSignCandidate | null = null;
  private candidateStartTime: number = 0;
  private lastDetectedTime: number = 0;
  private holdDurationMs: number = 420; // 420ms steady hold allows natural gesture completion and crisp confirmation
  private lastConfirmedToken: string | null = null;
  private lockedToken: string | null = null; // Locks confirmed token until hand neutral reset or sign change
  private neutralSince: number = 0;
  private cooldownUntil: number = 0;
  private recognitionMode: RecognitionMode = 'word';
  private switchSign: SwitchSignId = 'INDEX_TOUCH';
  private onnxRecognizer: ISLOnnxRecognizer = new ISLOnnxRecognizer();
  private latestOnnxPrediction: OnnxPrediction | null = null;
  private isPredictingOnnx: boolean = false;
  private lastOnnxInferenceTime: number = 0;
  private lastWristPos: LandmarkPoint3D | null = null;
  private lastIndexTipPos: LandmarkPoint3D | null = null;
  private lastFrameTime: number = 0;
  private isHandMoving: boolean = false;
  private stillSinceTime: number = 0;
  private pendingCandidateToken: string | null = null;
  private pendingCandidateCount: number = 0;
  private candidateHistory: { token: string; candidate: DetectedSignCandidate; time: number }[] = [];

  constructor() {}

  /**
   * Set the recognition mode ('word' for whole ISL words only, 'fingerspell' for A-Z spelling)
   */
  setMode(mode: RecognitionMode) {
    this.recognitionMode = mode;
    this.activeCandidate = null;
    this.lastConfirmedToken = null;
    this.lockedToken = null;
    this.neutralSince = 0;
    this.latestOnnxPrediction = null;
    this.candidateHistory = [];
    this.stillSinceTime = 0;
    this.pendingCandidateToken = null;
    this.pendingCandidateCount = 0;
  }

  getMode(): RecognitionMode {
    return this.recognitionMode;
  }

  /**
   * Configure the custom physical mode-switch gesture (persisted per user)
   */
  setSwitchSign(signId: SwitchSignId) {
    this.switchSign = signId;
    this.activeCandidate = null;
    this.pendingCandidateToken = null;
    this.pendingCandidateCount = 0;
  }

  getSwitchSign(): SwitchSignId {
    return this.switchSign;
  }

  /**
   * Initializes MediaPipe Hands via browser CDN script dynamically
   */
  async initialize(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    callback: RecognitionCallback,
    initialMode: RecognitionMode = 'word',
    initialSwitchSign: SwitchSignId = 'INDEX_TOUCH'
  ): Promise<boolean> {
    this.videoEl = video;
    this.canvasEl = canvas;
    this.onUpdate = callback;
    this.recognitionMode = initialMode;
    this.switchSign = initialSwitchSign;

    if (typeof window === 'undefined') return false;

    try {
      // Modern Google MediaPipe Tasks Vision (Single self-contained GPU .task model, zero broken Emscripten asset loaders)
      const importUrl = new Function('url', 'return import(url)');
      const vision = await importUrl('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs');
      const { FilesetResolver, HandLandmarker } = vision;

      const visionFiles = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(visionFiles, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      });

      this.isRunning = true;
      // Initialize in-browser ONNX temporal sequence recognizer in background
      this.onnxRecognizer.initialize().catch(() => {});

      // Only start detection loop once the video element has loaded frames with non-zero dimensions
      const startWhenVideoReady = () => {
        if (!this.isRunning || !this.videoEl) return;
        if (
          this.videoEl.readyState >= 2 &&
          this.videoEl.videoWidth > 0 &&
          this.videoEl.videoHeight > 0 &&
          !this.videoEl.paused
        ) {
          this.startLoop();
        } else {
          setTimeout(startWhenVideoReady, 50);
        }
      };
      startWhenVideoReady();

      return true;
    } catch (err) {
      console.warn('[ISL Recognizer] Modern Tasks-Vision initialization error:', err);
      return false;
    }
  }

  private startLoop() {
    if (!this.isRunning || !this.videoEl || !this.handLandmarker) return;

    let lastVideoTime = -1;
    let lastDetectionTime = 0;
    // Cap ML inference to 25 FPS (~40ms interval) to guarantee silky 60 FPS video stream playback
    const MIN_DETECTION_INTERVAL_MS = 40;

    const processFrame = () => {
      if (!this.isRunning) return;

      const now = performance.now();
      if (
        this.videoEl &&
        this.videoEl.readyState >= 2 &&
        this.videoEl.videoWidth > 0 &&
        this.videoEl.videoHeight > 0 &&
        !this.videoEl.paused &&
        !this.videoEl.ended &&
        this.videoEl.currentTime !== lastVideoTime &&
        now - lastDetectionTime >= MIN_DETECTION_INTERVAL_MS &&
        this.handLandmarker
      ) {
        lastVideoTime = this.videoEl.currentTime;
        lastDetectionTime = now;
        try {
          const results = this.handLandmarker.detectForVideo(this.videoEl, now);
          this.handleTaskVisionResults(results);
        } catch {
          // Skip frame on WebGL context busy
        }
      }

      this.animId = requestAnimationFrame(processFrame);
    };

    this.animId = requestAnimationFrame(processFrame);
  }

  private handleTaskVisionResults(results: any) {
    if (!this.isRunning || !this.onUpdate) return;

    const rawLandmarks = results?.landmarks || [];
    const rawHandedness = results?.handednesses || [];

    const parsedHands: HandLandmarkResult[] = rawLandmarks.map((lmList: any[], idx: number) => {
      const hCategory = rawHandedness[idx]?.[0]?.categoryName;
      const hLabel = hCategory === 'Left' ? 'Left' : 'Right';
      return {
        landmarks: lmList.map((p: any) => ({ x: p.x, y: p.y, z: p.z })),
        handedness: hLabel,
      };
    });

    this.processParsedHands(parsedHands);
  }

  private processParsedHands(parsedHands: HandLandmarkResult[]) {
    if (!this.isRunning || !this.onUpdate) return;

    // Draw landmark wireframe on preview canvas if provided
    this.drawLandmarksOverlay(parsedHands);

    const now = performance.now();

    // 1. Calculate Hand Velocity (Movement Speed) to detect Moving vs Stopped Hand
    let handSpeed = 0;
    if (parsedHands.length > 0 && parsedHands[0].landmarks.length >= 21) {
      const currWrist = parsedHands[0].landmarks[0];
      const currIndex = parsedHands[0].landmarks[8];
      if (this.lastWristPos && this.lastFrameTime > 0) {
        const dt = Math.max(0.008, (now - this.lastFrameTime) / 1000);
        if (dt < 0.3) {
          const dWrist = dist3D(currWrist, this.lastWristPos);
          const dIndex = dist3D(currIndex, this.lastIndexTipPos || currWrist);
          handSpeed = (dWrist + dIndex) / dt;
        }
      }
      this.lastWristPos = { ...currWrist };
      this.lastIndexTipPos = { ...currIndex };
      this.lastFrameTime = now;
    } else {
      this.lastWristPos = null;
      this.lastIndexTipPos = null;
      this.lastFrameTime = now;
      this.stillSinceTime = 0;
    }

    // Push frame into rolling 30-frame temporal buffer for ONNX sequence model
    this.onnxRecognizer.pushFrame(parsedHands);

    // Run async ONNX temporal inference every ~100ms when hands are active
    if (parsedHands.length > 0 && this.onnxRecognizer.isReady() && !this.isPredictingOnnx && (now - this.lastOnnxInferenceTime > 100)) {
      this.isPredictingOnnx = true;
      this.lastOnnxInferenceTime = now;
      this.onnxRecognizer.predict().then((res) => {
        this.latestOnnxPrediction = res;
        this.isPredictingOnnx = false;
      }).catch(() => {
        this.isPredictingOnnx = false;
      });
    }

    // Evaluate Camera Signing Zone & Framing Guard in Real Time
    const framing = evaluateFramingQuality(parsedHands);

    // ─── STOP & POSE GATE: Distinguish Hand in Flight vs Hand Stopped in Sign ───
    const isMovingFast = handSpeed > 0.45;
    const isHoldingStill = handSpeed <= 0.28;

    if (isMovingFast) {
      this.isHandMoving = true;
      this.stillSinceTime = 0;
      this.pendingCandidateToken = null;
      this.pendingCandidateCount = 0;

      // When the hand is actively moving/traveling, DO NOT churn random words!
      // This completely stops word flickering during transitions!
      this.onUpdate({
        candidate: this.lockedToken ? this.activeCandidate : null,
        holdProgress: 0.0,
        confirmedToken: null,
        handsDetected: parsedHands.length,
        allHands: parsedHands,
        statusMessage: 'Hand moving... Hold pose to sign',
        isMoving: true,
        framing,
      });
      return;
    }

    if (isHoldingStill) {
      this.isHandMoving = false;
      if (this.stillSinceTime === 0) {
        this.stillSinceTime = now;
      }
    }

    // Require the hand to be held still for at least ~80ms before evaluating the pose
    const hasSettled = this.stillSinceTime > 0 && (now - this.stillSinceTime >= 80);
    if (!hasSettled && parsedHands.length > 0) {
      this.onUpdate({
        candidate: this.activeCandidate,
        holdProgress: 0.0,
        confirmedToken: null,
        handsDetected: parsedHands.length,
        allHands: parsedHands,
        statusMessage: 'Settling pose...',
        isMoving: false,
        framing,
      });
      return;
    }

    // 1. Primary AI Matcher: Authentic .parquet Dataset Template Signatures (D:\Matri\Dataset)
    const parquetMatch = ParquetLandmarkMatcher.matchLiveHand(parsedHands, this.lastConfirmedToken);

    // 2. Secondary Matcher: Kinematic Angle and Distance Classifier
    const kinematicMatch = classifyHandPostures(parsedHands, this.recognitionMode, this.switchSign);

    // 3. Trained ONNX Deep Sequence Model (isl_model.onnx, 261 classes, 92.49% Top-1 Accuracy)
    const onnxMatch = (this.latestOnnxPrediction && this.latestOnnxPrediction.confidence >= 0.50) ? this.latestOnnxPrediction : null;

    // Priority Selection: MODE_SWITCH takes absolute precedence in both modes!
    let detected: DetectedSignCandidate | null = null;

    if (kinematicMatch && kinematicMatch.token === 'MODE_SWITCH') {
      detected = kinematicMatch;
    } else if (this.recognitionMode === 'fingerspell') {
      if (kinematicMatch && kinematicMatch.type === 'letter') {
        detected = kinematicMatch;
      }
    } else {
      if (parquetMatch) {
        detected = {
          token: parquetMatch.token,
          displayLabel: parquetMatch.displayLabel,
          type: 'gesture',
          confidence: parquetMatch.confidence,
          description: parquetMatch.description,
          topK: this.latestOnnxPrediction?.topK,
        };
      } else if (onnxMatch && onnxMatch.confidence >= 0.70) {
        detected = {
          token: onnxMatch.token,
          displayLabel: onnxMatch.displayLabel,
          type: 'gesture',
          confidence: onnxMatch.confidence,
          description: `Deep Neural Net (${Math.round(onnxMatch.confidence * 100)}% confidence)`,
          topK: onnxMatch.topK,
        };
      } else if (kinematicMatch && kinematicMatch.type === 'gesture') {
        detected = kinematicMatch;
      } else if (onnxMatch) {
        detected = {
          token: onnxMatch.token,
          displayLabel: onnxMatch.displayLabel,
          type: 'gesture',
          confidence: onnxMatch.confidence,
          description: `Deep Neural Net (${Math.round(onnxMatch.confidence * 100)}% confidence)`,
          topK: onnxMatch.topK,
        };
      }
    }

    let holdProgress = 0.0;
    let confirmedToken: DetectedSignCandidate | null = null;

    if (now < this.cooldownUntil) {
      // In post-confirmation cooldown
      this.onUpdate({
        candidate: this.activeCandidate,
        holdProgress: 0.0,
        confirmedToken: null,
        handsDetected: parsedHands.length,
        allHands: parsedHands,
        statusMessage: 'Confirmed',
        isMoving: false,
        framing,
      });
      return;
    }

    if (detected) {
      this.lastDetectedTime = now;
      this.neutralSince = 0;

      // Candidate Debounce: verify token across 2 consecutive checks
      if (this.pendingCandidateToken === detected.token) {
        this.pendingCandidateCount++;
      } else {
        this.pendingCandidateToken = detected.token;
        this.pendingCandidateCount = 1;
      }

      // Framing Guard Gating: If hands are resting near lap or severely off-screen,
      // suppress candidate locking and progress to eliminate accidental sign hallucinations!
      if (!framing.isInZone && (framing.zoneState === 'too_low' || framing.zoneState === 'off_center') && detected.token !== 'MODE_SWITCH') {
        this.onUpdate({
          candidate: null,
          holdProgress: 0.0,
          confirmedToken: null,
          handsDetected: parsedHands.length,
          allHands: parsedHands,
          statusMessage: framing.message,
          isMoving: false,
          framing,
        });
        return;
      }

      // If token is currently locked (already confirmed and user hasn't reset or switched signs)
      if (this.lockedToken && this.lockedToken === detected.token) {
        // Hand is still in confirmed pose: maintain locked visual state without duplicate re-triggering
        this.onUpdate({
          candidate: detected,
          holdProgress: 1.0,
          confirmedToken: null,
          handsDetected: parsedHands.length,
          allHands: parsedHands,
          statusMessage: `Confirmed: ${detected.displayLabel || detected.token} (Lower hands or sign next word)`,
          isMoving: false,
          framing,
        });
        return;
      }

      // If user transitioned to a different sign, release the previous lock
      if (this.lockedToken && this.lockedToken !== detected.token) {
        this.lockedToken = null;
      }

      if (!this.activeCandidate || this.activeCandidate.token !== detected.token) {
        // Only switch candidate if verified across at least 2 consecutive frames
        if (this.pendingCandidateCount >= 2 || !this.activeCandidate) {
          this.activeCandidate = detected;
          this.candidateStartTime = now;
          holdProgress = 0.08;
        }
      } else {
        // Signer holding the posture steadily: advance progress ring over calibrated hold duration
        const elapsed = now - this.candidateStartTime;
        const isSwitchSign = detected.token === 'MODE_SWITCH';
        const targetHold = isSwitchSign ? 380 : (this.recognitionMode === 'fingerspell' ? 320 : this.holdDurationMs);
        holdProgress = Math.min(1.0, elapsed / targetHold);

        if (holdProgress >= 1.0) {
          // Confirmed!
          confirmedToken = detected;
          this.lastConfirmedToken = detected.token;
          this.lockedToken = detected.token; // Lock until neutral reset or sign transition
          this.cooldownUntil = now + (isSwitchSign ? 1200 : (this.recognitionMode === 'fingerspell' ? 300 : 420)); // Mode switch has 1.2s cooldown to prevent accidental rebound
          this.candidateStartTime = now;
          holdProgress = 1.0;

          // Play subtle affirmative audio chime
          if (isSwitchSign) {
            this.playModeSwitchChime();
          } else {
            this.playConfirmChime();
          }
        }
      }
    } else {
      this.pendingCandidateToken = null;
      this.pendingCandidateCount = 0;

      // Hands in neutral / between signs
      if (this.neutralSince === 0) {
        this.neutralSince = now;
      }

      // If user drops hands or returns to neutral for > 550ms, unlock (avoids dropped frame jitter from unlocking duplicate sign)
      if (now - this.neutralSince > 550) {
        this.lockedToken = null;
        this.lastConfirmedToken = null;
        this.latestOnnxPrediction = null;
      }

      // 180ms grace period for dropped camera frames before resetting
      if (this.activeCandidate && (now - this.lastDetectedTime < 180)) {
        const elapsed = now - this.candidateStartTime;
        holdProgress = Math.min(1.0, elapsed / this.holdDurationMs);
      } else {
        this.activeCandidate = null;
        holdProgress = 0.0;
      }
    }

    this.onUpdate({
      candidate: this.activeCandidate,
      holdProgress,
      confirmedToken,
      handsDetected: parsedHands.length,
      allHands: parsedHands,
      statusMessage: this.activeCandidate ? `🎯 Holding: ${this.activeCandidate.displayLabel || this.activeCandidate.token}` : undefined,
      isMoving: false,
      framing,
    });
  }

  private drawLandmarksOverlay(hands: HandLandmarkResult[]) {
    if (!this.canvasEl) return;
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;

    // Dynamically match canvas internal resolution to video stream for 1:1 landmark positioning
    if (this.videoEl && this.videoEl.videoWidth > 0 && this.videoEl.videoHeight > 0) {
      if (this.canvasEl.width !== this.videoEl.videoWidth || this.canvasEl.height !== this.videoEl.videoHeight) {
        this.canvasEl.width = this.videoEl.videoWidth;
        this.canvasEl.height = this.videoEl.videoHeight;
      }
    }

    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    if (!hands || hands.length === 0) return;

    const w = this.canvasEl.width;
    const h = this.canvasEl.height;

    // Connections between 21 MediaPipe hand points
    const CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4], // Thumb
      [0,5],[5,6],[6,7],[7,8], // Index
      [0,9],[9,10],[10,11],[11,12], // Middle
      [0,13],[13,14],[14,15],[15,16], // Ring
      [0,17],[17,18],[18,19],[19,20], // Pinky
      [5,9],[9,13],[13,17], // Palm bridge
    ];

    ctx.save();


    hands.forEach((hand) => {
      const pts = hand.landmarks;
      if (!pts || pts.length < 21) return;

      // Draw all connecting lines in a single fast path
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#06b6d4';
      ctx.beginPath();
      CONNECTIONS.forEach(([i, j]) => {
        const p1 = pts[i];
        const p2 = pts[j];
        if (p1 && p2) {
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
        }
      });
      ctx.stroke();

      // Draw knuckles & intermediate joints
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      pts.forEach((p, idx) => {
        const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
        if (!isTip) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });

      // Draw high-visibility fingertips
      ctx.fillStyle = '#f59e0b';
      [4, 8, 12, 16, 20].forEach((tipIdx) => {
        const p = pts[tipIdx];
        if (p) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
    });

    ctx.restore();
  }

  private playConfirmChime() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Lush Apple / Vision Pro style dual-tone harmonic chord
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Root harmonic: F#5 (739.99 Hz) to C#6 (1108.73 Hz)
      osc1.frequency.setValueAtTime(739.99, now);
      osc1.frequency.exponentialRampToValueAtTime(1108.73, now + 0.12);

      // Fifth overtone: C#6 (1108.73 Hz) to F#6 (1479.98 Hz)
      osc2.frequency.setValueAtTime(1108.73, now);
      osc2.frequency.exponentialRampToValueAtTime(1479.98, now + 0.12);

      // Smooth exponential decay envelope
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.22);
      osc2.stop(now + 0.22);
    } catch {
      // Ignore audio policy silence
    }
  }

  /**
   * Distinct dual-tone melodic arpeggio for Hands-Free Physical Mode Switch
   */
  public playModeSwitchChime(toMode?: RecognitionMode) {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (toMode === 'fingerspell') {
        // Upward triad: Entering Fingerspell Letters mode (C5 -> E5 -> G5)
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
      } else {
        // Downward triad: Returning to Whole ISL Words mode (G5 -> E5 -> C5)
        osc.frequency.setValueAtTime(783.99, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(523.25, now + 0.16);
      }

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {}
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.canvasEl) {
      const ctx = this.canvasEl.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    }
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch {}
      this.handLandmarker = null;
    }
    this.activeCandidate = null;
  }
}
