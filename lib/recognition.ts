
import type { SignFrame, SignPoint } from "./signs";

export interface RecognitionResult {
  name: string;
  distance: number;
  confidence: number;
}

// Calculate distance between two landmarks.
function pointDistance(a: SignPoint, b: SignPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Normalize hand landmarks using the wrist and palm size.
function normalizeHand(hand: SignPoint[]): SignPoint[] {
  if (!hand || hand.length !== 21) return [];

  const wrist = hand[0];
  const palmScale = pointDistance(wrist, hand[9]);

  if (palmScale < 0.0001) return [];

  return hand.map((point) => ({
    x: (point.x - wrist.x) / palmScale,
    y: (point.y - wrist.y) / palmScale,
    z: (point.z - wrist.z) / palmScale,
  }));
}

// Compare the shape and position of two hands.
function handDistance(a: SignPoint[], b: SignPoint[]): number {
  const na = normalizeHand(a);
  const nb = normalizeHand(b);

  if (!na.length || !nb.length) return Infinity;

  let shapeTotal = 0;

  for (let i = 0; i < 21; i++) {
    shapeTotal += pointDistance(na[i], nb[i]);
  }

  const shapeDistance = shapeTotal / 21;

  // Keep a small contribution from wrist position because
  // the location of a sign can be important.
  const positionDistance = pointDistance(a[0], b[0]);

  return shapeDistance * 0.85 + positionDistance * 0.15;
}

// Compare frames while tolerating temporary loss of one hand.
function frameDistance(a: SignFrame, b: SignFrame): number {
  if (!a.hands?.length || !b.hands?.length) {
    return Infinity;
  }

  const aHands = a.hands;
  const bHands = b.hands;

  if (aHands.length === 1 && bHands.length === 1) {
    return handDistance(aHands[0], bHands[0]);
  }

  if (aHands.length === 2 && bHands.length === 2) {
    const direct =
      (
        handDistance(aHands[0], bHands[0]) +
        handDistance(aHands[1], bHands[1])
      ) / 2;

    const swapped =
      (
        handDistance(aHands[0], bHands[1]) +
        handDistance(aHands[1], bHands[0])
      ) / 2;

    return Math.min(direct, swapped);
  }

  // One hand may temporarily disappear from camera detection.
  // Compare the visible hand with the closest available hand,
  // and apply a penalty for the missing hand.
  const singleHand = aHands.length === 1 ? aHands[0] : bHands[0];
  const doubleHands = aHands.length === 2 ? aHands : bHands;

  const firstDistance = handDistance(singleHand, doubleHands[0]);
  const secondDistance = handDistance(singleHand, doubleHands[1]);

  const bestDistance = Math.min(firstDistance, secondDistance);

  if (!Number.isFinite(bestDistance)) return Infinity;

  return bestDistance + 0.30;
}

// Sample frames evenly to keep recognition efficient.
function sampleFrames(
  frames: SignFrame[],
  maximum = 48
): SignFrame[] {
  if (frames.length <= maximum) return frames;

  return Array.from({ length: maximum }, (_, index) => {
    const position = Math.round(
      (index * (frames.length - 1)) / (maximum - 1)
    );

    return frames[position];
  });
}

// Dynamic time warping with flexible start and end alignment.
// This allows the same sign to be recognized when its timing differs.
export function compareSignSequences(
  inputFrames: SignFrame[],
  savedFrames: SignFrame[]
): number {
  const input = sampleFrames(inputFrames);
  const saved = sampleFrames(savedFrames);

  if (!input.length || !saved.length) return Infinity;

  const rows = input.length;
  const cols = saved.length;

  const costs = Array.from(
    { length: rows + 1 },
    () => Array(cols + 1).fill(Infinity)
  );

  const lengths = Array.from(
    { length: rows + 1 },
    () => Array(cols + 1).fill(0)
  );

  // Allow the saved sign to contain extra frames
  // before the matching gesture starts.
  for (let j = 0; j <= cols; j++) {
    costs[0][j] = 0;
  }

  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      const distance = frameDistance(
        input[i - 1],
        saved[j - 1]
      );

      if (!Number.isFinite(distance)) continue;

      const options = [
        {
          cost: costs[i - 1][j - 1],
          length: lengths[i - 1][j - 1],
        },
        {
          cost: costs[i - 1][j],
          length: lengths[i - 1][j],
        },
        {
          cost: costs[i][j - 1],
          length: lengths[i][j - 1],
        },
      ];

      let best = options[0];

      for (const option of options) {
        if (option.cost < best.cost) {
          best = option;
        }
      }

      if (!Number.isFinite(best.cost)) continue;

      costs[i][j] = distance + best.cost;
      lengths[i][j] = best.length + 1;
    }
  }

  // Find the best ending position in the saved sequence.
  let bestAverage = Infinity;

  for (let j = 1; j <= cols; j++) {
    const pathLength = lengths[rows][j];

    if (pathLength === 0) continue;

    const average = costs[rows][j] / pathLength;

    if (average < bestAverage) {
      bestAverage = average;
    }
  }

  return bestAverage;
}

// Find the closest matching saved sign.
export function recognizeSign(
  inputFrames: SignFrame[],
  savedSigns: { name: string; frames: SignFrame[] }[]
): RecognitionResult | null {
  if (inputFrames.length < 15 || !savedSigns.length) {
    return null;
  }

  let bestMatch: RecognitionResult | null = null;

  for (const sign of savedSigns) {
    if (!sign.frames?.length) continue;

    const distance = compareSignSequences(
      inputFrames,
      sign.frames
    );

    if (
      Number.isFinite(distance) &&
      (!bestMatch || distance < bestMatch.distance)
    ) {
      bestMatch = {
        name: sign.name,
        distance,
        confidence: Math.max(
          0,
          Math.min(100, 100 * Math.exp(-distance / 0.65))
        ),
      };
    }
  }

  return bestMatch;
}
