'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface FrameHandsPayload {
  rightHand: Point3D[] | null;
  leftHand: Point3D[] | null;
}

export interface StudioFrameData {
  frameIndex: number;
  timeSec: number;
  rightHand: Point3D[] | null;
  leftHand: Point3D[] | null;
}

interface ThreeDHandsViewerProps {
  frames?: StudioFrameData[];
  currentFrame?: FrameHandsPayload | null;
  frameIndex?: number;
  isPlaying?: boolean;
  playbackSpeed?: number;
  onFrameChange?: (index: number) => void;
  className?: string;
}

// 21 Joint Connections for human hand (MediaPipe standard)
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

export const ThreeDHandsViewer: React.FC<ThreeDHandsViewerProps> = ({
  frames = [],
  currentFrame = null,
  frameIndex = 0,
  isPlaying = false,
  playbackSpeed = 1.0,
  onFrameChange,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Decoupled 60 FPS WebGL loop via mutable stateRef
  const stateRef = useRef({
    frames,
    currentFrame,
    frameIndex,
    isPlaying,
    playbackSpeed,
    floatFrame: frameIndex,
    lastTime: performance.now(),
    lastUiNotifyTime: 0,
    smoothCenter: new THREE.Vector3(0.5, 0.4, 0.0),
    smoothScale: 4.2,
    hasInitCenter: false,
    lastGoodRightHand: null as Point3D[] | null,
    lastGoodLeftHand: null as Point3D[] | null,
    framesToken: 0,
  });

  // Sync React props to mutable state ref
  stateRef.current.frames = frames;
  stateRef.current.currentFrame = currentFrame;
  stateRef.current.isPlaying = isPlaying;
  stateRef.current.playbackSpeed = playbackSpeed;

  // Whenever frames change (new sign clicked), reset centering and frame index
  useEffect(() => {
    stateRef.current.floatFrame = 0;
    stateRef.current.hasInitCenter = false;
    stateRef.current.lastGoodRightHand = null;
    stateRef.current.lastGoodLeftHand = null;
    stateRef.current.framesToken++;
  }, [frames]);

  // Scrubber manual jump
  useEffect(() => {
    if (!isPlaying) {
      stateRef.current.floatFrame = frameIndex;
    }
  }, [frameIndex, isPlaying]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Scene
    const scene = new THREE.Scene();

    // 2. Camera centered with comfortable perspective
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.01, 20);
    camera.position.set(0, 0.0, 1.05);

    // 3. WebGL Renderer with High-DPI & Film Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls centered squarely on hands
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.maxDistance = 2.4;
    controls.minDistance = 0.35;

    // 5. Studio Three-Point Lighting
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.3);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.8);
    keyLight.position.set(1.5, 2.5, 2.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 1.6);
    fillLight.position.set(-2.0, 1.0, 1.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf97316, 2.4);
    rimLight.position.set(0, 2.0, -1.8);
    scene.add(rimLight);

    // Bottom floor grid
    const grid = new THREE.GridHelper(1.8, 18, 0x475569, 0x1e293b);
    grid.position.y = -0.38;
    scene.add(grid);

    // 6. Dual-Tone Materials: Right Hand (Golden Amber) & Left Hand (Glacier Cyan)
    // Professional color coding so two-handed signs (Doctor, Hospital) are crystal clear
    const rightJointMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.18,
      roughness: 0.16,
      metalness: 0.12,
      clearcoat: 0.90,
      clearcoatRoughness: 0.10,
    });

    const rightBoneMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.14,
      roughness: 0.20,
      metalness: 0.10,
      clearcoat: 0.75,
      clearcoatRoughness: 0.10,
    });

    const rightPalmMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      emissive: 0x92400e,
      emissiveIntensity: 0.08,
      roughness: 0.28,
      metalness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      clearcoat: 0.6,
    });

    // Left Hand Material (Glacier Cyan)
    const leftJointMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.20,
      roughness: 0.16,
      metalness: 0.12,
      clearcoat: 0.90,
      clearcoatRoughness: 0.10,
    });

    const leftBoneMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.15,
      roughness: 0.20,
      metalness: 0.10,
      clearcoat: 0.75,
      clearcoatRoughness: 0.10,
    });

    const leftPalmMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x075985,
      emissiveIntensity: 0.08,
      roughness: 0.28,
      metalness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      clearcoat: 0.6,
    });

    // Helper: Build Volumetric 3D Emoji Hand Rig (Apple Memoji Aesthetic)
    function createHandRig(isLeft: boolean) {
      const jointMat = isLeft ? leftJointMat : rightJointMat;
      const boneMat = isLeft ? leftBoneMat : rightBoneMat;
      const palmMat = isLeft ? leftPalmMat : rightPalmMat;

      const joints: THREE.Mesh[] = [];
      const bones: THREE.Mesh[] = [];

      for (let i = 0; i < 21; i++) {
        // Volumetric rounded knuckles (Apple 3D Emoji thickness)
        const radius =
          i === 0
            ? 0.022 // Wrist base
            : i % 4 === 1
            ? 0.0165 // MCP Knuckle
            : i % 4 === 0
            ? 0.0135 // Rounded Fingertip
            : 0.0150; // PIP / DIP joint

        const geom = new THREE.SphereGeometry(radius, 18, 18);
        const mesh = new THREE.Mesh(geom, jointMat);
        mesh.visible = false;
        scene.add(mesh);
        joints.push(mesh);
      }

      for (let b = 0; b < HAND_BONES.length; b++) {
        // Fleshy rounded finger phalanxes (Radius 0.0125 - seamless with knuckles)
        const geom = new THREE.CylinderGeometry(0.0125, 0.0125, 1, 14);
        const mesh = new THREE.Mesh(geom, boneMat);
        mesh.visible = false;
        scene.add(mesh);
        bones.push(mesh);
      }

      // Volumetric palm polygon mesh
      const palmGeom = new THREE.BufferGeometry();
      const palmMesh = new THREE.Mesh(palmGeom, palmMat);
      palmMesh.visible = false;
      scene.add(palmMesh);

      // Wrist ring / bracelet anchor
      const wristRingGeom = new THREE.TorusGeometry(0.024, 0.0035, 10, 24);
      const wristRing = new THREE.Mesh(wristRingGeom, boneMat);
      wristRing.visible = false;
      scene.add(wristRing);

      return { joints, bones, palmMesh, wristRing };
    }

    const rightHand = createHandRig(false);
    const leftHand = createHandRig(true);

    const vUp = new THREE.Vector3(0, 1, 0);
    const vDir = new THREE.Vector3();
    const vMid = new THREE.Vector3();

    // Helper: Position bone cylinder between two 3D points
    function positionBone(mesh: THREE.Mesh, p1: THREE.Vector3, p2: THREE.Vector3) {
      const dist = p1.distanceTo(p2);
      mesh.scale.set(1, Math.max(0.001, dist), 1);
      vMid.copy(p1).add(p2).multiplyScalar(0.5);
      mesh.position.copy(vMid);

      vDir.copy(p2).sub(p1).normalize();
      mesh.quaternion.setFromUnitVectors(vUp, vDir);
      mesh.visible = true;
    }

    // Helper: Update volumetric palm mesh plate
    function updatePalmMesh(mesh: THREE.Mesh, points: THREE.Vector3[]) {
      // Connect wrist [0] to thumb base [1], index [5], middle [9], ring [13], pinky [17]
      const pIndices = [0, 1, 5, 9, 13, 17];
      const positions: number[] = [];
      const basePt = points[0];

      if (!basePt) return;

      for (let k = 1; k < pIndices.length - 1; k++) {
        const pt1 = points[pIndices[k]];
        const pt2 = points[pIndices[k + 1]];
        if (pt1 && pt2) {
          positions.push(basePt.x, basePt.y, basePt.z);
          positions.push(pt1.x, pt1.y, pt1.z);
          positions.push(pt2.x, pt2.y, pt2.z);
        }
      }

      mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      mesh.geometry.computeVertexNormals();
      mesh.visible = true;
    }

    // Helper: Interpolate between two landmark arrays
    function lerpLandmarks(
      a: Point3D[] | null,
      b: Point3D[] | null,
      alpha: number
    ): Point3D[] | null {
      if (!a && !b) return null;
      if (!a) return b;
      if (!b) return a;
      return a.map((pt, i) => {
        const p2 = b[i] || pt;
        const ax = Number.isFinite(pt.x) ? pt.x : (p2?.x || 0.5);
        const ay = Number.isFinite(pt.y) ? pt.y : (p2?.y || 0.5);
        const az = Number.isFinite(pt.z) ? pt.z : (p2?.z || 0.0);
        const bx = Number.isFinite(p2.x) ? p2.x : ax;
        const by = Number.isFinite(p2.y) ? p2.y : ay;
        const bz = Number.isFinite(p2.z) ? p2.z : az;

        return {
          x: ax + (bx - ax) * alpha,
          y: ay + (by - ay) * alpha,
          z: az + (bz - az) * alpha,
        };
      });
    }

    // ─── 60 FPS Hardware-Accelerated Animation Loop ─────────────────────────
    let animId: number;

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);

      const state = stateRef.current;
      const dt = Math.min((now - state.lastTime) / 1000, 0.1);
      state.lastTime = now;

      // 1. Advance playback at a calm, readable human cadence (~16 FPS base)
      if (state.isPlaying && state.frames && state.frames.length > 0) {
        const total = state.frames.length;
        // Calm deliberate signing cadence so gestures are fully understandable
        state.floatFrame = (state.floatFrame + dt * 16 * state.playbackSpeed) % total;

        // Throttled notification to React parent (10 Hz)
        if (now - state.lastUiNotifyTime > 90) {
          state.lastUiNotifyTime = now;
          if (onFrameChange) {
            onFrameChange(Math.floor(state.floatFrame));
          }
        }
      }

      // 2. Resolve Active Frame (Interpolated for buttery 60 FPS)
      let rLandmarks: Point3D[] | null = null;
      let lLandmarks: Point3D[] | null = null;

      if (state.frames && state.frames.length > 0) {
        const idxA = Math.floor(state.floatFrame) % state.frames.length;
        const idxB = (idxA + 1) % state.frames.length;
        const alpha = state.floatFrame - Math.floor(state.floatFrame);

        const frameA = state.frames[idxA];
        const frameB = state.frames[idxB];

        rLandmarks = lerpLandmarks(frameA?.rightHand, frameB?.rightHand, alpha);
        lLandmarks = lerpLandmarks(frameA?.leftHand, frameB?.leftHand, alpha);
      } else if (state.currentFrame) {
        rLandmarks = state.currentFrame.rightHand;
        lLandmarks = state.currentFrame.leftHand;
      }

      // 3. Fallback Retention: NEVER allow hands to disappear on dropped frames
      const isHandValid = (h: Point3D[] | null) =>
        h && h.length === 21 && h.some((p) => p && Number.isFinite(p.x) && p.x !== 0);

      if (isHandValid(rLandmarks)) {
        state.lastGoodRightHand = rLandmarks;
      } else if (state.lastGoodRightHand) {
        rLandmarks = state.lastGoodRightHand;
      }

      if (isHandValid(lLandmarks)) {
        state.lastGoodLeftHand = lLandmarks;
      } else if (state.lastGoodLeftHand) {
        lLandmarks = state.lastGoodLeftHand;
      }

      // 4. Centering & Adaptive Spatial Normalization
      // Collect valid points across both hands to determine exact bounding box
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      let validPtCount = 0;

      const collectBounds = (lms: Point3D[] | null) => {
        if (!lms || lms.length < 21) return;
        lms.forEach((p) => {
          if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
            const zVal = Number.isFinite(p.z) ? p.z : 0;
            minZ = Math.min(minZ, zVal);
            maxZ = Math.max(maxZ, zVal);
            validPtCount++;
          }
        });
      };

      collectBounds(rLandmarks);
      collectBounds(lLandmarks);

      if (validPtCount > 0) {
        const rawCenterX = (minX + maxX) / 2;
        const rawCenterY = (minY + maxY) / 2;
        const rawCenterZ = (minZ + maxZ) / 2;

        const spanX = maxX - minX;
        const spanY = maxY - minY;
        const maxSpan = Math.max(spanX, spanY, 0.05);

        // Normalize so the hands comfortably span ~0.45 units in 3D space
        const targetScale = Math.min(6.5, Math.max(2.2, 0.45 / maxSpan));

        if (!state.hasInitCenter) {
          state.smoothCenter.set(rawCenterX, rawCenterY, rawCenterZ);
          state.smoothScale = targetScale;
          state.hasInitCenter = true;
        } else {
          // Soft damping to eliminate jitter while staying perfectly centered
          state.smoothCenter.x += (rawCenterX - state.smoothCenter.x) * 0.15;
          state.smoothCenter.y += (rawCenterY - state.smoothCenter.y) * 0.15;
          state.smoothCenter.z += (rawCenterZ - state.smoothCenter.z) * 0.15;
          state.smoothScale += (targetScale - state.smoothScale) * 0.10;
        }
      }

      const cX = Number.isFinite(state.smoothCenter.x) ? state.smoothCenter.x : 0.5;
      const cY = Number.isFinite(state.smoothCenter.y) ? state.smoothCenter.y : 0.4;
      const cZ = Number.isFinite(state.smoothCenter.z) ? state.smoothCenter.z : 0.0;
      const scale = Number.isFinite(state.smoothScale) ? state.smoothScale : 4.2;

      // 5. Render Right Hand (Radiant Golden Amber)
      if (rLandmarks && rLandmarks.length === 21) {
        const pts: THREE.Vector3[] = rLandmarks.map((lm) => {
          const x = Number.isFinite(lm?.x) ? lm.x : cX;
          const y = Number.isFinite(lm?.y) ? lm.y : cY;
          const z = Number.isFinite(lm?.z) ? lm.z : cZ;
          return new THREE.Vector3((x - cX) * scale, -(y - cY) * scale, -(z - cZ) * scale);
        });

        pts.forEach((pt, i) => {
          rightHand.joints[i].position.copy(pt);
          rightHand.joints[i].visible = true;
        });

        HAND_BONES.forEach(([a, b], idx) => {
          positionBone(rightHand.bones[idx], pts[a], pts[b]);
        });

        updatePalmMesh(rightHand.palmMesh, pts);

        // Position wrist ring
        if (pts[0]) {
          rightHand.wristRing.position.copy(pts[0]);
          rightHand.wristRing.visible = true;
        }
      } else {
        rightHand.joints.forEach((j) => (j.visible = false));
        rightHand.bones.forEach((b) => (b.visible = false));
        rightHand.palmMesh.visible = false;
        rightHand.wristRing.visible = false;
      }

      // 6. Render Left Hand (Glacier Cyan)
      if (lLandmarks && lLandmarks.length === 21) {
        const pts: THREE.Vector3[] = lLandmarks.map((lm) => {
          const x = Number.isFinite(lm?.x) ? lm.x : cX;
          const y = Number.isFinite(lm?.y) ? lm.y : cY;
          const z = Number.isFinite(lm?.z) ? lm.z : cZ;
          return new THREE.Vector3((x - cX) * scale, -(y - cY) * scale, -(z - cZ) * scale);
        });

        pts.forEach((pt, i) => {
          leftHand.joints[i].position.copy(pt);
          leftHand.joints[i].visible = true;
        });

        HAND_BONES.forEach(([a, b], idx) => {
          positionBone(leftHand.bones[idx], pts[a], pts[b]);
        });

        updatePalmMesh(leftHand.palmMesh, pts);

        // Position wrist ring
        if (pts[0]) {
          leftHand.wristRing.position.copy(pts[0]);
          leftHand.wristRing.visible = true;
        }
      } else {
        leftHand.joints.forEach((j) => (j.visible = false));
        leftHand.bones.forEach((b) => (b.visible = false));
        leftHand.palmMesh.visible = false;
        leftHand.wristRing.visible = false;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // Responsive Canvas Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      rightJointMat.dispose();
      rightBoneMat.dispose();
      rightPalmMat.dispose();
      leftJointMat.dispose();
      leftBoneMat.dispose();
      leftPalmMat.dispose();
      if (container) container.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full min-h-[360px] bg-slate-950 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing ${className}`}
    />
  );
};
