'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// ── Global In-Memory Avatar Model Cache ─────────────────────────────────────
// Keeps the parsed Three.js humanoid rig in memory across component unmounts and re-renders
let globalCachedModel: THREE.Group | null = null;
let globalCachedSource: string = '';

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
  isVisible?: boolean;
  modelUrl?: string;
  colorMode?: 'auto' | 'natural' | 'original';
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
  isVisible = true,
  modelUrl,
  colorMode = 'auto',
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
  const isVisibleRef = useRef(isVisible);
  const modelUrlRef = useRef(modelUrl);
  const colorModeRef = useRef(colorMode);
  const activeSignNameRef = useRef<string | null>(null);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing 3D Avatar...');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSignName, setActiveSignName] = useState<string | null>(null);

  const triggerSignRef = useRef<((word: string) => void) | null>(null);

  const reloadModelRef = useRef<((url: string) => void) | null>(null);
  const reapplyMaterialsRef = useRef<((mode: 'auto' | 'natural' | 'original') => void) | null>(null);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    colorModeRef.current = colorMode;
    if (reapplyMaterialsRef.current) {
      reapplyMaterialsRef.current(colorMode);
    }
  }, [colorMode]);

  useEffect(() => {
    modelUrlRef.current = modelUrl;
    if (modelUrl && reloadModelRef.current) {
      reloadModelRef.current(modelUrl);
    }
  }, [modelUrl]);

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

    // Studio Lighting Setup - Multi-angle high luminosity
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 3.0);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x99ccff, 2.2);
    fillLight.position.set(-3, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 2.4);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    const groundBounceLight = new THREE.DirectionalLight(0x94a3b8, 1.4);
    groundBounceLight.position.set(0, -2, 2);
    scene.add(groundBounceLight);

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
    const logHandAngles = (label: string, extra?: Record<string, any>, force: boolean = false) => {
      // Guarded: Never log to console during active signing unless developer debug mode is explicitly set
      if (!force && (typeof window === 'undefined' || !(window as any).__DEBUG_HAND_ANGLES__)) {
        return;
      }

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

    // Attach to window so user can type getHandAngles() in browser console anytime on demand
    if (typeof window !== 'undefined') {
      (window as any).getHandAngles = () => {
        logHandAngles('Live Snapshot via window.getHandAngles()', undefined, true);
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
    let currentLoadedSource = '';
    const applyMaterials = (targetModel: THREE.Object3D, src: string) => {
      const isGlb = src.toLowerCase().includes('.glb') || src.toLowerCase().includes('glb');
      targetModel.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
          child.castShadow = child.receiveShadow = true;

          // 1. If it's a GLB and colorMode is not forced to 'natural', PRESERVE 100% of original PBR materials!
          if (isGlb && colorModeRef.current !== 'natural') {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              if (m) {
                m.side = THREE.DoubleSide;
                if ('roughness' in m) (m as any).roughness = Math.min((m as any).roughness ?? 0.65, 0.75);
                if ('metalness' in m) (m as any).metalness = Math.min((m as any).metalness ?? 0.1, 0.1);
                m.needsUpdate = true;
              }
            });
          } else {
            // 2. FBX or forced natural palette
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            const newMats = mats.map((m, matIdx) => {
              if (!m) return m;

              // A. If material has an original texture map from FBX, ALWAYS preserve it
              if (m.map) {
                m.map.needsUpdate = true;
                return new THREE.MeshStandardMaterial({
                  map: m.map,
                  color: new THREE.Color(0xffffff),
                  roughness: 0.65,
                  metalness: 0.05,
                  side: THREE.DoubleSide,
                  vertexColors: false,
                });
              }

              // B. Check if material has a REAL, non-black, visible color (Luminance >= 0.18)
              // Note: FBX near-black dummy colors (e.g. 0.08) are rejected so the character never turns black!
              const lum = m.color ? m.color.r * 0.299 + m.color.g * 0.587 + m.color.b * 0.114 : 0;
              const hasRealColor =
                m.color && lum >= 0.18 && (colorModeRef.current === 'original' || colorModeRef.current === 'auto');

              if (hasRealColor) {
                return new THREE.MeshStandardMaterial({
                  color: m.color.clone(),
                  roughness: 0.65,
                  metalness: 0.05,
                  side: THREE.DoubleSide,
                  vertexColors: false,
                });
              }

              // C. Authentic Natural Human Palette (Skin, Hair, White Shirt, Navy Suit, Slate Pants)
              const name = ((m.name || '') + ' ' + (child.name || '')).toLowerCase();
              let colorHex = 0x1e3a5f; // Smart tailored navy jacket
              let roughness = 0.65;
              let metalness = 0.05;

              if (/hair|scalp|beard|brow/i.test(name)) {
                colorHex = 0x241715; // Natural dark espresso hair
                roughness = 0.85;
              } else if (/head|face|skin|hand|arm|neck|ear|body/i.test(name)) {
                colorHex = 0xe0a982; // Warm natural human skin tone
                roughness = 0.5;
              } else if (/shirt|collar|tie|inner/i.test(name)) {
                colorHex = 0xf8fafc; // Clean white shirt
                roughness = 0.4;
              } else if (/pant|trouser|bottom|leg|jean/i.test(name)) {
                colorHex = 0x334155; // Charcoal slate trousers
                roughness = 0.75;
              } else if (/shoe|boot|foot|sole|heel/i.test(name)) {
                colorHex = 0x18181b; // Polished dark leather shoes
                roughness = 0.35;
              } else if (/eye|sclera|cornea/i.test(name)) {
                colorHex = 0xf8fafc; // Bright clean eye sclera
                roughness = 0.2;
              } else if (/teeth|tooth/i.test(name)) {
                colorHex = 0xfafafa; // Clean ivory teeth
                roughness = 0.25;
              } else if (/suit|jacket|coat|blazer|top|cloth/i.test(name)) {
                colorHex = 0x1e3a5f; // Smart navy suit jacket
                roughness = 0.7;
              } else {
                // Multi-mesh body parts fallback
                const DISTINCT_CHARACTER_PALETTE = [
                  0x1e3a5f, // 0: Smart Navy Suit
                  0xe0a982, // 1: Warm Natural Skin Tone
                  0x334155, // 2: Charcoal Slate Trousers
                  0x241715, // 3: Dark Hair
                  0xf8fafc, // 4: Clean White Shirt
                  0x18181b, // 5: Dark Shoes
                ];
                colorHex = DISTINCT_CHARACTER_PALETTE[matIdx % DISTINCT_CHARACTER_PALETTE.length];
              }

              return new THREE.MeshStandardMaterial({
                color: new THREE.Color(colorHex),
                roughness,
                metalness,
                side: THREE.DoubleSide,
                vertexColors: false,
              });
            });

            child.material = Array.isArray(child.material) ? newMats : newMats[0];
          }
        }
      });
    };

    const onModelLoaded = (model: THREE.Group | THREE.Object3D, loadedSource: string) => {
      currentLoadedSource = loadedSource;
      applyMaterials(model, loadedSource);

      model.traverse((child) => {
        const isBone = child instanceof THREE.Bone;
        const isMixamo = child.name.toLowerCase().includes('mixamorig');
        if (isBone || isMixamo) {
          const plain = child.name.replace(/^(mixamorig|bip01)[_:\s]?/i, '') || child.name;
          boneMap.set(plain, child as THREE.Bone);
          boneMap.set(plain.toLowerCase(), child as THREE.Bone);
          boneMap.set(child.name, child as THREE.Bone);
          boneMap.set(child.name.toLowerCase(), child as THREE.Bone);
          initialBoneRotations.set(plain, (child as THREE.Bone).rotation.clone());
          initialBoneQuaternions.set(plain, (child as THREE.Bone).quaternion.clone());
          initialBoneQuaternions.set(child.name, (child as THREE.Bone).quaternion.clone());

          const n = child.name.toLowerCase();
          if (n.includes('jaw') || n.includes('chin')) jawBone = child as THREE.Bone;
        }

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

      // Cache model in memory across component unmounts and view switches
      if (!globalCachedModel && model instanceof THREE.Group) {
        try {
          globalCachedModel = SkeletonUtils.clone(model) as THREE.Group;
          globalCachedSource = loadedSource;
        } catch {
          // ignore cache clone warning
        }
      }

      // Background export to GLB if source was FBX: runs silently after model is ready
      if (loadedSource.includes('fbx') && typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            const exporter = new GLTFExporter();
            exporter.parse(
              model,
              (gltfBuffer) => {
                if (gltfBuffer instanceof ArrayBuffer && gltfBuffer.byteLength > 1000) {
                  console.log(
                    `[AvatarModel] Auto-exported optimized GLB (${(gltfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB), uploading server cache...`
                  );
                  fetch('/api/avatar-model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: gltfBuffer,
                  })
                    .then(() => console.log('[AvatarModel] Successfully cached mans.glb on server!'))
                    .catch((err) => console.warn('[AvatarModel] GLB cache upload notice:', err));
                }
              },
              (exportErr) => {
                console.warn('[AvatarModel] GLTFExporter notice:', exportErr);
              },
              { binary: true }
            );
          } catch (e) {
            console.warn('[AvatarModel] Background GLTF export exception:', e);
          }
        }, 1200);
      }

      scene.add(model);
      modelReady = true;
      setIsLoading(false);
      if (onLoadedRef.current) onLoadedRef.current();

      if (signWordRef.current) {
        triggerSign(signWordRef.current);
      }
    };

    reapplyMaterialsRef.current = (mode: 'auto' | 'natural' | 'original') => {
      if (loadedModelObj) {
        colorModeRef.current = mode;
        applyMaterials(loadedModelObj, currentLoadedSource);
      }
    };

    reloadModelRef.current = (newUrl: string) => {
      modelUrlRef.current = newUrl;
      if (loadedModelObj) {
        scene.remove(loadedModelObj);
        loadedModelObj = null;
      }
      if (skeletonHelper) {
        scene.remove(skeletonHelper);
        skeletonHelper = null;
      }
      boneMap.clear();
      initialBoneRotations.clear();
      initialBoneQuaternions.clear();
      modelReady = false;
      setIsLoading(true);
      setLoadError(null);
      startModelLoading();
    };

    // ── 3. High-Performance Non-Blocking Model Loader ──────────────────────
    let isCancelled = false;
    const fbxLoader = new FBXLoader();

    const loadFallbackModel = () => {
      if (isCancelled) return;
      console.log('[ModelLoader] Loading lightweight /model/man.glb fallback...');
      setLoadingStatus('Loading fallback humanoid...');
      setLoadingProgress(70);

      loader.load(
        '/model/man.glb?v=6',
        (gltf) => {
          if (!isCancelled) {
            setLoadingProgress(100);
            onModelLoaded(gltf.scene, '/model/man.glb');
          }
        },
        undefined,
        (err) => {
          console.error('[ModelLoader] All model fallbacks failed:', err);
          if (!isCancelled) {
            setLoadError('Failed to load 3D model.');
            setIsLoading(false);
          }
        }
      );
    };

    const loadDirectFbx = async (targetUrl: string = '/api/avatar-model') => {
      if (isCancelled) return;
      try {
        const cleanName = targetUrl.split('?')[0].split('/').pop() || 'mans.fbx';
        setLoadingStatus(`Downloading 3D Avatar (${cleanName})...`);
        setLoadingProgress(10);

        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentLength = Number(res.headers.get('content-length') || 62534320);
        const reader = res.body?.getReader();

        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        if (reader) {
          while (true) {
            if (isCancelled) return;
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              receivedBytes += value.length;
              if (contentLength > 0) {
                const pct = Math.min(90, Math.round((receivedBytes / contentLength) * 90));
                setLoadingProgress(pct);
                setLoadingStatus(
                  `Downloading 3D Avatar (${(receivedBytes / 1024 / 1024).toFixed(1)} / ${(contentLength / 1024 / 1024).toFixed(1)} MB)...`
                );
              }
            }
          }
        }

        if (isCancelled) return;

        // Combine chunks into ArrayBuffer
        const allChunks = new Uint8Array(receivedBytes);
        let pos = 0;
        for (const chunk of chunks) {
          allChunks.set(chunk, pos);
          pos += chunk.length;
        }

        setLoadingStatus('Preparing 3D humanoid skeleton...');
        setLoadingProgress(95);

        // CRUCIAL: Yield to the browser event loop with setTimeout so the UI updates
        // and Chrome's watchdog timer resets before starting the FBX parse!
        await new Promise((r) => setTimeout(r, 100));
        if (isCancelled) return;

        // Parse with a safety timeout race so it NEVER deadlocks the tab
        const parseFbx = () => {
          return new Promise<THREE.Group>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('FBX parse timeout'));
            }, 8000);

            try {
              const fbx = fbxLoader.parse(allChunks.buffer, '');
              clearTimeout(timeout);
              resolve(fbx);
            } catch (pErr) {
              clearTimeout(timeout);
              reject(pErr);
            }
          });
        };

        const fbxResult = await parseFbx();
        if (!isCancelled) {
          setLoadingProgress(100);
          onModelLoaded(fbxResult, cleanName);
        }
      } catch (err) {
        console.warn('[ModelLoader] Mans FBX loading notice, switching to lightweight fallback...', err);
        loadFallbackModel();
      }
    };

    const startModelLoading = async () => {
      // Mobile Device Protection: Skip massive 60MB FBX download on mobile browsers to prevent OOM tab crash and WebSocket dropouts!
      const isMobileDevice = typeof window !== 'undefined' && (
        /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth < 768
      );
      if (isMobileDevice) {
        console.log('[ModelLoader] Mobile device detected! Using lightweight humanoid model to preserve memory and keep video meeting connection stable.');
        loadFallbackModel();
        return;
      }

      // 0. If user specifically requested a custom modelUrl
      const customUrl = modelUrlRef.current;
      if (customUrl) {
        const lower = customUrl.toLowerCase();
        if (lower.includes('.glb') || lower.includes('.gltf')) {
          setLoadingStatus(`Loading 3D model (${customUrl.split('/').pop()})...`);
          setLoadingProgress(35);
          loader.load(
            customUrl,
            (gltf) => {
              if (!isCancelled) {
                setLoadingProgress(100);
                onModelLoaded(gltf.scene, customUrl);
              }
            },
            (xhr) => {
              if (xhr.lengthComputable && xhr.total > 0 && !isCancelled) {
                setLoadingProgress(Math.min(95, Math.round((xhr.loaded / xhr.total) * 100)));
              }
            },
            (err) => {
              console.warn('[ModelLoader] Custom model load error, using fallback:', err);
              loadFallbackModel();
            }
          );
          return;
        } else if (lower.includes('.fbx')) {
          loadDirectFbx(customUrl);
          return;
        }
      }

      // 1. Instant Memory Cache Check: If model was previously loaded, load in 0ms!
      if (globalCachedModel) {
        console.log('[ModelLoader] Instant memory cache hit! Mounting pre-parsed avatar in 0ms');
        try {
          const cloned = SkeletonUtils.clone(globalCachedModel);
          onModelLoaded(cloned, globalCachedSource || 'memory_cache');
          return;
        } catch (cloneErr) {
          console.warn('[ModelLoader] Memory clone fallback:', cloneErr);
        }
      }

      // 2. High-speed GLB check: If pre-converted mans.glb exists, load in ~100ms!
      try {
        setLoadingStatus('Checking optimized 3D model...');
        setLoadingProgress(15);
        const glbCheck = await fetch('/api/avatar-model?format=glb', { method: 'HEAD' });
        if (glbCheck.ok && !isCancelled) {
          console.log('[ModelLoader] Optimized mans.glb found! Loading high-speed glTF...');
          setLoadingStatus('Loading optimized avatar...');
          setLoadingProgress(45);
          loader.load(
            '/api/avatar-model?format=glb',
            (gltf) => {
              if (!isCancelled) {
                setLoadingProgress(100);
                onModelLoaded(gltf.scene, 'mans.glb');
              }
            },
            (xhr) => {
              if (xhr.lengthComputable && xhr.total > 0 && !isCancelled) {
                setLoadingProgress(Math.min(95, Math.round((xhr.loaded / xhr.total) * 100)));
              }
            },
            (err) => {
              console.warn('[ModelLoader] glb load warning, trying stream fbx...', err);
              loadDirectFbx();
            }
          );
          return;
        }
      } catch (err) {
        console.warn('[ModelLoader] GLB check warning:', err);
      }

      // 3. Progressive stream download of FBX with event-loop yielding
      loadDirectFbx();
    };

    // Kick off model loading
    startModelLoading();

    // Reusable temp quaternions for 0-allocation MoCap frame slerp
    const _tempQ0 = new THREE.Quaternion();
    const _tempQ1 = new THREE.Quaternion();

    // ── 4. 60 FPS Render & Smooth Lerp Loop ──────────────────────────────────
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!isVisibleRef.current) {
        return; // Consumes 0 CPU and 0 GPU while hidden!
      }
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
          // Restore all bones to rest quaternions so they never get stuck on final frame
          for (const [bName, bObj] of boneMap.entries()) {
            const initQ = initialBoneQuaternions.get(bName);
            if (initQ) {
              bObj.quaternion.copy(initQ);
            }
          }
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
                _tempQ0.set(q0Arr[0], q0Arr[1], q0Arr[2], q0Arr[3]);
                _tempQ1.set(q1Arr[0], q1Arr[1], q1Arr[2], q1Arr[3]);
                _tempQ0.slerp(_tempQ1, alpha);
                bone.quaternion.slerp(_tempQ0, 0.45);
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

        // Live Hand Angle Logging (Silent by default; only logs if window.__DEBUG_HAND_ANGLES__ === true)
        if ((currentSignState || manualOverrideRef.current) && typeof window !== 'undefined' && (window as any).__DEBUG_HAND_ANGLES__) {
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
      const currentSmile = isSpeakingRef.current ? 0.45 : 0.25;
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
      isCancelled = true;
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 backdrop-blur-sm text-slate-300 z-30 p-4">
          {isLoading ? (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
              <div className="text-center px-4 max-w-xs">
                <p className="text-xs font-semibold text-slate-200">{loadingStatus}</p>
                <div className="w-44 h-1.5 bg-slate-800 rounded-full mx-auto mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-300 rounded-full"
                    style={{ width: `${Math.max(5, loadingProgress)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">{loadingProgress}%</p>
                
                {/* Instant Mobile & Low Bandwidth Fallback Choices */}
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (reloadModelRef.current) {
                        reloadModelRef.current('/model/man.glb');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer border border-slate-700/80 shadow-xs"
                  >
                    ⚡ Switch to Lightweight Avatar (1.5 MB)
                  </button>
                  <p className="text-[10px] text-slate-500">
                    Full 60 MB model takes longer on mobile network.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-4 space-y-3 max-w-xs">
              <p className="text-xs font-bold text-rose-400">Failed to Load Avatar Model</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  if (reloadModelRef.current) {
                    reloadModelRef.current('/model/man.glb');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                Load Lightweight Avatar (1.5 MB)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
