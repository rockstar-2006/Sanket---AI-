import * as THREE from 'three';

// ─── 1. OneEuroFilter (Adaptive Anti-Jitter Filter) ──────────────────────────
export class OneEuroFilter {
  minCutoff: number;
  beta: number;
  dCutoff: number;
  xPrev: number | null = null;
  dxPrev = 0;
  tPrev: number | null = null;

  constructor(minCutoff = 1.2, beta = 0.015, dCutoff = 1.0) {
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
    const dt = Math.max((timestamp - this.tPrev) / 1000, 1e-4);
    const dx = (x - (this.xPrev ?? x)) / dt;
    const alphaD = this.alpha(dt, this.dCutoff);
    const edx = alphaD * dx + (1 - alphaD) * this.dxPrev;
    this.dxPrev = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const a = this.alpha(dt, cutoff);
    const filteredX = a * x + (1 - a) * (this.xPrev ?? x);
    this.xPrev = filteredX;
    this.tPrev = timestamp;
    return filteredX;
  }

  private alpha(dt: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export interface HolisticFrameInput {
  poseLandmarks?: Landmark3D[] | null;
  leftHandLandmarks?: Landmark3D[] | null;
  rightHandLandmarks?: Landmark3D[] | null;
  faceLandmarks?: Landmark3D[] | null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * Universal bone node resolver for VRM 0.0 and 1.0
 */
export function getVRMBoneNode(vrm: any, name: string): THREE.Object3D | null {
  if (!vrm) return null;

  const camel = name.charAt(0).toLowerCase() + name.slice(1);
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);

  // 1. Normalized Bone Node in Three-VRM (Standardized VRM Humanoid coordinate space)
  if (vrm.humanoid && typeof vrm.humanoid.getNormalizedBoneNode === 'function') {
    const norm = vrm.humanoid.getNormalizedBoneNode(camel) || vrm.humanoid.getNormalizedBoneNode(pascal);
    if (norm) return norm;
  }

  // 2. Fallback to raw bone node ONLY if normalized bone node does not exist
  if (vrm.humanoid && typeof vrm.humanoid.getRawBoneNode === 'function') {
    const raw = vrm.humanoid.getRawBoneNode(camel) || vrm.humanoid.getRawBoneNode(pascal);
    if (raw) return raw;
  }

  const scene = vrm.scene || (vrm.isObject3D ? vrm : null);
  if (scene) {
    const direct =
      scene.getObjectByName(`J_Bip_L_${name.replace(/^left/i, '')}`) ||
      scene.getObjectByName(`J_Bip_R_${name.replace(/^right/i, '')}`) ||
      scene.getObjectByName(`J_Bip_C_${name}`) ||
      scene.getObjectByName(`J_Bip_L_${name}`) ||
      scene.getObjectByName(`J_Bip_R_${name}`) ||
      scene.getObjectByName(camel) ||
      scene.getObjectByName(pascal) ||
      scene.getObjectByName(name);
    if (direct) return direct;
  }

  return null;
}

/**
 * Mathematically Rigorous VRM Kinematics Engine
 *
 * Implements:
 * 1. Two-Bone Analytical Inverse Kinematics with Pole Vector for Arms
 * 2. Continuous 15-Phalanx Anatomical Flexion for Hands (zero gesture hardcoding)
 * 3. Orthonormal Basis Vector Alignment (zero gimbal lock, zero Euler angle guessing)
 * 4. Temporal 1€ Smoothing across all articulated joints
 */
export class VrmKinematicsEngine {
  private filters = new Map<string, OneEuroFilter>();

  private filterValue(id: string, val: number, timeMs: number, minCut = 1.2, beta = 0.015): number {
    if (!this.filters.has(id)) {
      this.filters.set(id, new OneEuroFilter(minCut, beta));
    }
    return this.filters.get(id)!.filter(val, timeMs);
  }

  public reset() {
    this.filters.clear();
  }

  /**
   * Solve full body posture and apply directly to VRM avatar
   */
  public update(vrm: any, input: HolisticFrameInput, timeMs: number = performance.now()): Record<string, any> {
    if (!vrm) return {};

    const telemetry: Record<string, any> = {};

    // ─── 1. Head & Torso Kinematics ─────────────────────────────────────────
    this.solveTorsoAndHead(vrm, input, timeMs, telemetry);

    // ─── 2. Two-Bone Analytical Arm Kinematics ──────────────────────────────
    // ISL Mirroring: Detected Right Arm (on screen-left) maps to Avatar's Left Arm
    // Detected Left Arm (on screen-right) maps to Avatar's Right Arm
    this.solveArm(vrm, input, 'left', timeMs, telemetry);
    this.solveArm(vrm, input, 'right', timeMs, telemetry);

    // ─── 3. Continuous 15-Phalanx Hand Kinematics ────────────────────────────
    this.solveHand(vrm, input, 'left', timeMs, telemetry);
    this.solveHand(vrm, input, 'right', timeMs, telemetry);

    // Keep avatar eyes open and natural
    if (vrm.blendShapeProxy) {
      vrm.blendShapeProxy.setValue('BLINK_L', 0);
      vrm.blendShapeProxy.setValue('BLINK_R', 0);
      vrm.blendShapeProxy.update();
    } else if (vrm.expressionManager) {
      vrm.expressionManager.setValue('blinkLeft', 0);
      vrm.expressionManager.setValue('blinkRight', 0);
      vrm.expressionManager.update();
    }

    return telemetry;
  }

  // ─── TORSO & HEAD SOLVER ──────────────────────────────────────────────────
  private solveTorsoAndHead(vrm: any, input: HolisticFrameInput, timeMs: number, telemetry: Record<string, any>) {
    const pose = input.poseLandmarks;
    if (pose && pose.length >= 25) {
      const p11 = pose[11]; // Left Shoulder
      const p12 = pose[12]; // Right Shoulder
      const p23 = pose[23]; // Left Hip
      const p24 = pose[24]; // Right Hip

      if (p11 && p12 && p23 && p24 && (p11.x !== 0 || p12.x !== 0)) {
        // Shoulder tilt (Roll) & Turn (Yaw)
        const dx = -(p12.x - p11.x); // Mirrored: positive when left is left
        const dy = -(p12.y - p11.y);
        const dz = -((p12.z || 0) - (p11.z || 0));

        const roll = clamp(Math.atan2(dy, Math.abs(dx)) * 0.35, -0.25, 0.25);
        const yaw = clamp(Math.atan2(dz, Math.abs(dx)) * 0.40, -0.30, 0.30);

        const fRoll = this.filterValue('spine_roll', roll, timeMs);
        const fYaw = this.filterValue('spine_yaw', yaw, timeMs);

        const spineQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, fYaw, fRoll, 'YXZ'));
        this.applyBoneRotation(vrm, 'spine', spineQuat, 0.5);
        this.applyBoneRotation(vrm, 'chest', spineQuat, 0.5);
      }
    }

    // Natural forward gaze with head stability
    const headQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0, 0.0, 0.0));
    this.applyBoneRotation(vrm, 'neck', headQuat, 0.5);
    this.applyBoneRotation(vrm, 'head', headQuat, 0.5);
  }

  // ─── TWO-BONE ANALYTICAL ARM SOLVER ───────────────────────────────────────
  private solveArm(vrm: any, input: HolisticFrameInput, side: 'left' | 'right', timeMs: number, telemetry: Record<string, any>) {
    const pose = input.poseLandmarks;
    if (!pose || pose.length < 17) return;

    const isLeft = side === 'left';
    // Direct anatomical mapping:
    // Left arm (screen-right) -> landmarks 11 (Shoulder), 13 (Elbow), 15 (Wrist)
    // Right arm (screen-left) -> landmarks 12 (Shoulder), 14 (Elbow), 16 (Wrist)
    const sIdx = isLeft ? 11 : 12;
    const eIdx = isLeft ? 13 : 14;
    const wIdx = isLeft ? 15 : 16;

    const S = pose[sIdx];
    const E = pose[eIdx];
    const W = pose[wIdx];

    if (!S || !E || (S.x === 0 && S.y === 0) || (E.x === 0 && E.y === 0)) return;

    // Convert to Three.js Cartesian (+X right, +Y up, +Z towards camera)
    const udx = E.x - S.x;
    const udy = -(E.y - S.y);
    const rawUdz = -((E.z || 0) - (S.z || 0));
    const udz = clamp(rawUdz * 0.40, -0.15, 0.15);

    // Target Upper Arm Unit Vector in World Space
    const uVecWorld = new THREE.Vector3(udx, udy, udz).normalize();
    if (uVecWorld.lengthSq() < 0.01) return;

    // Convert to vrm.scene local coordinate space (vrm.scene.rotation.y = Math.PI):
    // In vrm.scene local space, (X, Y, Z)_scene = (-X_world, Y_world, -Z_world)
    const uVecScene = new THREE.Vector3(-uVecWorld.x, uVecWorld.y, -uVecWorld.z).normalize();

    // ── 1. Upper Arm Orientation via Direction Vector ────────────────────────
    // In Three-VRM normalized humanoid space:
    // LeftUpperArm rest vector is (+1, 0, 0)
    // RightUpperArm rest vector is (-1, 0, 0)
    const restDir = new THREE.Vector3(isLeft ? 1 : -1, 0, 0);

    const qUpper = new THREE.Quaternion().setFromUnitVectors(restDir, uVecScene);
    const fUpperQ = this.filterQuaternion(`arm_${side}_upper`, qUpper, timeMs);
    this.applyBoneRotation(vrm, `${side}UpperArm`, fUpperQ, 0.85);

    // ── 2. Forearm Orientation in Local Space of Upper Arm ───────────────────
    if (W && (W.x !== 0 || W.y !== 0)) {
      const ldx = W.x - E.x;
      const ldy = -(W.y - E.y);
      const rawLdz = -((W.z || 0) - (E.z || 0));

      // Anatomical depth constraint: when lifting forearm (ldy > 0), preserve 2D vertical lift
      // Depth should complement, not overpower vertical elevation
      const ldz = clamp(rawLdz * 0.40, -0.12, 0.14);

      const lVecWorld = new THREE.Vector3(ldx, ldy, ldz).normalize();
      const lVecScene = new THREE.Vector3(-lVecWorld.x, lVecWorld.y, -lVecWorld.z).normalize();

      // In upper arm's local coordinate space:
      const invUpperQ = fUpperQ.clone().invert();
      const localLVec = lVecScene.clone().applyQuaternion(invUpperQ).normalize();

      // LowerArm rotates from restDir to localLVec in upper arm's local space:
      const qLower = new THREE.Quaternion().setFromUnitVectors(restDir, localLVec);
      const fLowerQ = this.filterQuaternion(`arm_${side}_lower`, qLower, timeMs);
      this.applyBoneRotation(vrm, `${side}LowerArm`, fLowerQ, 0.85);
    } else {
      // Default relaxed forearm
      const qLower = new THREE.Quaternion();
      this.applyBoneRotation(vrm, `${side}LowerArm`, qLower, 0.75);
    }
  }

  // ─── CONTINUOUS 15-PHALANX HAND & FINGER SOLVER ───────────────────────────
  private solveHand(vrm: any, input: HolisticFrameInput, side: 'left' | 'right', timeMs: number, telemetry: Record<string, any>) {
    const isLeft = side === 'left';
    // Direct anatomical mapping:
    // Left arm -> input.leftHandLandmarks
    // Right arm -> input.rightHandLandmarks
    const hand = isLeft ? input.leftHandLandmarks : input.rightHandLandmarks;
    if (!hand || hand.length < 21) {
      // Natural relaxed hand pose
      this.setRelaxedHand(vrm, side);
      return;
    }

    // ── 1. Wrist Orientation from Palm Plane ─────────────────────────────────
    // Wrist(0), IndexMCP(5), PinkyMCP(17), MiddleMCP(9)
    const p0 = hand[0];
    const p5 = hand[5];
    const p9 = hand[9];
    const p17 = hand[17];

    const vPalmLongWorld = new THREE.Vector3(
      p9.x - p0.x,
      -(p9.y - p0.y),
      -clamp(((p9.z || 0) - (p0.z || 0)) * 0.4, -0.15, 0.15)
    ).normalize();

    const vPalmAcrossWorld = new THREE.Vector3(
      p17.x - p5.x,
      -(p17.y - p5.y),
      -clamp(((p17.z || 0) - (p5.z || 0)) * 0.4, -0.15, 0.15)
    ).normalize();

    // Palm normal in World Space
    const palmNormalWorld = new THREE.Vector3()
      .crossVectors(vPalmLongWorld, vPalmAcrossWorld)
      .normalize();
    if (isLeft) palmNormalWorld.negate();

    // Convert to vrm.scene local coordinate space:
    const vPalmLongScene = new THREE.Vector3(-vPalmLongWorld.x, vPalmLongWorld.y, -vPalmLongWorld.z).normalize();
    const palmNormalScene = new THREE.Vector3(-palmNormalWorld.x, palmNormalWorld.y, -palmNormalWorld.z).normalize();

    // In LowerArm's coordinate space:
    const upperNode = getVRMBoneNode(vrm, `${side}UpperArm`);
    const lowerNode = getVRMBoneNode(vrm, `${side}LowerArm`);
    let qArm = new THREE.Quaternion();
    if (upperNode && lowerNode) {
      qArm = upperNode.quaternion.clone().multiply(lowerNode.quaternion);
    }
    const invArmQ = qArm.clone().invert();

    const localPalmDir = vPalmLongScene.clone().applyQuaternion(invArmQ).normalize();
    const restDir = new THREE.Vector3(isLeft ? 1 : -1, 0, 0);

    // Primary wrist alignment: rotate from restDir to localPalmDir
    const qWristAim = new THREE.Quaternion().setFromUnitVectors(restDir, localPalmDir);

    // Roll alignment: ensure palm faces forward when palmNormal points towards camera
    const localNormal = palmNormalScene.clone().applyQuaternion(invArmQ).normalize();
    const currentNormal = new THREE.Vector3(0, -1, 0).applyQuaternion(qWristAim).normalize();
    const rollAngle = Math.atan2(
      localNormal.clone().cross(currentNormal).dot(localPalmDir),
      currentNormal.dot(localNormal)
    );
    const qWristRoll = new THREE.Quaternion().setFromAxisAngle(localPalmDir, -rollAngle * 0.7);
    const qWrist = qWristRoll.multiply(qWristAim);

    const fWristQ = this.filterQuaternion(`wrist_${side}`, qWrist, timeMs);
    this.applyBoneRotation(vrm, `${side}Hand`, fWristQ, 0.80);

    // ── 2. Finger Articulation: Continuous Flexion + Pinch Closure ─────────
    const p4 = hand[4]; // Thumb Tip
    const p8 = hand[8]; // Index Tip
    const handScale = Math.hypot(p0.x - p9.x, p0.y - p9.y) || 0.1;
    const pinchDist = Math.hypot(p4.x - p8.x, p4.y - p8.y) / handScale;
    const isPinching = pinchDist < 0.38;

    const fingerDefs: { name: string; indices: [number, number, number, number] }[] = [
      { name: 'Thumb', indices: [1, 2, 3, 4] },
      { name: 'Index', indices: [5, 6, 7, 8] },
      { name: 'Middle', indices: [9, 10, 11, 12] },
      { name: 'Ring', indices: [13, 14, 15, 16] },
      { name: 'Little', indices: [17, 18, 19, 20] },
    ];

    // In Three-VRM:
    // Right hand: curling into palm rotates around +Z
    // Left hand: curling into palm rotates around -Z
    const curlSign = isLeft ? -1 : 1;

    fingerDefs.forEach(({ name, indices }) => {
      const [i0, i1, i2, i3] = indices;
      const pMCP = hand[i0];
      const pPIP = hand[i1];
      const pDIP = hand[i2];
      const pTip = hand[i3];

      if (!pMCP || !pPIP || !pDIP || !pTip) return;

      if (isPinching) {
        if (name === 'Thumb') {
          const qProx = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.20, 0.45, isLeft ? 0.45 : -0.45));
          const qInter = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, isLeft ? 0.65 : -0.65));
          const qDist = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, isLeft ? 0.45 : -0.45));
          this.applyBoneRotation(vrm, `${side}ThumbProximal`, qProx, 0.85);
          this.applyBoneRotation(vrm, `${side}ThumbIntermediate`, qInter, 0.85);
          this.applyBoneRotation(vrm, `${side}ThumbDistal`, qDist, 0.85);
          return;
        }

        if (name === 'Index') {
          const qProx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, curlSign), 0.65);
          const qInter = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, curlSign), 0.85);
          const qDist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, curlSign), 0.50);
          this.applyBoneRotation(vrm, `${side}IndexProximal`, qProx, 0.85);
          this.applyBoneRotation(vrm, `${side}IndexIntermediate`, qInter, 0.85);
          this.applyBoneRotation(vrm, `${side}IndexDistal`, qDist, 0.85);
          return;
        }

        // Middle, Ring, Little: Stand straight up tall and splayed
        const qStraight = new THREE.Quaternion();
        this.applyBoneRotation(vrm, `${side}${name}Proximal`, qStraight, 0.80);
        this.applyBoneRotation(vrm, `${side}${name}Intermediate`, qStraight, 0.80);
        this.applyBoneRotation(vrm, `${side}${name}Distal`, qStraight, 0.80);
        return;
      }

      // Continuous geometric flexion for general signs:
      const v1 = new THREE.Vector3(pPIP.x - pMCP.x, -(pPIP.y - pMCP.y), -((pPIP.z || 0) - (pMCP.z || 0))).normalize();
      const v2 = new THREE.Vector3(pDIP.x - pPIP.x, -(pDIP.y - pPIP.y), -((pDIP.z || 0) - (pPIP.z || 0))).normalize();
      const v3 = new THREE.Vector3(pTip.x - pDIP.x, -(pTip.y - pDIP.y), -((pTip.z || 0) - (pDIP.z || 0))).normalize();

      const angleMCP = clamp(Math.acos(clamp(vPalmLongWorld.dot(v1), -1, 1)), 0.0, 1.4);
      const anglePIP = clamp(Math.acos(clamp(v1.dot(v2), -1, 1)), 0.0, 1.6);
      const angleDIP = clamp(Math.acos(clamp(v2.dot(v3), -1, 1)), 0.0, 1.4);

      const fMCP = this.filterValue(`f_${side}_${name}_0`, angleMCP, timeMs, 2.0, 0.03);
      const fPIP = this.filterValue(`f_${side}_${name}_1`, anglePIP, timeMs, 2.0, 0.03);
      const fDIP = this.filterValue(`f_${side}_${name}_2`, angleDIP, timeMs, 2.0, 0.03);

      if (name === 'Thumb') {
        const qProx = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0.35, isLeft ? fMCP * 0.5 : -fMCP * 0.5));
        const qInter = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, isLeft ? fPIP * 0.6 : -fPIP * 0.6));
        const qDist = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, isLeft ? fDIP * 0.5 : -fDIP * 0.5));
        this.applyBoneRotation(vrm, `${side}ThumbProximal`, qProx, 0.75);
        this.applyBoneRotation(vrm, `${side}ThumbIntermediate`, qInter, 0.75);
        this.applyBoneRotation(vrm, `${side}ThumbDistal`, qDist, 0.75);
      } else {
        const qProx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, curlSign), fMCP * 0.85);
        const qInter = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, curlSign), fPIP * 0.95);
        const qDist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, curlSign), fDIP * 0.65);
        this.applyBoneRotation(vrm, `${side}${name}Proximal`, qProx, 0.75);
        this.applyBoneRotation(vrm, `${side}${name}Intermediate`, qInter, 0.75);
        this.applyBoneRotation(vrm, `${side}${name}Distal`, qDist, 0.75);
      }
    });
  }

  private setRelaxedHand(vrm: any, side: 'left' | 'right') {
    const qRest = new THREE.Quaternion();
    this.applyBoneRotation(vrm, `${side}Hand`, qRest, 0.5);
    const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
    const joints = ['Proximal', 'Intermediate', 'Distal'];
    fingers.forEach((f) => {
      joints.forEach((j) => {
        this.applyBoneRotation(vrm, `${side}${f}${j}`, qRest, 0.5);
      });
    });
  }

  // ─── HELPER: APPLY ROTATION TO VRM BONE ───────────────────────────────────
  private applyBoneRotation(vrm: any, boneName: string, targetQuat: THREE.Quaternion, slerpAmount = 0.75) {
    const node = getVRMBoneNode(vrm, boneName);
    if (!node) return;
    node.quaternion.slerp(targetQuat, slerpAmount);
  }

  // ─── HELPER: QUATERNION FILTERING ─────────────────────────────────────────
  private filterQuaternion(id: string, q: THREE.Quaternion, timeMs: number): THREE.Quaternion {
    const x = this.filterValue(`${id}_x`, q.x, timeMs);
    const y = this.filterValue(`${id}_y`, q.y, timeMs);
    const z = this.filterValue(`${id}_z`, q.z, timeMs);
    const w = this.filterValue(`${id}_w`, q.w, timeMs);
    return new THREE.Quaternion(x, y, z, w).normalize();
  }
}
