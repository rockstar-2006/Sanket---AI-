'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface BoneAuditReport {
  loadedSource: string;
  totalBones: number;
  isFull65: boolean;
  hasThumbs: boolean;
  hasAllFingers: boolean;
  thumbBones: string[];
  fingerBones: string[];
  missingBones: string[];
  detectedBones: string[];
}

export interface AvatarModelProps {
  isSpeaking: boolean;
  signWord?: string | null;
  manualPoseOverride?: Record<string, [number, number, number]> | null;
  showSkeletonHelper?: boolean;
  onBoneAudit?: (report: BoneAuditReport) => void;
  onSignComplete?: (word: string) => void;
  onLoaded?: () => void;
  className?: string;
}

export const SIGN_PHRASE_MAP: Record<string, string> = {
  hello: 'hello',
  hi: 'hello',
  hey: 'hello',
  greetings: 'hello',
  namaste: 'namaste',
  'thank you': 'thankyou',
  thankyou: 'thankyou',
  thanks: 'thankyou',
  'good morning': 'goodmorning',
  goodmorning: 'goodmorning',
  'good afternoon': 'goodafternoon',
  goodafternoon: 'goodafternoon',
  'good evening': 'goodevening',
  goodevening: 'goodevening',
  'good night': 'goodnight',
  goodnight: 'goodnight',
  'how are you': 'howareyou',
  howareyou: 'howareyou',
  alright: 'alright',
  ok: 'alright',
  okay: 'alright',
  pleased: 'pleased',
  'nice to meet you': 'pleased',
};

export function matchSignWord(text: string): string | null {
  if (!text) return null;
  const clean = text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');

  if (SIGN_PHRASE_MAP[clean]) return SIGN_PHRASE_MAP[clean];

  for (const [phrase, wordKey] of Object.entries(SIGN_PHRASE_MAP)) {
    if (clean.includes(phrase)) {
      return wordKey;
    }
  }
  return null;
}

// ─── Standard Humanoid Standing Rest Pose (Mixamo 65 Skeleton) ───────────────
type BoneEulerMap = Record<string, [number, number, number]>;

export const REST_POSES: BoneEulerMap = {
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

// ─── Authentic ISL Gesture Kinematics (Mixamo 65-Bone Standard) ─────────────
export interface FingerKinematics {
  rightCurl: number;
  leftCurl: number;
  rightSpread: number;
  leftSpread: number;
  thumbUp: number;
  thumbOut: number;
  rightFlutter?: number;
  leftFlutter?: number;
}

function evaluateSignTargets(signName: string, t: number): {
  bones: BoneEulerMap;
  fingerCurls: FingerKinematics;
  smileWeight: number;
} {
  const bones: BoneEulerMap = { ...REST_POSES };
  const s = signName.toLowerCase().trim();
  let smileWeight = 0;
  let fingerCurls: FingerKinematics = {
    rightCurl: 0,
    leftCurl: 0,
    rightSpread: 0,
    leftSpread: 0,
    thumbUp: 0,
    thumbOut: 0,
    rightFlutter: 0,
    leftFlutter: 0,
  };

  const restRArm = REST_POSES['RightArm'];
  const restRForeArm = REST_POSES['RightForeArm'];
  const restRHand = REST_POSES['RightHand'];

  const restLArm = REST_POSES['LeftArm'];
  const restLForeArm = REST_POSES['LeftForeArm'];
  const restLHand = REST_POSES['LeftHand'];

  const env = Math.sin(t * Math.PI);

  if (s === 'hello' || s === 'hi') {
    // ── 1. OFFICIAL ISL "HELLO / HI" — Master Studio Temple Salute & Dynamic Wave ───
    // Phase 1 (0.0 to 0.25): Smooth elevation to right temple
    // Phase 2 (0.25 to 0.80): 1.5s active salute & dynamic friendly wave
    // Phase 3 (0.80 to 1.0): Gentle return to neutral rest
    let poseT = 0;
    let waveT = 0;
    if (t < 0.25) {
      poseT = Math.sin((t / 0.25) * (Math.PI / 2));
      waveT = 0;
    } else if (t < 0.80) {
      poseT = 1.0;
      waveT = (t - 0.25) / 0.55; // 0.0 to 1.0 during wave hold
    } else {
      poseT = Math.cos(((t - 0.80) / 0.20) * (Math.PI / 2));
      waveT = 1.0;
    }

    // Dynamic waving oscillation at temple (3 full wave cycles)
    const wave = Math.sin(waveT * Math.PI * 6.0) * (waveT > 0 && waveT < 1 ? 1 : 0);

    // Subtle natural clavicle elevation
    bones['RightShoulder'] = [0.04 * poseT, 0, -0.04 * poseT];

    // Right Upper Arm: forward pitch (+0.38) & elevated to temple height (-0.65)
    bones['RightArm'] = [
      0.38 * poseT + restRArm[0] * (1 - poseT),
      (-0.18 - 0.12 * waveT) * poseT + restRArm[1] * (1 - poseT),
      (-0.65 + 0.15 * waveT) * poseT + restRArm[2] * (1 - poseT),
    ];

    // Right ForeArm: Acute 100-degree elbow fold (-1.80) placing hand AT the right temple
    bones['RightForeArm'] = [
      0.00,
      0.00,
      (-1.80 + 0.30 * waveT) * poseT + restRForeArm[2] * (1 - poseT),
    ];

    // Right Hand: palm facing forward with clean side-to-side wrist wave
    bones['RightHand'] = [
      (0.25 + wave * 0.15) * poseT + restRHand[0] * (1 - poseT),
      (-0.15 + wave * 0.15) * poseT + restRHand[1] * (1 - poseT),
      (0.15 + wave * 0.25) * poseT + restRHand[2] * (1 - poseT),
    ];

    bones['Head'] = [0.08 * poseT, -0.05 * poseT, 0];
    bones['Spine1'] = [0.02 * poseT, 0, 0];
    smileWeight = 0.70 * poseT;

    fingerCurls = {
      rightCurl: 0.00,
      leftCurl: 0.00,
      rightSpread: 0.40 * poseT,
      leftSpread: 0.00,
      thumbUp: 0.20 * poseT,
      thumbOut: 0.45 * poseT,
      rightFlutter: wave * 0.15,
      leftFlutter: 0.00,
    };

  } else if (s === 'thankyou') {
    // ── 2. OFFICIAL ISL "THANK YOU" — Clean Chin Touch & Forward Offering ──
    let p = 0;
    if (t < 0.45) {
      p = Math.sin((t / 0.45) * (Math.PI / 2));
      bones['RightArm'] = [
        0.32 * p + restRArm[0] * (1 - p),
        -0.15 * p + restRArm[1] * (1 - p),
        -0.85 * p + restRArm[2] * (1 - p),
      ];
      bones['RightForeArm'] = [
        0.00,
        0.00,
        -1.75 * p + restRForeArm[2] * (1 - p),
      ];
      bones['RightHand'] = [
        0.25 * p + restRHand[0] * (1 - p),
        -0.10 * p + restRHand[1] * (1 - p),
        0.05 * p + restRHand[2] * (1 - p),
      ];
    } else {
      p = Math.cos(((t - 0.45) / 0.55) * (Math.PI / 2));
      const p2 = Math.sin(((t - 0.45) / 0.55) * Math.PI);
      bones['RightArm'] = [
        (0.42 * p2 + 0.32 * p) + restRArm[0] * (1 - p),
        -0.10 * p2 + restRArm[1] * (1 - p),
        (-0.75 * p2 - 0.85 * p) + restRArm[2] * (1 - p),
      ];
      bones['RightForeArm'] = [
        0.00,
        0.00,
        (-0.80 * p2 - 1.75 * p) + restRForeArm[2] * (1 - p),
      ];
      bones['RightHand'] = [
        0.25 * p2 + restRHand[0] * (1 - p),
        0.00,
        0.00,
      ];
    }

    bones['Neck'] = [0.06 * env, 0, 0];
    bones['Head'] = [0.12 * env, 0, 0];
    bones['Spine1'] = [0.03 * env, 0, 0];
    smileWeight = 0.70 * env;

    fingerCurls = {
      rightCurl: 0.05 * env,
      leftCurl: 0.00,
      rightSpread: 0.20 * env,
      leftSpread: 0.00,
      thumbUp: 0.15 * env,
      thumbOut: 0.30 * env,
      rightFlutter: 0.00,
      leftFlutter: 0.00,
    };

  } else if (s === 'alright' || s === 'ok' || s === 'okay') {
    // ── 3. OFFICIAL ISL "ALRIGHT / OK" — Exact Double Thumbs-Up ──────────────
    const okRightArm: [number, number, number] = [0.25, -0.15, -1.05];
    const okRightForeArm: [number, number, number] = [0.00, 0.00, -1.45];
    const okRightHand: [number, number, number] = [0.15, -0.65, -0.45];

    const okLeftArm: [number, number, number] = [0.25, 0.15, 1.05];
    const okLeftForeArm: [number, number, number] = [0.00, 0.00, 1.45];
    const okLeftHand: [number, number, number] = [0.15, 0.65, 0.45];

    let p = 0;
    if (t < 0.32) {
      p = Math.sin((t / 0.32) * (Math.PI / 2));
      bones['RightArm'] = [
        okRightArm[0] * p + restRArm[0] * (1 - p),
        okRightArm[1] * p + restRArm[1] * (1 - p),
        okRightArm[2] * p + restRArm[2] * (1 - p),
      ];
      bones['RightForeArm'] = [
        okRightForeArm[0] * p + restRForeArm[0] * (1 - p),
        okRightForeArm[1] * p + restRForeArm[1] * (1 - p),
        okRightForeArm[2] * p + restRForeArm[2] * (1 - p),
      ];
      bones['RightHand'] = [
        okRightHand[0] * p + restRHand[0] * (1 - p),
        okRightHand[1] * p + restRHand[1] * (1 - p),
        okRightHand[2] * p + restRHand[2] * (1 - p),
      ];

      bones['LeftArm'] = [
        okLeftArm[0] * p + restLArm[0] * (1 - p),
        okLeftArm[1] * p + restLArm[1] * (1 - p),
        okLeftArm[2] * p + restLArm[2] * (1 - p),
      ];
      bones['LeftForeArm'] = [
        okLeftForeArm[0] * p + restLForeArm[0] * (1 - p),
        okLeftForeArm[1] * p + restLForeArm[1] * (1 - p),
        okLeftForeArm[2] * p + restLForeArm[2] * (1 - p),
      ];
      bones['LeftHand'] = [
        okLeftHand[0] * p + restLHand[0] * (1 - p),
        okLeftHand[1] * p + restLHand[1] * (1 - p),
        okLeftHand[2] * p + restLHand[2] * (1 - p),
      ];

      bones['Head'] = [0.06 * p, 0, 0];
      smileWeight = 0.40 * p;
    } else if (t < 0.72) {
      p = 1.0;
      const p2 = (t - 0.32) / 0.40;
      const doubleNod = Math.sin(p2 * Math.PI * 4);

      bones['RightArm'] = okRightArm;
      bones['RightForeArm'] = [
        okRightForeArm[0],
        okRightForeArm[1],
        okRightForeArm[2] + doubleNod * 0.06,
      ];
      bones['RightHand'] = okRightHand;

      bones['LeftArm'] = okLeftArm;
      bones['LeftForeArm'] = [
        okLeftForeArm[0],
        okLeftForeArm[1],
        okLeftForeArm[2] - doubleNod * 0.06,
      ];
      bones['LeftHand'] = okLeftHand;

      bones['Head'] = [0.10 + doubleNod * 0.06, 0, 0];
      bones['Neck'] = [0.04 + doubleNod * 0.03, 0, 0];
      bones['Spine1'] = [0.03 + doubleNod * 0.02, 0, 0];
      smileWeight = 0.85;
    } else {
      p = Math.cos(((t - 0.72) / 0.28) * (Math.PI / 2));
      bones['RightArm'] = [
        okRightArm[0] * p + restRArm[0] * (1 - p),
        okRightArm[1] * p + restRArm[1] * (1 - p),
        okRightArm[2] * p + restRArm[2] * (1 - p),
      ];
      bones['RightForeArm'] = [
        okRightForeArm[0] * p + restRForeArm[0] * (1 - p),
        okRightForeArm[1] * p + restRForeArm[1] * (1 - p),
        okRightForeArm[2] * p + restRForeArm[2] * (1 - p),
      ];
      bones['RightHand'] = [
        okRightHand[0] * p + restRHand[0] * (1 - p),
        okRightHand[1] * p + restRHand[1] * (1 - p),
        okRightHand[2] * p + restRHand[2] * (1 - p),
      ];

      bones['LeftArm'] = [
        okLeftArm[0] * p + restLArm[0] * (1 - p),
        okLeftArm[1] * p + restLArm[1] * (1 - p),
        okLeftArm[2] * p + restLArm[2] * (1 - p),
      ];
      bones['LeftForeArm'] = [
        okLeftForeArm[0] * p + restLForeArm[0] * (1 - p),
        okLeftForeArm[1] * p + restLForeArm[1] * (1 - p),
        okLeftForeArm[2] * p + restLForeArm[2] * (1 - p),
      ];
      bones['LeftHand'] = [
        okLeftHand[0] * p + restLHand[0] * (1 - p),
        okLeftHand[1] * p + restLHand[1] * (1 - p),
        okLeftHand[2] * p + restLHand[2] * (1 - p),
      ];

      bones['Head'] = [0.10 * p, 0, 0];
      bones['Neck'] = [0.04 * p, 0, 0];
      bones['Spine1'] = [0.03 * p, 0, 0];
      smileWeight = 0.85 * p;
    }

    // 4 fingers curl tightly into closed fist, thumbs extend straight UP!
    fingerCurls = {
      rightCurl: 1.0 * p,
      leftCurl: 1.0 * p,
      rightSpread: 0.0,
      leftSpread: 0.0,
      thumbUp: 1.0 * p,
      thumbOut: 0.0,
      rightFlutter: 0.0,
      leftFlutter: 0.0,
    };

  } else if (s === 'goodmorning') {
    // ── 4. ISL "GOOD MORNING" — Chin Touch to Rising Sun ───────────────────
    let p = 0;
    if (t < 0.42) {
      p = Math.sin((t / 0.42) * Math.PI);
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
      // Left Arm: Horizontal horizon base across lower chest
      bones['LeftArm'] = [0.28 * p2 + restLArm[0] * (1 - p2), 0.15 * p2, 0.90 * p2 + restLArm[2] * (1 - p2)];
      bones['LeftForeArm'] = [0.00, 0.00, 1.45 * p2 + restLForeArm[2] * (1 - p2)];
      bones['LeftHand'] = [0.20 * p2, 0.00, 0.00];

      // Right Arm: Rising sun elevating smoothly upward
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

  } else if (s === 'goodafternoon') {
    // ── 5. OFFICIAL ISL "GOOD AFTERNOON" (From MVI_0046.MOV Dataset) ───────────
    let p = 0;
    if (t < 0.42) {
      p = Math.sin((t / 0.42) * Math.PI);
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
      const stroke = (t - 0.42) / 0.58;
      const strokeEase = Math.sin(stroke * (Math.PI / 2));

      // Left Arm: Horizontal horizon base across lower chest
      bones['LeftArm'] = [0.28 * p2 + restLArm[0] * (1 - p2), 0.15 * p2, 0.90 * p2 + restLArm[2] * (1 - p2)];
      bones['LeftForeArm'] = [0.00, 0.00, 1.45 * p2 + restLForeArm[2] * (1 - p2)];
      bones['LeftHand'] = [0.20 * p2, 0.00, 0.00];

      // Right Arm: Pure VERTICAL downward stroke from eye level to chest level
      const vertArmX = THREE.MathUtils.lerp(0.38, 0.28, strokeEase);
      const vertArmZ = THREE.MathUtils.lerp(-0.55, -0.85, strokeEase);
      const vertForeZ = THREE.MathUtils.lerp(-1.65, -1.15, strokeEase);
      const vertHandX = THREE.MathUtils.lerp(0.30, 0.15, strokeEase);

      bones['RightArm'] = [
        vertArmX * p2 + restRArm[0] * (1 - p2),
        -0.15 * p2,
        vertArmZ * p2 + restRArm[2] * (1 - p2),
      ];
      bones['RightForeArm'] = [
        0.00,
        0.00,
        vertForeZ * p2 + restRForeArm[2] * (1 - p2),
      ];
      bones['RightHand'] = [
        vertHandX * p2,
        -0.10 * p2,
        0.05 * p2,
      ];

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

  } else if (s === 'goodevening') {
    // ── 6. OFFICIAL ISL "GOOD EVENING" — Chin Touch to Sinking Sunset ─────────
    let p = 0;
    if (t < 0.42) {
      p = Math.sin((t / 0.42) * Math.PI);
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
      // Left Arm: Horizontal horizon base across lower chest
      bones['LeftArm'] = [0.28 * p2 + restLArm[0] * (1 - p2), 0.15 * p2, 0.90 * p2 + restLArm[2] * (1 - p2)];
      bones['LeftForeArm'] = [0.00, 0.00, 1.45 * p2 + restLForeArm[2] * (1 - p2)];
      bones['LeftHand'] = [0.20 * p2, 0.00, 0.00];

      // Right Arm: Sinks downward below left forearm (sunset)
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
    // ── 7. ISL "GOOD NIGHT" — Both Hands at Left Cheek (Sleep Posture) ─────
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
    // ── 8. ISL "HOW ARE YOU" — Both Hands Chest to Open Forward ────────────
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
    // ── 9. ISL "NAMASTE / PLEASED" (Both Palms Meeting at Heart Center) ────
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
  }

  return { bones, fingerCurls, smileWeight };
}

export function AvatarModel({
  isSpeaking,
  signWord,
  manualPoseOverride,
  showSkeletonHelper = false,
  onBoneAudit,
  onSignComplete,
  onLoaded,
  className = '',
}: AvatarModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSpeakingRef = useRef(isSpeaking);
  const signWordRef = useRef(signWord);
  const manualOverrideRef = useRef(manualPoseOverride);
  const showSkeletonHelperRef = useRef(showSkeletonHelper);
  const onBoneAuditRef = useRef(onBoneAudit);
  const onSignCompleteRef = useRef(onSignComplete);
  const onLoadedRef = useRef(onLoaded);
  const activeSignNameRef = useRef<string | null>(null);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSignName, setActiveSignName] = useState<string | null>(null);

  const triggerSignRef = useRef<((word: string) => void) | null>(null);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    manualOverrideRef.current = manualPoseOverride;
  }, [manualPoseOverride]);

  useEffect(() => {
    showSkeletonHelperRef.current = showSkeletonHelper;
  }, [showSkeletonHelper]);

  useEffect(() => {
    onBoneAuditRef.current = onBoneAudit;
  }, [onBoneAudit]);

  useEffect(() => {
    onSignCompleteRef.current = onSignComplete;
  }, [onSignComplete]);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    activeSignNameRef.current = activeSignName;
  }, [activeSignName]);

  useEffect(() => {
    signWordRef.current = signWord;
    if (signWord && triggerSignRef.current) {
      triggerSignRef.current(signWord);
    }
  }, [signWord]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let raf: number;
    let skeletonHelper: THREE.SkeletonHelper | null = null;

    // ── 1. Scene & Camera Setup ──────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, container.clientWidth / container.clientHeight, 0.01, 100);
    camera.position.set(0, 1.28, 2.70);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.8;
    controls.maxDistance = 4.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    controls.target.set(0, 1.15, 0);
    controls.update();

    // Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x99ccff, 1.4);
    fillLight.position.set(-3, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.8);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    // ── 2. Skeletal Map & Morph Indices ──────────────────────────────────────
    const boneMap = new Map<string, THREE.Bone>();
    const initialBoneRotations = new Map<string, THREE.Euler>();
    const initialBoneQuaternions = new Map<string, THREE.Quaternion>();
    let jawBone: THREE.Bone | null = null;
    let morphMesh: THREE.SkinnedMesh | null = null;
    let mouthMorphIndex = -1;
    let smileMorphIndex = -1;
    let modelReady = false;
    let loadedModelObj: THREE.Group | THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let currentAction: THREE.AnimationAction | null = null;

    let currentSignState: { name: string; startTime: number; duration: number } | null = null;
    let lastTime = performance.now();
    let idleClock = 0;
    let speakPhase = 0;

    // ── Helper to format radian angles in both degrees and radians for console inspection ──
    const radToDegStr = (rad: number) => `${(rad * (180 / Math.PI)).toFixed(1)}°`;
    const formatBoneAngle = (euler: THREE.Euler | [number, number, number]) => {
      const x = 'x' in euler ? euler.x : euler[0];
      const y = 'y' in euler ? euler.y : euler[1];
      const z = 'z' in euler ? euler.z : euler[2];
      return {
        'Degrees (X, Y, Z)': `${radToDegStr(x)}, ${radToDegStr(y)}, ${radToDegStr(z)}`,
        'Euler Radians': `[${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]`,
      };
    };

    let lastHandAngleLogTime = 0;
    const logHandAngles = (label: string, extra?: Record<string, any>) => {
      const rArm = boneMap.get('RightArm')?.rotation;
      const rForeArm = boneMap.get('RightForeArm')?.rotation;
      const rHand = boneMap.get('RightHand')?.rotation;
      const lArm = boneMap.get('LeftArm')?.rotation;
      const lForeArm = boneMap.get('LeftForeArm')?.rotation;
      const lHand = boneMap.get('LeftHand')?.rotation;

      console.group(`%c👐 [HAND ANGLES APPLIED] ${label}`, 'color: #f59e0b; font-weight: bold; font-size: 11px;');
      console.table({
        'Right Arm': rArm ? formatBoneAngle(rArm) : 'N/A',
        'Right ForeArm': rForeArm ? formatBoneAngle(rForeArm) : 'N/A',
        'Right Hand': rHand ? formatBoneAngle(rHand) : 'N/A',
        'Left Arm': lArm ? formatBoneAngle(lArm) : 'N/A',
        'Left ForeArm': lForeArm ? formatBoneAngle(lForeArm) : 'N/A',
        'Left Hand': lHand ? formatBoneAngle(lHand) : 'N/A',
      });
      if (extra) {
        console.log('Hand Kinematics Details:', extra);
      }
      console.groupEnd();
    };

    // Attach to window so user can type getHandAngles() in browser console anytime
    if (typeof window !== 'undefined') {
      (window as any).getHandAngles = () => {
        logHandAngles('Live Snapshot via window.getHandAngles()');
      };
    }

    interface MocapClipData {
      word: string;
      fps: number;
      totalFrames: number;
      durationSec: number;
      sourceTake: string;
      frames: { time: number; bones: Record<string, [number, number, number, number]> }[];
    }

    const mocapCache = new Map<string, MocapClipData>();
    let activeMocapState: {
      clip: MocapClipData;
      startTime: number;
    } | null = null;

    // Trigger sign animation directly from dataset video mocap frames (.mov / .parquet)
    const triggerSign = async (rawWord: string) => {
      const matched = matchSignWord(rawWord) || rawWord.toLowerCase().trim();
      setActiveSignName(matched);
      activeSignNameRef.current = matched;
      console.log(`%c🎬 [DATASET VIDEO MOCAP] "${matched.toUpperCase()}"`, 'color: #10b981; font-weight: bold;');

      // 1. Fetch & play pure motion capture frames from video dataset
      try {
        let clip = mocapCache.get(matched);
        if (!clip) {
          const res = await fetch(`/signs/frames_${matched}.json`);
          if (res.ok) {
            clip = await res.json();
            if (clip) mocapCache.set(matched, clip);
          }
        }

        if (clip && clip.frames && clip.frames.length > 0) {
          activeMocapState = {
            clip,
            startTime: performance.now(),
          };
          currentSignState = null;
          return;
        }
      } catch (err) {
        console.warn(`[AvatarModel] Error loading dataset mocap for "${matched}":`, err);
      }

      // Procedural fallback
      currentSignState = {
        name: matched,
        startTime: performance.now(),
        duration: 2.8,
      };
    };

    triggerSignRef.current = triggerSign;

    // ── 3. Load 3D Model (Supports GLB or FBX) ──────────────────────────────
    const onModelLoaded = (model: THREE.Group | THREE.Object3D, loadedSource: string) => {
      model.traverse((child) => {
        const isBone = child instanceof THREE.Bone;
        const isMixamo = child.name.startsWith('mixamorig');
        if (isBone || isMixamo) {
          const plain = child.name.replace(/^mixamorig[_:]?/i, '') || child.name;
          boneMap.set(plain, child as THREE.Bone);
          boneMap.set(child.name, child as THREE.Bone);
          initialBoneRotations.set(plain, (child as THREE.Bone).rotation.clone());
          initialBoneQuaternions.set(plain, (child as THREE.Bone).quaternion.clone());
          initialBoneQuaternions.set(child.name, (child as THREE.Bone).quaternion.clone());

          const n = child.name.toLowerCase();
          if (n.includes('jaw') || n.includes('chin')) jawBone = child as THREE.Bone;
        }
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
          child.castShadow = child.receiveShadow = true;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (m) {
              // Ensure FBX materials are nicely visible and not dark black
              if (m.color && (m.color.r < 0.1 && m.color.g < 0.1 && m.color.b < 0.1)) {
                m.color.setHex(0xd4af87); // Warm avatar skin tone
              }
              if ('metalness' in m) (m as any).metalness = 0.05;
              if ('roughness' in m) (m as any).roughness = 0.65;
            }
          });
          if (child instanceof THREE.SkinnedMesh && child.morphTargetDictionary) {
            morphMesh = child;
            const mouthKey = Object.keys(child.morphTargetDictionary).find((s) =>
              ['open', 'jaw', 'mouth', 'aa'].some((kw) => s.toLowerCase().includes(kw))
            );
            if (mouthKey) {
              mouthMorphIndex = child.morphTargetDictionary[mouthKey];
            }
            const smileKey = Object.keys(child.morphTargetDictionary).find((s) =>
              ['smile', 'happy', 'joy'].some((kw) => s.toLowerCase().includes(kw))
            );
            if (smileKey) {
              smileMorphIndex = child.morphTargetDictionary[smileKey];
            }
          }
        }
      });

      // ── BONE AUDIT REPORT ──────────────────────────────────────────────────
      const detectedBoneNames = Array.from(new Set(Array.from(boneMap.keys()).map(k => k.replace(/^mixamorig[_:]?/i, ''))));
      const thumbBones = detectedBoneNames.filter(b => /thumb/i.test(b));
      const fingerBones = detectedBoneNames.filter(b => /thumb|index|middle|ring|pinky/i.test(b));
      const isFull65 = thumbBones.length >= 2 && fingerBones.length >= 10;
      const hasThumbs = thumbBones.length >= 2;
      const hasAllFingers = fingerBones.length >= 10;

      const standardBoneList = [
        'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
        'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
        'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3',
        'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3',
        'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3',
        'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3',
        'LeftHandPinky1', 'LeftHandPinky2', 'LeftHandPinky3',
        'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
        'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3',
        'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3',
        'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3',
        'RightHandRing1', 'RightHandRing2', 'RightHandRing3',
        'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3',
        'LeftUpLeg', 'LeftLeg', 'LeftFoot',
        'RightUpLeg', 'RightLeg', 'RightFoot'
      ];
      const missingBones = standardBoneList.filter(sb => !detectedBoneNames.includes(sb));

      const auditReport: BoneAuditReport = {
        loadedSource,
        totalBones: detectedBoneNames.length,
        isFull65,
        hasThumbs,
        hasAllFingers,
        thumbBones,
        fingerBones,
        missingBones,
        detectedBones: detectedBoneNames,
      };

      console.log(`%c[BONE AUDIT REPORT] Source: ${loadedSource}`, 'color: #38bdf8; font-weight: bold;');
      console.log(`%c[BONE AUDIT] Total unique bones detected: ${detectedBoneNames.length}`, 'color: #00ffff; font-weight: bold;');
      console.log(`%c[BONE AUDIT] 65-bone skeleton status: ${isFull65 ? '✅ YES (Full 65 Skeleton with Thumbs)' : '❌ NO (Missing Thumbs/Fingers)'}`, isFull65 ? 'color: #00ff00; font-weight: bold;' : 'color: #ff0000; font-weight: bold;');
      console.log('[BONE AUDIT] Thumb bones found:', thumbBones);
      console.log('[BONE AUDIT] All hand/finger bones found:', fingerBones);
      console.log('[BONE AUDIT] Missing standard bones:', missingBones);

      if (onBoneAuditRef.current) {
        onBoneAuditRef.current(auditReport);
      }

      // Initialize core body rest rotations
      for (const [name, [rx, ry, rz]] of Object.entries(REST_POSES)) {
        const bone = boneMap.get(name);
        if (bone) {
          bone.rotation.set(rx, ry, rz);
        }
      }

      // Scale & center model
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const cent = box.getCenter(new THREE.Vector3());
      const sc = 2.0 / size.y;
      model.scale.setScalar(sc);
      model.position.set(-cent.x * sc, -box.min.y * sc, -cent.z * sc);
      model.updateMatrixWorld(true);

      // Skeleton visualizer helper
      skeletonHelper = new THREE.SkeletonHelper(model);
      skeletonHelper.visible = showSkeletonHelperRef.current;
      scene.add(skeletonHelper);

      // Position camera nicely to frame avatar torso & hands
      const box2 = new THREE.Box3().setFromObject(model);
      const h = box2.max.y;
      camera.position.set(0, h * 0.60, h * 1.55);
      controls.target.set(0, h * 0.58, 0);
      controls.update();

      loadedModelObj = model;
      mixer = new THREE.AnimationMixer(model);
      mixer.addEventListener('finished', (e) => {
        const word = activeSignNameRef.current;
        activeSignNameRef.current = null;
        setActiveSignName(null);
        if (word) logHandAngles(`MoCap Clip "${word}" Finished`);
        if (onSignCompleteRef.current && word) onSignCompleteRef.current(word);
      });

      scene.add(model);
      modelReady = true;
      setIsLoading(false);
      if (onLoadedRef.current) onLoadedRef.current();

      if (signWordRef.current) {
        triggerSign(signWordRef.current);
      }
    };

    // Load passive_marker_man.fbx, fallback to mans.fbx, then man.glb
    const fbxLoader = new FBXLoader();
    const tryLoadFbx = (url: string, nextFallback: () => void) => {
      fbxLoader.load(
        url,
        (fbx) => {
          console.log(`[ModelLoader] Successfully loaded ${url}`);
          onModelLoaded(fbx, url);
        },
        undefined,
        (err) => {
          console.warn(`[ModelLoader] Failed ${url}, trying fallback...`, err);
          nextFallback();
        }
      );
    };

    tryLoadFbx('/model/passive_marker_man.fbx?v=2', () => {
      tryLoadFbx('/model/mans.fbx?v=2', () => {
        console.log('[ModelLoader] Loading /model/man.glb...');
        loader.load(
          '/model/man.glb?v=2',
          (gltf) => onModelLoaded(gltf.scene, '/model/man.glb'),
          undefined,
          (err) => {
            console.error('Failed to load avatar model:', err);
            setLoadError('Failed to load 3D model.');
            setIsLoading(false);
          }
        );
      });
    });

    // ── 4. 60 FPS Render & Smooth Lerp Loop ──────────────────────────────────
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!modelReady) {
        renderer.render(scene, camera);
        return;
      }

      if (skeletonHelper) {
        skeletonHelper.visible = showSkeletonHelperRef.current;
      }

      if (mixer) {
        mixer.update(delta);
      }

      const isDatasetMocapPlaying = Boolean(activeMocapState);

      if (activeMocapState) {
        // ── Pure Motion Capture Playback directly from .MOV / .PARQUET Dataset ──
        const elapsed = (now - activeMocapState.startTime) / 1000;
        const clip = activeMocapState.clip;
        const totalFrames = clip.frames.length;
        const duration = clip.durationSec || totalFrames / 30;

        if (elapsed >= duration) {
          const finishedWord = clip.word;
          activeMocapState = null;
          activeSignNameRef.current = null;
          setActiveSignName(null);
          if (onSignCompleteRef.current) onSignCompleteRef.current(finishedWord);
        } else {
          const frameFloat = (elapsed / duration) * (totalFrames - 1);
          const idx0 = Math.floor(frameFloat);
          const idx1 = Math.min(idx0 + 1, totalFrames - 1);
          const alpha = frameFloat - idx0;

          const f0 = clip.frames[idx0];
          const f1 = clip.frames[idx1];

          if (f0 && f1) {
            const allBoneNames = Object.keys(f0.bones);
            allBoneNames.forEach((boneName) => {
              const bone = boneMap.get(boneName);
              const q0Arr = f0.bones[boneName];
              const q1Arr = f1.bones[boneName];
              if (bone && q0Arr && q1Arr) {
                const q0 = new THREE.Quaternion(q0Arr[0], q0Arr[1], q0Arr[2], q0Arr[3]);
                const q1 = new THREE.Quaternion(q1Arr[0], q1Arr[1], q1Arr[2], q1Arr[3]);
                q0.slerp(q1, alpha);
                bone.quaternion.slerp(q0, 0.45);
              }
            });
          }
        }
      } else {
        idleClock += delta * 1.5;

        // 1. Evaluate Current Sign Targets
        let currentTargets: BoneEulerMap = { ...REST_POSES };
        let currentFingerCurls: FingerKinematics = {
          rightCurl: 0,
          leftCurl: 0,
          rightSpread: 0,
          leftSpread: 0,
          thumbUp: 0,
          thumbOut: 0,
          rightFlutter: 0,
          leftFlutter: 0,
        };
        let currentSmile = 0;

        if (manualOverrideRef.current) {
          currentTargets = { ...REST_POSES, ...manualOverrideRef.current };
        } else if (currentSignState) {
          const elapsed = (now - currentSignState.startTime) / 1000;
          const progress = elapsed / currentSignState.duration;

          if (progress >= 1.0) {
            const completedWord = currentSignState.name;
            currentSignState = null;
            activeSignNameRef.current = null;
            setActiveSignName(null);
            logHandAngles(`Sign "${completedWord}" Finished`);
            if (onSignCompleteRef.current) onSignCompleteRef.current(completedWord);
          } else {
            const res = evaluateSignTargets(currentSignState.name, progress);
            currentTargets = res.bones;
            currentFingerCurls = res.fingerCurls;
            currentSmile = res.smileWeight;
          }
        } else {
          // Idle breathing on Spine
          currentTargets['Spine1'] = [Math.sin(idleClock) * 0.015, 0, 0];
        }

        // Live Hand Angle Logging (Throttled to every 600ms during signing or manual override)
        if (currentSignState || manualOverrideRef.current) {
          if (now - lastHandAngleLogTime > 600) {
            lastHandAngleLogTime = now;
            const desc = currentSignState
              ? `Signing "${currentSignState.name}" (${Math.min(100, Math.round(((now - currentSignState.startTime) / (currentSignState.duration * 1000)) * 100))}%)`
              : 'Manual Slider Override';
            logHandAngles(desc, {
              fingerCurls: currentFingerCurls,
              targets: {
                RightArm: currentTargets['RightArm'],
                RightForeArm: currentTargets['RightForeArm'],
                RightHand: currentTargets['RightHand'],
                LeftArm: currentTargets['LeftArm'],
                LeftForeArm: currentTargets['LeftForeArm'],
                LeftHand: currentTargets['LeftHand'],
              },
            });
          }
        }

        // 2. Smooth Crisp Lerp on Core Skeleton Bones
        for (const [boneName, [tx, ty, tz]] of Object.entries(currentTargets)) {
          const bone = boneMap.get(boneName);
          if (bone) {
            bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, tx, 0.22);
            bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, ty, 0.22);
            bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, tz, 0.22);
          }
        }

        // 3. Complete 5-Finger & Thumb Kinematics using Local Bone Quaternions
        const fourFingers = ['Index', 'Middle', 'Ring', 'Pinky'];
        const fingerSpreadFactors: Record<string, number> = {
          Index: -0.15,
          Middle: 0.00,
          Ring: 0.12,
          Pinky: 0.25,
        };

        const jointWeights: Record<number, number> = {
          1: 0.50, // Knuckle flexion
          2: 0.40, // Middle joint flexion
          3: 0.25, // Tip joint flexion
        };

        const rCurl = currentFingerCurls.rightCurl || 0;
        const lCurl = currentFingerCurls.leftCurl || 0;
        const rSpread = currentFingerCurls.rightSpread || 0;
        const lSpread = currentFingerCurls.leftSpread || 0;
        const rFlutter = currentFingerCurls.rightFlutter || 0;
        const lFlutter = currentFingerCurls.leftFlutter || 0;
        const thumbLift = currentFingerCurls.thumbUp || 0;
        const thumbAbduct = currentFingerCurls.thumbOut || 0;

        for (const f of fourFingers) {
          const spread = fingerSpreadFactors[f] || 0;
          for (let j = 1; j <= 3; j++) {
            const jw = jointWeights[j] || 0.35;

            // ── Right Hand Fingers (Local Hinge Flexion) ──
            const rBone = boneMap.get(`RightHand${f}${j}`);
            const rInitQ = initialBoneQuaternions.get(`RightHand${f}${j}`);
            if (rBone && rInitQ) {
              const curlAngle = rCurl * jw * 1.65 + (j === 3 ? rFlutter * 0.3 : 0);
              const deltaQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -curlAngle);
              if (j === 1 && rSpread !== 0) {
                const spreadQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spread * rSpread);
                deltaQ.multiply(spreadQ);
              }
              const targetQ = rInitQ.clone().multiply(deltaQ);
              rBone.quaternion.slerp(targetQ, 0.22);
            }

            // ── Left Hand Fingers (Local Hinge Flexion) ──
            const lBone = boneMap.get(`LeftHand${f}${j}`);
            const lInitQ = initialBoneQuaternions.get(`LeftHand${f}${j}`);
            if (lBone && lInitQ) {
              const curlAngle = lCurl * jw * 1.65 + (j === 3 ? lFlutter * 0.3 : 0);
              const deltaQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), curlAngle);
              if (j === 1 && lSpread !== 0) {
                const spreadQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -spread * lSpread);
                deltaQ.multiply(spreadQ);
              }
              const targetQ = lInitQ.clone().multiply(deltaQ);
              lBone.quaternion.slerp(targetQ, 0.22);
            }
          }
        }

        // ── Thumbs (Thumb1, Thumb2, Thumb3) ──
        for (let j = 1; j <= 3; j++) {
          // Right Thumb
          const rThumb = boneMap.get(`RightHandThumb${j}`);
          const rTInitQ = initialBoneQuaternions.get(`RightHandThumb${j}`);
          if (rThumb && rTInitQ) {
            let deltaQ = new THREE.Quaternion();
            if (thumbLift > 0.1) {
              // Thumbs up straight erect
              deltaQ = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(-0.35 * thumbLift, -0.45 * thumbLift, 0.40 * thumbLift, 'XYZ')
              );
            } else if (rCurl > 0.5) {
              // Closed fist: fold thumb across fingers
              deltaQ = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.35 * rCurl, -0.30 * rCurl, -0.45 * rCurl, 'XYZ')
              );
            } else {
              // Open relaxed / abducted thumb
              deltaQ = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, -0.30 * thumbAbduct, -0.15 * thumbAbduct, 'XYZ')
              );
            }
            const targetQ = rTInitQ.clone().multiply(deltaQ);
            rThumb.quaternion.slerp(targetQ, 0.22);
          }

          // Left Thumb
          const lThumb = boneMap.get(`LeftHandThumb${j}`);
          const lTInitQ = initialBoneQuaternions.get(`LeftHandThumb${j}`);
          if (lThumb && lTInitQ) {
            let deltaQ = new THREE.Quaternion();
            if (thumbLift > 0.1) {
              // Thumbs up straight erect
              deltaQ = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(-0.35 * thumbLift, 0.45 * thumbLift, -0.40 * thumbLift, 'XYZ')
              );
            } else if (lCurl > 0.5) {
              // Closed fist: fold thumb across fingers
              deltaQ = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.35 * lCurl, 0.30 * lCurl, 0.45 * lCurl, 'XYZ')
              );
            } else {
              // Open relaxed / abducted thumb
              deltaQ = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, 0.30 * thumbAbduct, 0.15 * thumbAbduct, 'XYZ')
              );
            }
            const targetQ = lTInitQ.clone().multiply(deltaQ);
            lThumb.quaternion.slerp(targetQ, 0.22);
          }
        }
      }

      // 4. Facial Expression (Polite Smile) & Lip-Sync
      if (morphMesh && morphMesh.morphTargetInfluences) {
        if (smileMorphIndex >= 0) {
          morphMesh.morphTargetInfluences[smileMorphIndex] = THREE.MathUtils.lerp(
            morphMesh.morphTargetInfluences[smileMorphIndex],
            currentSmile,
            0.15
          );
        }
      }

      if (isSpeakingRef.current) {
        speakPhase += delta * 8;
        const w = Math.abs(Math.sin(speakPhase)) * 0.7;
        if (morphMesh && mouthMorphIndex >= 0 && morphMesh.morphTargetInfluences) {
          morphMesh.morphTargetInfluences[mouthMorphIndex] = w;
        }
        if (jawBone) jawBone.rotation.x = w * 0.25;
      } else {
        speakPhase = 0;
        if (morphMesh && mouthMorphIndex >= 0 && morphMesh.morphTargetInfluences) {
          morphMesh.morphTargetInfluences[mouthMorphIndex] = THREE.MathUtils.lerp(
            morphMesh.morphTargetInfluences[mouthMorphIndex],
            0,
            0.15
          );
        }
        if (jawBone) jawBone.rotation.x = THREE.MathUtils.lerp(jawBone.rotation.x, 0, 0.15);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ── 5. Resize Observer ───────────────────────────────────────────────────
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        camera.aspect = e.contentRect.width / e.contentRect.height;
        camera.updateProjectionMatrix();
        renderer.setSize(e.contentRect.width, e.contentRect.height);
      }
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (typeof window !== 'undefined') {
        delete (window as any).getHandAngles;
      }
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      controls.dispose();
      renderer.dispose();
      draco.dispose();
    };
  }, []);

  return (
    <div className={`w-full h-full relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ display: isLoading || loadError ? 'none' : 'block' }}
      />

      {/* Active Sign Badge Overlay */}
      {!isLoading && !loadError && activeSignName && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/90 text-white text-[10px] font-bold shadow-lg backdrop-blur-md animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          Signing: {activeSignName.toUpperCase()}
        </div>
      )}

      {/* Loading & Error States */}
      {(isLoading || loadError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300">
          {isLoading ? (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
              <div className="text-center">
                <p className="text-xs font-semibold">Loading 3D Sign Language Avatar...</p>
                <p className="text-[10px] text-slate-500 mt-1">{loadingProgress}%</p>
              </div>
            </>
          ) : (
            <div className="text-center p-4 space-y-2">
              <p className="text-xs font-bold text-rose-500">Failed to Load Avatar</p>
              <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">{loadError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
