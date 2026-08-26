'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Play,
  Pause,
  RotateCcw,
  Video,
  Activity,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Terminal,
  ChevronDown,
  ChevronUp,
  FileCode2,
  ChevronLeft,
  ChevronRight,
  Gauge,
} from 'lucide-react';
import { animateVRM, getVRMBoneNode } from '@/lib/vrmKalidokitBridge';
import { SignKinematicsSolver } from '@/lib/signKinematics';

// Expose THREE globally immediately for UMD scripts
if (typeof window !== 'undefined') {
  (window as any).THREE = THREE;
}

declare global {
  interface Window {
    THREE: any;
    Holistic: any;
    Kalidokit: any;
    kalidokit: any;
    THREE_VRM: any;
    VRM: any;
    logAvatarAngles: () => void;
  }
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17]             // Palm base
];

const POSE_CONNECTIONS = [
  [11, 12], // Shoulders
  [11, 13], [13, 15], // Left arm (detected)
  [12, 14], [14, 16], // Right arm (detected)
  [11, 23], [12, 24], [23, 24] // Torso
];

const DATASET_PRESETS = [
  'goodafternoon/MVI_0046.parquet',
  'goodafternoon/MVI_0047.parquet',
  'goodafternoon/MVI_0048.parquet',
  'goodafternoon/MVI_0049.parquet',
  'goodafternoon/MVI_0050.parquet',
  'alright/MVI_0037.parquet',
  'alright/MVI_0038.parquet',
  'alright/MVI_0039.parquet',
  'goodevening/MVI_0001.parquet',
  'goodevening/MVI_0052.parquet',
];

function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}

function mixamoToVrmHumanoidName(name: string) {
  const match = name.match(/^mixamorig(Left|Right)(Hand)?(Arm|ForeArm|Hand)?(Thumb|Index|Middle|Ring|Pinky)?([123])?$/);
  if (!match) {
    if (name === 'mixamorigSpine') return 'spine';
    if (name === 'mixamorigSpine1') return 'chest';
    if (name === 'mixamorigNeck') return 'neck';
    if (name === 'mixamorigHead') return 'head';
    return name;
  }

  const [, side, hand, limb, finger, joint] = match;
  const sideName = side.toLowerCase();
  if (limb === 'Arm') return `${sideName}UpperArm`;
  if (limb === 'ForeArm') return `${sideName}LowerArm`;
  if (limb === 'Hand' && !finger) return `${sideName}Hand`;
  if (finger) {
    const fingerName = finger === 'Pinky' ? 'little' : finger.toLowerCase();
    const jointName = joint === '1' ? 'Proximal' : joint === '2' ? 'Intermediate' : 'Distal';
    return `${sideName}${fingerName}${jointName}`;
  }
  return name;
}

export default function TestKalidokitVRMPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const container3dRef = useRef<HTMLDivElement>(null);

  // Mode Selection: Parquet (Pre-extracted Ground-Truth) vs MOV (Live Video Inference)
  const [sourceMode, setSourceMode] = useState<'parquet' | 'mov'>('parquet');
  const [currentFile, setCurrentFile] = useState('goodafternoon/MVI_0046.parquet');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Parquet Data State
  const [parquetData, setParquetData] = useState<any>(null);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isLoadingParquet, setIsLoadingParquet] = useState(false);

  // Script & Engine Readiness
  const [holisticLoaded, setHolisticLoaded] = useState(false);
  const [kalidokitLoaded, setKalidokitLoaded] = useState(false);
  const [threeVRMLoaded, setThreeVRMLoaded] = useState(false);
  const [vrmLoaded, setVrmLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initializing MediaPipe, Kalidokit & VRM...');
  const [fps, setFps] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showInspector, setShowInspector] = useState(true);

  // Telemetry State for Live Inspector
  const [telemetry, setTelemetry] = useState({
    timestampSec: 0,
    frameIndex: 0,
    poseActive: false,
    rHandActive: false,
    lHandActive: false,
    faceActive: false,
    rArm: [0, 0, 0],
    rForeArm: [0, 0, 0],
    rHand: [0, 0, 0],
    lArm: [0, 0, 0],
    lForeArm: [0, 0, 0],
    head: [0, 0, 0],
    rIndexProximal: [0, 0, 0],
    rThumbProximal: [0, 0, 0],
    rMiddleProximal: [0, 0, 0],
  });

  const vrmRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const holisticRef = useRef<any>(null);
  const isProcessingFrameRef = useRef(false);
  const lastLogTimeRef = useRef(0);
  const latestSnapshotRef = useRef<any>(null);
  const parquetSolverRef = useRef(new SignKinematicsSolver());
  const animTimeRef = useRef(0);
  const lastTickTimeRef = useRef(performance.now());

  // ─── 1. Initialize Three.js Scene and Load VRM Model ───────────────────────
  useEffect(() => {
    if (!container3dRef.current) return;

    const width = container3dRef.current.clientWidth || 500;
    const height = container3dRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 1.18, 1.40);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    container3dRef.current.innerHTML = '';
    container3dRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.08, 0);
    controls.enableDamping = true;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(1.5, 3.5, 2.5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    fillLight.position.set(-1.5, 2.0, 2.0);
    scene.add(fillLight);

    // Floor Grid
    const grid = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // Sanitize VRM MToon ShaderMaterials into clean Three.js standard materials
    const sanitizeVRMMaterials = (root: THREE.Object3D) => {
      root.traverse((child: any) => {
        if (child.isMesh || child.isSkinnedMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          const sanitizeMat = (mat: any) => {
            if (!mat) return mat;
            if (
              mat.isShaderMaterial ||
              mat.type === 'ShaderMaterial' ||
              mat.name?.includes('M00_') ||
              mat.isMToonMaterial ||
              mat.name?.toLowerCase().includes('face') ||
              mat.name?.toLowerCase().includes('brow') ||
              mat.name?.toLowerCase().includes('hair')
            ) {
              const map =
                mat.map ||
                mat.uniforms?.mainTex?.value ||
                mat.uniforms?._MainTex?.value ||
                mat.uniforms?.map?.value ||
                null;

              const isAlphaCutout =
                mat.name?.toLowerCase().includes('eyebrow') ||
                mat.name?.toLowerCase().includes('eyelash') ||
                mat.name?.toLowerCase().includes('hair') ||
                mat.name?.toLowerCase().includes('cutout');

              return new THREE.MeshStandardMaterial({
                map: map,
                color: map ? 0xffffff : 0xecd0c0,
                roughness: 0.6,
                metalness: 0.05,
                transparent: isAlphaCutout,
                alphaTest: isAlphaCutout ? 0.35 : 0.0,
                depthWrite: true,
                depthTest: true,
                side: isAlphaCutout ? THREE.DoubleSide : THREE.FrontSide,
              });
            }
            return mat;
          };

          if (Array.isArray(child.material)) {
            child.material = child.material.map(sanitizeMat);
          } else {
            child.material = sanitizeMat(child.material);
          }
        }
      });
    };

    // Load VRM Model (Supports both THREE_VRM UMD and bundled ESM)
    const loader = new GLTFLoader();

    const applyLoadedVRM = (vrm: any, sceneObj: THREE.Object3D) => {
      vrmRef.current = vrm;
      sanitizeVRMMaterials(vrm.scene || sceneObj);
      (vrm.scene || sceneObj).rotation.y = Math.PI; // Face camera directly
      scene.add(vrm.scene || sceneObj);
      setVrmLoaded(true);
      setStatusMessage('VRM Model (masc_vroid.vrm) loaded & calibrated.');
    };

    const loadVRM = () => {
      const modelUrl = '/api/avatar-model?file=masc_vroid.vrm';

      // @ts-ignore
      import(/* webpackIgnore: true */ 'https://esm.sh/@pixiv/three-vrm@2.0.6?bundle')
        .then(({ VRMLoaderPlugin }: any) => {
          setThreeVRMLoaded(true);
          loader.register((parser) => new VRMLoaderPlugin(parser));

          loader.load(
            modelUrl,
            (gltf) => {
              const vrm = gltf.userData.vrm || { scene: gltf.scene, humanoid: null };
              applyLoadedVRM(vrm, gltf.scene);
            },
            (progress) => {
              if (progress.total > 0) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                setStatusMessage(`Loading VRM Model: ${pct}%`);
              }
            },
            (error: any) => {
              console.error('Error loading VRM:', error);
              setStatusMessage(`VRM Load Error: ${error.message}`);
            }
          );
        })
        .catch((err) => {
          console.warn('Fallback loading raw gltf scene:', err);
          loader.load(
            modelUrl,
            (gltf) => {
              applyLoadedVRM({ scene: gltf.scene, humanoid: null }, gltf.scene);
            },
            undefined,
            (error: any) => {
              console.error('Error loading raw model:', error);
              setStatusMessage(`Model Load Error: ${error.message}`);
            }
          );
        });
    };

    loadVRM();

    // Three.js Render Loop with FPS Counter
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let lastRenderTime = performance.now();
    let animId: number;

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min((now - lastRenderTime) / 1000, 0.1);
      lastRenderTime = now;

      if (vrmRef.current && typeof vrmRef.current.update === 'function') {
        vrmRef.current.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);

      frameCount++;
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }
    };
    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container3dRef.current) return;
      const w = container3dRef.current.clientWidth;
      const h = container3dRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // ─── 2. Fetch Parquet Data on File Selection ────────────────────────────────
  useEffect(() => {
    if (sourceMode !== 'parquet') return;

    let isMounted = true;
    setIsLoadingParquet(true);
    setStatusMessage(`Loading Parquet dataset: ${currentFile}...`);

    fetch(`/api/dataset-parquet?file=${currentFile}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load parquet`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        parquetSolverRef.current.reset();
        setParquetData(data);
        setCurrentFrameIdx(0);
        setIsLoadingParquet(false);
        setStatusMessage(`Parquet loaded: ${data.totalFrames} frames (${data.durationSec}s)`);
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsLoadingParquet(false);
        setStatusMessage(`Parquet error: ${err.message}`);
        console.error('Parquet fetch error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [currentFile, sourceMode]);

  // ─── 3. Draw 2D Skeleton Landmarks on Canvas ────────────────────────────────
  const drawLandmarksOnCanvas = useCallback((frameData: any) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Optional: Draw video frame underneath if MOV mode
    if (sourceMode === 'mov' && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, w, h);
    } else {
      // Dark slate blueprint background for Parquet Mode
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    if (!frameData) return;

    // A. Draw Pose Bones & Joints (Cyan)
    if (frameData.poseLandmarks && frameData.poseLandmarks.length >= 25) {
      const pose = frameData.poseLandmarks;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 3;
      POSE_CONNECTIONS.forEach(([i, j]) => {
        const p1 = pose[i];
        const p2 = pose[j];
        if (p1 && p2 && (p1.x !== 0 || p1.y !== 0) && (p2.x !== 0 || p2.y !== 0)) {
          ctx.beginPath();
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
          ctx.stroke();
        }
      });

      ctx.fillStyle = '#38bdf8';
      pose.forEach((pt: any, i: number) => {
        if (i <= 24 && pt && (pt.x !== 0 || pt.y !== 0)) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 3.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // B. Draw Left Hand (Screen-Right signer hand, Emerald)
    if (frameData.leftHandLandmarks && frameData.leftHandLandmarks.length === 21) {
      const lh = frameData.leftHandLandmarks;

      ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
      ctx.lineWidth = 2;
      HAND_CONNECTIONS.forEach(([i, j]) => {
        const p1 = lh[i];
        const p2 = lh[j];
        if (p1 && p2 && (p1.x !== 0 || p1.y !== 0) && (p2.x !== 0 || p2.y !== 0)) {
          ctx.beginPath();
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
          ctx.stroke();
        }
      });

      ctx.fillStyle = '#4ade80';
      lh.forEach((pt: any) => {
        if (pt && (pt.x !== 0 || pt.y !== 0)) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // C. Draw Right Hand (Screen-Left signer hand, Rose - Main Signer Hand)
    if (frameData.rightHandLandmarks && frameData.rightHandLandmarks.length === 21) {
      const rh = frameData.rightHandLandmarks;

      ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
      ctx.lineWidth = 2.5;
      HAND_CONNECTIONS.forEach(([i, j]) => {
        const p1 = rh[i];
        const p2 = rh[j];
        if (p1 && p2 && (p1.x !== 0 || p1.y !== 0) && (p2.x !== 0 || p2.y !== 0)) {
          ctx.beginPath();
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
          ctx.stroke();
        }
      });

      ctx.fillStyle = '#f43f5e';
      rh.forEach((pt: any, idx: number) => {
        if (pt && (pt.x !== 0 || pt.y !== 0)) {
          ctx.beginPath();
          // Larger dots on tips
          const isTip = [4, 8, 12, 16, 20].includes(idx);
          ctx.arc(pt.x * w, pt.y * h, isTip ? 4 : 2.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // D. Draw Face Outline (Purple)
    if (frameData.faceLandmarks && frameData.faceLandmarks.length >= 200) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
      frameData.faceLandmarks.forEach((pt: any, i: number) => {
        if (i % 6 === 0 && pt && (pt.x !== 0 || pt.y !== 0)) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 1.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }
  }, [sourceMode]);

  // ─── 4. Apply Holistic Frame Results to VRM Avatar ─────────────────────────
  const handleHolisticResults = useCallback((results: any, frameNum = 0, timeSec = 0) => {
    if (!vrmRef.current) return;

    try {
      const vrm = vrmRef.current;
      let solved: any = {};

      if (sourceMode === 'parquet') {
        const rotations = parquetSolverRef.current.solveFrame(
          {
            frame: results.frameIndex ?? frameNum,
            pose: results.poseLandmarks || [],
            leftHand: results.leftHandLandmarks,
            rightHand: results.rightHandLandmarks,
            face: results.faceLandmarks,
          },
          timeSec * 1000
        );

        Object.entries(rotations).forEach(([boneName, values]) => {
          const node = getVRMBoneNode(vrm, mixamoToVrmHumanoidName(boneName));
          if (!node) return;
          const [x, y, z, w] = values as [number, number, number, number];
          node.quaternion.set(x, y, z, w).normalize();
        });
        solved = rotations;
      } else {
        solved = animateVRM(vrm, results, videoRef.current);
      }

      // Extract telemetry angles
      const getAngles = (boneName: string): [number, number, number] => {
        const node =
          vrm.humanoid?.getNormalizedBoneNode?.(boneName) ||
          vrm.humanoid?.getBoneNode?.(boneName) ||
          vrm.scene?.getObjectByName(boneName);
        if (!node) return [0, 0, 0];
        const euler = new THREE.Euler().setFromQuaternion(node.quaternion, 'XYZ');
        return [round3(euler.x), round3(euler.y), round3(euler.z)];
      };

      const currentTime = timeSec || (videoRef.current ? videoRef.current.currentTime : 0);

      const snapshot = {
        timestampSec: round3(currentTime),
        frameIndex: frameNum,
        poseActive: !!results.poseLandmarks,
        rHandActive: !!results.rightHandLandmarks,
        lHandActive: !!results.leftHandLandmarks,
        faceActive: !!results.faceLandmarks,
        rArm: getAngles('rightUpperArm'),
        rForeArm: getAngles('rightLowerArm'),
        rHand: getAngles('rightHand'),
        lArm: getAngles('leftUpperArm'),
        lForeArm: getAngles('leftLowerArm'),
        head: getAngles('head'),
        rIndexProximal: getAngles('rightIndexProximal'),
        rThumbProximal: getAngles('rightThumbProximal'),
        rMiddleProximal: getAngles('rightMiddleProximal'),
      };

      setTelemetry(snapshot);
      latestSnapshotRef.current = snapshot;
    } catch (solveErr) {
      console.error('Kalidokit VRM solve error:', solveErr);
    }
  }, [kalidokitLoaded, sourceMode]);

  const currentFrameIdxRef = useRef(0);

  // Sync ref with state on manual changes
  const onScrubberChange = (newIdx: number) => {
    setIsPlaying(false);
    currentFrameIdxRef.current = newIdx;
    setCurrentFrameIdx(newIdx);
  };

  // ─── 5. Render a specific Parquet Frame ─────────────────────────────────────
  const renderParquetFrame = useCallback((frameIdx: number) => {
    if (!parquetData?.frames?.[frameIdx]) return;
    const frame = parquetData.frames[frameIdx];

    drawLandmarksOnCanvas(frame);
    handleHolisticResults(frame, frameIdx, frame.timeSec);
  }, [parquetData, drawLandmarksOnCanvas, handleHolisticResults]);

  // Render on manual scrubber change or step
  useEffect(() => {
    if (sourceMode === 'parquet' && parquetData) {
      renderParquetFrame(currentFrameIdx);
    }
  }, [currentFrameIdx, parquetData, sourceMode, renderParquetFrame]);

  // ─── 6. Parquet Playback Animation Loop (30 FPS Accurate) ───────────────────
  useEffect(() => {
    if (sourceMode !== 'parquet' || !isPlaying || !parquetData?.totalFrames) return;

    let animId: number;
    let accumulatedTime = currentFrameIdxRef.current / 30.0;
    let lastTime = performance.now();
    let lastRenderedIdx = -1;

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000.0;
      lastTime = now;

      accumulatedTime += dt * playbackSpeed;
      let targetIdx = Math.floor(accumulatedTime * 30.0);

      if (targetIdx >= parquetData.totalFrames) {
        accumulatedTime = 0;
        targetIdx = 0;
      }

      if (targetIdx !== lastRenderedIdx) {
        lastRenderedIdx = targetIdx;
        currentFrameIdxRef.current = targetIdx;
        setCurrentFrameIdx(targetIdx);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [sourceMode, isPlaying, parquetData, playbackSpeed]);

  // ─── 7. Initialize MediaPipe Holistic for MOV Mode ──────────────────────────
  useEffect(() => {
    if (!holisticLoaded || sourceMode !== 'mov') return;

    try {
      const holistic = new window.Holistic({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
      });

      holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        refineFaceLandmarks: true,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });

      holistic.onResults((results: any) => {
        isProcessingFrameRef.current = false;
        drawLandmarksOnCanvas(results);
        handleHolisticResults(results, 0, videoRef.current?.currentTime || 0);
      });

      holisticRef.current = holistic;
      setStatusMessage('MediaPipe Holistic initialized & tracking video frames.');
    } catch (err: any) {
      console.error('Failed to init Holistic:', err);
      setStatusMessage(`Error initializing Holistic: ${err.message}`);
    }
  }, [holisticLoaded, sourceMode, drawLandmarksOnCanvas, handleHolisticResults]);

  // ─── 8. Continuous MOV Video Processing Loop ────────────────────────────────
  useEffect(() => {
    if (sourceMode !== 'mov' || !isPlaying) return;

    let animId: number;
    const processVideoFrame = async () => {
      if (
        videoRef.current &&
        !videoRef.current.paused &&
        !videoRef.current.ended &&
        holisticRef.current &&
        !isProcessingFrameRef.current
      ) {
        isProcessingFrameRef.current = true;
        try {
          await holisticRef.current.send({ image: videoRef.current });
        } catch (e) {
          isProcessingFrameRef.current = false;
        }
      }
      animId = requestAnimationFrame(processVideoFrame);
    };

    animId = requestAnimationFrame(processVideoFrame);
    return () => cancelAnimationFrame(animId);
  }, [sourceMode, isPlaying]);

  // ─── 9. User Controls ───────────────────────────────────────────────────────
  const togglePlay = () => {
    if (sourceMode === 'parquet') {
      setIsPlaying(!isPlaying);
    } else {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const restartPlayback = () => {
    if (sourceMode === 'parquet') {
      onScrubberChange(0);
      setIsPlaying(true);
    } else {
      if (!videoRef.current) return;
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const stepFrame = (delta: number) => {
    if (sourceMode !== 'parquet' || !parquetData?.totalFrames) return;
    const nextIdx = Math.max(0, Math.min(parquetData.totalFrames - 1, currentFrameIdxRef.current + delta));
    onScrubberChange(nextIdx);
  };

  const copyLiveTelemetry = () => {
    const json = JSON.stringify(telemetry, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const logSnapshotToConsole = () => {
    if (typeof window !== 'undefined' && window.logAvatarAngles) {
      window.logAvatarAngles();
    }
  };

  const totalFrames = parquetData?.totalFrames || 0;
  const currentSec = parquetData?.frames?.[currentFrameIdx]?.timeSec || 0;
  const totalSec = parquetData?.durationSec || 0;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-6 flex flex-col font-sans">
      {/* 1. Global Three.js CDN */}
      <Script
        src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"
        strategy="beforeInteractive"
      />
      {/* 2. MediaPipe Holistic */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/holistic.js"
        onLoad={() => setHolisticLoaded(true)}
      />
      {/* 3. Kalidokit UMD */}
      <Script
        src="https://cdn.jsdelivr.net/npm/kalidokit@1.1/dist/kalidokit.umd.js"
        onLoad={() => setKalidokitLoaded(true)}
      />

      {/* Header */}
      <div className="max-w-7xl mx-auto w-full mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                VRM + Kalidokit Dataset & Parquet Workbench
              </h1>
              <p className="text-xs text-slate-400">
                Direct Ground-Truth <span className="text-emerald-400 font-mono">.parquet</span> Landmarks + <span className="text-purple-400 font-mono">masc_vroid.vrm</span> + <span className="text-blue-400 font-mono">Kalidokit</span>
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switcher & Status Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => {
                setSourceMode('parquet');
                setIsPlaying(false);
              }}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                sourceMode === 'parquet'
                  ? 'bg-purple-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              Parquet (Ground Truth)
            </button>
            <button
              onClick={() => {
                setSourceMode('mov');
                setIsPlaying(false);
              }}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                sourceMode === 'mov'
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Video .MOV Mocap
            </button>
          </div>

          <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 border ${kalidokitLoaded ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
            {kalidokitLoaded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            Kalidokit
          </div>
          <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 border ${vrmLoaded ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
            {vrmLoaded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            masc_vroid.vrm
          </div>
          <div className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
            {fps} FPS
          </div>
        </div>
      </div>

      {/* Main Side-by-Side Display */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Side: 2D Blueprint Skeleton (Parquet) or Video Canvas */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col shadow-xl">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              {sourceMode === 'parquet' ? (
                <FileCode2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Video className="w-4 h-4 text-blue-400" />
              )}
              {sourceMode === 'parquet' ? 'Parquet Frame Landmarks Blueprint' : 'Source Dataset Video (.MOV)'}
            </div>

            {/* Parquet Take Selector */}
            <select
              value={currentFile}
              onChange={(e) => {
                setCurrentFile(e.target.value);
                setIsPlaying(false);
              }}
              className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
            >
              {DATASET_PRESETS.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 bg-black flex items-center justify-center min-h-[400px]">
            {sourceMode === 'mov' && (
              <video
                ref={videoRef}
                src={`/api/dataset-video?file=${currentFile.replace(/\.parquet$/, '.mov')}`}
                playsInline
                muted
                loop
                crossOrigin="anonymous"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="absolute inset-0 w-full h-full object-contain opacity-40"
              />
            )}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="relative z-10 w-full h-full object-contain"
            />
          </div>

          {/* Interactive Frame Scrubber (Parquet Mode) & Controls */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-3">
            {sourceMode === 'parquet' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="text-purple-300 font-semibold">
                    Frame {currentFrameIdx + 1} / {totalFrames}
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    {currentSec.toFixed(2)}s / {totalSec.toFixed(2)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, totalFrames - 1)}
                  value={currentFrameIdx}
                  onChange={(e) => {
                    onScrubberChange(Number(e.target.value));
                  }}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  disabled={!vrmLoaded || (sourceMode === 'parquet' && isLoadingParquet)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-600/30"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Pause' : 'Play Sign'}
                </button>

                <button
                  onClick={restartPlayback}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all"
                  title="Restart from Frame 0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {sourceMode === 'parquet' && (
                  <>
                    <button
                      onClick={() => stepFrame(-1)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all"
                      title="Step -1 Frame"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => stepFrame(1)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all"
                      title="Step +1 Frame"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Playback Speed */}
                    <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-[11px]">
                      {[0.25, 0.5, 1.0].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setPlaybackSpeed(spd)}
                          className={`px-2 py-1 rounded-lg ${
                            playbackSpeed === spd
                              ? 'bg-purple-600 text-white font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="text-xs text-slate-400 font-mono truncate">
                {statusMessage}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 3D VRM Model */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col shadow-xl">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Activity className="w-4 h-4 text-purple-400" />
              VRM Humanoid Avatar (masc_vroid.vrm + @pixiv/three-vrm)
            </div>
            <div className="text-[11px] text-slate-400">
              OrbitControls: Click & Drag to Rotate
            </div>
          </div>

          <div ref={container3dRef} className="relative flex-1 min-h-[400px] bg-[#07090e]" />

          {/* Real-time Status Bar */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${telemetry.poseActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                Pose: {telemetry.poseActive ? 'Kalidokit Active' : 'Idle'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${telemetry.rHandActive ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-500'}`}>
                R-Hand: {telemetry.rHandActive ? '15 Bones Active' : 'No Hand'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${telemetry.lHandActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                L-Hand: {telemetry.lHandActive ? '15 Bones Active' : 'Rest Pose'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${telemetry.faceActive ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-500'}`}>
                Face: {telemetry.faceActive ? 'Tracking' : 'Idle'}
              </span>
            </div>
            <div className="font-mono text-[11px] text-purple-400">
              Time: {telemetry.timestampSec.toFixed(2)}s | Frame {telemetry.frameIndex}
            </div>
          </div>
        </div>
      </div>

      {/* Live Value Inspector & Logger Panel */}
      <div className="max-w-7xl mx-auto w-full bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div
          onClick={() => setShowInspector(!showInspector)}
          className="p-4 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-850 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-slate-200">
              VRM Humanoid Bone Angles & Kalidokit Solver Values
            </h2>
            <span className="text-xs text-slate-400 font-normal">
              (Live Euler angles in radians mapped to VRM humanoid bones)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyLiveTelemetry();
              }}
              className="px-3 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs flex items-center gap-1.5 transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied JSON!' : 'Copy JSON Snapshot'}
            </button>
            {showInspector ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {showInspector && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 font-mono text-xs">
            {/* 1. Right Arm & Forearm */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/60 flex flex-col gap-2">
              <div className="text-purple-400 font-bold text-[13px] border-b border-slate-800 pb-1 flex items-center justify-between">
                <span>Right Arm (VRM)</span>
                <span className="text-[10px] text-slate-500">radians</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">rightUpperArm:</span>
                <span className="text-amber-300">[{telemetry.rArm.join(', ')}]</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">rightLowerArm:</span>
                <span className="text-amber-300">[{telemetry.rForeArm.join(', ')}]</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">rightHand:</span>
                <span className="text-amber-300">[{telemetry.rHand.join(', ')}]</span>
              </div>
            </div>

            {/* 2. Left Arm */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/60 flex flex-col gap-2">
              <div className="text-emerald-400 font-bold text-[13px] border-b border-slate-800 pb-1 flex items-center justify-between">
                <span>Left Arm (VRM)</span>
                <span className="text-[10px] text-slate-500">radians</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">leftUpperArm:</span>
                <span className="text-emerald-300">[{telemetry.lArm.join(', ')}]</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">leftLowerArm:</span>
                <span className="text-emerald-300">[{telemetry.lForeArm.join(', ')}]</span>
              </div>
            </div>

            {/* 3. Head & Face */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/60 flex flex-col gap-2">
              <div className="text-blue-400 font-bold text-[13px] border-b border-slate-800 pb-1 flex items-center justify-between">
                <span>Head & Blendshapes</span>
                <span className="text-[10px] text-slate-500">radians</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">head (Euler):</span>
                <span className="text-blue-300">[{telemetry.head.join(', ')}]</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Face Blendshapes:</span>
                <span className="text-blue-300">Blinks & Vowels</span>
              </div>
            </div>

            {/* 4. Right Hand Fingers */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/60 flex flex-col gap-2">
              <div className="text-rose-400 font-bold text-[13px] border-b border-slate-800 pb-1 flex items-center justify-between">
                <span>Right Hand Joints</span>
                <span className="text-[10px] text-slate-500">Euler</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">rightIndexProximal:</span>
                <span className="text-rose-300">[{telemetry.rIndexProximal.join(', ')}]</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">rightThumbProximal:</span>
                <span className="text-rose-300">[{telemetry.rThumbProximal.join(', ')}]</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">rightMiddleProximal:</span>
                <span className="text-rose-300">[{telemetry.rMiddleProximal.join(', ')}]</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
