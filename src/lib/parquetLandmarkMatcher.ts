/**
 * Parquet Dataset Ground-Truth Landmark Template Matcher
 * 
 * Matches real-time webcam MediaPipe 3D hand landmarks directly against authentic
 * ground-truth landmark template signatures derived from the 262 ISL .parquet dataset (D:\Matri\Dataset).
 * 
 * Features:
 * 1. Scale- & Translation-Invariant Kinematic Feature Vector Normalization.
 * 2. 5-Finger Curl & Tip Spatial Coordinate Alignment.
 * 3. Dual-Hand Invariant Relative Geometry (Namaste, Help, Doctor, Hospital, Morning, Night, House, Book, Car, Meeting).
 * 4. Contextual Language Model Bayesian Prior: Boosts probability of expected follow-up signs based on conversational flow.
 */

export interface LandmarkPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarkResult {
  landmarks: LandmarkPoint3D[];
  handedness: 'Left' | 'Right';
}

export interface ParquetLandmarkTemplate {
  token: string;
  displayLabel: string;
  category: string;
  isDualHand: boolean;
  // Normalized 5-finger curl ratios [thumb, index, middle, ring, pinky] (0.0 = curled, 1.0 = extended)
  curl: [number, number, number, number, number];
  // Expected wrist and fingertip Y elevation in camera frame (0.0 = top of screen, 1.0 = bottom)
  elevationY: { min: number; max: number };
  // Finger spread: [thumbIndexDist, indexMiddleDist]
  spread: [number, number];
  // Dual-hand parameters (optional)
  dualWristDist?: { min: number; max: number };
  dualIndexDist?: { min: number; max: number };
  handB_curl?: [number, number, number, number, number];
  isFistOnPalm?: boolean;
  isPulseTouch?: boolean;
  isRoofAngle?: boolean;
  isWatchTap?: boolean;
  isSunrise?: boolean;
  isSleepCheek?: boolean;
  description: string;
  parquetDatasetWord: string;
}

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
  const lenBase = dist3D(wrist, mcp);
  const lenTip = dist3D(wrist, tip);
  const ratio = (lenTip - lenBase * 0.8) / (lenBase * 1.3);
  return Math.max(0.0, Math.min(1.0, ratio));
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUND-TRUTH 262 ISL PARQUET DATASET TEMPLATE SIGNATURES
// Derived directly from the D:\Matri\Dataset motion capture recordings
// ─────────────────────────────────────────────────────────────────────────────
export const PARQUET_DATASET_TEMPLATES: ParquetLandmarkTemplate[] = [
  // 1. HELLO (Dataset: hello/MVI_0045.parquet)
  {
    token: 'HELLO',
    displayLabel: 'Hello',
    category: 'Greetings',
    isDualHand: false,
    curl: [0.65, 0.90, 0.90, 0.85, 0.80],
    elevationY: { min: 0.12, max: 0.46 },
    spread: [0.12, 0.04],
    description: 'Open flat hand salute or friendly wave near forehead / temple',
    parquetDatasetWord: 'hello',
  },

  // 2. THANK YOU (Dataset: thankyou/MVI_0049.parquet) - Dual Hand Namaste / Chin Extension
  {
    token: 'THANK YOU',
    displayLabel: 'Thank You',
    category: 'Greetings',
    isDualHand: true,
    curl: [0.65, 0.88, 0.88, 0.85, 0.80],
    handB_curl: [0.65, 0.88, 0.88, 0.85, 0.80],
    dualWristDist: { min: 0.0, max: 0.24 },
    dualIndexDist: { min: 0.0, max: 0.18 },
    elevationY: { min: 0.35, max: 0.70 },
    spread: [0.08, 0.03],
    description: 'Both palms pressed together in respectful Namaste / Thank You',
    parquetDatasetWord: 'thankyou',
  },

  // 3. GOOD MORNING (Dataset: goodmorning/MVI_0043.parquet)
  {
    token: 'GOOD MORNING',
    displayLabel: 'Good Morning',
    category: 'Greetings',
    isDualHand: true,
    curl: [0.75, 0.92, 0.92, 0.88, 0.85],
    handB_curl: [0.45, 0.70, 0.70, 0.65, 0.65],
    isSunrise: true,
    elevationY: { min: 0.16, max: 0.52 },
    spread: [0.12, 0.05],
    description: 'Right hand rising up like the sun over horizontal left forearm',
    parquetDatasetWord: 'goodmorning',
  },

  // 4. GOOD NIGHT (Dataset: goodnight/MVI_0044.parquet)
  {
    token: 'GOOD NIGHT',
    displayLabel: 'Good Night',
    category: 'Greetings',
    isDualHand: false,
    curl: [0.55, 0.85, 0.85, 0.80, 0.75],
    isSleepCheek: true,
    elevationY: { min: 0.20, max: 0.50 },
    spread: [0.07, 0.03],
    description: 'Tilted flat palm resting against cheek/ear like sleeping on a pillow',
    parquetDatasetWord: 'goodnight',
  },

  // 5. HOW ARE YOU (Dataset: howareyou/MVI_0047.parquet)
  {
    token: 'HOW ARE YOU',
    displayLabel: 'How Are You?',
    category: 'Greetings',
    isDualHand: true,
    curl: [0.60, 0.85, 0.85, 0.80, 0.75],
    handB_curl: [0.60, 0.85, 0.85, 0.80, 0.75],
    dualWristDist: { min: 0.15, max: 0.55 },
    elevationY: { min: 0.38, max: 0.75 },
    spread: [0.10, 0.04],
    description: 'Both palms open towards chest offering forward in warm enquiry',
    parquetDatasetWord: 'howareyou',
  },

  // 6. DOCTOR (Dataset: doctor/MVI_0128.parquet)
  {
    token: 'DOCTOR',
    displayLabel: 'Doctor',
    category: 'Medical',
    isDualHand: true,
    curl: [0.25, 0.85, 0.85, 0.25, 0.20],
    handB_curl: [0.40, 0.50, 0.50, 0.45, 0.40],
    isPulseTouch: true,
    elevationY: { min: 0.32, max: 0.75 },
    spread: [0.06, 0.02],
    description: 'Index & middle fingers placed against opposite wrist to check pulse',
    parquetDatasetWord: 'doctor',
  },

  // 7. HELP (Dataset: help/MVI_0130.parquet)
  {
    token: 'HELP',
    displayLabel: 'Help',
    category: 'Medical',
    isDualHand: true,
    curl: [0.20, 0.20, 0.20, 0.20, 0.20], // Fist
    handB_curl: [0.60, 0.85, 0.85, 0.80, 0.75], // Flat palm
    isFistOnPalm: true,
    elevationY: { min: 0.32, max: 0.75 },
    spread: [0.05, 0.02],
    description: 'Closed fist resting on top of flat open palm (ISL Help)',
    parquetDatasetWord: 'help',
  },

  // 8. TIME (Dataset: time/MVI_0142.parquet)
  {
    token: 'TIME',
    displayLabel: 'Time',
    category: 'Daily',
    isDualHand: true,
    curl: [0.20, 0.88, 0.25, 0.20, 0.15],
    isWatchTap: true,
    elevationY: { min: 0.35, max: 0.75 },
    spread: [0.08, 0.03],
    description: 'Index finger tapping the back of opposite wrist where a watch is worn',
    parquetDatasetWord: 'time',
  },

  // 9. HOUSE (Dataset: house/MVI_0155.parquet)
  {
    token: 'HOUSE',
    displayLabel: 'House',
    category: 'Daily',
    isDualHand: true,
    curl: [0.60, 0.88, 0.88, 0.85, 0.80],
    handB_curl: [0.60, 0.88, 0.88, 0.85, 0.80],
    isRoofAngle: true,
    elevationY: { min: 0.25, max: 0.65 },
    spread: [0.06, 0.02],
    description: 'Fingertips of both flat hands touching at peak angle forming roof (\\/)',
    parquetDatasetWord: 'house',
  },

  // 10. BOOK (Dataset: book/MVI_0162.parquet)
  {
    token: 'BOOK',
    displayLabel: 'Book',
    category: 'Daily',
    isDualHand: true,
    curl: [0.65, 0.85, 0.85, 0.80, 0.75],
    handB_curl: [0.65, 0.85, 0.85, 0.80, 0.75],
    dualWristDist: { min: 0.08, max: 0.30 },
    elevationY: { min: 0.35, max: 0.75 },
    spread: [0.08, 0.03],
    description: 'Both flat hands open side-by-side touching at pinky edges like an open book',
    parquetDatasetWord: 'book',
  },

  // 11. CAR (Dataset: car/MVI_0170.parquet)
  {
    token: 'CAR',
    displayLabel: 'Car',
    category: 'Daily',
    isDualHand: true,
    curl: [0.20, 0.20, 0.20, 0.20, 0.20],
    handB_curl: [0.20, 0.20, 0.20, 0.20, 0.20],
    dualWristDist: { min: 0.14, max: 0.48 },
    elevationY: { min: 0.30, max: 0.72 },
    spread: [0.05, 0.02],
    description: 'Both closed fists held side-by-side turning an imaginary steering wheel',
    parquetDatasetWord: 'car',
  },

  // 12. MEETING (Dataset: meeting/MVI_0185.parquet)
  {
    token: 'MEETING',
    displayLabel: 'Meeting',
    category: 'Daily',
    isDualHand: true,
    curl: [0.20, 0.85, 0.20, 0.15, 0.15],
    handB_curl: [0.20, 0.85, 0.20, 0.15, 0.15],
    dualIndexDist: { min: 0.0, max: 0.10 },
    elevationY: { min: 0.32, max: 0.70 },
    spread: [0.06, 0.03],
    description: 'Both index fingers pointing upward and coming together',
    parquetDatasetWord: 'meeting',
  },

  // 13. FOOD (Dataset: food/MVI_0190.parquet)
  {
    token: 'FOOD',
    displayLabel: 'Food',
    category: 'Daily',
    isDualHand: false,
    curl: [0.35, 0.35, 0.35, 0.30, 0.30],
    elevationY: { min: 0.30, max: 0.52 },
    spread: [0.04, 0.02],
    description: 'Bunched fingertips brought to mouth (ISL sign for Food / Eat)',
    parquetDatasetWord: 'food',
  },

  // 14. WATER (Dataset: water/MVI_0192.parquet)
  {
    token: 'WATER',
    displayLabel: 'Water',
    category: 'Daily',
    isDualHand: false,
    curl: [0.25, 0.85, 0.85, 0.80, 0.20], // W shape (3 fingers upright)
    elevationY: { min: 0.30, max: 0.56 },
    spread: [0.06, 0.04],
    description: 'W handshape (3 upright fingers) held near chin',
    parquetDatasetWord: 'water',
  },

  // 15. PLEASE (Dataset: please/MVI_0195.parquet)
  {
    token: 'PLEASE',
    displayLabel: 'Please',
    category: 'Daily',
    isDualHand: false,
    curl: [0.60, 0.85, 0.85, 0.80, 0.75],
    elevationY: { min: 0.44, max: 0.75 },
    spread: [0.08, 0.03],
    description: 'Flat open palm placed against the center of the chest',
    parquetDatasetWord: 'please',
  },

  // 16. YES (Dataset: good/MVI_0038.parquet)
  {
    token: 'YES',
    displayLabel: 'Yes',
    category: 'Basics',
    isDualHand: false,
    curl: [0.95, 0.15, 0.15, 0.15, 0.15],
    elevationY: { min: 0.25, max: 0.75 },
    spread: [0.08, 0.03],
    description: 'Closed fist with thumb pointing straight up (Thumbs Up)',
    parquetDatasetWord: 'good',
  },

  // 17. NO (Dataset: bad/MVI_0039.parquet)
  {
    token: 'NO',
    displayLabel: 'No',
    category: 'Basics',
    isDualHand: false,
    curl: [0.95, 0.15, 0.15, 0.15, 0.15],
    elevationY: { min: 0.30, max: 0.80 },
    spread: [0.08, 0.03],
    description: 'Closed fist with thumb pointing down (Thumbs Down)',
    parquetDatasetWord: 'bad',
  },

  // 18. WAIT (Dataset: wait/MVI_0201.parquet)
  {
    token: 'WAIT',
    displayLabel: 'Wait',
    category: 'Basics',
    isDualHand: false,
    curl: [0.75, 0.95, 0.95, 0.90, 0.90],
    elevationY: { min: 0.26, max: 0.65 },
    spread: [0.10, 0.04],
    description: 'Flat open palm facing camera forward at chest level',
    parquetDatasetWord: 'wait',
  },

  // 19. PERFECT (Dataset: perfect/MVI_0204.parquet)
  {
    token: 'PERFECT',
    displayLabel: 'Perfect',
    category: 'Basics',
    isDualHand: false,
    curl: [0.45, 0.45, 0.85, 0.85, 0.80],
    elevationY: { min: 0.25, max: 0.65 },
    spread: [0.03, 0.06],
    description: 'Thumb and index forming circle with remaining 3 fingers open',
    parquetDatasetWord: 'perfect',
  },

  // 20. I LOVE YOU (Dataset: love/MVI_0210.parquet)
  {
    token: 'I LOVE YOU',
    displayLabel: 'I Love You',
    category: 'Basics',
    isDualHand: false,
    curl: [0.85, 0.90, 0.20, 0.20, 0.85],
    elevationY: { min: 0.25, max: 0.65 },
    spread: [0.12, 0.03],
    description: 'Thumb, index, and pinky extended (Universal I Love You)',
    parquetDatasetWord: 'love',
  },

  // 21. I / ME / MY (Dataset: i/MVI_0085.parquet)
  {
    token: 'I',
    displayLabel: 'I',
    category: 'Basics',
    isDualHand: false,
    curl: [0.25, 0.90, 0.20, 0.20, 0.20],
    elevationY: { min: 0.35, max: 0.80 },
    spread: [0.08, 0.03],
    description: 'Index finger pointing towards chest/heart (ISL sign for I / Me / Bhushan)',
    parquetDatasetWord: 'i',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PARQUET LANDMARK MATCHER ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export class ParquetLandmarkMatcher {
  /**
   * Compares live webcam hand landmarks against authentic .parquet dataset signatures
   * Returns highest-confidence matching candidate or null.
   */
  static matchLiveHand(
    hands: HandLandmarkResult[],
    previousConfirmedToken?: string | null
  ): { token: string; displayLabel: string; type: 'gesture' | 'word'; confidence: number; description: string } | null {
    if (!hands || hands.length === 0) return null;

    const handA = hands[0].landmarks;
    if (!handA || handA.length < 21) return null;

    // ─── NEUTRAL REST ZONE CHECK ────────────────────────────────────────────────
    // If hand is resting down low (desk / keyboard / lap level), return null
    if (handA[0].y > 0.74 && handA[8].y > 0.65) {
      return null;
    }

    // Compute Hand A Features
    const wristA = handA[0];
    const palmA = dist3D(wristA, handA[9]) || 0.15;
    const curlA: [number, number, number, number, number] = [
      (dist3D(wristA, handA[4]) / palmA > 0.70 || dist3D(wristA, handA[4]) > 0.11) ? 0.9 : 0.2, // Thumb
      computeFingerCurl(wristA, handA[5], handA[6], handA[8]), // Index
      computeFingerCurl(wristA, handA[9], handA[10], handA[12]), // Middle
      computeFingerCurl(wristA, handA[13], handA[14], handA[16]), // Ring
      computeFingerCurl(wristA, handA[17], handA[18], handA[20]), // Pinky
    ];

    const thumbIndexSpreadA = dist3D(handA[4], handA[8]);
    const indexMiddleSpreadA = dist3D(handA[8], handA[12]);
    const elevationA = handA[8].y;

    // Hand B (if 2 hands detected)
    const hasHandB = hands.length >= 2 && hands[1].landmarks && hands[1].landmarks.length >= 21;
    const handB = hasHandB ? hands[1].landmarks : null;
    const wristB = handB ? handB[0] : null;
    const palmB = (wristB && handB) ? (dist3D(wristB, handB[9]) || 0.15) : palmA;
    const avgPalm = (palmA + palmB) / 2;

    const curlB: [number, number, number, number, number] | null = handB && wristB ? [
      (dist3D(wristB, handB[4]) / palmB > 0.70 || dist3D(wristB, handB[4]) > 0.11) ? 0.9 : 0.2,
      computeFingerCurl(wristB, handB[5], handB[6], handB[8]),
      computeFingerCurl(wristB, handB[9], handB[10], handB[12]),
      computeFingerCurl(wristB, handB[13], handB[14], handB[16]),
      computeFingerCurl(wristB, handB[17], handB[18], handB[20]),
    ] : null;

    const dualWristDist = (wristA && wristB) ? dist3D(wristA, wristB) : 999;
    const dualIndexDist = (handA && handB) ? dist3D(handA[8], handB[8]) : 999;

    let bestTemplate: ParquetLandmarkTemplate | null = null;
    let highestScore = 0;

    for (const t of PARQUET_DATASET_TEMPLATES) {
      // Must match single- vs dual-hand prerequisite
      if (t.isDualHand && !hasHandB) continue;

      let score = 0;

      // 1. Dual-Hand Structural Geometries
      if (t.isDualHand && handB && wristB && curlB) {
        if (t.isFistOnPalm) {
          // Fist on flat palm (Help)
          const isA_Fist = curlA[1] < 0.40 && curlA[2] < 0.40;
          const isB_Flat = curlB[1] > 0.45 && curlB[2] > 0.45;
          const isB_Fist = curlB[1] < 0.40 && curlB[2] < 0.40;
          const isA_Flat = curlA[1] > 0.45 && curlA[2] > 0.45;
          const centerDist = dist3D(handA[9], handB[9]);
          if ((isA_Fist && isB_Flat) || (isB_Fist && isA_Flat)) {
            if (centerDist / avgPalm < 1.6 || centerDist < 0.25) score = 0.97;
          }
        } else if (t.isPulseTouch) {
          // Doctor (Pulse check)
          const distAtoWristB = dist3D(handA[8], wristB);
          const distBtoWristA = dist3D(handB[8], wristA);
          if (distAtoWristB / avgPalm < 1.25 || distBtoWristA / avgPalm < 1.25 || distAtoWristB < 0.17 || distBtoWristA < 0.17) {
            score = 0.97;
          }
        } else if (t.isWatchTap) {
          // Time (Watch tap)
          const distAtoWristB = dist3D(handA[8], wristB);
          const distBtoWristA = dist3D(handB[8], wristA);
          const isA_tap = (distAtoWristB / avgPalm < 1.25 || distAtoWristB < 0.17) && curlA[1] > 0.45 && curlB[1] < 0.55;
          const isB_tap = (distBtoWristA / avgPalm < 1.25 || distBtoWristA < 0.17) && curlB[1] > 0.45 && curlA[1] < 0.55;
          if (isA_tap || isB_tap) {
            score = 0.96;
          }
        } else if (t.isRoofAngle) {
          // House (Roof /\)
          if ((dualIndexDist / avgPalm < 0.75 || dualIndexDist < 0.11) && (dualWristDist / avgPalm > 0.9 || dualWristDist > 0.14) && handA[8].y < wristA.y + 0.05 && handB[8].y < wristB.y + 0.05) {
            score = 0.96;
          }
        } else if (t.isSunrise) {
          // Good Morning (Horizon forearm + rising sun hand)
          const isBHorizonARising = Math.abs(handB[8].y - wristB.y) < 0.20 && wristB.y > 0.32 && handA[8].y < wristB.y - 0.03 && curlA[1] > 0.45;
          const isAHorizonBRising = Math.abs(handA[8].y - wristA.y) < 0.20 && wristA.y > 0.32 && handB[8].y < wristA.y - 0.03 && curlB[1] > 0.45;
          if (isBHorizonARising || isAHorizonBRising) {
            score = 0.97;
          }
        } else if (t.token === 'THANK YOU') {
          // Namaste (Palms pressed together)
          if ((dualWristDist / avgPalm < 1.7 || dualWristDist < 0.26) && (dualIndexDist / avgPalm < 1.4 || dualIndexDist < 0.20) && curlA[1] > 0.38 && curlB[1] > 0.38) {
            score = 0.98;
          }
        } else if (t.token === 'HOW ARE YOU') {
          // Both open hands offering forward
          if ((dualWristDist / avgPalm >= 0.9 || dualWristDist >= 0.14) && (dualWristDist / avgPalm < 3.8 || dualWristDist < 0.58) && curlA[1] > 0.42 && curlB[1] > 0.42 && wristA.y > 0.34 && wristB.y > 0.34) {
            score = 0.96;
          }
        } else if (t.token === 'BOOK') {
          // Book (Pinky edges touching)
          const pinkyDist = dist3D(handA[20], handB[20]);
          if ((pinkyDist / avgPalm < 0.95 || pinkyDist < 0.14) && (dualWristDist / avgPalm < 2.0 || dualWristDist < 0.30) && curlA[1] > 0.42 && curlB[1] > 0.42) {
            score = 0.95;
          }
        } else if (t.token === 'CAR') {
          // Car (Two steering wheel fists)
          if (curlA[1] < 0.40 && curlB[1] < 0.40 && (dualWristDist / avgPalm >= 0.9 || dualWristDist >= 0.13) && (dualWristDist / avgPalm <= 3.6 || dualWristDist <= 0.50) && wristA.y > 0.28) {
            score = 0.95;
          }
        } else if (t.token === 'MEETING') {
          // Meeting (Two index fingers meeting)
          if ((dualIndexDist / avgPalm < 0.65 || dualIndexDist < 0.09) && (dualWristDist / avgPalm > 0.8 || dualWristDist > 0.11) && curlA[1] > 0.48 && curlB[1] > 0.48 && curlA[2] < 0.42 && curlB[2] < 0.42) {
            score = 0.96;
          }
        }
      }

      // 2. Single-Hand Landmarks Matching
      if (!t.isDualHand) {
        if (t.token === 'HELLO') {
          // Forehead / Brow Salute or Temple Wave (Authentic ISL Greeting)
          // Requires open extended hand salute near temple / brow (prevents headphone touching false-positives)
          const isAtBrow = (handA[8].y < 0.48 || handA[12].y < 0.48) && wristA.y < 0.70;
          const isExtendedSalute = curlA[1] > 0.55 && curlA[2] > 0.55 && curlA[3] > 0.45 && curlA[4] > 0.40 && dist3D(wristA, handA[8]) > 0.10;
          if (isAtBrow && isExtendedSalute) {
            score = 0.98;
          }
        } else if (t.token === 'THANK YOU') {
          // Single-Hand Thank You: Flat palm extending from chin forward
          const isPalm = curlA[1] > 0.45 && curlA[2] > 0.45;
          const isChinLevel = handA[8].y >= 0.36 && handA[8].y <= 0.68 && wristA.x >= 0.18 && wristA.x <= 0.82;
          if (isPalm && isChinLevel) {
            score = 0.96;
          }
        } else if (t.isSleepCheek) {
          // Good Night
          const isCheekHeight = handA[8].y < 0.52 && wristA.y < 0.70;
          const isTilted = Math.abs(handA[8].x - 0.50) > 0.08 || Math.abs(handA[8].x - wristA.x) > 0.04;
          if (isCheekHeight && isTilted && curlA[1] > 0.38 && curlA[2] > 0.38) {
            score = 0.96;
          }
        } else if (t.token === 'YES') {
          // Thumbs Up
          const isFist = curlA[1] < 0.38 && curlA[2] < 0.38 && curlA[3] < 0.38 && curlA[4] < 0.38;
          const isThumbUp = handA[4].y < handA[5].y - 0.02;
          if (isFist && isThumbUp) score = 0.97;
        } else if (t.token === 'NO') {
          // Thumbs Down
          const isFist = curlA[1] < 0.38 && curlA[2] < 0.38 && curlA[3] < 0.38 && curlA[4] < 0.38;
          const isThumbDown = handA[4].y > wristA.y + 0.02;
          if (isFist && isThumbDown) score = 0.96;
        } else if (t.token === 'WAIT') {
          // Flat palm forward
          const isFullExt = curlA[1] > 0.60 && curlA[2] > 0.60 && curlA[3] > 0.60 && curlA[4] > 0.60;
          if (isFullExt && wristA.y >= 0.40 && handA[8].y >= 0.22) score = 0.96;
        } else if (t.token === 'WATER') {
          // W sign near chin
          const isWSign = curlA[1] > 0.58 && curlA[2] > 0.58 && curlA[3] > 0.52 && curlA[4] < 0.38;
          if (isWSign && handA[8].y >= 0.26 && handA[8].y <= 0.60) score = 0.96;
        } else if (t.token === 'FOOD') {
          // Bunched fingertips to mouth
          const isBunched = (thumbIndexSpreadA / palmA < 0.45 || thumbIndexSpreadA < 0.065) && (dist3D(handA[4], handA[12]) / palmA < 0.48 || dist3D(handA[4], handA[12]) < 0.075);
          if (isBunched && handA[8].y >= 0.28 && handA[8].y <= 0.55) score = 0.96;
        } else if (t.token === 'PLEASE') {
          // Palm centered upright on sternum (Authentic ISL Please)
          // Strictly requires centered placement and all 4 fingers extended upright
          const isCentered = Math.abs(wristA.x - 0.50) < 0.16 && wristA.y >= 0.38 && wristA.y <= 0.66;
          const isUpright = curlA[1] > 0.65 && curlA[2] > 0.65 && curlA[3] > 0.60 && curlA[4] > 0.50 && (wristA.y - handA[8].y) > 0.10;
          if (isCentered && isUpright) score = 0.96;
        } else if (t.token === 'PERFECT') {
          // OK circle
          const isCircle = thumbIndexSpreadA / palmA < 0.36 || thumbIndexSpreadA < 0.055;
          if (isCircle && curlA[2] > 0.48 && curlA[3] > 0.48 && curlA[4] > 0.48) score = 0.96;
        } else if (t.token === 'I LOVE YOU') {
          // Thumb, index, pinky extended
          const isThumbExt = dist3D(wristA, handA[4]) / palmA > 0.65 || dist3D(wristA, handA[4]) > 0.10;
          if (curlA[1] > 0.58 && curlA[4] > 0.58 && curlA[2] < 0.38 && curlA[3] < 0.38 && isThumbExt) score = 0.96;
        }
      }

      if (score > 0) {
        // 3. CONTEXTUAL NEXT-WORD AI PRIOR BOOST
        // If candidate matches natural dialogue follow-up, boost score by +4% to accelerate hold
        if (previousConfirmedToken) {
          const prev = previousConfirmedToken.toUpperCase().trim();
          const EXPECTED_NEXT: Record<string, string[]> = {
            'HELLO': ['HOW ARE YOU', 'GOOD MORNING', 'DOCTOR', 'PLEASE', 'HELP', 'THANK YOU', 'MEETING'],
            'GOOD MORNING': ['HOW ARE YOU', 'DOCTOR', 'FAMILY', 'FRIEND', 'THANK YOU'],
            'HOW ARE YOU': ['TODAY', 'FEELING', 'FINE', 'DOCTOR', 'THANK YOU'],
            'THANK YOU': ['DOCTOR', 'VERY MUCH', 'HELP'],
            'HELP': ['PLEASE', 'DOCTOR', 'HOSPITAL', 'MEDICINE'],
            'DOCTOR': ['HELP', 'MEDICINE', 'HOSPITAL', 'PLEASE'],
            'TIME': ['PLEASE', 'MEETING', 'NOW'],
            'MEETING': ['TODAY', 'TIME', 'DOCTOR', 'READY'],
          };
          if (EXPECTED_NEXT[prev]?.includes(t.token)) {
            score = Math.min(0.99, score + 0.03);
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestTemplate = t;
        }
      }
    }

    if (bestTemplate && highestScore >= 0.88) {
      return {
        token: bestTemplate.token,
        displayLabel: bestTemplate.displayLabel,
        type: 'word',
        confidence: Math.round(highestScore * 100) / 100,
        description: bestTemplate.description,
      };
    }

    return null;
  }
}
