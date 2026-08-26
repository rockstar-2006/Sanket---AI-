import * as THREE from 'three';

export interface KalidokitEuler {
  x: number;
  y: number;
  z: number;
  rotationOrder?: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function dist2D(p1: any, p2: any) {
  if (!p1 || !p2) return 0;
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function dist3D(p1: any, p2: any) {
  if (!p1 || !p2) return 0;
  return Math.hypot(p1.x - p2.x, p1.y - p2.y, (p1.z || 0) - (p2.z || 0));
}

/**
 * 1€ (OneEuro) Adaptive Filter for zero-jitter and responsive tracking
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = 1.5, beta = 0.02, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(rate: number, cutoff: number) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  filter(x: number, timestamp: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = timestamp;
      return x;
    }

    const dt = (timestamp - this.tPrev) / 1000.0;
    this.tPrev = timestamp;
    if (dt <= 0.0001 || dt > 1.0) {
      this.xPrev = x;
      return x;
    }

    const rate = 1.0 / dt;
    const dx = (x - this.xPrev) * rate;
    const edx = this.dxPrev + this.alpha(rate, this.dCutoff) * (dx - this.dxPrev);
    this.dxPrev = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const a = this.alpha(rate, cutoff);
    const xHat = this.xPrev + a * (x - this.xPrev);
    this.xPrev = xHat;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.tPrev = null;
    this.dxPrev = 0;
  }
}

const filterBank: Record<string, OneEuroFilter> = {};

function getFilteredValue(key: string, val: number, timeMs: number, minCutoff = 1.5, beta = 0.02): number {
  if (!filterBank[key]) {
    filterBank[key] = new OneEuroFilter(minCutoff, beta);
  }
  return filterBank[key].filter(val, timeMs);
}

/**
 * Universal bone node resolver for VRM models (VRM 0.0 & VRM 1.0)
 * Prioritizes raw skinned mesh bones so transforms are rendered immediately.
 */
export function getVRMBoneNode(vrm: any, name: string): THREE.Object3D | null {
  if (!vrm) return null;

  const camelName = name.charAt(0).toLowerCase() + name.slice(1);
  const pascalName = name.charAt(0).toUpperCase() + name.slice(1);

  // 1. Raw Bone Node in Three-VRM 2.0 (Direct SkinnedMesh transform)
  if (vrm.humanoid && typeof vrm.humanoid.getRawBoneNode === 'function') {
    const raw =
      vrm.humanoid.getRawBoneNode(camelName) ||
      vrm.humanoid.getRawBoneNode(pascalName);
    if (raw) return raw;
  }

  // 2. Direct named bone in scene hierarchy (Standard VRM / VRoid bone naming)
  const scene = vrm.scene || (vrm.isObject3D ? vrm : null);
  if (scene) {
    const direct =
      scene.getObjectByName(`J_Bip_L_${name.replace(/^Left/, '')}`) ||
      scene.getObjectByName(`J_Bip_R_${name.replace(/^Right/, '')}`) ||
      scene.getObjectByName(`J_Bip_C_${name}`) ||
      scene.getObjectByName(`J_Bip_L_${name}`) ||
      scene.getObjectByName(`J_Bip_R_${name}`) ||
      scene.getObjectByName(camelName) ||
      scene.getObjectByName(pascalName) ||
      scene.getObjectByName(name);
    if (direct) return direct;
  }

  // 3. Normalized bone node fallback
  if (vrm.humanoid && typeof vrm.humanoid.getNormalizedBoneNode === 'function') {
    const norm =
      vrm.humanoid.getNormalizedBoneNode(camelName) ||
      vrm.humanoid.getNormalizedBoneNode(pascalName);
    if (norm) return norm;
  }

  return null;
}

/**
 * Rig bone rotation with smooth quaternion slerp from Euler
 */
export function rigRotation(
  vrm: any,
  name: string,
  rotation?: KalidokitEuler,
  dampener = 1.0,
  lerpAmount = 0.65
) {
  if (!vrm || !rotation) return;
  const part = getVRMBoneNode(vrm, name);
  if (!part) return;

  const order = (rotation.rotationOrder as any) || 'XYZ';

  const rx = (rotation.x || 0) * dampener;
  const ry = (rotation.y || 0) * dampener;
  const rz = (rotation.z || 0) * dampener;

  const euler = new THREE.Euler(rx, ry, rz, order);
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  part.quaternion.slerp(quaternion, lerpAmount);

  if (vrm.humanoid && typeof vrm.humanoid.getNormalizedBoneNode === 'function') {
    const camelName = name.charAt(0).toLowerCase() + name.slice(1);
    const norm = vrm.humanoid.getNormalizedBoneNode(camelName);
    if (norm && norm !== part) {
      norm.quaternion.slerp(quaternion, lerpAmount);
    }
  }
}

/**
 * Calculate geometric finger curl ratio from 4 landmarks: MCP, PIP, DIP, TIP
 * Returns 0.0 (100% straight/open) to 1.0 (fully curled into palm)
 */
function getNormalizedFingerCurl(mcp: any, pip: any, dip: any, tip: any): number {
  if (!mcp || !pip || !dip || !tip) return 0.0;
  const directSpan = dist3D(mcp, tip);
  const anatomicalLength = dist3D(mcp, pip) + dist3D(pip, dip) + dist3D(dip, tip);
  if (anatomicalLength < 0.001) return 0.0;
  const ratio = directSpan / anatomicalLength;
  return clamp((0.88 - ratio) / 0.40, 0.0, 1.0);
}

/**
 * High-Precision VRM Kinematics Pipeline for Indian Sign Language Dataset
 */
export function animateVRM(
  vrm: any,
  results: any,
  videoElement?: HTMLVideoElement | null
) {
  if (!vrm || !results) return {};

  const nowMs = performance.now();
  const poseLandmarks = results.poseLandmarks;

  // ─── 1. Forward Kinematics for Arms (100% Blueprint-Accurate) ───────────────
  if (poseLandmarks && poseLandmarks.length >= 17) {
    // 1.1 Screen-Left Arm (Right Shoulder 12 -> Right Elbow 14 -> Right Wrist 16)
    const p12 = poseLandmarks[12]; // Right Shoulder
    const p14 = poseLandmarks[14]; // Right Elbow
    const p16 = poseLandmarks[16]; // Right Wrist

    if (p12 && p14 && (p12.x !== 0 || p12.y !== 0) && (p14.x !== 0 || p14.y !== 0)) {
      const udx = p14.x - p12.x; // Negative when elbow is to the left of shoulder
      const udy = p14.y - p12.y; // Positive when elbow is below shoulder
      const udz = (p14.z || 0) - (p12.z || 0);

      // Upper arm angle: In rest (T-pose), arm extends horizontally (+X).
      // Angle phi: 1.57 rad = hanging down, 0.0 rad = horizontal, -1.0 rad = raised
      const phiUpper = Math.atan2(udy, -udx);
      const targetUpperZ = -phiUpper * 0.82;
      const targetUpperX = clamp(-udz * 1.5, -0.2, 0.4);
      const targetUpperY = -0.28; // Outward rotation so forearm flexes beside the ear, not across eyes

      const fUpperX = getFilteredValue('lua_x', targetUpperX, nowMs, 2.0, 0.03);
      const fUpperY = getFilteredValue('lua_y', targetUpperY, nowMs, 2.0, 0.03);
      const fUpperZ = getFilteredValue('lua_z', targetUpperZ, nowMs, 2.0, 0.03);

      rigRotation(vrm, 'LeftUpperArm', { x: fUpperX, y: fUpperY, z: fUpperZ }, 1.0, 0.75);

      // Lower Arm (Elbow Hinge Flexion):
      if (p16 && (p16.x !== 0 || p16.y !== 0)) {
        const ldx = p16.x - p14.x;
        const ldy = p16.y - p14.y;
        const ldz = (p16.z || 0) - (p14.z || 0);

        const uLen = Math.hypot(udx, udy, udz) || 0.1;
        const lLen = Math.hypot(ldx, ldy, ldz) || 0.1;
        const cosAngle = clamp((udx * ldx + udy * ldy + udz * ldz) / (uLen * lLen), -1, 1);
        const elbowBend = Math.PI - Math.acos(cosAngle);

        const fLowerZ = getFilteredValue('lla_z', -clamp(elbowBend, 0.0, 2.3), nowMs, 2.0, 0.03);
        rigRotation(vrm, 'LeftLowerArm', { x: 0.10, y: -0.15, z: fLowerZ }, 1.0, 0.75);
      }
    }

    // 1.2 Screen-Right Arm (Left Shoulder 11 -> Left Elbow 13 -> Left Wrist 15)
    // Signer's inactive left arm stays resting naturally down at the right hip
    const p11 = poseLandmarks[11]; // Left Shoulder
    const p13 = poseLandmarks[13]; // Left Elbow
    const p15 = poseLandmarks[15]; // Left Wrist

    if (p11 && p13 && (p11.x !== 0 || p11.y !== 0) && (p13.x !== 0 || p13.y !== 0)) {
      const udxR = p13.x - p11.x; // Positive when elbow is to the right of shoulder
      const udyR = p13.y - p11.y; // Positive when elbow is below shoulder
      const udzR = (p13.z || 0) - (p11.z || 0);

      const phiUpperR = Math.atan2(udyR, udxR);
      // In Three-VRM RightUpperArm (points -X in T-pose), +Z rotates DOWN towards hip:
      const targetUpperZR = phiUpperR * 0.85; // +1.25 rad when hanging straight down
      const targetUpperXR = clamp(-udzR * 1.5, -0.2, 0.4);

      const fUpperXR = getFilteredValue('rua_x', targetUpperXR, nowMs, 2.0, 0.03);
      const fUpperZR = getFilteredValue('rua_z', targetUpperZR, nowMs, 2.0, 0.03);

      rigRotation(vrm, 'RightUpperArm', { x: fUpperXR, y: 0.0, z: fUpperZR }, 1.0, 0.75);

      // Relaxed forearm and hand resting at right side
      rigRotation(vrm, 'RightLowerArm', { x: 0.0, y: 0.0, z: 0.0 }, 1.0, 0.75);
      rigRotation(vrm, 'RightHand', { x: 0.0, y: 0.0, z: 0.0 }, 1.0, 0.75);
    }
  }

  // ─── 2. Posture Alignment (Torso & Head) ───────────────────────────────────
  rigRotation(vrm, 'Spine', { x: 0.02, y: 0, z: 0 }, 1.0, 0.50);
  rigRotation(vrm, 'Chest', { x: 0.02, y: 0, z: 0 }, 1.0, 0.50);
  rigRotation(vrm, 'Neck', { x: 0.02, y: 0, z: 0 }, 1.0, 0.50);
  rigRotation(vrm, 'Head', { x: 0.00, y: 0, z: 0 }, 1.0, 0.50);

  let isPinching = false;

  // ─── 3. Precision Hand & 15-Joint Finger Kinematics (Screen-Left Signer Hand)
  const rHand = results.rightHandLandmarks;
  if (rHand && rHand.length >= 21) {
    const p0 = rHand[0];   // Wrist
    const p4 = rHand[4];   // Thumb Tip
    const p5 = rHand[5];   // Index MCP
    const p8 = rHand[8];   // Index Tip
    const p9 = rHand[9];   // Middle MCP
    const p12 = rHand[12]; // Middle Tip
    const p16 = rHand[16]; // Ring Tip
    const p17 = rHand[17]; // Pinky MCP
    const p20 = rHand[20]; // Pinky Tip

    // 3.1 Wrist Alignment: Natural camera-forward palm orientation
    const handScale = dist2D(p0, p9) || 0.1;
    const handDirX = p12.x - p0.x;
    const handRoll = clamp((handDirX / handScale) * 0.15, -0.20, 0.20);

    const filtPitch = getFilteredValue('lwrist_x', 0.02, nowMs, 1.5, 0.02);
    const filtYaw = getFilteredValue('lwrist_y', -0.10, nowMs, 1.5, 0.02);
    const filtRoll = getFilteredValue('lwrist_z', 0.15 - handRoll, nowMs, 1.5, 0.02);

    rigRotation(vrm, 'LeftHand', { x: filtPitch, y: filtYaw, z: filtRoll }, 1.0, 0.65);

    // 3.2 Hand Gesture Analysis (Scale-Invariant Normalized Pinch Distance)
    const pinchDistNormalized = dist2D(p4, p8) / handScale;

    // Check if Middle, Ring, Pinky are extended
    const middleExtRatio = dist3D(p9, p12) / (dist3D(p9, rHand[10]) + dist3D(rHand[10], rHand[11]) + dist3D(rHand[11], p12) || 0.01);
    const ringExtRatio = dist3D(rHand[13], p16) / (dist3D(rHand[13], rHand[14]) + dist3D(rHand[14], rHand[15]) + dist3D(rHand[15], p16) || 0.01);
    const pinkyExtRatio = dist3D(p17, p20) / (dist3D(p17, rHand[18]) + dist3D(rHand[18], rHand[19]) + dist3D(rHand[19], p20) || 0.01);

    const middleStraight = middleExtRatio > 0.82;
    const ringStraight = ringExtRatio > 0.82;

    // True "OK" Sign: Thumb & Index tips close (< 0.35 of hand scale) while other fingers are straight up
    isPinching = pinchDistNormalized < 0.35 && (middleStraight || ringStraight);

    if (isPinching) {
      // 3.3 Flawless Closed "OK" Circle Pinch (Index + Thumb)
      rigRotation(vrm, 'LeftIndexProximal', { x: 0, y: -0.15, z: 0.65 }, 1.0, 0.65);
      rigRotation(vrm, 'LeftIndexIntermediate', { x: 0, y: 0, z: 0.85 }, 1.0, 0.65);
      rigRotation(vrm, 'LeftIndexDistal', { x: 0, y: 0, z: 0.50 }, 1.0, 0.65);

      rigRotation(vrm, 'LeftThumbProximal', { x: 0.22, y: 0.45, z: 0.45 }, 1.0, 0.65);
      rigRotation(vrm, 'LeftThumbIntermediate', { x: 0, y: 0, z: 0.65 }, 1.0, 0.65);
      rigRotation(vrm, 'LeftThumbDistal', { x: 0, y: 0, z: 0.45 }, 1.0, 0.65);

      // Middle, Ring, Pinky: Stand straight UP, tall and splayed
      rigRotation(vrm, 'LeftMiddleProximal', { x: 0, y: 0.00, z: 0.02 }, 1.0, 0.60);
      rigRotation(vrm, 'LeftMiddleIntermediate', { x: 0, y: 0, z: 0.02 }, 1.0, 0.60);
      rigRotation(vrm, 'LeftMiddleDistal', { x: 0, y: 0, z: 0.02 }, 1.0, 0.60);

      rigRotation(vrm, 'LeftRingProximal', { x: 0, y: 0.12, z: 0.02 }, 1.0, 0.60);
      rigRotation(vrm, 'LeftRingIntermediate', { x: 0, y: 0, z: 0.02 }, 1.0, 0.60);
      rigRotation(vrm, 'LeftRingDistal', { x: 0, y: 0, z: 0.02 }, 1.0, 0.60);

      rigRotation(vrm, 'LeftLittleProximal', { x: 0, y: 0.24, z: 0.02 }, 1.0, 0.60);
      rigRotation(vrm, 'LeftLittleIntermediate', { x: 0, y: 0, z: 0.02 }, 1.0, 0.60);
      rigRotation(vrm, 'LeftLittleDistal', { x: 0, y: 0, z: 0.02 }, 1.0, 0.60);
    } else {
      // 3.4 Dynamic Continuous Geometric Hand Solver (Open Hand / Gestures)
      const indexCurl = getNormalizedFingerCurl(rHand[5], rHand[6], rHand[7], p8);
      const middleCurl = getNormalizedFingerCurl(rHand[9], rHand[10], rHand[11], p12);
      const ringCurl = getNormalizedFingerCurl(rHand[13], rHand[14], rHand[15], p16);
      const pinkyCurl = getNormalizedFingerCurl(rHand[17], rHand[18], rHand[19], p20);

      const fIndexCurl = getFilteredValue('f_index_curl', indexCurl, nowMs, 2.0, 0.03);
      const fMiddleCurl = getFilteredValue('f_middle_curl', middleCurl, nowMs, 2.0, 0.03);
      const fRingCurl = getFilteredValue('f_ring_curl', ringCurl, nowMs, 2.0, 0.03);
      const fPinkyCurl = getFilteredValue('f_pinky_curl', pinkyCurl, nowMs, 2.0, 0.03);

      rigRotation(vrm, 'LeftIndexProximal', { x: 0, y: -0.16, z: fIndexCurl * 0.85 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftIndexIntermediate', { x: 0, y: 0, z: fIndexCurl * 0.95 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftIndexDistal', { x: 0, y: 0, z: fIndexCurl * 0.55 }, 1.0, 0.55);

      const thumbSpan = dist3D(p4, rHand[2]);
      const thumbCurl = clamp((0.11 - thumbSpan) / 0.08, 0.0, 1.0);
      const fThumbCurl = getFilteredValue('f_thumb_curl', thumbCurl, nowMs, 2.0, 0.03);

      rigRotation(vrm, 'LeftThumbProximal', { x: 0.12, y: 0.48, z: 0.18 + fThumbCurl * 0.5 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftThumbIntermediate', { x: 0, y: 0, z: 0.05 + fThumbCurl * 0.5 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftThumbDistal', { x: 0, y: 0, z: 0.05 + fThumbCurl * 0.4 }, 1.0, 0.55);

      rigRotation(vrm, 'LeftMiddleProximal', { x: 0, y: 0.00, z: fMiddleCurl * 0.85 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftMiddleIntermediate', { x: 0, y: 0, z: fMiddleCurl * 0.95 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftMiddleDistal', { x: 0, y: 0, z: fMiddleCurl * 0.55 }, 1.0, 0.55);

      rigRotation(vrm, 'LeftRingProximal', { x: 0, y: 0.12, z: fRingCurl * 0.85 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftRingIntermediate', { x: 0, y: 0, z: fRingCurl * 0.95 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftRingDistal', { x: 0, y: 0, z: fRingCurl * 0.55 }, 1.0, 0.55);

      rigRotation(vrm, 'LeftLittleProximal', { x: 0, y: 0.22, z: fPinkyCurl * 0.85 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftLittleIntermediate', { x: 0, y: 0, z: fPinkyCurl * 0.95 }, 1.0, 0.55);
      rigRotation(vrm, 'LeftLittleDistal', { x: 0, y: 0, z: fPinkyCurl * 0.55 }, 1.0, 0.55);
    }
  }

  // ─── 4. Apply Screen-Right Hand ───────────────────────────────────────────
  const lHand = results.leftHandLandmarks;
  if (lHand && lHand.length >= 21) {
    rigRotation(vrm, 'RightHand', { x: 0.05, y: 0, z: 0 }, 1.0, 0.45);
    const lhIndexCurl = getNormalizedFingerCurl(lHand[5], lHand[6], lHand[7], lHand[8]);
    rigRotation(vrm, 'RightIndexProximal', { x: 0, y: 0.16, z: -lhIndexCurl * 0.85 }, 1.0, 0.50);
  }

  // ─── 5. Facial Expressions (Keep open eyes & natural gaze) ────────────────
  if (vrm.blendShapeProxy) {
    vrm.blendShapeProxy.setValue('BLINK_L', 0);
    vrm.blendShapeProxy.setValue('BLINK_R', 0);
    vrm.blendShapeProxy.update();
  } else if (vrm.expressionManager) {
    vrm.expressionManager.setValue('blinkLeft', 0);
    vrm.expressionManager.setValue('blinkRight', 0);
    vrm.expressionManager.update();
  }

  return { isPinching };
}
