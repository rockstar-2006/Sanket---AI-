import * as THREE from 'three';

// Pose landmark connections (MediaPipe Holistic)
const POSE_BONES: [number, number, number][] = [
  // [jointA, jointB, radius]
  [11, 12, 0.016], // Collar / Shoulders
  [11, 13, 0.015], // Left Upper Arm
  [13, 15, 0.013], // Left Forearm
  [12, 14, 0.015], // Right Upper Arm
  [14, 16, 0.013], // Right Forearm
  [11, 23, 0.014], // Left Ribs/Torso
  [12, 24, 0.014], // Right Ribs/Torso
  [23, 24, 0.015], // Hips/Pelvis
];

// Hand landmark connections (21 joints)
const HAND_BONES: [number, number, number][] = [
  // Thumb
  [0, 1, 0.007], [1, 2, 0.0065], [2, 3, 0.006], [3, 4, 0.0055],
  // Index
  [0, 5, 0.0065], [5, 6, 0.006], [6, 7, 0.0055], [7, 8, 0.005],
  // Middle
  [0, 9, 0.0065], [9, 10, 0.006], [10, 11, 0.0055], [11, 12, 0.005],
  // Ring
  [0, 13, 0.0065], [13, 14, 0.006], [14, 15, 0.0055], [15, 16, 0.005],
  // Pinky
  [0, 17, 0.006], [17, 18, 0.0055], [18, 19, 0.005], [19, 20, 0.0045],
  // Knuckle arch
  [5, 9, 0.005], [9, 13, 0.005], [13, 17, 0.005],
];

// Key mouth landmark loop in MediaPipe Holistic face mesh
const MOUTH_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];

const _V_UP = new THREE.Vector3(0, 1, 0);
const _V_DIR = new THREE.Vector3();
const _V_MID = new THREE.Vector3();

/**
 * High-Visibility 3D Holographic Skeletal Avatar
 * Designed specifically for sign language clarity, depth perception, and accessibility.
 * Features volumetric 3D limbs, articulated hands, palm plates, head silhouette, and facial landmarks.
 */
export class Holographic3DSkeleton {
  public group: THREE.Group;

  // Volumetric 3D Pose Limbs
  private poseBoneMeshes: THREE.Mesh[] = [];
  private neckMesh: THREE.Mesh;
  private spineMesh: THREE.Mesh;

  // Articulated 3D Hands
  private rightHandBoneMeshes: THREE.Mesh[] = [];
  private leftHandBoneMeshes: THREE.Mesh[] = [];
  private rightPalmMesh: THREE.Mesh;
  private leftPalmMesh: THREE.Mesh;
  private rightPalmGeom: THREE.BufferGeometry;
  private leftPalmGeom: THREE.BufferGeometry;

  // Joint Nodes (Spheres)
  private poseJoints: THREE.Mesh[] = [];
  private rightHandJoints: THREE.Mesh[] = [];
  private leftHandJoints: THREE.Mesh[] = [];

  // Hand Persistence Cache (Prevents single-frame blinking / disappearing glitches)
  private lastValidRightHand: any[] | null = null;
  private rightHandLostFrames: number = 0;
  private lastValidLeftHand: any[] | null = null;
  private leftHandLostFrames: number = 0;

  // Torso Silhouette & Chest Plate
  private torsoMesh: THREE.Mesh;
  private torsoGeom: THREE.BufferGeometry;
  private torsoFrameLines: THREE.LineSegments;
  private torsoFrameGeom: THREE.BufferGeometry;

  // Head Silhouette & Facial Landmarks
  private headMesh: THREE.Mesh;
  private eyeLeftMesh: THREE.Mesh;
  private eyeRightMesh: THREE.Mesh;
  private noseMesh: THREE.Mesh;
  private mouthLine: THREE.Line;
  private mouthGeom: THREE.BufferGeometry;

  // Pinch Energy Feedback Ring
  private pinchRing: THREE.Mesh;

  // Positioning & Scale parameters (calibrated to Three.js camera view)
  private scale = 1.95;
  private centerY = 0.44;
  private centerX = 0.50;
  private baseHeight = 1.15;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'Holographic3DSkeleton';

    // Unit cylinder geometry reused for all bone segments
    const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
    const unitSphere = new THREE.SphereGeometry(1, 12, 12);

    // ─── Materials ─────────────────────────────────────────────────────────────
    // 1. Neon Cyan (Main Upper Body & Limbs)
    const cyanLimbMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.95,
    });

    const cyanJointMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    // 2. Neon Coral / Rose (Active Right Hand)
    const roseHandMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.95,
      roughness: 0.2,
      transparent: true,
      opacity: 0.96,
    });

    const roseJointMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xf43f5e,
      emissiveIntensity: 1.3,
      roughness: 0.1,
    });

    // 3. Neon Emerald (Left Hand)
    const emeraldHandMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.90,
      roughness: 0.2,
      transparent: true,
      opacity: 0.96,
    });

    const emeraldJointMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    // 4. Torso Mannequin Chest Shield
    const torsoChestMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.40,
      side: THREE.DoubleSide,
      roughness: 0.4,
      depthWrite: false,
    });

    const torsoWireMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.8,
    });

    // 5. Head Holographic Dome
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.35,
      roughness: 0.3,
    });

    // ─── Build Pose Limbs ──────────────────────────────────────────────────────
    for (let i = 0; i < POSE_BONES.length; i++) {
      const bone = new THREE.Mesh(unitCylinder, cyanLimbMat);
      bone.visible = false;
      this.group.add(bone);
      this.poseBoneMeshes.push(bone);
    }

    // Neck & Spine
    this.neckMesh = new THREE.Mesh(unitCylinder, cyanLimbMat);
    this.neckMesh.visible = false;
    this.group.add(this.neckMesh);

    this.spineMesh = new THREE.Mesh(unitCylinder, cyanLimbMat);
    this.spineMesh.visible = false;
    this.group.add(this.spineMesh);

    // Pose Joint Spheres (Shoulders, Elbows, Wrists, Hips)
    for (let i = 0; i < 33; i++) {
      const radius = i === 11 || i === 12 ? 0.022 : i === 13 || i === 14 ? 0.018 : 0.016;
      const s = new THREE.Mesh(unitSphere, cyanJointMat);
      s.scale.setScalar(radius);
      s.visible = false;
      this.group.add(s);
      this.poseJoints.push(s);
    }

    // ─── Build Torso Chest Plate ───────────────────────────────────────────────
    this.torsoGeom = new THREE.BufferGeometry();
    const torsoPos = new Float32Array(2 * 3 * 3); // 2 triangles (quad)
    this.torsoGeom.setAttribute('position', new THREE.BufferAttribute(torsoPos, 3));
    this.torsoMesh = new THREE.Mesh(this.torsoGeom, torsoChestMat);
    this.group.add(this.torsoMesh);

    this.torsoFrameGeom = new THREE.BufferGeometry();
    const framePos = new Float32Array(4 * 2 * 3); // 4 perimeter segments
    this.torsoFrameGeom.setAttribute('position', new THREE.BufferAttribute(framePos, 3));
    this.torsoFrameLines = new THREE.LineSegments(this.torsoFrameGeom, torsoWireMat);
    this.group.add(this.torsoFrameLines);

    // ─── Build Right Hand (Active Coral) ──────────────────────────────────────
    for (let i = 0; i < HAND_BONES.length; i++) {
      const bone = new THREE.Mesh(unitCylinder, roseHandMat);
      bone.visible = false;
      this.group.add(bone);
      this.rightHandBoneMeshes.push(bone);
    }
    for (let i = 0; i < 21; i++) {
      const s = new THREE.Mesh(unitSphere, roseJointMat);
      s.scale.setScalar(i === 0 ? 0.014 : i % 4 === 0 ? 0.0075 : 0.008);
      s.visible = false;
      this.group.add(s);
      this.rightHandJoints.push(s);
    }

    // Right Palm Surface
    this.rightPalmGeom = new THREE.BufferGeometry();
    const palmPosR = new Float32Array(3 * 3 * 3); // 3 triangles fan
    this.rightPalmGeom.setAttribute('position', new THREE.BufferAttribute(palmPosR, 3));
    const palmMatR = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0x9f1239,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rightPalmMesh = new THREE.Mesh(this.rightPalmGeom, palmMatR);
    this.group.add(this.rightPalmMesh);

    // ─── Build Left Hand (Emerald) ────────────────────────────────────────────
    for (let i = 0; i < HAND_BONES.length; i++) {
      const bone = new THREE.Mesh(unitCylinder, emeraldHandMat);
      bone.visible = false;
      this.group.add(bone);
      this.leftHandBoneMeshes.push(bone);
    }
    for (let i = 0; i < 21; i++) {
      const s = new THREE.Mesh(unitSphere, emeraldJointMat);
      s.scale.setScalar(i === 0 ? 0.014 : i % 4 === 0 ? 0.0075 : 0.008);
      s.visible = false;
      this.group.add(s);
      this.leftHandJoints.push(s);
    }

    // Left Palm Surface
    this.leftPalmGeom = new THREE.BufferGeometry();
    const palmPosL = new Float32Array(3 * 3 * 3);
    this.leftPalmGeom.setAttribute('position', new THREE.BufferAttribute(palmPosL, 3));
    const palmMatL = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x065f46,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.leftPalmMesh = new THREE.Mesh(this.leftPalmGeom, palmMatL);
    this.group.add(this.leftPalmMesh);

    // ─── Build Head Silhouette & Facial Cues ──────────────────────────────────
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 16), headMat);
    this.headMesh.scale.set(0.9, 1.15, 0.95);
    this.headMesh.visible = false;
    this.group.add(this.headMesh);

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.5,
    });
    this.eyeLeftMesh = new THREE.Mesh(unitSphere, eyeMat);
    this.eyeLeftMesh.scale.setScalar(0.011);
    this.eyeLeftMesh.visible = false;
    this.group.add(this.eyeLeftMesh);

    this.eyeRightMesh = new THREE.Mesh(unitSphere, eyeMat);
    this.eyeRightMesh.scale.setScalar(0.011);
    this.eyeRightMesh.visible = false;
    this.group.add(this.eyeRightMesh);

    this.noseMesh = new THREE.Mesh(unitSphere, cyanJointMat);
    this.noseMesh.scale.setScalar(0.009);
    this.noseMesh.visible = false;
    this.group.add(this.noseMesh);

    // Mouth Loop
    this.mouthGeom = new THREE.BufferGeometry();
    const mouthPos = new Float32Array(MOUTH_INDICES.length * 3);
    this.mouthGeom.setAttribute('position', new THREE.BufferAttribute(mouthPos, 3));
    const mouthMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85,
    });
    this.mouthLine = new THREE.Line(this.mouthGeom, mouthMat);
    this.mouthLine.visible = false;
    this.group.add(this.mouthLine);

    // ─── Pinch Energy Ring ────────────────────────────────────────────────────
    const ringGeom = new THREE.TorusGeometry(0.024, 0.005, 16, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
    });
    this.pinchRing = new THREE.Mesh(ringGeom, ringMat);
    this.pinchRing.visible = false;
    this.group.add(this.pinchRing);

    scene.add(this.group);

    // Initialize with an authentic standby / resting pose so the avatar is immediately visible
    this.resetToDefaultPose();
  }

  /**
   * Reset the skeleton to a natural neutral standby posture
   */
  public resetToDefaultPose() {
    this.lastValidRightHand = null;
    this.rightHandLostFrames = 0;
    this.lastValidLeftHand = null;
    this.leftHandLostFrames = 0;
    this.update(createNeutralPoseLandmarks());
  }

  /**
   * Convert normalized MediaPipe coordinates (0..1) to 3D World Space coordinates
   * with proper scale, elevation, and optional depth anchoring offset.
   */
  private toWorld(pt: { x: number; y: number; z?: number }, zAnchor = 0): THREE.Vector3 {
    const rawX = isNaN(pt.x) ? this.centerX : pt.x;
    const rawY = isNaN(pt.y) ? this.centerY : pt.y;
    const rawZ = isNaN(pt.z as number) ? 0 : (pt.z || 0);
    const x = (rawX - this.centerX) * this.scale;
    const y = -(rawY - this.centerY) * this.scale + this.baseHeight;
    const z = -((rawZ + zAnchor) * this.scale * 0.85);
    return new THREE.Vector3(x, y, z);
  }

  /**
   * Position, orient, and stretch a volumetric cylinder between two 3D points
   */
  private alignBone(
    mesh: THREE.Mesh,
    pA: THREE.Vector3,
    pB: THREE.Vector3,
    radius: number,
    maxAllowedLen = 0.65
  ) {
    const dist = pA.distanceTo(pB);
    if (!isFinite(dist) || dist < 0.002 || dist > maxAllowedLen) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    _V_MID.copy(pA).add(pB).multiplyScalar(0.5);
    mesh.position.copy(_V_MID);
    mesh.scale.set(radius, dist, radius);
    _V_DIR.subVectors(pB, pA).normalize();

    // Singularity protection when pointing straight down: prevents violent 180-deg limb flips
    if (_V_DIR.y < -0.9999) {
      mesh.quaternion.set(0, 0, 1, 0); // stable 180-deg rotation around Z
    } else if (_V_DIR.y > 0.9999) {
      mesh.quaternion.set(0, 0, 0, 1);
    } else {
      mesh.quaternion.setFromUnitVectors(_V_UP, _V_DIR);
    }
  }

  public updateLandmarks(
    poseLandmarks: any,
    leftHandLandmarks: any,
    rightHandLandmarks: any,
    faceLandmarks: any
  ) {
    this.update({
      poseLandmarks,
      leftHandLandmarks,
      rightHandLandmarks,
      faceLandmarks,
    });
  }

  public update(frameData: any) {
    if (!frameData) return;

    const pose = frameData.poseLandmarks;
    const rh = frameData.rightHandLandmarks;
    const lh = frameData.leftHandLandmarks;
    const face = frameData.faceLandmarks;

    // ─── 1. Pose Body Limbs & Joints ──────────────────────────────────────────
    if (pose && pose.length >= 25) {
      // Depth anchors for hands & head
      const rightWristZ = pose[16]?.z ?? 0;
      const leftWristZ = pose[15]?.z ?? 0;
      const noseZ = pose[0]?.z ?? 0;

      const pWristPoseR = pose[16];
      const vWristR = (pWristPoseR && (pWristPoseR.x !== 0 || pWristPoseR.y !== 0))
        ? this.toWorld(pWristPoseR)
        : null;

      const pWristPoseL = pose[15];
      const vWristL = (pWristPoseL && (pWristPoseL.x !== 0 || pWristPoseL.y !== 0))
        ? this.toWorld(pWristPoseL)
        : null;

      // Update major body limbs
      for (let i = 0; i < POSE_BONES.length; i++) {
        const [a, b, radius] = POSE_BONES[i];
        const ptA = pose[a];
        const ptB = pose[b];
        if (ptA && ptB && (ptA.x !== 0 || ptA.y !== 0) && (ptB.x !== 0 || ptB.y !== 0)) {
          const vA = this.toWorld(ptA);
          const vB = this.toWorld(ptB);
          this.alignBone(this.poseBoneMeshes[i], vA, vB, radius, 0.65);
        } else {
          this.poseBoneMeshes[i].visible = false;
        }
      }

      // Shoulders & Pelvis midpoints for Neck & Spine
      const p11 = pose[11];
      const p12 = pose[12];
      const p23 = pose[23];
      const p24 = pose[24];
      const pNose = pose[0];

      if (p11 && p12 && p23 && p24) {
        const v11 = this.toWorld(p11);
        const v12 = this.toWorld(p12);
        const v23 = this.toWorld(p23);
        const v24 = this.toWorld(p24);

        const vShoulderMid = new THREE.Vector3().addVectors(v11, v12).multiplyScalar(0.5);
        const vHipsMid = new THREE.Vector3().addVectors(v23, v24).multiplyScalar(0.5);

        // Spine
        this.alignBone(this.spineMesh, vShoulderMid, vHipsMid, 0.016, 0.75);

        // Neck
        if (pNose) {
          const vNose = this.toWorld(pNose);
          const vChin = new THREE.Vector3().copy(vNose).add(vShoulderMid).multiplyScalar(0.5);
          this.alignBone(this.neckMesh, vShoulderMid, vChin, 0.014, 0.35);
        }

        // Check for reasonable shoulder and torso dimensions to prevent exploded geometry
        const shoulderDist = v11.distanceTo(v12);
        const spineDist = vShoulderMid.distanceTo(vHipsMid);
        if (shoulderDist > 0.08 && shoulderDist < 0.90 && spineDist > 0.08 && spineDist < 0.95) {
          // Torso Chest Plate
          const tPos = (this.torsoGeom.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
          // Tri 1: 11 -> 12 -> 24
          tPos[0] = v11.x; tPos[1] = v11.y; tPos[2] = v11.z;
          tPos[3] = v12.x; tPos[4] = v12.y; tPos[5] = v12.z;
          tPos[6] = v24.x; tPos[7] = v24.y; tPos[8] = v24.z;
          // Tri 2: 11 -> 24 -> 23
          tPos[9] = v11.x; tPos[10] = v11.y; tPos[11] = v11.z;
          tPos[12] = v24.x; tPos[13] = v24.y; tPos[14] = v24.z;
          tPos[15] = v23.x; tPos[16] = v23.y; tPos[17] = v23.z;
          (this.torsoGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
          this.torsoMesh.visible = true;

          // Torso Border Wireframe
          const fPos = (this.torsoFrameGeom.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
          // 11 -> 12
          fPos[0] = v11.x; fPos[1] = v11.y; fPos[2] = v11.z; fPos[3] = v12.x; fPos[4] = v12.y; fPos[5] = v12.z;
          // 12 -> 24
          fPos[6] = v12.x; fPos[7] = v12.y; fPos[8] = v12.z; fPos[9] = v24.x; fPos[10] = v24.y; fPos[11] = v24.z;
          // 24 -> 23
          fPos[12] = v24.x; fPos[13] = v24.y; fPos[14] = v24.z; fPos[15] = v23.x; fPos[16] = v23.y; fPos[17] = v23.z;
          // 23 -> 11
          fPos[18] = v23.x; fPos[19] = v23.y; fPos[20] = v23.z; fPos[21] = v11.x; fPos[22] = v11.y; fPos[23] = v11.z;
          (this.torsoFrameGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
          this.torsoFrameLines.visible = true;
        } else {
          this.torsoMesh.visible = false;
          this.torsoFrameLines.visible = false;
        }
        this.torsoFrameLines.visible = true;
      } else {
        this.torsoMesh.visible = false;
        this.torsoFrameLines.visible = false;
      }

      // Joint Nodes
      for (let i = 0; i < 33; i++) {
        const pt = pose[i];
        if (
          pt &&
          (pt.x !== 0 || pt.y !== 0) &&
          (i === 11 || i === 12 || i === 13 || i === 14 || i === 15 || i === 16 || i === 23 || i === 24)
        ) {
          const v = this.toWorld(pt);
          this.poseJoints[i].position.copy(v);
          this.poseJoints[i].visible = true;
        } else {
          this.poseJoints[i].visible = false;
        }
      }

      // ─── 2. Head Silhouette & Facial Landmarks ──────────────────────────────
      if (pNose) {
        const vNose = this.toWorld(pNose);
        this.noseMesh.position.copy(vNose);
        this.noseMesh.visible = true;

        const pEarL = pose[7];
        const pEarR = pose[8];
        if (pEarL && pEarR) {
          const vEarL = this.toWorld(pEarL);
          const vEarR = this.toWorld(pEarR);
          const vHeadCenter = new THREE.Vector3().addVectors(vEarL, vEarR).multiplyScalar(0.5);
          vHeadCenter.y += 0.02;
          this.headMesh.position.copy(vHeadCenter);
          this.headMesh.visible = true;
        } else {
          this.headMesh.position.copy(vNose).add(new THREE.Vector3(0, 0.03, -0.06));
          this.headMesh.visible = true;
        }
      } else {
        this.headMesh.visible = false;
        this.noseMesh.visible = false;
      }

      // Eyes
      const pEyeL = pose[2];
      const pEyeR = pose[5];
      if (pEyeL && (pEyeL.x !== 0 || pEyeL.y !== 0)) {
        this.eyeLeftMesh.position.copy(this.toWorld(pEyeL));
        this.eyeLeftMesh.visible = true;
      } else {
        this.eyeLeftMesh.visible = false;
      }
      if (pEyeR && (pEyeR.x !== 0 || pEyeR.y !== 0)) {
        this.eyeRightMesh.position.copy(this.toWorld(pEyeR));
        this.eyeRightMesh.visible = true;
      } else {
        this.eyeRightMesh.visible = false;
      }

      // Mouth Loop from Face Mesh
      if (face && face.length >= 400) {
        const mPos = (this.mouthGeom.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
        let ptr = 0;
        for (let i = 0; i < MOUTH_INDICES.length; i++) {
          const idx = MOUTH_INDICES[i];
          const pt = face[idx];
          if (pt && (pt.x !== 0 || pt.y !== 0)) {
            const v = this.toWorld(pt, noseZ);
            mPos[ptr++] = v.x; mPos[ptr++] = v.y; mPos[ptr++] = v.z;
          } else {
            mPos[ptr++] = 0; mPos[ptr++] = 0; mPos[ptr++] = 0;
          }
        }
        (this.mouthGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
        this.mouthLine.visible = true;
      } else {
        this.mouthLine.visible = false;
      }

      // ─── 3. Right Hand (Active Coral) ───────────────────────────────────────
      let activeRH = rh;
      if (rh && rh.length >= 21 && rh.some((p: any) => p && (p.x !== 0 || p.y !== 0))) {
        this.lastValidRightHand = rh;
        this.rightHandLostFrames = 0;
      } else if (this.lastValidRightHand && this.rightHandLostFrames < 3) {
        this.rightHandLostFrames++;
        activeRH = this.lastValidRightHand;
      } else {
        activeRH = null;
        this.lastValidRightHand = null;
      }

      if (activeRH && activeRH.length >= 21) {
        const vJointsR: THREE.Vector3[] = [];
        for (let i = 0; i < 21; i++) {
          const pt = activeRH[i];
          const v = this.toWorld(pt, rightWristZ);
          vJointsR.push(v);
        }

        // Physical detachment check: Hand MUST be attached to the right forearm wrist!
        let handValidR = true;
        if (vWristR) {
          const dxR = vJointsR[0].x - vWristR.x;
          const dyR = vJointsR[0].y - vWristR.y;
          const dist2DR = Math.sqrt(dxR * dxR + dyR * dyR);
          if (dist2DR > 0.28) {
            // Hand is detached from forearm (e.g. arm lowered to side, ghost hand in stomach)
            handValidR = false;
            activeRH = null;
            this.lastValidRightHand = null;
          } else {
            // Seamlessly anchor hand root (joint 0) directly to forearm wrist (pose 16)
            const offsetR = new THREE.Vector3().subVectors(vWristR, vJointsR[0]);
            for (let i = 0; i < 21; i++) {
              vJointsR[i].add(offsetR);
            }
          }
        }

        if (handValidR) {
          for (let i = 0; i < 21; i++) {
            this.rightHandJoints[i].position.copy(vJointsR[i]);
            this.rightHandJoints[i].visible = true;
          }

          for (let i = 0; i < HAND_BONES.length; i++) {
            const [a, b, r] = HAND_BONES[i];
            this.alignBone(this.rightHandBoneMeshes[i], vJointsR[a], vJointsR[b], r, 0.22);
          }

          // Right Palm Plate (Wrist 0 to Knuckles 5, 9, 13, 17)
          const wristToMidKnuckleR = vJointsR[0].distanceTo(vJointsR[9]);
          if (wristToMidKnuckleR > 0.02 && wristToMidKnuckleR < 0.28) {
            const pR = (this.rightPalmGeom.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
            // Tri 1: 0 -> 5 -> 9
            pR[0] = vJointsR[0].x; pR[1] = vJointsR[0].y; pR[2] = vJointsR[0].z;
            pR[3] = vJointsR[5].x; pR[4] = vJointsR[5].y; pR[5] = vJointsR[5].z;
            pR[6] = vJointsR[9].x; pR[7] = vJointsR[9].y; pR[8] = vJointsR[9].z;
            // Tri 2: 0 -> 9 -> 13
            pR[9] = vJointsR[0].x; pR[10] = vJointsR[0].y; pR[11] = vJointsR[0].z;
            pR[12] = vJointsR[9].x; pR[13] = vJointsR[9].y; pR[14] = vJointsR[9].z;
            pR[15] = vJointsR[13].x; pR[16] = vJointsR[13].y; pR[17] = vJointsR[13].z;
            // Tri 3: 0 -> 13 -> 17
            pR[18] = vJointsR[0].x; pR[19] = vJointsR[0].y; pR[20] = vJointsR[0].z;
            pR[21] = vJointsR[13].x; pR[22] = vJointsR[13].y; pR[23] = vJointsR[13].z;
            pR[24] = vJointsR[17].x; pR[25] = vJointsR[17].y; pR[26] = vJointsR[17].z;
            (this.rightPalmGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
            this.rightPalmMesh.visible = true;
          } else {
            this.rightPalmMesh.visible = false;
          }

          // Pinch ring disabled to prevent stray rings appearing during closed-fist signs
          this.pinchRing.visible = false;
        } else {
          for (let i = 0; i < HAND_BONES.length; i++) this.rightHandBoneMeshes[i].visible = false;
          for (let i = 0; i < 21; i++) this.rightHandJoints[i].visible = false;
          this.rightPalmMesh.visible = false;
          this.pinchRing.visible = false;
        }
      } else {
        for (let i = 0; i < HAND_BONES.length; i++) this.rightHandBoneMeshes[i].visible = false;
        for (let i = 0; i < 21; i++) this.rightHandJoints[i].visible = false;
        this.rightPalmMesh.visible = false;
        this.pinchRing.visible = false;
      }

      // ─── 4. Left Hand (Emerald) ─────────────────────────────────────────────
      let activeLH = lh;
      if (lh && lh.length >= 21 && lh.some((p: any) => p && (p.x !== 0 || p.y !== 0))) {
        this.lastValidLeftHand = lh;
        this.leftHandLostFrames = 0;
      } else if (this.lastValidLeftHand && this.leftHandLostFrames < 3) {
        this.leftHandLostFrames++;
        activeLH = this.lastValidLeftHand;
      } else {
        activeLH = null;
        this.lastValidLeftHand = null;
      }

      if (activeLH && activeLH.length >= 21) {
        const vJointsL: THREE.Vector3[] = [];
        for (let i = 0; i < 21; i++) {
          const pt = activeLH[i];
          const v = this.toWorld(pt, leftWristZ);
          vJointsL.push(v);
        }

        // Physical detachment check: Hand MUST be attached to the left forearm wrist!
        let handValidL = true;
        if (vWristL) {
          const wristDistL = vJointsL[0].distanceTo(vWristL);
          if (wristDistL > 0.28) {
            // Hand is detached from forearm, drop it!
            handValidL = false;
            activeLH = null;
            this.lastValidLeftHand = null;
          } else {
            // Seamlessly anchor hand root (joint 0) directly to forearm wrist (pose 15)
            const offsetL = new THREE.Vector3().subVectors(vWristL, vJointsL[0]);
            for (let i = 0; i < 21; i++) {
              vJointsL[i].add(offsetL);
            }
          }
        }

        if (handValidL) {
          for (let i = 0; i < 21; i++) {
            this.leftHandJoints[i].position.copy(vJointsL[i]);
            this.leftHandJoints[i].visible = true;
          }

          for (let i = 0; i < HAND_BONES.length; i++) {
            const [a, b, r] = HAND_BONES[i];
            this.alignBone(this.leftHandBoneMeshes[i], vJointsL[a], vJointsL[b], r, 0.22);
          }

          // Left Palm Plate
          const wristToMidKnuckleL = vJointsL[0].distanceTo(vJointsL[9]);
          if (wristToMidKnuckleL > 0.02 && wristToMidKnuckleL < 0.28) {
            const pL = (this.leftPalmGeom.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
            // Tri 1: 0 -> 5 -> 9
            pL[0] = vJointsL[0].x; pL[1] = vJointsL[0].y; pL[2] = vJointsL[0].z;
            pL[3] = vJointsL[5].x; pL[4] = vJointsL[5].y; pL[5] = vJointsL[5].z;
            pL[6] = vJointsL[9].x; pL[7] = vJointsL[9].y; pL[8] = vJointsL[9].z;
            // Tri 2: 0 -> 9 -> 13
            pL[9] = vJointsL[0].x; pL[10] = vJointsL[0].y; pL[11] = vJointsL[0].z;
            pL[12] = vJointsL[9].x; pL[13] = vJointsL[9].y; pL[14] = vJointsL[9].z;
            pL[15] = vJointsL[13].x; pL[16] = vJointsL[13].y; pL[17] = vJointsL[13].z;
            // Tri 3: 0 -> 13 -> 17
            pL[18] = vJointsL[0].x; pL[19] = vJointsL[0].y; pL[20] = vJointsL[0].z;
            pL[21] = vJointsL[13].x; pL[22] = vJointsL[13].y; pL[23] = vJointsL[13].z;
            pL[24] = vJointsL[17].x; pL[25] = vJointsL[17].y; pL[26] = vJointsL[17].z;
            (this.leftPalmGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
            this.leftPalmMesh.visible = true;
          } else {
            this.leftPalmMesh.visible = false;
          }
        } else {
          for (let i = 0; i < HAND_BONES.length; i++) this.leftHandBoneMeshes[i].visible = false;
          for (let i = 0; i < 21; i++) this.leftHandJoints[i].visible = false;
          this.leftPalmMesh.visible = false;
        }
      } else {
        for (let i = 0; i < HAND_BONES.length; i++) this.leftHandBoneMeshes[i].visible = false;
        for (let i = 0; i < 21; i++) this.leftHandJoints[i].visible = false;
        this.leftPalmMesh.visible = false;
      }
    }
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  public dispose() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}

/**
 * Generates an anatomically balanced, natural standby pose in normalized MediaPipe coordinates
 */
export function createNeutralPoseLandmarks() {
  const pose: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 33; i++) {
    pose.push({ x: 0.5, y: 0.5, z: 0 });
  }

  // Head & Facial Cues
  pose[0] = { x: 0.50, y: 0.18, z: -0.04 }; // Nose
  pose[2] = { x: 0.53, y: 0.16, z: -0.04 }; // Left eye
  pose[5] = { x: 0.47, y: 0.16, z: -0.04 }; // Right eye
  pose[7] = { x: 0.56, y: 0.18, z: 0.0 };   // Left ear
  pose[8] = { x: 0.44, y: 0.18, z: 0.0 };   // Right ear

  // Shoulders (Span across chest)
  pose[11] = { x: 0.62, y: 0.32, z: 0.0 }; // Left shoulder
  pose[12] = { x: 0.38, y: 0.32, z: 0.0 }; // Right shoulder

  // Elbows (Natural curve forward)
  pose[13] = { x: 0.67, y: 0.48, z: 0.04 }; // Left elbow
  pose[14] = { x: 0.33, y: 0.48, z: 0.04 }; // Right elbow

  // Wrists (Resting naturally in front of torso)
  pose[15] = { x: 0.59, y: 0.60, z: -0.05 }; // Left wrist
  pose[16] = { x: 0.41, y: 0.60, z: -0.05 }; // Right wrist

  // Pelvis / Hips
  pose[23] = { x: 0.56, y: 0.68, z: 0.0 }; // Left hip
  pose[24] = { x: 0.44, y: 0.68, z: 0.0 }; // Right hip

  // 21-Joint Relaxed Hands
  const buildRestHand = (wristX: number, wristY: number, isRight: boolean) => {
    const hand: { x: number; y: number; z: number }[] = [];
    const dir = isRight ? -1 : 1;
    for (let i = 0; i < 21; i++) {
      if (i === 0) {
        hand.push({ x: wristX, y: wristY, z: -0.05 });
      } else {
        const fingerIdx = Math.floor((i - 1) / 4);
        const jointIdx = (i - 1) % 4;
        const spread = (fingerIdx - 2) * 0.012 * dir;
        const flex = (jointIdx + 1) * 0.014;
        hand.push({
          x: wristX + spread + (fingerIdx === 0 ? dir * 0.02 : 0),
          y: wristY + flex,
          z: -0.05 - (jointIdx + 1) * 0.006,
        });
      }
    }
    return hand;
  };

  const lh = buildRestHand(0.59, 0.60, false);
  const rh = buildRestHand(0.41, 0.60, true);

  // Face Mesh (Mouth Loop)
  const face: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 468; i++) {
    face.push({ x: 0.50, y: 0.22, z: -0.02 });
  }
  const MOUTH = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];
  MOUTH.forEach((idx, i) => {
    const angle = (i / MOUTH.length) * Math.PI * 2;
    face[idx] = {
      x: 0.50 + Math.cos(angle) * 0.020,
      y: 0.24 + Math.sin(angle) * 0.010,
      z: -0.04,
    };
  });

  return {
    poseLandmarks: pose,
    leftHandLandmarks: lh,
    rightHandLandmarks: rh,
    faceLandmarks: face,
  };
}

