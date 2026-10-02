/**
 * Motion Smoothing & Landmark Interpolation Engine
 * Provides butter-smooth 60fps frame interpolation and transitions for the Holographic 3D Skeleton.
 * Eliminates camera sensor jitter and creates natural gliding transitions between sign gestures.
 */

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export interface FrameLandmarks {
  poseLandmarks: Landmark3D[] | null;
  leftHandLandmarks: Landmark3D[] | null;
  rightHandLandmarks: Landmark3D[] | null;
  faceLandmarks: Landmark3D[] | null;
}

/**
 * Linear interpolation between two numbers: (1 - t) * a + t * b
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smoothly interpolates an array of 3D landmarks with outlier displacement clamping.
 * Prevents camera sensor spikes from stretching or breaking the 3D skeleton.
 */
export function interpolateLandmarkList(
  from: Landmark3D[] | null,
  to: Landmark3D[] | null,
  t: number,
  maxDisplacement = 0.22
): Landmark3D[] | null {
  if (!from && !to) return null;
  if (!from) return to;
  if (!to) return null;

  const count = Math.min(from.length, to.length);
  const result: Landmark3D[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const f = from[i];
    const target = to[i];
    if (!f || !target) {
      result[i] = target || f;
      continue;
    }

    // Measure Euclidean step distance
    const dx = target.x - f.x;
    const dy = target.y - f.y;
    const dz = target.z - f.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    let targetX = target.x;
    let targetY = target.y;
    let targetZ = target.z;

    // Outlier guard: clamp wild tracking jumps in a single frame
    if (distSq > maxDisplacement * maxDisplacement) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const ratio = maxDisplacement / dist;
        targetX = f.x + dx * ratio;
        targetY = f.y + dy * ratio;
        targetZ = f.z + dz * ratio;
      }
    }

    result[i] = {
      x: lerp(f.x, targetX, t),
      y: lerp(f.y, targetY, t),
      z: lerp(f.z, targetZ, t),
    };
  }
  return result;
}

/**
 * Generates N smooth transition bridge frames between two poses
 * Uses cubic ease-in-out easing for natural biological movement
 */
export function generateSmoothBridge(
  startFrame: FrameLandmarks,
  endFrame: FrameLandmarks,
  bridgeSteps: number = 10
): FrameLandmarks[] {
  const bridge: FrameLandmarks[] = [];

  for (let step = 1; step <= bridgeSteps; step++) {
    // Cubic ease-in-out factor
    const linearT = step / (bridgeSteps + 1);
    const easeT = linearT < 0.5
      ? 4 * linearT * linearT * linearT
      : 1 - Math.pow(-2 * linearT + 2, 3) / 2;

    bridge.push({
      poseLandmarks: interpolateLandmarkList(startFrame.poseLandmarks, endFrame.poseLandmarks, easeT, 0.28),
      leftHandLandmarks: interpolateLandmarkList(startFrame.leftHandLandmarks, endFrame.leftHandLandmarks, easeT, 0.24),
      rightHandLandmarks: interpolateLandmarkList(startFrame.rightHandLandmarks, endFrame.rightHandLandmarks, easeT, 0.24),
      faceLandmarks: interpolateLandmarkList(startFrame.faceLandmarks, endFrame.faceLandmarks, easeT, 0.15),
    });
  }

  return bridge;
}

export class LandmarkMotionSmoother {
  private prevPose: Landmark3D[] | null = null;
  private prevLeft: Landmark3D[] | null = null;
  private prevRight: Landmark3D[] | null = null;
  private prevFace: Landmark3D[] | null = null;

  // Smoothing factor: 0.48 provides super fluid biological movement while retaining snappy sign gestures
  public smoothingFactor: number = 0.48;

  reset() {
    this.prevPose = null;
    this.prevLeft = null;
    this.prevRight = null;
    this.prevFace = null;
  }

  smooth(frame: FrameLandmarks): FrameLandmarks {
    if (!this.prevPose) {
      this.prevPose = frame.poseLandmarks;
      this.prevLeft = frame.leftHandLandmarks;
      this.prevRight = frame.rightHandLandmarks;
      this.prevFace = frame.faceLandmarks;
      return frame;
    }

    const alpha = this.smoothingFactor;

    const smoothedPose = frame.poseLandmarks
      ? (this.prevPose ? interpolateLandmarkList(this.prevPose, frame.poseLandmarks, alpha, 0.20) : frame.poseLandmarks)
      : null;

    const smoothedLeft = frame.leftHandLandmarks
      ? (this.prevLeft ? interpolateLandmarkList(this.prevLeft, frame.leftHandLandmarks, alpha, 0.16) : frame.leftHandLandmarks)
      : null;

    const smoothedRight = frame.rightHandLandmarks
      ? (this.prevRight ? interpolateLandmarkList(this.prevRight, frame.rightHandLandmarks, alpha, 0.16) : frame.rightHandLandmarks)
      : null;

    const smoothedFace = frame.faceLandmarks
      ? (this.prevFace ? interpolateLandmarkList(this.prevFace, frame.faceLandmarks, alpha, 0.10) : frame.faceLandmarks)
      : null;

    this.prevPose = smoothedPose;
    this.prevLeft = smoothedLeft;
    this.prevRight = smoothedRight;
    this.prevFace = smoothedFace;

    return {
      poseLandmarks: smoothedPose,
      leftHandLandmarks: smoothedLeft,
      rightHandLandmarks: smoothedRight,
      faceLandmarks: smoothedFace,
    };
  }
}
