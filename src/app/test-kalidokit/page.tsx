'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  Search,
  X,
  FolderTree,
  Zap,
} from 'lucide-react';
import { VrmKinematicsEngine } from '@/lib/vrmKinematicsEngine';
import { Holographic3DSkeleton } from '@/lib/holographic3DSkeleton';
import { vectorEmbeddingEngine, SemanticMatchResult } from '@/lib/vectorEmbeddingEngine';
import { LandmarkMotionSmoother } from '@/lib/motionSmoothing';

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

export interface DatasetWordGroup {
  word: string;
  category?: string;
  fullPath?: string;
  count: number;
  files: string[];
}

const DEFAULT_DATASET_WORDS: DatasetWordGroup[] = [
  { word: 'goodafternoon', category: 'Greetings & Basics', fullPath: 'goodafternoon', count: 22, files: ['goodafternoon/MVI_0046.parquet'] },
  { word: 'alright', category: 'Greetings & Basics', fullPath: 'alright', count: 21, files: ['alright/MVI_0037.parquet'] },
  { word: 'goodevening', category: 'Greetings & Basics', fullPath: 'goodevening', count: 21, files: ['goodevening/MVI_0001.parquet'] },
  { word: 'goodmorning', category: 'Greetings & Basics', fullPath: 'goodmorning', count: 21, files: ['goodmorning/MVI_0042.parquet'] },
  { word: 'goodnight', category: 'Greetings & Basics', fullPath: 'goodnight', count: 21, files: ['goodnight/MVI_0002.parquet'] },
  { word: 'hello', category: 'Greetings & Basics', fullPath: 'hello', count: 21, files: ['hello/MVI_0029.parquet'] },
  { word: 'howareyou', category: 'Greetings & Basics', fullPath: 'howareyou', count: 21, files: ['howareyou/MVI_0033.parquet'] },
  { word: 'pleased', category: 'Greetings & Basics', fullPath: 'pleased', count: 21, files: ['pleased/MVI_0009.parquet'] },
  { word: 'thankyou', category: 'Greetings & Basics', fullPath: 'thankyou', count: 21, files: ['thankyou/MVI_0006.parquet'] },
];

function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}

export default function TestKalidokitVRMPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const container3dRef = useRef<HTMLDivElement>(null);

  // Dynamic Dataset Catalog State
  const [datasetWords, setDatasetWords] = useState<DatasetWordGroup[]>(DEFAULT_DATASET_WORDS);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWord, setSelectedWord] = useState<string>('goodafternoon');

  // Mode Selection: Parquet (Pre-extracted Ground-Truth) vs MOV (Live Video Inference)
  const [sourceMode, setSourceMode] = useState<'parquet' | 'mov'>('parquet');
  const [currentFile, setCurrentFile] = useState('goodafternoon/MVI_0046.parquet');
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Parquet Data State
  const [parquetData, setParquetData] = useState<any>(null);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const currentFrameIdxRef = useRef(0);
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

  // 3D Display Mode: 3D Holographic Skeleton (Primary ground truth) vs VRM Character vs Dual
  const [display3DMode, setDisplay3DMode] = useState<'skeleton' | 'vrm' | 'dual'>('skeleton');
  const holographic3DRef = useRef<Holographic3DSkeleton | null>(null);

  // Vector Embedding Semantic Search & Landmark Motion Smoothing State
  const [vectorQuery, setVectorQuery] = useState('');
  const [vectorMatches, setVectorMatches] = useState<SemanticMatchResult[]>([]);
  const [smoothMotionEnabled, setSmoothMotionEnabled] = useState(true);
  const smootherRef = useRef<LandmarkMotionSmoother>(new LandmarkMotionSmoother());

  const currentWordGroup = useMemo(() => {
    return (
      datasetWords.find(
        (w) =>
          (w.fullPath && w.fullPath === selectedWord) ||
          w.word === selectedWord ||
          `${w.category}/${w.word}` === selectedWord
      ) || datasetWords[0]
    );
  }, [datasetWords, selectedWord]);
  const takeIndex = currentWordGroup ? currentWordGroup.files.indexOf(currentFile) : -1;

  const selectWordGroup = useCallback((w: DatasetWordGroup) => {
    const wordKey = w.fullPath || w.word;
    setSelectedWord(wordKey);
    if (w.files && w.files.length > 0) {
      setCurrentFile(w.files[0]);
      currentFrameIdxRef.current = 0;
      setCurrentFrameIdx(0);
      if (autoPlay) {
        setIsPlaying(true);
      }
    }
  }, [autoPlay]);

  const categoryWordCounts = useMemo(() => {
    const counts: Record<string, number> = { All: datasetWords.length };
    for (const w of datasetWords) {
      const cat = w.category || 'Greetings & Basics';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [datasetWords]);

  const filteredWords = useMemo(() => {
    return datasetWords.filter((w) => {
      const matchCategory =
        selectedCategory === 'All' ||
        w.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        w.word.toLowerCase().includes(q) ||
        (w.category && w.category.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [datasetWords, selectedCategory, searchQuery]);

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
  const kinematicsEngineRef = useRef(new VrmKinematicsEngine());
  const animTimeRef = useRef(0);
  const lastTickTimeRef = useRef(performance.now());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const resetCamera = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 1.25, 1.48);
      controlsRef.current.target.set(0, 1.18, 0);
      controlsRef.current.update();
    }
  }, []);

  // ─── 1. Initialize Three.js Scene and Load VRM Model ───────────────────────
  useEffect(() => {
    if (!container3dRef.current) return;

    const width = container3dRef.current.clientWidth || 500;
    const height = container3dRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 1.25, 1.48);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    container3dRef.current.innerHTML = '';
    container3dRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.18, 0);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Studio & Holographic Lighting (High Visibility for Deaf Accessibility)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(1.5, 3.5, 2.5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.4);
    fillLight.position.set(-1.5, 2.0, 2.0);
    scene.add(fillLight);

    // Front & Back Cyber Rim Lights to emphasize hand gestures and limb outlines
    const holoRimLight = new THREE.PointLight(0x06b6d4, 2.2, 8);
    holoRimLight.position.set(0, 0.8, 1.2);
    scene.add(holoRimLight);

    const holoBackLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    holoBackLight.position.set(0, 2.0, -1.8);
    scene.add(holoBackLight);

    // Floor Grid
    const grid = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // 3D Holographic Skeleton (Direct Ground-Truth 3D representation)
    const holo3D = new Holographic3DSkeleton(scene);
    holographic3DRef.current = holo3D;
    holo3D.setVisible(display3DMode === 'skeleton' || display3DMode === 'dual');

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
                mat.transparent ||
                mat.opacity < 1.0;

              return new THREE.MeshStandardMaterial({
                map: map,
                color: mat.color || new THREE.Color(0xffffff),
                roughness: 0.65,
                metalness: 0.05,
                transparent: isAlphaCutout,
                alphaTest: isAlphaCutout ? 0.35 : 0.0,
                depthWrite: !isAlphaCutout,
                side: THREE.DoubleSide,
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
      (vrm.scene || sceneObj).visible = display3DMode === 'vrm' || display3DMode === 'dual';
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

  // Sync 3D view mode visibility (Skeleton vs VRM vs Dual)
  useEffect(() => {
    if (holographic3DRef.current) {
      holographic3DRef.current.setVisible(display3DMode === 'skeleton' || display3DMode === 'dual');
    }
    if (vrmRef.current?.scene) {
      vrmRef.current.scene.visible = display3DMode === 'vrm' || display3DMode === 'dual';
    }
  }, [display3DMode]);

  // ─── 1.5. Fetch Catalog of All Words in D:\Matri\Dataset ────────────────────
  useEffect(() => {
    fetch('/api/dataset-parquet?action=list')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.words) && data.words.length > 0) {
          setDatasetWords(data.words);
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCategories(['All', ...data.categories]);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load dataset catalog:', err);
      });
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
        kinematicsEngineRef.current.reset();
        setParquetData(data);
        currentFrameIdxRef.current = 0;
        setCurrentFrameIdx(0);
        setIsLoadingParquet(false);
        setStatusMessage(`Parquet loaded: ${data.totalFrames} frames (${data.durationSec}s)`);
        if (autoPlay) {
          setIsPlaying(true);
        }
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

    // 1. Background Grid & Holographic Backdrop
    if (sourceMode === 'mov' && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, w, h);
    } else {
      // Deep cyber slate vignette
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h));
      bgGrad.addColorStop(0, '#0c101a');
      bgGrad.addColorStop(1, '#05070b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Blueprint Grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    if (!frameData) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pose = frameData.poseLandmarks;
    const lh = frameData.leftHandLandmarks;
    const rh = frameData.rightHandLandmarks;
    const face = frameData.faceLandmarks;

    // ─── 2. Human Torso & Chest Silhouette ──────────────────────────────────
    if (pose && pose.length >= 25) {
      const p11 = pose[11]; // L Shoulder
      const p12 = pose[12]; // R Shoulder
      const p23 = pose[23]; // L Hip
      const p24 = pose[24]; // R Hip

      if (p11 && p12 && p23 && p24 && (p11.x !== 0 || p12.x !== 0)) {
        // Translucent torso shield
        ctx.beginPath();
        ctx.moveTo(p11.x * w, p11.y * h);
        ctx.lineTo(p12.x * w, p12.y * h);
        ctx.lineTo(p24.x * w, p24.y * h);
        ctx.lineTo(p23.x * w, p23.y * h);
        ctx.closePath();

        const torsoGrad = ctx.createLinearGradient(0, p11.y * h, 0, p23.y * h);
        torsoGrad.addColorStop(0, 'rgba(6, 182, 212, 0.14)');
        torsoGrad.addColorStop(1, 'rgba(6, 182, 212, 0.02)');
        ctx.fillStyle = torsoGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // ─── 3. Glowing Pose Bones & Joint Capsules ──────────────────────────────
    if (pose && pose.length >= 25) {
      // Pass 1: Outer Neon Bloom
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 6;
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

      // Pass 2: Sharp Inner Bone Core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
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

      // Joint Nodes
      pose.forEach((pt: any, i: number) => {
        if (i <= 24 && pt && (pt.x !== 0 || pt.y !== 0)) {
          // Halo
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 5, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
          ctx.fill();

          // Core
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      });
    }

    // ─── 4. Inactive Hand (Screen-Right, Emerald Glow) ───────────────────────
    if (lh && lh.length === 21) {
      // Palm fill
      ctx.beginPath();
      ctx.moveTo(lh[0].x * w, lh[0].y * h);
      ctx.lineTo(lh[5].x * w, lh[5].y * h);
      ctx.lineTo(lh[9].x * w, lh[9].y * h);
      ctx.lineTo(lh[13].x * w, lh[13].y * h);
      ctx.lineTo(lh[17].x * w, lh[17].y * h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.fill();

      // Finger bones glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
      ctx.strokeStyle = '#10b981';
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

      // Finger joints
      ctx.shadowBlur = 0;
      lh.forEach((pt: any) => {
        if (pt && (pt.x !== 0 || pt.y !== 0)) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#6ee7b7';
          ctx.fill();
        }
      });
    }

    // ─── 5. Active Signing Hand (Screen-Left, Vibrant Coral / Rose Glow) ────
    if (rh && rh.length === 21) {
      // Palm Webbing
      ctx.beginPath();
      ctx.moveTo(rh[0].x * w, rh[0].y * h);
      ctx.lineTo(rh[5].x * w, rh[5].y * h);
      ctx.lineTo(rh[9].x * w, rh[9].y * h);
      ctx.lineTo(rh[13].x * w, rh[13].y * h);
      ctx.lineTo(rh[17].x * w, rh[17].y * h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
      ctx.fill();

      // Pass 1: Neon Glow Bloom
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(244, 63, 94, 0.8)';
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.lineWidth = 5;
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

      // Pass 2: Sharp Core Bone
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#f43f5e';
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

      // Joint Nodes with Illuminated Fingertips
      rh.forEach((pt: any, idx: number) => {
        if (pt && (pt.x !== 0 || pt.y !== 0)) {
          const isTip = [4, 8, 12, 16, 20].includes(idx);
          if (isTip) {
            ctx.beginPath();
            ctx.arc(pt.x * w, pt.y * h, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(251, 113, 133, 0.5)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(pt.x * w, pt.y * h, 2.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(pt.x * w, pt.y * h, 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#fca5a5';
            ctx.fill();
          }
        }
      });

      // ── Detect Pinch & Render Glowing Energy Ring at Contact Point ──────
      const p4 = rh[4]; // Thumb tip
      const p8 = rh[8]; // Index tip
      if (p4 && p8) {
        const handScale = Math.hypot(rh[0].x - rh[9].x, rh[0].y - rh[9].y) || 0.1;
        const pinchDist = Math.hypot(p4.x - p8.x, p4.y - p8.y) / handScale;
        if (pinchDist < 0.38) {
          const cx = ((p4.x + p8.x) / 2) * w;
          const cy = ((p4.y + p8.y) / 2) * h;

          ctx.save();
          ctx.shadowBlur = 14;
          ctx.shadowColor = '#38bdf8';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 9, 0, 2 * Math.PI);
          ctx.stroke();

          ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // ─── 6. Facial Contours (Eyes, Brows & Mouth in Violet/Purple) ───────────
    if (face && face.length >= 200) {
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
      ctx.fillStyle = 'rgba(192, 132, 252, 0.65)';
      face.forEach((pt: any, i: number) => {
        if (i % 5 === 0 && pt && (pt.x !== 0 || pt.y !== 0)) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 1.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    ctx.restore();
  }, [sourceMode]);

  // ─── 4. Apply Holistic Frame Results to 3D Viewport & VRM Avatar ───────────
  const handleHolisticResults = useCallback((results: any, frameNum = 0, timeSec = 0) => {
    if (!results) return;

    // 1. Direct 3D Holographic Skeleton update with optional Landmark Motion Smoothing
    if (holographic3DRef.current) {
      const finalResults = smoothMotionEnabled && results.poseLandmarks
        ? smootherRef.current.smooth(results)
        : results;
      holographic3DRef.current.update(finalResults);
    }

    if (!vrmRef.current) return;

    try {
      const vrm = vrmRef.current;
      const currentTime = timeSec || (videoRef.current ? videoRef.current.currentTime : 0);

      // Unified Two-Bone Analytical IK & Continuous Phalanx Flexion
      kinematicsEngineRef.current.update(
        vrm,
        {
          poseLandmarks: results.poseLandmarks || null,
          leftHandLandmarks: results.leftHandLandmarks || null,
          rightHandLandmarks: results.rightHandLandmarks || null,
          faceLandmarks: results.faceLandmarks || null,
        },
        currentTime * 1000
      );

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

  // Sync ref with state on manual changes
  const onScrubberChange = (newIdx: number) => {
    setIsPlaying(false);
    currentFrameIdxRef.current = newIdx;
    setCurrentFrameIdx(newIdx);
    if (sourceMode === 'parquet' && parquetData) {
      renderParquetFrame(newIdx);
    }
  };

  // ─── 5. Render a specific Parquet Frame ─────────────────────────────────────
  const renderParquetFrame = useCallback((frameIdx: number) => {
    if (!parquetData?.frames?.[frameIdx]) return;
    const frame = parquetData.frames[frameIdx];

    drawLandmarksOnCanvas(frame);
    handleHolisticResults(frame, frameIdx, frame.timeSec);
  }, [parquetData, drawLandmarksOnCanvas, handleHolisticResults]);



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
      const totalSignSec = parquetData.totalFrames / 30.0;
      const pauseDuration = 0.5; // Natural 0.5s hold at end of sign before looping

      let targetIdx = Math.floor(accumulatedTime * 30.0);

      if (accumulatedTime >= totalSignSec + pauseDuration) {
        accumulatedTime = 0;
        targetIdx = 0;
      } else if (targetIdx >= parquetData.totalFrames) {
        targetIdx = parquetData.totalFrames - 1; // Hold completed sign shape
      }

      if (targetIdx !== lastRenderedIdx) {
        lastRenderedIdx = targetIdx;
        currentFrameIdxRef.current = targetIdx;
        setCurrentFrameIdx(targetIdx);
        renderParquetFrame(targetIdx);
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

          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all cursor-pointer ${
              autoPlay
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-semibold'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${autoPlay ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
            Auto-Play on Select: {autoPlay ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Interactive Category & Word Explorer */}
      <div className="max-w-7xl mx-auto w-full mb-5 bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
        {/* Top bar: Title, Search, and Global Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Dataset Explorer & Hologram Signer
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50 font-mono font-semibold">
                  {datasetWords.length} Words • {categories.length - 1} Categories • {datasetWords.reduce((a, b) => a + b.count, 0)} Takes
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Explore words across subfolders from Indian Sign Language (INCLUDE) dataset
              </p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px] sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search 260+ signs (e.g. happy, cat, train)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 text-xs rounded-xl pl-9 pr-8 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Vector Embedding Semantic Search & Motion Smoothing Strip */}
        <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3 flex flex-col gap-2.5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Vector Embedding Semantic Matcher & Motion Smoother
              </span>
            </div>

            {/* Smooth Motion Toggle */}
            <button
              onClick={() => {
                setSmoothMotionEnabled(!smoothMotionEnabled);
                smootherRef.current.reset();
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
                smoothMotionEnabled
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50 shadow-xs'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>Smooth Landmark Motion: {smoothMotionEnabled ? 'ON (Fluid 60fps)' : 'OFF (Raw)'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Test Vector Cosine Similarity (e.g. physician, automobile, puppy, cheerful, laptop)..."
              value={vectorQuery}
              onChange={(e) => {
                const q = e.target.value;
                setVectorQuery(q);
                if (q.trim().length > 1) {
                  setVectorMatches(vectorEmbeddingEngine.findSemanticMatches(q, 4, 0.65));
                } else {
                  setVectorMatches([]);
                }
              }}
              className="flex-1 min-w-[260px] bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-400"
            />

            {/* Quick Example Synonym Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Try:</span>
              {[
                { label: 'physician → doctor', term: 'physician' },
                { label: 'automobile → car', term: 'automobile' },
                { label: 'puppy → dog', term: 'puppy' },
                { label: 'cheerful → happy', term: 'cheerful' },
                { label: 'laptop → computer', term: 'laptop' },
              ].map((ex) => (
                <button
                  key={ex.term}
                  onClick={() => {
                    setVectorQuery(ex.term);
                    const matches = vectorEmbeddingEngine.findSemanticMatches(ex.term, 4, 0.65);
                    setVectorMatches(matches);
                    if (matches.length > 0) {
                      const matchedGroup = datasetWords.find(w => w.word.toLowerCase() === matches[0].matchedVocab.toLowerCase());
                      if (matchedGroup) {
                        selectWordGroup(matchedGroup);
                      }
                    }
                  }}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-cyan-950 text-cyan-300 hover:text-white border border-slate-800 transition whitespace-nowrap"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Matches Output */}
          {vectorMatches.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-1">
              <span className="text-[10px] font-bold text-cyan-400 uppercase">Cosine Matches:</span>
              {vectorMatches.map((m, idx) => {
                const targetGroup = datasetWords.find(w => w.word.toLowerCase() === m.matchedVocab.toLowerCase());
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (targetGroup) {
                        selectWordGroup(targetGroup);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition ${
                      idx === 0
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-md font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span>{m.matchedVocab.toUpperCase()}</span>
                    <span className="text-[10px] opacity-80">({Math.round(m.similarity * 100)}%)</span>
                    <span className="text-[9px] opacity-60">[{m.category}]</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {categories.map((cat) => {
            const isCatActive = selectedCategory === cat;
            const count = categoryWordCounts[cat] ?? 0;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isCatActive
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md shadow-cyan-500/30 font-bold'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    isCatActive ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Word Chips Grid / Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-1 scrollbar-thin max-h-32 flex-wrap">
          {filteredWords.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-2">
              No words found matching "{searchQuery}" in {selectedCategory}.
            </div>
          ) : (
            filteredWords.map((w) => {
              const wordKey = w.fullPath || w.word;
              const isSelected =
                wordKey === selectedWord ||
                w.word === selectedWord ||
                `${w.category}/${w.word}` === selectedWord;

              return (
                <button
                  key={w.fullPath || w.word}
                  onClick={() => selectWordGroup(w)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 border-cyan-300 shadow-md shadow-cyan-500/25 scale-105 ring-2 ring-cyan-400/40'
                      : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-cyan-500/40 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <span>{w.word}</span>
                  {selectedCategory === 'All' && w.category && (
                    <span className={`text-[9px] px-1 py-0.5 rounded opacity-75 lowercase font-normal ${isSelected ? 'bg-slate-950/20 text-slate-950 font-medium' : 'bg-slate-800/80 text-cyan-300'}`}>
                      {w.category}
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                      isSelected
                        ? 'bg-slate-950/30 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {w.count}
                  </span>
                </button>
              );
            })
          )}
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

            {/* Word & Take Selectors */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setSelectedCategory(newCat);
                  const match = datasetWords.find(
                    (w) => newCat === 'All' || w.category === newCat
                  );
                  if (match) {
                    selectWordGroup(match);
                  }
                }}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-300 font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-400 tracking-wide cursor-pointer max-w-[130px]"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-slate-900 text-slate-200">
                    {c} ({categoryWordCounts[c] ?? 0})
                  </option>
                ))}
              </select>

              {/* Word Selector */}
              <select
                value={currentWordGroup ? (currentWordGroup.fullPath || currentWordGroup.word) : selectedWord}
                onChange={(e) => {
                  const targetKey = e.target.value;
                  const group = datasetWords.find((w) => (w.fullPath || w.word) === targetKey || w.word === targetKey);
                  if (group) {
                    selectWordGroup(group);
                  }
                }}
                className="bg-cyan-950/60 border border-cyan-700/60 text-xs rounded-lg px-2.5 py-1 text-cyan-300 font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-400 uppercase tracking-wide cursor-pointer max-w-[150px]"
              >
                {filteredWords.map((w) => {
                  const key = w.fullPath || w.word;
                  return (
                    <option key={key} value={key} className="bg-slate-900 text-slate-200">
                      {w.word.toUpperCase()} ({w.count})
                    </option>
                  );
                })}
              </select>

              {/* Take Selector */}
              <select
                value={currentFile}
                onChange={(e) => {
                  const newFile = e.target.value;
                  setCurrentFile(newFile);
                  currentFrameIdxRef.current = 0;
                  setCurrentFrameIdx(0);
                  if (autoPlay) {
                    setIsPlaying(true);
                  }
                }}
                className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono cursor-pointer max-w-[160px]"
              >
                {currentWordGroup?.files.map((file, idx) => {
                  const fileName = file.split('/').pop() || file;
                  return (
                    <option key={file} value={file} className="bg-slate-900 text-slate-200">
                      Take #{idx + 1} ({fileName})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="relative flex-1 bg-black flex items-center justify-center min-h-[400px]">
            {/* Active Word HUD Badge */}
            <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/40 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40 uppercase font-mono font-bold">
                    {currentWordGroup?.category || 'Greetings & Basics'}
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    {currentWordGroup?.word.toUpperCase() || selectedWord.toUpperCase()}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Take {takeIndex >= 0 ? takeIndex + 1 : 1} of {currentWordGroup?.files.length || 1} • {totalFrames} Frames
                </span>
              </div>
            </div>

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

        {/* Right Side: 3D Interactive Viewport */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col shadow-xl">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>3D Sign Model</span>
            </div>

            {/* 3D Mode Selector: 3D Holographic Skeleton vs 3D VRM Mesh vs Dual */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[11px] flex-wrap">
              <button
                onClick={() => setDisplay3DMode('skeleton')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  display3DMode === 'skeleton'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                3D Hologram (Direct)
              </button>
              <button
                onClick={() => setDisplay3DMode('vrm')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  display3DMode === 'vrm'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                VRM Avatar
              </button>
              <button
                onClick={() => setDisplay3DMode('dual')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  display3DMode === 'dual'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Dual Overlay
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetCamera}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-[11px] font-medium flex items-center gap-1.5 transition-all border border-slate-700/80 cursor-pointer shadow-sm"
                title="Reset 3D camera to front center view"
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span>Center View</span>
              </button>
              <div className="text-[11px] text-slate-400 font-mono hidden md:block">
                Orbit: Drag 360°
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-[400px] bg-[#07090e]">
            <div ref={container3dRef} className="absolute inset-0 w-full h-full" />
            {/* Active Word 3D HUD Badge */}
            <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/40 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40 uppercase font-mono font-bold">
                    {currentWordGroup?.category || 'Greetings & Basics'}
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    {currentWordGroup?.word.toUpperCase() || selectedWord.toUpperCase()}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Take {takeIndex >= 0 ? takeIndex + 1 : 1} of {currentWordGroup?.files.length || 1} • {totalFrames} Frames
                </span>
              </div>
            </div>

            <div className="absolute top-3 right-3 z-10 pointer-events-none bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {display3DMode === 'skeleton'
                ? '3D Hologram Mode (Ground-Truth)'
                : display3DMode === 'vrm'
                ? 'VRM Character Mode'
                : 'Dual Overlay Mode'}
            </div>
          </div>

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
