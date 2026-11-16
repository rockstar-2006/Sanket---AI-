'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 21-joint kinematic hand connectivity
const HAND_BONES: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Knuckle Arch
  [5, 9], [9, 13], [13, 17],
];

export interface SignEmojiDef {
  id: string;
  name: string;
  category: 'medical' | 'daily' | 'courtesy' | 'emergency';
  icon: string;
  meaning: string;
  description: string;
  keyframes: (t: number) => {
    rightHand: { x: number; y: number; z: number }[];
    leftHand: { x: number; y: number; z: number }[];
  };
}

function generateHandPose(
  wristPos: [number, number, number],
  fingerCurls: [number, number, number, number, number],
  handRotation: [number, number, number] = [0, 0, 0]
): { x: number; y: number; z: number }[] {
  const points: { x: number; y: number; z: number }[] = [];
  const [wx, wy, wz] = wristPos;
  points.push({ x: wx, y: wy, z: wz });

  const fingerConfigs = [
    { baseAngle: 0.75, length: 0.16, curl: fingerCurls[0] }, // Thumb
    { baseAngle: 0.32, length: 0.22, curl: fingerCurls[1] }, // Index
    { baseAngle: 0.05, length: 0.24, curl: fingerCurls[2] }, // Middle
    { baseAngle: -0.22, length: 0.21, curl: fingerCurls[3] }, // Ring
    { baseAngle: -0.48, length: 0.17, curl: fingerCurls[4] }, // Pinky
  ];

  fingerConfigs.forEach((cfg) => {
    const angle = cfg.baseAngle + handRotation[2];
    const curl = cfg.curl;

    for (let seg = 1; seg <= 4; seg++) {
      const segRatio = seg / 4;
      const straightExt = cfg.length * segRatio;
      const bendFactor = (1 - curl) * segRatio * 0.12;

      const px = wx + Math.sin(angle) * straightExt;
      const py = wy + Math.cos(angle) * straightExt * (0.3 + 0.7 * curl);
      const pz = wz + bendFactor + (handRotation[1] * segRatio * 0.1);

      points.push({ x: px, y: py, z: pz });
    }
  });

  return points;
}

export const SIGN_EMOJIS_LIST: SignEmojiDef[] = [
  {
    id: 'doctor',
    name: 'Doctor',
    category: 'medical',
    icon: '🩺',
    meaning: 'Physician / Medical Pulse',
    description: 'Index & middle fingers tapping left inner wrist pulse',
    keyframes: (t: number) => {
      const tap = Math.pow(Math.sin(t * Math.PI * 2), 4);
      const rightHand = generateHandPose(
        [-0.04 + tap * 0.03, 0.06 - tap * 0.04, 0.08 - tap * 0.06],
        [0.1, 0.95, 0.95, 0.1, 0.1],
        [0.2, 0.1, -0.6]
      );
      const leftHand = generateHandPose(
        [-0.18, -0.05, 0.0],
        [0.8, 0.9, 0.9, 0.9, 0.8],
        [0.4, 0.2, 1.4]
      );
      return { rightHand, leftHand };
    },
  },
  {
    id: 'house',
    name: 'House',
    category: 'daily',
    icon: '🏠',
    meaning: 'Home / Clinic Building',
    description: 'Both flat hands meeting symmetrically at 45° angle to form roof peak',
    keyframes: (t: number) => {
      const breath = Math.sin(t * Math.PI * 2) * 0.015;
      const rightHand = generateHandPose(
        [0.08 + breath, -0.10, 0.0],
        [0.9, 1.0, 1.0, 1.0, 0.9],
        [0.0, 0.0, -0.78]
      );
      const leftHand = generateHandPose(
        [-0.08 - breath, -0.10, 0.0],
        [0.9, 1.0, 1.0, 1.0, 0.9],
        [0.0, 0.0, 0.78]
      );
      return { rightHand, leftHand };
    },
  },
  {
    id: 'help',
    name: 'Help',
    category: 'emergency',
    icon: '🤝',
    meaning: 'Assistance / Emergency',
    description: 'Thumbs-up fist landing on open flat left palm with upward lift',
    keyframes: (t: number) => {
      const lift = Math.sin(t * Math.PI * 2) * 0.04;
      const rightHand = generateHandPose(
        [0.0, -0.02 + lift, 0.04],
        [0.95, 0.1, 0.1, 0.1, 0.1],
        [0.0, 0.0, 0.0]
      );
      const leftHand = generateHandPose(
        [-0.12, -0.12 + lift, 0.0],
        [0.85, 0.95, 0.95, 0.95, 0.85],
        [0.0, 0.0, 1.5]
      );
      return { rightHand, leftHand };
    },
  },
  {
    id: 'namaste',
    name: 'Namaste',
    category: 'courtesy',
    icon: '🙏',
    meaning: 'Respectful Greeting / Thank You',
    description: 'Both palms pressed together at chest level in prayer pose',
    keyframes: (t: number) => {
      const nod = Math.sin(t * Math.PI * 2) * 0.02;
      const rightHand = generateHandPose(
        [0.04, -0.15 + nod, 0.0],
        [0.9, 1.0, 1.0, 1.0, 0.9],
        [0.0, -0.3, -0.15]
      );
      const leftHand = generateHandPose(
        [-0.04, -0.15 + nod, 0.0],
        [0.9, 1.0, 1.0, 1.0, 0.9],
        [0.0, 0.3, 0.15]
      );
      return { rightHand, leftHand };
    },
  },
  {
    id: 'water',
    name: 'Water',
    category: 'daily',
    icon: '💧',
    meaning: 'Drinking Water',
    description: 'Three fingers in W shape tapping gently against chin',
    keyframes: (t: number) => {
      const tap = Math.sin(t * Math.PI * 4) * 0.03;
      const rightHand = generateHandPose(
        [0.0, 0.12 + tap, 0.0],
        [0.1, 0.95, 0.95, 0.95, 0.1],
        [0.0, 0.0, 0.0]
      );
      return { rightHand, leftHand: [] };
    },
  },
  {
    id: 'yes',
    name: 'Yes',
    category: 'daily',
    icon: '👍',
    meaning: 'Affirmative / Agree',
    description: 'Closed right fist nodding rhythmically up and down',
    keyframes: (t: number) => {
      const nodY = Math.sin(t * Math.PI * 4) * 0.05;
      const rightHand = generateHandPose(
        [0.0, -0.05 + nodY, 0.0],
        [0.1, 0.1, 0.1, 0.1, 0.1],
        [nodY * 4, 0.0, 0.0]
      );
      return { rightHand, leftHand: [] };
    },
  },
  {
    id: 'medicine',
    name: 'Medicine',
    category: 'medical',
    icon: '💊',
    meaning: 'Pill / Prescription Medicine',
    description: 'Right middle finger grinding in circular motion on left open palm (mortar & pestle)',
    keyframes: (t: number) => {
      const circleX = Math.cos(t * Math.PI * 4) * 0.03;
      const circleZ = Math.sin(t * Math.PI * 4) * 0.03;
      const rightHand = generateHandPose(
        [-0.08 + circleX, 0.02, circleZ],
        [0.1, 0.1, 0.95, 0.1, 0.1], // Middle extended down
        [0.4, 0.0, 0.0]
      );
      const leftHand = generateHandPose(
        [-0.14, -0.06, 0.0],
        [0.85, 0.95, 0.95, 0.95, 0.85], // Open palm upward
        [0.0, 0.0, 1.4]
      );
      return { rightHand, leftHand };
    },
  },
  {
    id: 'love',
    name: 'I Love You',
    category: 'courtesy',
    icon: '🤟',
    meaning: 'Warm Regard / I Love You',
    description: 'Thumb, index, and pinky extended with middle and ring folded down',
    keyframes: (t: number) => {
      const sway = Math.sin(t * Math.PI * 2) * 0.03;
      const rightHand = generateHandPose(
        [0.0 + sway, -0.05, 0.0],
        [1.0, 1.0, 0.1, 0.1, 1.0], // Thumb, index, pinky
        [0.0, sway * 0.5, 0.0]
      );
      return { rightHand, leftHand: [] };
    },
  },
];

interface SignEmoji3DViewerProps {
  emojiId?: string;
  autoRotate?: boolean;
  interactive?: boolean;
  className?: string;
  badgeOverlay?: boolean;
}

export const SignEmoji3DViewer: React.FC<SignEmoji3DViewerProps> = ({
  emojiId = 'doctor',
  autoRotate = false,
  interactive = true,
  className = 'w-full h-full min-h-[220px]',
  badgeOverlay = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeEmoji = SIGN_EMOJIS_LIST.find((e) => e.id === emojiId) || SIGN_EMOJIS_LIST[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / (container.clientHeight || 1),
      0.05,
      20
    );
    camera.position.set(0, 0.1, 1.15);

    // Renderer with WebGL antialiasing & tone mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Controls
    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxDistance = 2.5;
      controls.minDistance = 0.4;
      controls.target.set(0, -0.02, 0);
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 1.5;
    }

    // Studio Lighting (Key, Rim, Fill, Glow)
    const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.8);
    keyLight.position.set(1.5, 3.0, 2.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf97316, 2.2); // Orange rim
    rimLight.position.set(-2.0, -1.0, -1.5);
    scene.add(rimLight);

    const topFill = new THREE.DirectionalLight(0xffffff, 1.4);
    topFill.position.set(0, 2.5, -1.0);
    scene.add(topFill);

    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.0);
    scene.add(ambientLight);

    // Apple/WhatsApp Glossy 3D Material
    const goldenMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24, // Rich warm amber gold
      emissive: 0x92400e, // Soft internal amber warmth
      emissiveIntensity: 0.18,
      roughness: 0.22,
      metalness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      reflectivity: 0.85,
    });

    // Mesh Group
    const emojiGroup = new THREE.Group();
    scene.add(emojiGroup);

    // Pool of node spheres and bone cylinders
    const sphereGeo = new THREE.SphereGeometry(0.016, 20, 20);
    const rightNodes: THREE.Mesh[] = [];
    const leftNodes: THREE.Mesh[] = [];

    for (let i = 0; i < 21; i++) {
      const rM = new THREE.Mesh(sphereGeo, goldenMaterial);
      emojiGroup.add(rM);
      rightNodes.push(rM);

      const lM = new THREE.Mesh(sphereGeo, goldenMaterial);
      emojiGroup.add(lM);
      leftNodes.push(lM);
    }

    // Cylindrical bones
    const boneCylGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 16);
    const rightBones: THREE.Mesh[] = [];
    const leftBones: THREE.Mesh[] = [];

    HAND_BONES.forEach(() => {
      const rB = new THREE.Mesh(boneCylGeo, goldenMaterial);
      emojiGroup.add(rB);
      rightBones.push(rB);

      const lB = new THREE.Mesh(boneCylGeo, goldenMaterial);
      emojiGroup.add(lB);
      leftBones.push(lB);
    });

    // Helper to position a cylinder bone between two points
    const positionBone = (
      mesh: THREE.Mesh,
      p1: { x: number; y: number; z: number },
      p2: { x: number; y: number; z: number }
    ) => {
      const v1 = new THREE.Vector3(p1.x, p1.y, p1.z);
      const v2 = new THREE.Vector3(p2.x, p2.y, p2.z);
      const dist = v1.distanceTo(v2);

      mesh.scale.set(1, dist, 1);
      mesh.position.copy(v1).add(v2).multiplyScalar(0.5);

      const dir = v2.clone().sub(v1).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      mesh.quaternion.setFromUnitVectors(up, dir);
      mesh.visible = true;
    };

    // Animation loop
    let animId: number;
    let startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const elapsed = (performance.now() - startTime) / 1000;
      const cycleTime = (elapsed * 0.8) % 1; // 1.25s loop

      const { rightHand, leftHand } = activeEmoji.keyframes(cycleTime);

      // Update Right Hand
      if (rightHand && rightHand.length === 21) {
        rightNodes.forEach((node, i) => {
          node.position.set(rightHand[i].x, rightHand[i].y, rightHand[i].z);
          node.visible = true;
        });

        HAND_BONES.forEach(([a, b], idx) => {
          positionBone(rightBones[idx], rightHand[a], rightHand[b]);
        });
      } else {
        rightNodes.forEach((n) => (n.visible = false));
        rightBones.forEach((b) => (b.visible = false));
      }

      // Update Left Hand
      if (leftHand && leftHand.length === 21) {
        leftNodes.forEach((node, i) => {
          node.position.set(leftHand[i].x, leftHand[i].y, leftHand[i].z);
          node.visible = true;
        });

        HAND_BONES.forEach(([a, b], idx) => {
          positionBone(leftBones[idx], leftHand[a], leftHand[b]);
        });
      } else {
        leftNodes.forEach((n) => (n.visible = false));
        leftBones.forEach((b) => (b.visible = false));
      }

      if (controls) controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / (h || 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      goldenMaterial.dispose();
      sphereGeo.dispose();
      boneCylGeo.dispose();
      if (container) container.innerHTML = '';
    };
  }, [emojiId, autoRotate, interactive, activeEmoji]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {badgeOverlay && (
        <div className="absolute top-2 left-2 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-amber-500/40 text-[10px] font-mono text-amber-300 shadow-md">
          <span className="text-xs">{activeEmoji.icon}</span>
          <span className="font-bold">{activeEmoji.name}</span>
        </div>
      )}
    </div>
  );
};
