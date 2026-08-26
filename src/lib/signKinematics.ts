import * as THREE from 'three';

// ─── 1. One-Euro Filter (Anti-Jitter for Motion Capture) ─────────────────────────
export class OneEuroFilter {
  minCutoff: number;
  beta: number;
  dCutoff: number;
  xPrev: number | null = null;
  dxPrev = 0;
  tPrev: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(x: number, timestamp: number): number {
    if (this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = timestamp;
      return x;
    }
    const dt = Math.max((timestamp - this.tPrev) / 1000, 1e-5);
    const dx = (x - (this.xPrev ?? x)) / dt;
    const edx = this.smoothingFactor(dt, this.dCutoff) * dx + (1 - this.smoothingFactor(dt, this.dCutoff)) * this.dxPrev;
    this.dxPrev = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const alpha = this.smoothingFactor(dt, cutoff);
    const filteredX = alpha * x + (1 - alpha) * (this.xPrev ?? x);
    this.xPrev = filteredX;
    this.tPrev = timestamp;
    return filteredX;
  }

  private smoothingFactor(dt: number, cutoff: number): number {
    const r = 2 * Math.PI * cutoff * dt;
    return r / (r + 1);
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface ParsedFrameLandmarks {
  frame: number;
  pose: LandmarkPoint[];       // 33 landmarks
  leftHand: LandmarkPoint[] | null;  // 21 landmarks or null if NaN
  rightHand: LandmarkPoint[] | null; // 21 landmarks or null if NaN
  face: LandmarkPoint[] | null;      // 468 landmarks or null
}

// ─── 2. Vector Math Utilities for Kinematics ─────────────────────────────────
const V3 = THREE.Vector3;
const Q = THREE.Quaternion;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function getVector(p1: LandmarkPoint, p2: LandmarkPoint): THREE.Vector3 {
  // MediaPipe: x right+, y down+, z forward-
  // Three.js: x right+, y up+, z towards camera+
  return new THREE.Vector3(p2.x - p1.x, -(p2.y - p1.y), -(p2.z - p1.z));
}

function getAngleBetween(v1: THREE.Vector3, v2: THREE.Vector3): number {
  const dot = v1.clone().normalize().dot(v2.clone().normalize());
  return Math.acos(clamp(dot, -1, 1));
}

// ─── 3. Full Kinematics Solver (Head, Chest, Arms, 15 Fingers) ───────────────
export class SignKinematicsSolver {
  private filterMap = new Map<string, OneEuroFilter>();

  private getFiltered(id: string, val: number, time: number, minCut = 1.0, beta = 0.01): number {
    if (!this.filterMap.has(id)) {
      this.filterMap.set(id, new OneEuroFilter(minCut, beta, 1.0));
    }
    return this.filterMap.get(id)!.filter(val, time);
  }

  public reset() {
    this.filterMap.clear();
  }

  public solveFrame(
    data: ParsedFrameLandmarks,
    time: number
  ): Record<string, [number, number, number, number]> {
    const quaternions: Record<string, [number, number, number, number]> = {};

    const { pose, leftHand, rightHand, face } = data;

    // ── A. Spine & Chest Rotation ──────────────────────────────────────────
    if (pose && pose.length >= 25) {
      const lShoulder = pose[11];
      const rShoulder = pose[12];
      const lHip = pose[23];
      const rHip = pose[24];

      if (lShoulder && rShoulder && lHip && rHip) {
        const shoulderVec = getVector(rShoulder, lShoulder).normalize();
        
        // Torso roll, yaw & pitch
        const roll = clamp(Math.atan2(shoulderVec.y, shoulderVec.x) * 0.25, -0.2, 0.2);
        const yaw = clamp(Math.atan2(shoulderVec.z, shoulderVec.x) * 0.35, -0.3, 0.3);
        const pitch = clamp(((lShoulder.y + rShoulder.y) / 2 - (lHip.y + rHip.y) / 2) * 0.15, -0.15, 0.15);

        const fRoll = this.getFiltered('spine_roll', roll, time);
        const fYaw = this.getFiltered('spine_yaw', yaw, time);
        const fPitch = this.getFiltered('spine_pitch', pitch, time);

        const spineEuler = new THREE.Euler(fPitch, fYaw, fRoll, 'YXZ');
        const spineQuat = new THREE.Quaternion().setFromEuler(spineEuler);
        quaternions['mixamorigSpine'] = [spineQuat.x, spineQuat.y, spineQuat.z, spineQuat.w];
        quaternions['mixamorigSpine1'] = [spineQuat.x * 0.5, spineQuat.y * 0.5, spineQuat.z * 0.5, spineQuat.w];
      }
    }

    // ── B. Head & Neck Orientation ──────────────────────────────────────────
    if (face && face.length >= 264) {
      const nose = face[1];
      const chin = face[152];
      const lEye = face[263];
      const rEye = face[33];

      if (nose && chin && lEye && rEye) {
        const eyeVec = getVector(rEye, lEye).normalize();
        const headRoll = clamp(Math.atan2(eyeVec.y, eyeVec.x) * 0.45, -0.30, 0.30);
        const headYaw = clamp(Math.atan2(eyeVec.z, eyeVec.x) * 0.50, -0.40, 0.40);
        const faceVec = getVector(chin, nose).normalize();
        const headPitch = clamp(Math.atan2(faceVec.z, faceVec.y) * 0.40, -0.30, 0.30);

        const fHeadPitch = this.getFiltered('head_pitch', headPitch, time);
        const fHeadYaw = this.getFiltered('head_yaw', headYaw, time);
        const fHeadRoll = this.getFiltered('head_roll', headRoll, time);

        const headEuler = new THREE.Euler(fHeadPitch, fHeadYaw, fHeadRoll, 'YXZ');
        const headQuat = new THREE.Quaternion().setFromEuler(headEuler);
        quaternions['mixamorigHead'] = [headQuat.x, headQuat.y, headQuat.z, headQuat.w];
        quaternions['mixamorigNeck'] = [headQuat.x * 0.35, headQuat.y * 0.35, headQuat.z * 0.35, headQuat.w];
      }
    }

    // ── C. Left Arm & Forearm (Exact Unit-Vector Retargeting from Video) ───────
    let lUpperVec: THREE.Vector3 | null = null;
    let lForeVec: THREE.Vector3 | null = null;

    if (pose && pose.length >= 17) {
      const lShoulder = pose[11];
      const lElbow = pose[13];
      const lWrist = pose[15];

      if (lShoulder && lElbow && lWrist) {
        lUpperVec = getVector(lShoulder, lElbow).normalize();
        lForeVec = getVector(lElbow, lWrist).normalize();

        // Mixamo LeftArm rest orientation (A-Pose vector)
        const lRestDir = new THREE.Vector3(-0.35, -0.93, 0).normalize();
        const lArmQ = new THREE.Quaternion().setFromUnitVectors(lRestDir, lUpperVec);

        // Forearm elbow hinge flexion (0 to 2.4 rad)
        const elbowAngle = clamp(getAngleBetween(lUpperVec, lForeVec), 0.05, 2.35);
        const lForearmQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), elbowAngle);

        const fArmQ = this.filterQuaternion('LeftArm', lArmQ, time);
        const fForearmQ = this.filterQuaternion('LeftForeArm', lForearmQ, time);

        quaternions['mixamorigLeftArm'] = [round4(fArmQ.x), round4(fArmQ.y), round4(fArmQ.z), round4(fArmQ.w)];
        quaternions['mixamorigLeftForeArm'] = [round4(fForearmQ.x), round4(fForearmQ.y), round4(fForearmQ.z), round4(fForearmQ.w)];
      }

      // ── D. Right Arm & Forearm (Exact Unit-Vector Retargeting from Video) ──────
      const rShoulder = pose[12];
      const rElbow = pose[14];
      const rWrist = pose[16];

      if (rShoulder && rElbow && rWrist) {
        const rUpperVec = getVector(rShoulder, rElbow).normalize();
        const rForeVec = getVector(rElbow, rWrist).normalize();

        // Mixamo RightArm rest orientation (A-Pose vector)
        const rRestDir = new THREE.Vector3(0.35, -0.93, 0).normalize();
        const rArmQ = new THREE.Quaternion().setFromUnitVectors(rRestDir, rUpperVec);

        // Forearm elbow hinge flexion (0 to 2.4 rad)
        const elbowAngle = clamp(getAngleBetween(rUpperVec, rForeVec), 0.05, 2.35);
        const rForearmQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), elbowAngle);

        const fArmQ = this.filterQuaternion('RightArm', rArmQ, time);
        const fForearmQ = this.filterQuaternion('RightForeArm', rForearmQ, time);

        quaternions['mixamorigRightArm'] = [round4(fArmQ.x), round4(fArmQ.y), round4(fArmQ.z), round4(fArmQ.w)];
        quaternions['mixamorigRightForeArm'] = [round4(fForearmQ.x), round4(fForearmQ.y), round4(fForearmQ.z), round4(fForearmQ.w)];
      }
    }

    // ── E. Left Hand & 15 Finger Joints ────────────────────────────────────
    if (leftHand && leftHand.length >= 21) {
      this.solveFingers(leftHand, 'Left', time, quaternions, lForeVec);
    } else {
      this.setRestFingers('Left', quaternions);
    }

    // ── F. Right Hand & 15 Finger Joints ───────────────────────────────────
    if (rightHand && rightHand.length >= 21) {
      this.solveFingers(rightHand, 'Right', time, quaternions);
    } else {
      this.setRestFingers('Right', quaternions);
    }

    return quaternions;
  }

  private solveFingers(
    hand: LandmarkPoint[],
    side: 'Left' | 'Right',
    time: number,
    out: Record<string, [number, number, number, number]>,
    forearmVec?: THREE.Vector3 | null
  ) {
    const isLeft = side === 'Left';
    const sign = isLeft ? 1 : -1;

    // Wrist rotation from palm plane: Wrist(0), Index(5), Pinky(17)
    const wrist = hand[0];
    const indexMCP = hand[5];
    const pinkyMCP = hand[17];
    const v1 = getVector(wrist, indexMCP).normalize();
    const v2 = getVector(wrist, pinkyMCP).normalize();
    const palmNormal = new THREE.Vector3().crossVectors(v1, v2).normalize();

    // Constrain wrist rotation to natural human articulation (preventing flips)
    const wristPitch = clamp(palmNormal.z * 0.40, -0.45, 0.45);
    const wristYaw = clamp(v1.y * 0.30, -0.35, 0.35);
    const wristRoll = clamp(palmNormal.x * 0.30 * sign, -0.35, 0.35);

    const wristEuler = new THREE.Euler(wristPitch, wristYaw, wristRoll, 'YXZ');
    const wristQuat = new THREE.Quaternion().setFromEuler(wristEuler);
    const fWristQ = this.filterQuaternion(`${side}Hand`, wristQuat, time);
    out[`mixamorig${side}Hand`] = [fWristQ.x, fWristQ.y, fWristQ.z, fWristQ.w];

    // 4 Fingers: Index (5-8), Middle (9-12), Ring (13-16), Pinky (17-20)
    const fourFingers = [
      { name: 'Index', indices: [5, 6, 7, 8], spread: -0.12 },
      { name: 'Middle', indices: [9, 10, 11, 12], spread: 0.00 },
      { name: 'Ring', indices: [13, 14, 15, 16], spread: 0.10 },
      { name: 'Pinky', indices: [17, 18, 19, 20], spread: 0.20 },
    ];

    fourFingers.forEach(({ name, indices, spread }) => {
      const [p0, p1, p2, p3] = indices.map((idx) => hand[idx]);
      if (!p0 || !p1 || !p2 || !p3) return;

      const seg1 = getVector(wrist, p0);
      const seg2 = getVector(p0, p1);
      const seg3 = getVector(p1, p2);
      const seg4 = getVector(p2, p3);

      const curl1 = clamp(getAngleBetween(seg1, seg2), 0, 1.4) * 0.55;
      const curl2 = clamp(getAngleBetween(seg2, seg3), 0, 1.4) * 0.45;
      const curl3 = clamp(getAngleBetween(seg3, seg4), 0, 1.4) * 0.30;

      // Mixamo Rig: Finger flexion is on the Z-axis, spread on Y-axis
      const q1Euler = new THREE.Euler(0, spread * 0.35 * sign, curl1 * sign, 'XYZ');
      const q2Euler = new THREE.Euler(0, 0, curl2 * sign, 'XYZ');
      const q3Euler = new THREE.Euler(0, 0, curl3 * sign, 'XYZ');

      const q1 = new THREE.Quaternion().setFromEuler(q1Euler);
      const q2 = new THREE.Quaternion().setFromEuler(q2Euler);
      const q3 = new THREE.Quaternion().setFromEuler(q3Euler);

      const fq1 = this.filterQuaternion(`${side}Hand${name}1`, q1, time);
      const fq2 = this.filterQuaternion(`${side}Hand${name}2`, q2, time);
      const fq3 = this.filterQuaternion(`${side}Hand${name}3`, q3, time);

      out[`mixamorig${side}Hand${name}1`] = [fq1.x, fq1.y, fq1.z, fq1.w];
      out[`mixamorig${side}Hand${name}2`] = [fq2.x, fq2.y, fq2.z, fq2.w];
      out[`mixamorig${side}Hand${name}3`] = [fq3.x, fq3.y, fq3.z, fq3.w];
    });

    // Thumb: Thumb1 (1), Thumb2 (2), Thumb3 (3), Tip (4)
    const [t0, t1, t2, t3] = [1, 2, 3, 4].map((idx) => hand[idx]);
    if (t0 && t1 && t2 && t3) {
      const tSeg1 = getVector(wrist, t0);
      const tSeg2 = getVector(t0, t1);
      const tSeg3 = getVector(t1, t2);

      const tCurl1 = clamp(getAngleBetween(tSeg1, tSeg2), 0, 1.2) * 0.45;
      const tCurl2 = clamp(getAngleBetween(tSeg2, tSeg3), 0, 1.2) * 0.35;

      const tq1 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-tCurl1 * 0.2, -tCurl1 * 0.35 * sign, -tCurl1 * 0.25 * sign, 'XYZ')
      );
      const tq2 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -tCurl2 * 0.25 * sign, -tCurl2 * 0.30 * sign, 'XYZ')
      );
      const tq3 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, -tCurl2 * 0.20 * sign, 'XYZ')
      );

      const ftq1 = this.filterQuaternion(`${side}HandThumb1`, tq1, time);
      const ftq2 = this.filterQuaternion(`${side}HandThumb2`, tq2, time);
      const ftq3 = this.filterQuaternion(`${side}HandThumb3`, tq3, time);

      out[`mixamorig${side}HandThumb1`] = [ftq1.x, ftq1.y, ftq1.z, ftq1.w];
      out[`mixamorig${side}HandThumb2`] = [ftq2.x, ftq2.y, ftq2.z, ftq2.w];
      out[`mixamorig${side}HandThumb3`] = [ftq3.x, ftq3.y, ftq3.z, ftq3.w];
    }
  }

  private setRestFingers(side: 'Left' | 'Right', out: Record<string, [number, number, number, number]>) {
    const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
    fingers.forEach((name) => {
      for (let i = 1; i <= 3; i++) {
        out[`mixamorig${side}Hand${name}${i}`] = [0, 0, 0, 1];
      }
    });
  }

  private filterQuaternion(id: string, q: THREE.Quaternion, time: number): THREE.Quaternion {
    const fx = this.getFiltered(`${id}_qx`, q.x, time, 1.2, 0.015);
    const fy = this.getFiltered(`${id}_qy`, q.y, time, 1.2, 0.015);
    const fz = this.getFiltered(`${id}_qz`, q.z, time, 1.2, 0.015);
    const fw = this.getFiltered(`${id}_qw`, q.w, time, 1.2, 0.015);
    return new THREE.Quaternion(fx, fy, fz, fw).normalize();
  }
}

// ─── 5. High-Precision ISL AnimationClip Synthesizer ────────────────────────
export interface SignEvaluationResult {
  bones: Record<string, [number, number, number]>;
  fingerCurls: {
    rightCurl: number;
    leftCurl: number;
    rightSpread: number;
    leftSpread: number;
    thumbUp: number;
    thumbOut: number;
    rightFlutter?: number;
    leftFlutter?: number;
  };
  smileWeight: number;
}

export const MIXAMO_REST_POSES: Record<string, [number, number, number]> = {
  LeftShoulder:   [0.000,  0.000,  0.000],
  RightShoulder:  [0.000,  0.000,  0.000],
  LeftArm:        [0.000,  0.000,  1.320],
  RightArm:       [0.000,  0.000, -1.320],
  LeftForeArm:    [0.000,  0.000,  0.000],
  RightForeArm:   [0.000,  0.000,  0.000],
  LeftHand:       [0.000,  0.000,  0.000],
  RightHand:      [0.000,  0.000,  0.000],
  Head:           [0.000,  0.000,  0.000],
  Neck:           [0.000,  0.000,  0.000],
  Spine1:         [0.000,  0.000,  0.000],
  Spine:          [0.000,  0.000,  0.000],
};

export function evaluateISLSignTargets(signName: string, progress: number): SignEvaluationResult {
  const s = signName.toLowerCase().trim();
  const t = clamp(progress, 0, 1);
  const bones: Record<string, [number, number, number]> = { ...MIXAMO_REST_POSES };
  let fingerCurls = {
    rightCurl: 0,
    leftCurl: 0,
    rightSpread: 0,
    leftSpread: 0,
    thumbUp: 0,
    thumbOut: 0,
    rightFlutter: 0,
    leftFlutter: 0,
  };
  let smileWeight = 0;

  const restRArm = MIXAMO_REST_POSES.RightArm;
  const restLArm = MIXAMO_REST_POSES.LeftArm;
  const restRForeArm = MIXAMO_REST_POSES.RightForeArm;
  const restLForeArm = MIXAMO_REST_POSES.LeftForeArm;
  const restRHand = MIXAMO_REST_POSES.RightHand;
  const restLHand = MIXAMO_REST_POSES.LeftHand;

  const env = Math.sin(t * Math.PI);

  if (s === 'hello' || s === 'hi') {
    // ── 1. ISL "HELLO" (Right Hand Wave near Temple) ──────────────────────────
    let p = 0;
    if (t < 0.22) p = Math.sin((t / 0.22) * (Math.PI / 2));
    else if (t < 0.78) p = 1.0;
    else p = Math.cos(((t - 0.78) / 0.22) * (Math.PI / 2));

    const waveCycle = t >= 0.22 && t <= 0.78 ? Math.sin(((t - 0.22) / 0.56) * Math.PI * 6) : 0;
    bones['RightArm'] = [
      0.35 * p + restRArm[0] * (1 - p),
      -0.20 * p,
      -0.45 * p + waveCycle * 0.08 + restRArm[2] * (1 - p),
    ];
    bones['RightForeArm'] = [0.00, 0.00, -1.85 * p + waveCycle * 0.12 + restRForeArm[2] * (1 - p)];
    bones['RightHand'] = [0.15 * p, -0.20 * p, 0.25 * p + waveCycle * 0.20];
    bones['Head'] = [0.05 * p, 0.04 * p, -0.04 * p];
    smileWeight = 0.75 * p;

    fingerCurls = {
      rightCurl: 0.02 * p,
      leftCurl: 0.00,
      rightSpread: 0.40 * p,
      leftSpread: 0.00,
      thumbUp: 0.15 * p,
      thumbOut: 0.45 * p,
      rightFlutter: waveCycle * 0.08,
      leftFlutter: 0.0,
    };

  } else if (s === 'thankyou' || s === 'thanks') {
    // ── 2. ISL "THANK YOU" (Chin Touch extending forward) ─────────────────────
    let p = 0;
    if (t < 0.45) {
      p = Math.sin((t / 0.45) * Math.PI);
      bones['RightArm'] = [0.30 * p + restRArm[0] * (1 - p), -0.15 * p, -0.85 * p + restRArm[2] * (1 - p)];
      bones['RightForeArm'] = [0.00, 0.00, -1.80 * p + restRForeArm[2] * (1 - p)];
      bones['RightHand'] = [0.25 * p, -0.10 * p, 0.05 * p];
      bones['Head'] = [0.06 * p, 0, 0];
      smileWeight = 0.60 * p;
    } else {
      const p2 = Math.sin(((t - 0.45) / 0.55) * Math.PI);
      bones['RightArm'] = [0.45 * p2 + restRArm[0] * (1 - p2), -0.10 * p2, -0.95 * p2 + restRArm[2] * (1 - p2)];
      bones['RightForeArm'] = [0.00, 0.00, -0.65 * p2 + restRForeArm[2] * (1 - p2)];
      bones['RightHand'] = [0.15 * p2, -0.10 * p2, 0.00];
      bones['Head'] = [0.08 * p2, 0, 0];
      smileWeight = 0.80 * p2;
    }
    fingerCurls = {
      rightCurl: 0.04 * env,
      leftCurl: 0.00,
      rightSpread: 0.10 * env,
      leftSpread: 0.00,
      thumbUp: 0.15 * env,
      thumbOut: 0.25 * env,
      rightFlutter: 0.0,
      leftFlutter: 0.0,
    };

  } else if (s === 'goodafternoon') {
    // ── 3. OFFICIAL ISL "GOOD AFTERNOON" ──────────────────────────────────────
    if (t < 0.40) {
      // Phase 1: "GOOD" — Chin Touch
      const p = Math.sin((t / 0.40) * Math.PI);
      bones['RightArm'] = [0.32 * p + restRArm[0] * (1 - p), -0.15 * p, -0.85 * p + restRArm[2] * (1 - p)];
      bones['RightForeArm'] = [0.00, 0.00, -1.75 * p + restRForeArm[2] * (1 - p)];
      bones['RightHand'] = [0.25 * p, -0.10 * p, 0.05 * p];
      bones['Head'] = [0.08 * p, 0, 0];
      smileWeight = 0.65 * p;

      fingerCurls = {
        rightCurl: 0.05 * p,
        leftCurl: 0.00,
        rightSpread: 0.20 * p,
        leftSpread: 0.00,
        thumbUp: 0.15 * p,
        thumbOut: 0.30 * p,
        rightFlutter: 0.0,
        leftFlutter: 0.0,
      };
    } else {
      // Phase 2: "AFTERNOON" — Left horizon base + Right vertical sun stroke
      const p2 = Math.sin(((t - 0.40) / 0.60) * Math.PI);
      const stroke = (t - 0.40) / 0.60;
      const strokeEase = Math.sin(stroke * (Math.PI / 2));

      // Left Arm: Horizontal horizon base across lower chest
      bones['LeftArm'] = [0.28 * p2 + restLArm[0] * (1 - p2), 0.15 * p2, 0.90 * p2 + restLArm[2] * (1 - p2)];
      bones['LeftForeArm'] = [0.00, 0.00, 1.45 * p2 + restLForeArm[2] * (1 - p2)];
      bones['LeftHand'] = [0.20 * p2, 0.00, 0.00];

      // Right Arm: Vertical sun stroke from 12 o'clock downward
      const vertArmX = THREE.MathUtils.lerp(0.38, 0.28, strokeEase);
      const vertArmZ = THREE.MathUtils.lerp(-0.55, -0.85, strokeEase);
      const vertForeZ = THREE.MathUtils.lerp(-1.65, -1.15, strokeEase);
      const vertHandX = THREE.MathUtils.lerp(0.30, 0.15, strokeEase);

      bones['RightArm'] = [
        vertArmX * p2 + restRArm[0] * (1 - p2),
        -0.15 * p2,
        vertArmZ * p2 + restRArm[2] * (1 - p2),
      ];
      bones['RightForeArm'] = [0.00, 0.00, vertForeZ * p2 + restRForeArm[2] * (1 - p2)];
      bones['RightHand'] = [vertHandX * p2, -0.10 * p2, 0.05 * p2];

      bones['Head'] = [0.08 * p2, 0.00, 0];
      smileWeight = 0.70 * p2;

      fingerCurls = {
        rightCurl: 0.00,
        leftCurl: 0.00,
        rightSpread: 0.45 * p2,
        leftSpread: 0.15 * p2,
        thumbUp: 0.25 * p2,
        thumbOut: 0.50 * p2,
        rightFlutter: 0.0,
        leftFlutter: 0.0,
      };
    }

  } else if (s === 'goodmorning') {
    // ── 4. ISL "GOOD MORNING" — Chin Touch to Rising Sun ─────────────────────
    if (t < 0.42) {
      const p = Math.sin((t / 0.42) * Math.PI);
      bones['RightArm'] = [0.32 * p + restRArm[0] * (1 - p), -0.15 * p, -0.85 * p + restRArm[2] * (1 - p)];
      bones['RightForeArm'] = [0.00, 0.00, -1.75 * p + restRForeArm[2] * (1 - p)];
      bones['RightHand'] = [0.25 * p, -0.10 * p, 0.05 * p];
      bones['Head'] = [0.08 * p, 0, 0];
      smileWeight = 0.65 * p;
      fingerCurls = {
        rightCurl: 0.05 * p,
        leftCurl: 0.00,
        rightSpread: 0.20 * p,
        leftSpread: 0.00,
        thumbUp: 0.15 * p,
        thumbOut: 0.30 * p,
        rightFlutter: 0.0,
        leftFlutter: 0.0,
      };
    } else {
      const p2 = Math.sin(((t - 0.42) / 0.58) * Math.PI);
      bones['LeftArm'] = [0.28 * p2 + restLArm[0] * (1 - p2), 0.15 * p2, 0.90 * p2 + restLArm[2] * (1 - p2)];
      bones['LeftForeArm'] = [0.00, 0.00, 1.45 * p2 + restLForeArm[2] * (1 - p2)];
      bones['LeftHand'] = [0.20 * p2, 0.00, 0.00];

      bones['RightArm'] = [0.35 * p2 + restRArm[0] * (1 - p2), -0.15 * p2, -0.60 * p2 + restRArm[2] * (1 - p2)];
      bones['RightForeArm'] = [0.00, 0.00, -1.40 * p2 + restRForeArm[2] * (1 - p2)];
      bones['RightHand'] = [0.25 * p2, -0.10 * p2, 0.10 * p2];
      bones['Head'] = [0.10 * p2, 0, 0];
      smileWeight = 0.75 * p2;
      fingerCurls = {
        rightCurl: 0.00,
        leftCurl: 0.00,
        rightSpread: 0.45 * p2,
        leftSpread: 0.15 * p2,
        thumbUp: 0.25 * p2,
        thumbOut: 0.50 * p2,
        rightFlutter: 0.0,
        leftFlutter: 0.0,
      };
    }

  } else if (s === 'goodevening') {
    // ── 5. ISL "GOOD EVENING" — Sunset below Horizon ──────────────────────────
    if (t < 0.42) {
      const p = Math.sin((t / 0.42) * Math.PI);
      bones['RightArm'] = [0.32 * p + restRArm[0] * (1 - p), -0.15 * p, -0.85 * p + restRArm[2] * (1 - p)];
      bones['RightForeArm'] = [0.00, 0.00, -1.75 * p + restRForeArm[2] * (1 - p)];
      bones['RightHand'] = [0.25 * p, -0.10 * p, 0.05 * p];
      bones['Head'] = [0.08 * p, 0, 0];
      smileWeight = 0.65 * p;
    } else {
      const p2 = Math.sin(((t - 0.42) / 0.58) * Math.PI);
      bones['LeftArm'] = [0.28 * p2 + restLArm[0] * (1 - p2), 0.15 * p2, 0.90 * p2 + restLArm[2] * (1 - p2)];
      bones['LeftForeArm'] = [0.00, 0.00, 1.45 * p2 + restLForeArm[2] * (1 - p2)];
      bones['LeftHand'] = [0.20 * p2, 0.00, 0.00];

      bones['RightArm'] = [0.28 * p2 + restRArm[0] * (1 - p2), -0.10 * p2, -1.15 * p2 + restRArm[2] * (1 - p2)];
      bones['RightForeArm'] = [0.00, 0.00, -0.90 * p2 + restRForeArm[2] * (1 - p2)];
      bones['RightHand'] = [0.15 * p2, -0.10 * p2, 0.05 * p2];
      bones['Head'] = [0.08 * p2, -0.04 * p2, 0];
      smileWeight = 0.55 * p2;
      fingerCurls = {
        rightCurl: 0.05 * p2,
        leftCurl: 0.00,
        rightSpread: 0.25 * p2,
        leftSpread: 0.10 * p2,
        thumbUp: 0.15 * p2,
        thumbOut: 0.30 * p2,
        rightFlutter: 0.0,
        leftFlutter: 0.0,
      };
    }

  } else if (s === 'goodnight') {
    // ── 6. ISL "GOOD NIGHT" — Both Hands at Cheek (Sleep Posture) ───────────
    bones['RightArm'] = [0.32 * env + restRArm[0] * (1 - env), -0.30 * env, -0.70 * env + restRArm[2] * (1 - env)];
    bones['LeftArm'] = [0.35 * env + restLArm[0] * (1 - env), 0.20 * env, 0.65 * env + restLArm[2] * (1 - env)];
    bones['RightForeArm'] = [0.00, 0.00, -1.85 * env + restRForeArm[2] * (1 - env)];
    bones['LeftForeArm'] = [0.00, 0.00, 1.70 * env + restLForeArm[2] * (1 - env)];
    bones['RightHand'] = [0.25 * env, -0.30 * env, 0.15 * env];
    bones['LeftHand'] = [0.25 * env, 0.30 * env, -0.15 * env];
    bones['Head'] = [0.08 * env, -0.15 * env, 0.20 * env];
    smileWeight = 0.4 * env;
    fingerCurls = {
      rightCurl: 0.15 * env,
      leftCurl: 0.15 * env,
      rightSpread: 0.10 * env,
      leftSpread: 0.10 * env,
      thumbUp: 0.15 * env,
      thumbOut: 0.20 * env,
      rightFlutter: 0.0,
      leftFlutter: 0.0,
    };

  } else if (s === 'howareyou') {
    // ── 7. ISL "HOW ARE YOU" — Palms Open Forward from Chest ────────────────
    bones['RightArm'] = [0.32 * env + restRArm[0] * (1 - env), -0.15 * env, -0.85 * env + restRArm[2] * (1 - env)];
    bones['LeftArm'] = [0.32 * env + restLArm[0] * (1 - env), 0.15 * env, 0.85 * env + restLArm[2] * (1 - env)];
    bones['RightForeArm'] = [0.00, 0.00, -1.15 * env + restRForeArm[2] * (1 - env)];
    bones['LeftForeArm'] = [0.00, 0.00, 1.15 * env + restLForeArm[2] * (1 - env)];
    bones['RightHand'] = [0.25 * env, -0.15 * env, 0.10 * env];
    bones['LeftHand'] = [0.25 * env, 0.15 * env, -0.10 * env];
    bones['Head'] = [0.10 * env, 0, 0];
    smileWeight = 0.6 * env;
    fingerCurls = {
      rightCurl: 0.08 * env,
      leftCurl: 0.08 * env,
      rightSpread: 0.35 * env,
      leftSpread: 0.35 * env,
      thumbUp: 0.25 * env,
      thumbOut: 0.45 * env,
      rightFlutter: 0.0,
      leftFlutter: 0.0,
    };

  } else if (s === 'namaste' || s === 'pleased') {
    // ── 8. ISL "NAMASTE / PLEASED" (Both Palms Meeting at Heart Center) ───────
    bones['RightArm'] = [0.28 * env + restRArm[0] * (1 - env), -0.25 * env, -0.95 * env + restRArm[2] * (1 - env)];
    bones['LeftArm'] = [0.28 * env + restLArm[0] * (1 - env), 0.25 * env, 0.95 * env + restLArm[2] * (1 - env)];
    bones['RightForeArm'] = [0.00, 0.00, -1.60 * env + restRForeArm[2] * (1 - env)];
    bones['LeftForeArm'] = [0.00, 0.00, 1.60 * env + restLForeArm[2] * (1 - env)];
    bones['RightHand'] = [0.30 * env, -0.30 * env, 0.10 * env];
    bones['LeftHand'] = [0.30 * env, 0.30 * env, -0.10 * env];
    bones['Head'] = [0.12 * env, 0, 0];
    bones['Spine1'] = [0.04 * env, 0, 0];
    smileWeight = 0.6 * env;
    fingerCurls = {
      rightCurl: 0.04 * env,
      leftCurl: 0.04 * env,
      rightSpread: 0.08 * env,
      leftSpread: 0.08 * env,
      thumbUp: 0.20 * env,
      thumbOut: 0.25 * env,
      rightFlutter: 0.0,
      leftFlutter: 0.0,
    };

  } else if (s === 'alright' || s === 'ok') {
    // ── 9. ISL "ALRIGHT / THUMBS UP" ──────────────────────────────────────────
    bones['RightArm'] = [0.25 * env + restRArm[0] * (1 - env), -0.15 * env, -1.05 * env + restRArm[2] * (1 - env)];
    bones['LeftArm'] = [0.25 * env + restLArm[0] * (1 - env), 0.15 * env, 1.05 * env + restLArm[2] * (1 - env)];
    bones['RightForeArm'] = [0.00, 0.00, -1.45 * env + restRForeArm[2] * (1 - env)];
    bones['LeftForeArm'] = [0.00, 0.00, 1.45 * env + restLForeArm[2] * (1 - env)];
    bones['RightHand'] = [0.15 * env, -0.65 * env, -0.45 * env];
    bones['LeftHand'] = [0.15 * env, 0.65 * env, 0.45 * env];
    bones['Head'] = [0.10 * env, 0, 0];
    smileWeight = 0.85 * env;
    fingerCurls = {
      rightCurl: 1.0 * env,
      leftCurl: 1.0 * env,
      rightSpread: 0.0,
      leftSpread: 0.0,
      thumbUp: 1.0 * env,
      thumbOut: 0.0,
      rightFlutter: 0.0,
      leftFlutter: 0.0,
    };
  }

  return { bones, fingerCurls, smileWeight };
}

export function buildAnimationClipJson(
  clipName: string,
  frames: { time: number; rotations: Record<string, [number, number, number, number]> }[]
) {
  if (!frames.length) return null;

  const times = frames.map((frame) => round4(frame.time));
  const tracks = Object.keys(frames[0].rotations).map((boneName) => {
    const values = frames.flatMap((frame) => frame.rotations[boneName] || [0, 0, 0, 1]);
    return {
      name: `${boneName}.quaternion`,
      type: 'quaternion',
      times,
      values: values.map(round4),
    };
  });

  return {
    name: clipName.toLowerCase(),
    duration: times[times.length - 1] || 1,
    tracks,
  };
}

export function buildCompactFrameRigJson(
  word: string,
  frames: { time: number; rotations: Record<string, [number, number, number, number]> }[],
  sourceTake: string
) {
  return {
    word: word.toLowerCase(),
    fps: 30,
    totalFrames: frames.length,
    durationSec: frames.length ? round4(frames[frames.length - 1].time) : 0,
    sourceTake,
    frames: frames.map((frame) => ({ time: round4(frame.time), bones: frame.rotations })),
  };
}

// ─── 6. Build Synthesized High-Fidelity AnimationClip for any Sign ───────────
export function synthesizeISLAnimationClip(
  wordName: string,
  fps = 30,
  durationSec = 2.8
): any {
  const totalFrames = Math.floor(durationSec * fps);
  const solvedFrames: { time: number; rotations: Record<string, [number, number, number, number]> }[] = [];

  for (let i = 0; i <= totalFrames; i++) {
    const progress = i / totalFrames;
    const timeSec = i / fps;
    const res = evaluateISLSignTargets(wordName, progress);
    const rotations: Record<string, [number, number, number, number]> = {};

    // 1. Upper body & arms
    for (const [boneName, eulerArr] of Object.entries(res.bones)) {
      const e = new THREE.Euler(eulerArr[0], eulerArr[1], eulerArr[2], 'XYZ');
      const q = new THREE.Quaternion().setFromEuler(e);
      rotations[`mixamorig${boneName}`] = [round4(q.x), round4(q.y), round4(q.z), round4(q.w)];
    }

    // 2. 15 Left & 15 Right finger bones
    const sides: ('Left' | 'Right')[] = ['Left', 'Right'];
    sides.forEach((side) => {
      const isRight = side === 'Right';
      const sign = isRight ? -1 : 1;
      const curl = isRight ? res.fingerCurls.rightCurl : res.fingerCurls.leftCurl;
      const spread = isRight ? res.fingerCurls.rightSpread : res.fingerCurls.leftSpread;
      const thumbUp = res.fingerCurls.thumbUp;
      const thumbOut = res.fingerCurls.thumbOut;

      const fingers = [
        { name: 'Index', spreadOffset: -0.12 },
        { name: 'Middle', spreadOffset: 0.00 },
        { name: 'Ring', spreadOffset: 0.10 },
        { name: 'Pinky', spreadOffset: 0.20 },
      ];

      fingers.forEach(({ name, spreadOffset }) => {
        const q1 = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, (spread + spreadOffset) * 0.35 * sign, curl * 0.85 * sign, 'XYZ')
        );
        const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, curl * 0.95 * sign, 'XYZ'));
        const q3 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, curl * 0.65 * sign, 'XYZ'));

        rotations[`mixamorig${side}Hand${name}1`] = [round4(q1.x), round4(q1.y), round4(q1.z), round4(q1.w)];
        rotations[`mixamorig${side}Hand${name}2`] = [round4(q2.x), round4(q2.y), round4(q2.z), round4(q2.w)];
        rotations[`mixamorig${side}Hand${name}3`] = [round4(q3.x), round4(q3.y), round4(q3.z), round4(q3.w)];
      });

      // Thumb 1, 2, 3
      const tq1 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(thumbUp * 0.45, -thumbOut * 0.55 * sign, -thumbOut * 0.45 * sign, 'XYZ')
      );
      const tq2 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -thumbOut * 0.35 * sign, -thumbOut * 0.40 * sign, 'XYZ')
      );
      const tq3 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, -thumbOut * 0.30 * sign, 'XYZ')
      );

      rotations[`mixamorig${side}HandThumb1`] = [round4(tq1.x), round4(tq1.y), round4(tq1.z), round4(tq1.w)];
      rotations[`mixamorig${side}HandThumb2`] = [round4(tq2.x), round4(tq2.y), round4(tq2.z), round4(tq2.w)];
      rotations[`mixamorig${side}HandThumb3`] = [round4(tq3.x), round4(tq3.y), round4(tq3.z), round4(tq3.w)];
    });

    solvedFrames.push({ time: timeSec, rotations });
  }

  return buildAnimationClipJson(wordName, solvedFrames);
}
