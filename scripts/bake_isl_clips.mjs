import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

const MIXAMO_REST_POSES = {
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

function evaluateISLSignTargets(signName, progress) {
  const s = signName.toLowerCase().trim();
  const t = clamp(progress, 0, 1);
  const bones = { ...MIXAMO_REST_POSES };
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

  const env = Math.sin(t * Math.PI);

  if (s === 'hello' || s === 'hi') {
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
    };
  } else if (s === 'goodafternoon') {
    if (t < 0.40) {
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
      };
    } else {
      const p2 = Math.sin(((t - 0.40) / 0.60) * Math.PI);
      const stroke = (t - 0.40) / 0.60;
      const strokeEase = Math.sin(stroke * (Math.PI / 2));

      // Left Arm: Horizontal horizon base across chest
      bones['LeftArm'] = [0.28 * p2 + restLArm[0] * (1 - p2), 0.15 * p2, 0.90 * p2 + restLArm[2] * (1 - p2)];
      bones['LeftForeArm'] = [0.00, 0.00, 1.45 * p2 + restLForeArm[2] * (1 - p2)];
      bones['LeftHand'] = [0.20 * p2, 0.00, 0.00];

      // Right Arm: Vertical sun stroke from 12 o'clock downward to horizon
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
      };
    }
  } else if (s === 'goodmorning') {
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
      };
    }
  } else if (s === 'goodevening') {
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
      };
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
      };
    }
  } else if (s === 'goodnight') {
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
    };
  } else if (s === 'howareyou') {
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
    };
  } else if (s === 'namaste' || s === 'pleased') {
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
    };
  } else if (s === 'alright' || s === 'ok') {
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
    };
  }

  return { bones, fingerCurls, smileWeight };
}

function synthesizeClip(wordName, fps = 30, durationSec = 2.8) {
  const totalFrames = Math.floor(durationSec * fps);
  const times = [];
  for (let i = 0; i <= totalFrames; i++) times.push(round4(i / fps));

  const boneTrackValues = {};

  for (let i = 0; i <= totalFrames; i++) {
    const progress = i / totalFrames;
    const res = evaluateISLSignTargets(wordName, progress);

    for (const [boneName, eulerArr] of Object.entries(res.bones)) {
      const trackKey = `mixamorig${boneName}.quaternion`;
      if (!boneTrackValues[trackKey]) boneTrackValues[trackKey] = [];
      const e = new THREE.Euler(eulerArr[0], eulerArr[1], eulerArr[2], 'XYZ');
      const q = new THREE.Quaternion().setFromEuler(e);
      boneTrackValues[trackKey].push(round4(q.x), round4(q.y), round4(q.z), round4(q.w));
    }

    const sides = ['Left', 'Right'];
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

        const k1 = `mixamorig${side}Hand${name}1.quaternion`;
        const k2 = `mixamorig${side}Hand${name}2.quaternion`;
        const k3 = `mixamorig${side}Hand${name}3.quaternion`;

        if (!boneTrackValues[k1]) boneTrackValues[k1] = [];
        if (!boneTrackValues[k2]) boneTrackValues[k2] = [];
        if (!boneTrackValues[k3]) boneTrackValues[k3] = [];

        boneTrackValues[k1].push(round4(q1.x), round4(q1.y), round4(q1.z), round4(q1.w));
        boneTrackValues[k2].push(round4(q2.x), round4(q2.y), round4(q2.z), round4(q2.w));
        boneTrackValues[k3].push(round4(q3.x), round4(q3.y), round4(q3.z), round4(q3.w));
      });

      const tq1 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(thumbUp * 0.45, -thumbOut * 0.55 * sign, -thumbOut * 0.45 * sign, 'XYZ')
      );
      const tq2 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -thumbOut * 0.35 * sign, -thumbOut * 0.40 * sign, 'XYZ')
      );
      const tq3 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, -thumbOut * 0.30 * sign, 'XYZ')
      );

      const tk1 = `mixamorig${side}HandThumb1.quaternion`;
      const tk2 = `mixamorig${side}HandThumb2.quaternion`;
      const tk3 = `mixamorig${side}HandThumb3.quaternion`;

      if (!boneTrackValues[tk1]) boneTrackValues[tk1] = [];
      if (!boneTrackValues[tk2]) boneTrackValues[tk2] = [];
      if (!boneTrackValues[tk3]) boneTrackValues[tk3] = [];

      boneTrackValues[tk1].push(round4(tq1.x), round4(tq1.y), round4(tq1.z), round4(tq1.w));
      boneTrackValues[tk2].push(round4(tq2.x), round4(tq2.y), round4(tq2.z), round4(tq2.w));
      boneTrackValues[tk3].push(round4(tq3.x), round4(tq3.y), round4(tq3.z), round4(tq3.w));
    });
  }

  const tracks = Object.keys(boneTrackValues).map((trackName) => ({
    name: trackName,
    type: 'quaternion',
    times,
    values: boneTrackValues[trackName],
  }));

  return {
    name: wordName.toLowerCase(),
    duration: round4(durationSec),
    tracks,
  };
}

const outputDir = path.join(__dirname, '..', 'public', 'signs');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const words = [
  'goodafternoon',
  'goodmorning',
  'goodevening',
  'goodnight',
  'hello',
  'thankyou',
  'howareyou',
  'alright',
  'pleased',
  'namaste',
];

const manifest = [];

for (const word of words) {
  const clip = synthesizeClip(word, 30, 2.8);
  const filePath = path.join(outputDir, `sign_${word}.json`);
  fs.writeFileSync(filePath, JSON.stringify(clip));
  console.log(`Baked: sign_${word}.json (${clip.tracks.length} tracks, ${clip.duration}s)`);
  manifest.push({
    word,
    duration: clip.duration,
    frames: clip.tracks[0].times.length,
    file: `/signs/sign_${word}.json`,
  });
}

fs.writeFileSync(
  path.join(outputDir, 'manifest.json'),
  JSON.stringify({ signs: manifest, updatedAt: new Date().toISOString() }, null, 2)
);
console.log('All authentic ISL AnimationClips successfully baked to public/signs/!');
