import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { parquetReadObjects } from '../src/lib/hyparquet.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 1. One-Euro Filter (Anti-Jitter) ────────────────────────────────────────
class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  filter(x, timestamp) {
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

  smoothingFactor(dt, cutoff) {
    const r = 2 * Math.PI * cutoff * dt;
    return r / (r + 1);
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function getVector(p1, p2) {
  return new THREE.Vector3(p2.x - p1.x, -(p2.y - p1.y), -(p2.z - p1.z));
}

function getAngleBetween(v1, v2) {
  const dot = v1.clone().normalize().dot(v2.clone().normalize());
  return Math.acos(clamp(dot, -1, 1));
}

class SignKinematicsSolver {
  constructor() {
    this.filterMap = new Map();
  }

  getFiltered(id, val, time, minCut = 1.0, beta = 0.01) {
    if (!this.filterMap.has(id)) {
      this.filterMap.set(id, new OneEuroFilter(minCut, beta, 1.0));
    }
    return this.filterMap.get(id).filter(val, time);
  }

  reset() {
    this.filterMap.clear();
  }

  solveFrame(data, time) {
    const quaternions = {};
    const { pose, leftHand, rightHand, face } = data;

    // ── A. Spine & Chest Rotation ──────────────────────────────────────────
    if (pose && pose.length >= 25) {
      const lShoulder = pose[11], rShoulder = pose[12], lHip = pose[23], rHip = pose[24];
      if (lShoulder && rShoulder && lHip && rHip) {
        const shoulderVec = getVector(rShoulder, lShoulder).normalize();
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
      const nose = face[1], chin = face[152], lEye = face[263], rEye = face[33];
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

    // ── C. Left Arm & Forearm ───────────────────────────────────────────────
    let lUpperVec = null;
    let lForeVec = null;

    if (pose && pose.length >= 17) {
      const lShoulder = pose[11], lElbow = pose[13], lWrist = pose[15];
      if (lShoulder && lElbow && lWrist) {
        lUpperVec = getVector(lShoulder, lElbow).normalize();
        lForeVec = getVector(lElbow, lWrist).normalize();

        const lArmZ = Math.atan2(lUpperVec.y, lUpperVec.x);
        const lArmX = Math.atan2(lUpperVec.z, Math.hypot(lUpperVec.x, lUpperVec.y));
        const lArmY = Math.atan2(lUpperVec.z, lUpperVec.x) * 0.35;

        const lArmEuler = new THREE.Euler(
          clamp(lArmX * 0.85, -0.6, 1.2),
          clamp(lArmY, -0.45, 0.45),
          clamp(-lArmZ, -0.5, 1.7),
          'YXZ'
        );
        const armQuat = new THREE.Quaternion().setFromEuler(lArmEuler);

        const elbowAngle = clamp(getAngleBetween(lUpperVec, lForeVec), 0.05, 2.35);
        const forearmEuler = new THREE.Euler(0, 0, elbowAngle, 'XYZ');
        const forearmQuat = new THREE.Quaternion().setFromEuler(forearmEuler);

        const fArmQ = this.filterQuaternion('LeftArm', armQuat, time);
        const fForearmQ = this.filterQuaternion('LeftForeArm', forearmQuat, time);

        quaternions['mixamorigLeftArm'] = [fArmQ.x, fArmQ.y, fArmQ.z, fArmQ.w];
        quaternions['mixamorigLeftForeArm'] = [fForearmQ.x, fForearmQ.y, fForearmQ.z, fForearmQ.w];
      }

      // ── D. Right Arm & Forearm ──────────────────────────────────────────────
      const rShoulder = pose[12], rElbow = pose[14], rWrist = pose[16];
      if (rShoulder && rElbow && rWrist) {
        const rUpperVec = getVector(rShoulder, rElbow).normalize();
        const rForeVec = getVector(rElbow, rWrist).normalize();

        const rArmZ = Math.atan2(rUpperVec.y, -rUpperVec.x);
        const rArmX = Math.atan2(rUpperVec.z, Math.hypot(rUpperVec.x, rUpperVec.y));
        const rArmY = Math.atan2(-rUpperVec.z, -rUpperVec.x) * 0.35;

        const rArmEuler = new THREE.Euler(
          clamp(rArmX * 0.85, -0.6, 1.2),
          clamp(rArmY, -0.45, 0.45),
          clamp(rArmZ, -1.7, 0.5),
          'YXZ'
        );
        const armQuat = new THREE.Quaternion().setFromEuler(rArmEuler);

        const elbowAngle = clamp(getAngleBetween(rUpperVec, rForeVec), 0.05, 2.35);
        const forearmEuler = new THREE.Euler(0, 0, -elbowAngle, 'XYZ');
        const forearmQuat = new THREE.Quaternion().setFromEuler(forearmEuler);

        const fArmQ = this.filterQuaternion('RightArm', armQuat, time);
        const fForearmQ = this.filterQuaternion('RightForeArm', forearmQuat, time);

        quaternions['mixamorigRightArm'] = [fArmQ.x, fArmQ.y, fArmQ.z, fArmQ.w];
        quaternions['mixamorigRightForeArm'] = [fForearmQ.x, fForearmQ.y, fForearmQ.z, fForearmQ.w];
      }
    }

    // ── E. Fingers ─────────────────────────────────────────────────────────
    if (leftHand && leftHand.length >= 21) {
      this.solveFingers(leftHand, 'Left', time, quaternions, lForeVec);
    } else {
      this.setRestFingers('Left', quaternions);
    }

    if (rightHand && rightHand.length >= 21) {
      this.solveFingers(rightHand, 'Right', time, quaternions);
    } else {
      this.setRestFingers('Right', quaternions);
    }

    return quaternions;
  }

  solveFingers(hand, side, time, out, forearmVec) {
    const isLeft = side === 'Left';
    const sign = isLeft ? 1 : -1;

    const wrist = hand[0], indexMCP = hand[5], pinkyMCP = hand[17];
    const v1 = getVector(wrist, indexMCP).normalize();
    const v2 = getVector(wrist, pinkyMCP).normalize();
    const palmNormal = new THREE.Vector3().crossVectors(v1, v2).normalize();

    const wristPitch = clamp(palmNormal.z * 0.40, -0.45, 0.45);
    const wristYaw = clamp(v1.y * 0.30, -0.35, 0.35);
    const wristRoll = clamp(palmNormal.x * 0.30 * sign, -0.35, 0.35);

    const wristEuler = new THREE.Euler(wristPitch, wristYaw, wristRoll, 'YXZ');
    const wristQuat = new THREE.Quaternion().setFromEuler(wristEuler);
    const fWristQ = this.filterQuaternion(`${side}Hand`, wristQuat, time);
    out[`mixamorig${side}Hand`] = [fWristQ.x, fWristQ.y, fWristQ.z, fWristQ.w];

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

    // Thumb
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

  setRestFingers(side, out) {
    const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
    fingers.forEach((name) => {
      for (let i = 1; i <= 3; i++) {
        out[`mixamorig${side}Hand${name}${i}`] = [0, 0, 0, 1];
      }
    });
  }

  filterQuaternion(id, q, time) {
    const fx = this.getFiltered(`${id}_qx`, q.x, time, 1.2, 0.015);
    const fy = this.getFiltered(`${id}_qy`, q.y, time, 1.2, 0.015);
    const fz = this.getFiltered(`${id}_qz`, q.z, time, 1.2, 0.015);
    const fw = this.getFiltered(`${id}_qw`, q.w, time, 1.2, 0.015);
    return new THREE.Quaternion(fx, fy, fz, fw).normalize();
  }
}

function buildAnimationClipJson(clipName, frames) {
  if (!frames.length) return null;

  const tracks = [];
  const boneNames = Object.keys(frames[0].rotations);
  const times = frames.map((f) => f.time);
  const duration = times[times.length - 1] || 1.0;

  boneNames.forEach((boneName) => {
    const values = [];
    frames.forEach((f) => {
      const q = f.rotations[boneName] || [0, 0, 0, 1];
      values.push(q[0], q[1], q[2], q[3]);
    });

    const track = new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
    tracks.push(track.toJSON());
  });

  const clip = new THREE.AnimationClip(clipName.toLowerCase(), duration, []);
  const clipJson = clip.toJSON();
  clipJson.tracks = tracks;
  clipJson.duration = duration;

  return clipJson;
}

export async function generateAllSigns() {
  const datasetDir = 'D:\\Matri\\Dataset';
  const outputDir = path.join(process.cwd(), 'public', 'signs');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const categories = fs.readdirSync(datasetDir).filter((f) => {
    return fs.statSync(path.join(datasetDir, f)).isDirectory();
  });

  console.log(`[SignGenerator] Found ${categories.length} categories in ${datasetDir}`);
  const solver = new SignKinematicsSolver();
  const generatedClips = [];

  for (const word of categories) {
    const wordFolder = path.join(datasetDir, word);
    const parquetFiles = fs.readdirSync(wordFolder).filter((f) => f.endsWith('.parquet'));

    if (!parquetFiles.length) continue;

    const preferredTake = parquetFiles.find((f) => f.includes('9985') || f.includes('0029') || f.includes('0006')) || parquetFiles[0];
    const parquetPath = path.join(wordFolder, preferredTake);

    const fileBuffer = fs.readFileSync(parquetPath);
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

    const rows = await parquetReadObjects({ file: arrayBuffer });
    if (!rows || !rows.length) continue;

    const frameMap = new Map();
    rows.forEach((r) => {
      const frameIdx = Number(r.frame);
      if (!frameMap.has(frameIdx)) {
        frameMap.set(frameIdx, { pose: [], leftHand: [], rightHand: [], face: [] });
      }
      const bucket = frameMap.get(frameIdx);
      const pt = {
        x: isNaN(r.x) || r.x === null ? 0 : Number(r.x),
        y: isNaN(r.y) || r.y === null ? 0 : Number(r.y),
        z: isNaN(r.z) || r.z === null ? 0 : Number(r.z),
      };

      if (r.type === 'pose') bucket.pose[Number(r.landmark_index)] = pt;
      else if (r.type === 'left_hand') bucket.leftHand[Number(r.landmark_index)] = pt;
      else if (r.type === 'right_hand') bucket.rightHand[Number(r.landmark_index)] = pt;
      else if (r.type === 'face') bucket.face[Number(r.landmark_index)] = pt;
    });

    solver.reset();
    const sortedFrames = Array.from(frameMap.keys()).sort((a, b) => a - b);
    const solvedFrames = [];

    sortedFrames.forEach((frameIdx, i) => {
      const timeSec = i / 30.0;
      const bucket = frameMap.get(frameIdx);

      const hasLH = bucket.leftHand.length === 21 && bucket.leftHand.some((p) => p && (p.x !== 0 || p.y !== 0));
      const hasRH = bucket.rightHand.length === 21 && bucket.rightHand.some((p) => p && (p.x !== 0 || p.y !== 0));

      const parsedData = {
        frame: frameIdx,
        pose: bucket.pose,
        leftHand: hasLH ? bucket.leftHand : null,
        rightHand: hasRH ? bucket.rightHand : null,
        face: bucket.face.length >= 264 ? bucket.face : null,
      };

      const rotations = solver.solveFrame(parsedData, timeSec);
      solvedFrames.push({ time: timeSec, rotations });
    });

    const cleanWord = word.toLowerCase().trim();
    const clipJson = buildAnimationClipJson(cleanWord, solvedFrames);

    if (clipJson) {
      const outFileName = `sign_${cleanWord}.json`;
      const outFilePath = path.join(outputDir, outFileName);
      fs.writeFileSync(outFilePath, JSON.stringify(clipJson, null, 2));

      console.log(`[SignGenerator] Generated: ${outFileName} (${solvedFrames.length} frames, ${clipJson.duration.toFixed(2)}s)`);
      generatedClips.push({
        word: cleanWord,
        duration: clipJson.duration,
        frames: solvedFrames.length,
        file: `/signs/${outFileName}`,
      });
    }
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ signs: generatedClips, updatedAt: new Date().toISOString() }, null, 2));
  console.log(`[SignGenerator] Done! Manifest written to ${manifestPath}`);
  return generatedClips;
}

if (process.argv[1] && process.argv[1].includes('generate_signs')) {
  generateAllSigns().catch(console.error);
}
