'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Holographic3DSkeleton } from '@/lib/holographic3DSkeleton';
import { LandmarkMotionSmoother, generateSmoothBridge, FrameLandmarks } from '@/lib/motionSmoothing';
import { SemanticSubstitution } from '@/lib/agents/translatorAgent';
import { Sparkles, Play, Pause, RotateCcw, Volume2, ShieldCheck, Zap, Activity } from 'lucide-react';

interface HologramParquetPlayerProps {
  wordsQueue: string[];
  activeWord: string | null;
  onWordComplete?: (word: string) => void;
  className?: string;
  omittedWords?: string[];
  semanticSubstitutions?: SemanticSubstitution[];
}

export function HologramParquetPlayer({
  wordsQueue = [],
  activeWord = null,
  onWordComplete,
  className = 'w-full h-full',
  omittedWords = [],
  semanticSubstitutions = [],
}: HologramParquetPlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const skeletonRef = useRef<Holographic3DSkeleton | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const smootherRef = useRef<LandmarkMotionSmoother>(new LandmarkMotionSmoother());
  const lastPlayedFrameRef = useRef<FrameLandmarks | null>(null);

  const [currentPlayingWord, setCurrentPlayingWord] = useState<string | null>(activeWord);
  const [frames, setFrames] = useState<any[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [smoothMotionEnabled, setSmoothMotionEnabled] = useState(true);

  // Initialize Three.js Scene with Holographic3DSkeleton
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 1.25, 1.55);
    camera.lookAt(0, 1.15, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ground Grid
    const grid = new THREE.GridHelper(8, 16, 0x0e7490, 0x0f172a);
    grid.position.y = 0;
    scene.add(grid);

    // Multi-Angle Cybernetic Lighting (Front Key Cyan, Warm Rose Fill, Back Rim)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x06b6d4, 2.5); // Cyan
    keyLight.position.set(1.5, 2.5, 2.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf43f5e, 2.0); // Rose
    fillLight.position.set(-1.5, 1.0, 2.0);
    scene.add(fillLight);

    const backRimLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    backRimLight.position.set(0, 2.0, -2.0);
    scene.add(backRimLight);

    // Initialize the High-Visibility Holographic Skeleton
    const skeleton = new Holographic3DSkeleton(scene);
    skeletonRef.current = skeleton;

    // Render loop
    const render = () => {
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(render);
    };
    render();

    // Resize observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      skeleton.dispose();
    };
  }, []);

  // Fetch .parquet data when activeWord changes or next word in queue
  const loadWordParquet = useCallback(async (word: string) => {
    if (!word) return;
    setLoading(true);
    setCurrentPlayingWord(word);

    try {
      const res = await fetch(`/api/dataset-parquet?word=${encodeURIComponent(word)}`);
      if (!res.ok) {
        console.warn(`Failed to fetch parquet frames for word: ${word}`);
        setLoading(false);
        if (onWordComplete) onWordComplete(word);
        return;
      }

      const data = await res.json();
      if (data.frames && data.frames.length > 0) {
        let loadedFrames = data.frames;

        // If smooth motion is enabled and we have a previous end frame, generate bridge frames
        if (smoothMotionEnabled && lastPlayedFrameRef.current && loadedFrames.length > 0) {
          const bridge = generateSmoothBridge(lastPlayedFrameRef.current, loadedFrames[0], 10);
          loadedFrames = [...bridge, ...loadedFrames];
        }

        setFrames(loadedFrames);
        setCurrentFrameIdx(0);
        setIsPlaying(true);
      } else {
        if (onWordComplete) {
          setTimeout(() => onWordComplete(word), 0);
        }
      }
    } catch (err) {
      console.error('Parquet load error:', err);
    } finally {
      setLoading(false);
    }
  }, [onWordComplete, smoothMotionEnabled]);

  // Trigger loading when activeWord changes
  useEffect(() => {
    if (activeWord) {
      loadWordParquet(activeWord);
    }
  }, [activeWord, loadWordParquet]);

  // Frame playback loop at 30 FPS with Motion Smoothing
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const interval = setInterval(() => {
      let isDone = false;
      let completedWord: string | null = null;

      setCurrentFrameIdx((prev) => {
        const next = prev + 1;
        if (next >= frames.length) {
          isDone = true;
          completedWord = currentPlayingWord;
          return 0;
        }

        const rawFrameData = frames[next];
        if (skeletonRef.current && rawFrameData) {
          // Apply real-time EMA motion smoothing if enabled
          const finalFrame = smoothMotionEnabled
            ? smootherRef.current.smooth(rawFrameData)
            : rawFrameData;

          skeletonRef.current.update(finalFrame);
        }

        return next;
      });

      if (isDone) {
        clearInterval(interval);
        setIsPlaying(false);
        if (frames.length > 0) {
          lastPlayedFrameRef.current = frames[frames.length - 1];
        }
        if (completedWord && onWordComplete) {
          const w = completedWord;
          setTimeout(() => {
            onWordComplete(w);
          }, 0);
        }
      }
    }, 1000 / 30); // 30 FPS

    return () => clearInterval(interval);
  }, [isPlaying, frames, currentPlayingWord, onWordComplete, smoothMotionEnabled]);

  return (
    <div className={`relative flex flex-col bg-slate-950 rounded-3xl overflow-hidden border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 ${className}`}>
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 shrink-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white tracking-wide uppercase font-heading">
            ISL Hologram (Dataset Ground-Truth)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Smooth Motion Toggle */}
          <button
            onClick={() => {
              setSmoothMotionEnabled(!smoothMotionEnabled);
              smootherRef.current.reset();
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
              smoothMotionEnabled
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50 shadow-xs'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle Landmark Motion Smoothing & Bridge Transitions"
          >
            <Activity className="w-3 h-3" />
            <span>Smooth: {smoothMotionEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {currentPlayingWord ? (
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold tracking-wider animate-pulse">
              SIGNING: {currentPlayingWord.toUpperCase()}
            </span>
          ) : (
            <span className="text-slate-500 text-xs font-medium italic">
              Waiting for speech input...
            </span>
          )}
        </div>
      </div>

      {/* 3D Viewport */}
      <div ref={mountRef} className="flex-1 w-full min-h-[220px] relative bg-radial-gradient from-slate-900 to-slate-950">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 z-20">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-cyan-950 border border-cyan-500 text-cyan-300 text-xs font-bold animate-pulse">
              <Zap className="w-4 h-4 text-cyan-400 animate-spin" />
              Loading .parquet motion from D:\Matri\Dataset...
            </div>
          </div>
        )}

        {/* Playback Scrubber Pill */}
        {frames.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-mono text-slate-300">
            <span className="text-cyan-400 font-bold">Frame {currentFrameIdx + 1}/{frames.length}</span>
            <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all"
                style={{ width: `${((currentFrameIdx + 1) / frames.length) * 100}%` }}
              />
            </div>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1 hover:text-white transition"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Information: Words Queue, Semantic Vector Matches & ISL Stopwords */}
      <div className="p-2.5 bg-slate-900 border-t border-slate-800 shrink-0 text-xs flex flex-col gap-1.5">
        {/* Queue of matched words */}
        {wordsQueue.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Queue:</span>
            {wordsQueue.map((w, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                  w.toLowerCase() === currentPlayingWord?.toLowerCase()
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 animate-pulse'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {w}
              </span>
            ))}
          </div>
        )}

        {/* Vector Embedding Semantic Match Badge */}
        {semanticSubstitutions.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-cyan-300 font-medium">
            <Zap className="w-3 h-3 text-cyan-400" />
            <span>
              Vector Match: {semanticSubstitutions.map(s => `"${s.original}" → ${s.matchedVocab.toUpperCase()} (${Math.round(s.similarity * 100)}%)`).join(', ')}
            </span>
          </div>
        )}

        {/* ISL Grammar Badge */}
        {omittedWords.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400/90 font-medium">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            <span>ISL Grammar Filter: Omitted non-sign glue: &quot;{omittedWords.join(', ')}&quot;</span>
          </div>
        )}
      </div>
    </div>
  );
}
