import * as THREE from 'three';

export interface KalidokitEuler {
  x: number;
  y: number;
  z: number;
  rotationOrder?: string;
}

export interface KalidokitPoseRig {
  Hips?: { position?: { x: number; y: number; z: number }; rotation?: KalidokitEuler };
  Spine?: KalidokitEuler;
  Chest?: KalidokitEuler;
  Neck?: KalidokitEuler;
  Head?: KalidokitEuler;
  RightUpperArm?: KalidokitEuler;
  RightLowerArm?: KalidokitEuler;
  RightHand?: KalidokitEuler;
  LeftUpperArm?: KalidokitEuler;
  LeftLowerArm?: KalidokitEuler;
  LeftHand?: KalidokitEuler;
  RightUpperLeg?: KalidokitEuler;
  RightLowerLeg?: KalidokitEuler;
  LeftUpperLeg?: KalidokitEuler;
  LeftLowerLeg?: KalidokitEuler;
}

export interface KalidokitHandRig {
  [key: string]: KalidokitEuler | undefined;
}

/**
 * Find bone by multiple common Mixamo naming conventions
 */
function findBone(boneMap: Map<string, THREE.Bone>, modelRoot: THREE.Object3D | null, ...names: string[]): THREE.Bone | THREE.Object3D | null {
  for (const n of names) {
    if (boneMap.has(n)) return boneMap.get(n)!;
    const plain = n.replace(/^mixamorig[_:]?/i, '');
    if (boneMap.has(plain)) return boneMap.get(plain)!;
    if (modelRoot) {
      const obj = modelRoot.getObjectByName(n) || modelRoot.getObjectByName(plain) || modelRoot.getObjectByName(`mixamorig:${plain}`);
      if (obj) return obj;
    }
  }
  return null;
}

/**
 * Apply rotation directly to a Mixamo bone using Kalidokit's solved angles
 */
export function applyKalidokitBoneRotation(
  bone: THREE.Bone | THREE.Object3D | null | undefined,
  rot: KalidokitEuler | undefined,
  dampen = 1.0,
  slerpFactor = 0.5
) {
  if (!bone || !rot) return;
  const order = (rot.rotationOrder as any) || 'XYZ';
  const euler = new THREE.Euler(rot.x * dampen, rot.y * dampen, rot.z * dampen, order);
  const targetQuat = new THREE.Quaternion().setFromEuler(euler);
  bone.quaternion.slerp(targetQuat, slerpFactor);
}

/**
 * Apply full Kalidokit Pose, Hands, and Face rigs directly to Mixamo bone map or 3D model root
 */
export function applyKalidokitToMixamo(
  boneMap: Map<string, THREE.Bone>,
  modelRoot: THREE.Object3D | null,
  poseRig?: KalidokitPoseRig | null,
  leftHandRig?: KalidokitHandRig | null,
  rightHandRig?: KalidokitHandRig | null,
  slerpFactor = 0.5
) {
  if (!boneMap && !modelRoot) return;

  // 1. Core Pose Rig
  if (poseRig) {
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigSpine', 'Spine'), poseRig.Spine, 0.45, slerpFactor);
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigSpine1', 'Spine1', 'Chest'), poseRig.Chest, 0.45, slerpFactor);
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigNeck', 'Neck'), poseRig.Neck, 0.35, slerpFactor);
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigHead', 'Head'), poseRig.Head, 0.85, slerpFactor);

    // Left Arm & Forearm
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigLeftArm', 'LeftArm'), poseRig.LeftUpperArm, 1.0, slerpFactor);
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigLeftForeArm', 'LeftForeArm'), poseRig.LeftLowerArm, 1.0, slerpFactor);
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigLeftHand', 'LeftHand'), poseRig.LeftHand, 1.0, slerpFactor);

    // Right Arm & Forearm
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigRightArm', 'RightArm'), poseRig.RightUpperArm, 1.0, slerpFactor);
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigRightForeArm', 'RightForeArm'), poseRig.RightLowerArm, 1.0, slerpFactor);
    applyKalidokitBoneRotation(findBone(boneMap, modelRoot, 'mixamorigRightHand', 'RightHand'), poseRig.RightHand, 1.0, slerpFactor);
  }

  // 2. Left Hand Fingers
  if (leftHandRig) {
    const fingerMap: Record<string, string> = {
      LeftThumbProximal: 'mixamorigLeftHandThumb1',
      LeftThumbIntermediate: 'mixamorigLeftHandThumb2',
      LeftThumbDistal: 'mixamorigLeftHandThumb3',
      LeftIndexProximal: 'mixamorigLeftHandIndex1',
      LeftIndexIntermediate: 'mixamorigLeftHandIndex2',
      LeftIndexDistal: 'mixamorigLeftHandIndex3',
      LeftMiddleProximal: 'mixamorigLeftHandMiddle1',
      LeftMiddleIntermediate: 'mixamorigLeftHandMiddle2',
      LeftMiddleDistal: 'mixamorigLeftHandMiddle3',
      LeftRingProximal: 'mixamorigLeftHandRing1',
      LeftRingIntermediate: 'mixamorigLeftHandRing2',
      LeftRingDistal: 'mixamorigLeftHandRing3',
      LeftLittleProximal: 'mixamorigLeftHandPinky1',
      LeftLittleIntermediate: 'mixamorigLeftHandPinky2',
      LeftLittleDistal: 'mixamorigLeftHandPinky3',
    };

    for (const [kKey, mKey] of Object.entries(fingerMap)) {
      const rot = leftHandRig[kKey];
      const bone = findBone(boneMap, modelRoot, mKey);
      if (bone && rot) {
        applyKalidokitBoneRotation(bone, rot, 1.0, slerpFactor);
      }
    }
  }

  // 3. Right Hand Fingers
  if (rightHandRig) {
    const fingerMap: Record<string, string> = {
      RightThumbProximal: 'mixamorigRightHandThumb1',
      RightThumbIntermediate: 'mixamorigRightHandThumb2',
      RightThumbDistal: 'mixamorigRightHandThumb3',
      RightIndexProximal: 'mixamorigRightHandIndex1',
      RightIndexIntermediate: 'mixamorigRightHandIndex2',
      RightIndexDistal: 'mixamorigRightHandIndex3',
      RightMiddleProximal: 'mixamorigRightHandMiddle1',
      RightMiddleIntermediate: 'mixamorigRightHandMiddle2',
      RightMiddleDistal: 'mixamorigRightHandMiddle3',
      RightRingProximal: 'mixamorigRightHandRing1',
      RightRingIntermediate: 'mixamorigRightHandRing2',
      RightRingDistal: 'mixamorigRightHandRing3',
      RightLittleProximal: 'mixamorigRightHandPinky1',
      RightLittleIntermediate: 'mixamorigRightHandPinky2',
      RightLittleDistal: 'mixamorigRightHandPinky3',
    };

    for (const [kKey, mKey] of Object.entries(fingerMap)) {
      const rot = rightHandRig[kKey];
      const bone = findBone(boneMap, modelRoot, mKey);
      if (bone && rot) {
        applyKalidokitBoneRotation(bone, rot, 1.0, slerpFactor);
      }
    }
  }
}
