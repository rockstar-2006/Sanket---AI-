'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Holographic3DSkeleton, createNeutralPoseLandmarks } from '@/lib/holographic3DSkeleton';
import { LandmarkMotionSmoother, generateSmoothBridge, FrameLandmarks } from '@/lib/motionSmoothing';
import { generateFingerspellFrames, ISL_LETTER_DESCRIPTIONS, ISLLetterDescription } from '@/lib/fingerspellingEngine';
import { ChoreographedSignAction, SpeechToSignPipelineResult } from '@/lib/agents/speechToSignAgent';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Zap,
  Activity,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Layers,
  FileText,
  Volume2
} from 'lucide-react';

export default function TestSpeechToSignPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const skeletonRef = useRef<Holographic3DSkeleton | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const smootherRef = useRef<LandmarkMotionSmoother>(new LandmarkMotionSmoother());
  const lastPlayedFrameRef = useRef<FrameLandmarks | null>(null);
  const glideIntervalRef = useRef<any>(null);
  const playbackTimerRef = useRef<any>(null);
  const advanceTimeoutRef = useRef<any>(null);
  const standbyTimeoutRef = useRef<any>(null);
  const isPlayingRef = useRef<boolean>(false);
  const currentFrameIdxRef = useRef<number>(0);
  const advanceQueueRef = useRef<() => void>(() => {});
  const prefetchCacheRef = useRef<Map<string, any[]>>(new Map());

  // ─── Stable speed & function refs (breaks stale useCallback dep chain) ───────
  const playbackSpeedRef = useRef<number>(0.75);
  const stopAllPlaybackRef = useRef<() => void>(() => {});
  const startPlayingFramesRef = useRef<(frames: any[]) => void>(() => {});
  const playActionRef = useRef<(action: ChoreographedSignAction) => void>(() => {});

  // Input & Pipeline States
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<SpeechToSignPipelineResult | null>(null);

  // Hologram Playback States & Controls
  const [animationQueue, setAnimationQueue] = useState<ChoreographedSignAction[]>([]);
  const animationQueueRef = useRef<ChoreographedSignAction[]>([]);
  const [currentActionIndex, setCurrentActionIndex] = useState<number>(-1);
  const currentActionIndexRef = useRef<number>(-1);

  const [activeToken, setActiveToken] = useState<string | null>('hello');
  const [frames, setFrames] = useState<any[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingFrames, setIsLoadingFrames] = useState<boolean>(false);
  const [smoothMotion, setSmoothMotion] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.75); // 0.5x, 0.75x, 1.0x
  playbackSpeedRef.current = playbackSpeed;
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const isLoopingRef = useRef<boolean>(false);
  isLoopingRef.current = isLooping;

  const [holdSign, setHoldSign] = useState<boolean>(false);
  const holdSignRef = useRef<boolean>(false);
  holdSignRef.current = holdSign;

  const [selectedLetterInfo, setSelectedLetterInfo] = useState<ISLLetterDescription | null>(null);

  const speechRecognitionRef = useRef<any>(null);

  // Re-center camera on chest & signing area
  const resetCamera = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 1.25, 1.55);
      controlsRef.current.target.set(0, 1.15, 0);
      controlsRef.current.update();
    }
  }, []);

  // ─── 1. Initialize Three.js Hologram Scene ──────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Calibrated Perspective Camera: Centered on upper body (Y = 1.15)
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 1.25, 1.55);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.15, 0);
    controlsRef.current = controls;

    // Ground Truth Spatial Orientation Grid & Cybernetic Pedestal
    const grid = new THREE.GridHelper(8, 16, 0x0e7490, 0x0f172a);
    grid.position.y = 0;
    scene.add(grid);

    const pedestalGeom = new THREE.RingGeometry(0.38, 0.44, 32);
    const pedestalMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const pedestal = new THREE.Mesh(pedestalGeom, pedestalMat);
    pedestal.rotation.x = -Math.PI / 2;
    pedestal.position.y = 0.01;
    scene.add(pedestal);

    // Multi-Angle Cybernetic Lighting (Front Key Cyan, Warm Rose Fill, High-Angle Rim)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const keyCyanLight = new THREE.DirectionalLight(0x06b6d4, 2.6);
    keyCyanLight.position.set(1.5, 2.5, 2.5);
    scene.add(keyCyanLight);

    const fillRoseLight = new THREE.DirectionalLight(0xf43f5e, 2.0);
    fillRoseLight.position.set(-1.5, 1.0, 2.0);
    scene.add(fillRoseLight);

    const backRimLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    backRimLight.position.set(0, 2.2, -2.0);
    scene.add(backRimLight);

    // Initialize High-Visibility Volumetric Skeleton (Instantly visible in standby pose)
    const skeleton = new Holographic3DSkeleton(scene);
    skeletonRef.current = skeleton;

    // Continuous Render Loop
    const renderLoop = () => {
      controls.update();
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    // Auto-resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Load initial greeting sign
    loadWordParquet('hello');

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (glideIntervalRef.current) clearInterval(glideIntervalRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      controls.dispose();
      renderer.dispose();
      skeleton.dispose();
    };
  }, []);

  // ─── 2. Stop All Running Timers, Glides, and Loops Cleanly ──────────────────
  const stopAllPlayback = useCallback(() => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current); // recursive setTimeout pattern
      playbackTimerRef.current = null;
    }
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    if (standbyTimeoutRef.current) {
      clearTimeout(standbyTimeoutRef.current);
      standbyTimeoutRef.current = null;
    }
    if (glideIntervalRef.current) {
      clearInterval(glideIntervalRef.current);
      glideIntervalRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []); // empty deps — all reads go through refs
  stopAllPlaybackRef.current = stopAllPlayback;

  // ─── 2b. Smooth Glide Back to Standby Neutral Posture ───────────────────────
  const glideToStandby = useCallback(() => {
    if (glideIntervalRef.current) {
      clearInterval(glideIntervalRef.current);
      glideIntervalRef.current = null;
    }
    if (!skeletonRef.current) return;
    if (!lastPlayedFrameRef.current) {
      skeletonRef.current.resetToDefaultPose();
      return;
    }

    const neutralPose = createNeutralPoseLandmarks();
    const bridge = generateSmoothBridge(lastPlayedFrameRef.current, neutralPose, 14);
    let step = 0;

    glideIntervalRef.current = setInterval(() => {
      if (step < bridge.length && skeletonRef.current) {
        skeletonRef.current.update(bridge[step]);
        step++;
      } else {
        if (glideIntervalRef.current) {
          clearInterval(glideIntervalRef.current);
          glideIntervalRef.current = null;
        }
        if (skeletonRef.current) {
          skeletonRef.current.resetToDefaultPose();
        }
        lastPlayedFrameRef.current = null;
      }
    }, 33);
  }, []);

  // ─── 3. Frame Playback Engine (Zero Race Conditions, Self-Terminating) ──────
  const startPlayingFrames = useCallback((frameList: any[]) => {
    if (!frameList || frameList.length === 0) return;

    stopAllPlaybackRef.current(); // via stable ref — no dep on stopAllPlayback
    isPlayingRef.current = true;
    setIsPlaying(true);
    currentFrameIdxRef.current = 0;
    setCurrentFrameIdx(0);

    // Render frame 0 immediately
    const frame0 = frameList[0];
    if (skeletonRef.current && frame0) {
      const finalFrame0 = smoothMotion ? smootherRef.current.smooth(frame0) : frame0;
      skeletonRef.current.update(finalFrame0);
    }

    // Background-prefetch the NEXT word while current word plays
    const nextActionIdx = currentActionIndexRef.current + 1;
    const nextAction = animationQueueRef.current[nextActionIdx];
    if (nextAction?.parquetWord && !prefetchCacheRef.current.has(nextAction.parquetWord)) {
      fetch(`/api/dataset-parquet?word=${encodeURIComponent(nextAction.parquetWord)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.frames) prefetchCacheRef.current.set(nextAction.parquetWord!, data.frames);
        })
        .catch(() => {}); // silent — normal fetch in playAction is fallback
    }

    const scheduleNextFrame = () => {
      // Read live speed on every tick — never stale
      const delay = Math.round((1000 / 30) / playbackSpeedRef.current);
      playbackTimerRef.current = setTimeout(() => {
        const nextIdx = currentFrameIdxRef.current + 1;

        if (nextIdx >= frameList.length) {
          playbackTimerRef.current = null;
          isPlayingRef.current = false;
          setIsPlaying(false);
          lastPlayedFrameRef.current = frameList[frameList.length - 1];
          // Advance to next action in queue exactly once
          advanceTimeoutRef.current = setTimeout(() => {
            advanceQueueRef.current(); // always-current ref
          }, 120);
          return;
        }

        currentFrameIdxRef.current = nextIdx;
        setCurrentFrameIdx(nextIdx);

        const rawFrame = frameList[nextIdx];
        if (skeletonRef.current && rawFrame) {
          const finalFrame = smoothMotion
            ? smootherRef.current.smooth(rawFrame)
            : rawFrame;
          skeletonRef.current.update(finalFrame);
        }

        scheduleNextFrame(); // recurse — reads live speed each tick
      }, delay);
    };

    scheduleNextFrame();
  }, [smoothMotion]); // only smoothMotion — no stopAllPlayback, no playbackSpeed
  startPlayingFramesRef.current = startPlayingFrames;

  // ─── 4. Fetch Parquet Frames for Word from Dataset ──────────────────────────
  // ─── 4. Unified Play Action (Word Parquet Take OR Fingerspelling 3D Animation) ──
  const playAction = useCallback(async (action: ChoreographedSignAction) => {
    if (!action) return;
    stopAllPlaybackRef.current();
    setActiveToken(action.token);

    if (action.parquetWord) {
      // Fast path: use prefetched frames if available
      const cachedFrames = prefetchCacheRef.current.get(action.parquetWord);
      if (cachedFrames) {
        prefetchCacheRef.current.delete(action.parquetWord);
        let loadedFrames = cachedFrames;
        if (smoothMotion && lastPlayedFrameRef.current && loadedFrames.length > 0) {
          const bridge = generateSmoothBridge(lastPlayedFrameRef.current, loadedFrames[0], 10);
          loadedFrames = [...bridge, ...loadedFrames];
        }
        smootherRef.current.reset();
        setFrames(loadedFrames);
        startPlayingFramesRef.current(loadedFrames);
        return;
      }

      // 1. Fetch Parquet Frames for Word from 262 ISL Dataset
      setIsLoadingFrames(true);
      try {
        const res = await fetch(`/api/dataset-parquet?word=${encodeURIComponent(action.parquetWord)}`);
        if (!res.ok) {
          console.warn(`[Parquet] Could not fetch frames for: ${action.parquetWord}`);
          setIsLoadingFrames(false);
          advanceQueueRef.current();
          return;
        }

        const data = await res.json();
        if (data.frames && data.frames.length > 0) {
          let loadedFrames = data.frames;

          // Apply smooth transition bridge from previous end frame
          if (smoothMotion && lastPlayedFrameRef.current && loadedFrames.length > 0) {
            const bridge = generateSmoothBridge(lastPlayedFrameRef.current, loadedFrames[0], 10);
            loadedFrames = [...bridge, ...loadedFrames];
          }

          smootherRef.current.reset();
          setFrames(loadedFrames);
          startPlayingFramesRef.current(loadedFrames);
        } else {
          advanceQueueRef.current();
        }
      } catch (err) {
        console.error('[Parquet] Load error:', err);
        advanceQueueRef.current();
      } finally {
        setIsLoadingFrames(false);
      }
    } else {
      // 2. Word Not in Dataset: Generate Authentic 3D Fingerspelling Animation Take!
      setIsLoadingFrames(true);
      try {
        let loadedFrames = generateFingerspellFrames(action.token, 26);

        if (smoothMotion && lastPlayedFrameRef.current && loadedFrames.length > 0) {
          const bridge = generateSmoothBridge(lastPlayedFrameRef.current, loadedFrames[0], 8);
          loadedFrames = [...bridge, ...loadedFrames];
        }

        smootherRef.current.reset();
        setFrames(loadedFrames);
        startPlayingFramesRef.current(loadedFrames);
      } catch (err) {
        console.error('[Fingerspell] Generation error:', err);
        advanceQueueRef.current();
      } finally {
        setIsLoadingFrames(false);
      }
    }
  }, [smoothMotion]); // only smoothMotion — no startPlayingFrames, no stopAllPlayback
  playActionRef.current = playAction;

  // Backward compatibility alias for isolated word loader
  const loadWordParquet = useCallback((word: string) => {
    playActionRef.current({
      type: 'word',
      token: word,
      displayLabel: word.toUpperCase(),
      source: 'dataset_parquet',
      parquetWord: word,
      durationMs: 1400,
    });
  }, []);

  // ─── 5. Replay and Word Isolation Controls ──────────────────────────────────
  const replayFullSequence = useCallback(() => {
    const queue = animationQueueRef.current;
    if (queue.length > 0) {
      stopAllPlayback();
      currentActionIndexRef.current = 0;
      setCurrentActionIndex(0);
      playActionRef.current(queue[0]);
    }
  }, [stopAllPlayback]);

  const playWordAction = useCallback((idx: number) => {
    const queue = animationQueueRef.current;
    if (idx >= 0 && idx < queue.length) {
      stopAllPlayback();
      currentActionIndexRef.current = idx;
      setCurrentActionIndex(idx);
      playActionRef.current(queue[idx]);
    }
  }, [stopAllPlayback]);

  // ─── 6. Advance to Next Item in Animation Queue ─────────────────────────────
  const advanceQueue = useCallback(() => {
    const queue = animationQueueRef.current;
    const nextIndex = currentActionIndexRef.current + 1;

    if (nextIndex < queue.length) {
      currentActionIndexRef.current = nextIndex;
      setCurrentActionIndex(nextIndex);
      const nextAction = queue[nextIndex];
      advanceTimeoutRef.current = setTimeout(() => {
        playActionRef.current(nextAction);
      }, 0);
    } else {
      // Reached end of sentence or single sign
      if (isLoopingRef.current && queue.length > 0) {
        advanceTimeoutRef.current = setTimeout(() => {
          replayFullSequence();
        }, 800);
      } else if (holdSignRef.current) {
        // Freeze pose in place so user can rotate in 3D and inspect
        isPlayingRef.current = false;
        setIsPlaying(false);
      } else {
        isPlayingRef.current = false;
        setIsPlaying(false);
        // Hold final sign posture for 1500ms so user can comfortably observe, then glide down to neutral
        standbyTimeoutRef.current = setTimeout(() => {
          glideToStandby();
        }, 1500);
      }
    }
  }, [glideToStandby, replayFullSequence]);
  advanceQueueRef.current = advanceQueue;

  const handleTogglePlay = () => {
    if (!isPlayingRef.current) {
      if (frames.length > 0) {
        if (currentFrameIdxRef.current >= frames.length - 1) {
          currentFrameIdxRef.current = 0;
        }
        startPlayingFramesRef.current(frames);
      }
    } else {
      stopAllPlayback();
    }
  };

  // ─── 5. Dispatch Input to Google ADK Pipeline ──────────────────────────────
  const handleTranslateAndSign = async (queryText: string) => {
    const textToProcess = (queryText || inputText).trim();
    if (!textToProcess) return;

    setIsProcessing(true);
    setInputText(textToProcess);

    try {
      const res = await fetch('/api/agents/speech-to-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToProcess }),
      });

      if (res.ok) {
        const data: SpeechToSignPipelineResult = await res.json();
        setPipelineResult(data);

        if (data.animationQueue && data.animationQueue.length > 0) {
          animationQueueRef.current = data.animationQueue;
          currentActionIndexRef.current = 0;
          setAnimationQueue(data.animationQueue);
          setCurrentActionIndex(0);
          const firstAction = data.animationQueue[0];
          playActionRef.current(firstAction);
        }
      }
    } catch (err) {
      console.error('[Pipeline] Error executing Speech-to-Sign:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── 6. Web Speech Recognition (Microphone) ─────────────────────────────────
  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Web Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          handleTranslateAndSign(transcript);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[Speech] Error:', err);
      setIsListening(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Header Bar */}
      <header className="h-16 px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black shadow-lg shadow-cyan-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-2 font-heading">
              Test 1: Speech & Text to 3D Hologram Sign Language
            </h1>
            <div className="text-[11px] text-slate-400 font-mono">
              Google ADK Multi-Agent • Gemini Flash • 262 ISL Parquet Dataset • Vector Embeddings
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm">
            <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            Gemini 2.0 Flash Active
          </span>
          <span className="hidden sm:inline px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs font-bold">
            262 ISL Words Loaded
          </span>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 sm:p-6 gap-6">
        
        {/* Left Column: Input, Presets & Multi-Agent HUD */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4 overflow-y-auto pr-1">
          
          {/* A. Text & Voice Input Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-3.5">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Ask or Speak Any Question / Sentence:</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTranslateAndSign(inputText)}
                placeholder='e.g. "What is your name?", "The physician is in the hospital"...'
                className="flex-1 bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />

              {/* Mic Button */}
              <button
                onClick={toggleListening}
                className={`p-3 rounded-2xl border transition shadow-lg ${
                  isListening
                    ? 'bg-rose-500 text-white border-rose-400 animate-pulse shadow-rose-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-slate-700'
                }`}
                title={isListening ? 'Stop Listening' : 'Speak into Microphone'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Submit Button */}
              <button
                onClick={() => handleTranslateAndSign(inputText)}
                disabled={isProcessing || !inputText.trim()}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-cyan-500/25 active:scale-95 shrink-0"
              >
                {isProcessing ? (
                  <>
                    <Zap className="w-4 h-4 animate-spin" />
                    <span>Orchestrating...</span>
                  </>
                ) : (
                  <>
                    <span>Translate & Sign</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Quick Test Presets */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">One-Click Test Presets:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '👋 What is your name?', text: 'what is your name' },
                  { label: '🩺 Physician in hospital', text: 'the physician is in the hospital' },
                  { label: '🌅 Good morning you happy', text: 'good morning you are happy' },
                  { label: '🚗 Fast automobile', text: 'fast automobile' },
                  { label: '🤝 How are you?', text: 'how are you' },
                  { label: '🙏 Thank you', text: 'thank you' },
                  { label: '🔤 Hello Sanket (Fingerspell)', text: 'hello sanket' },
                ].map((item) => (
                  <button
                    key={item.text}
                    onClick={() => handleTranslateAndSign(item.text)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-700/80 text-xs font-mono font-medium transition"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct A-Z Fingerspelling Test Bar */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-mono text-cyan-400 uppercase font-bold flex items-center justify-between">
                <span>🔤 Direct A-Z Fingerspelling Test:</span>
                <span className="text-[10px] text-slate-500 font-normal">ISL Ground Truth Calibrated</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((char) => (
                  <button
                    key={char}
                    onClick={() => {
                      const desc = ISL_LETTER_DESCRIPTIONS[char] || null;
                      setSelectedLetterInfo(desc);
                      playActionRef.current({
                        type: 'letter',
                        token: char,
                        displayLabel: char,
                        source: 'fingerspell_letter',
                        durationMs: 850,
                      });
                    }}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center border cursor-pointer ${
                      activeToken === char
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-lg shadow-cyan-500/40 ring-1 ring-cyan-300 scale-105'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-700/60 hover:text-white hover:border-cyan-500/40'
                    }`}
                    title={`Test Sign for Letter [${char}]`}
                  >
                    {char}
                  </button>
                ))}
              </div>

              {/* Educational ISL Letter Inspector Card */}
              {selectedLetterInfo && (
                <div className="mt-2 p-3.5 bg-slate-950/90 border border-cyan-500/40 rounded-2xl shadow-xl flex flex-col gap-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-cyan-500 text-slate-950 font-mono font-black text-xs flex items-center justify-center shadow-xs">
                        {selectedLetterInfo.letter}
                      </span>
                      <span className="text-white text-xs font-bold font-mono">
                        {selectedLetterInfo.name} • Indian Sign Language (ISL)
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                      {selectedLetterInfo.twoHanded ? 'Two-Handed' : 'Single-Hand'}
                    </span>
                  </div>
                  <p className="text-xs text-cyan-100 font-medium leading-relaxed">
                    👉 <strong className="text-cyan-300">Handshape:</strong> {selectedLetterInfo.handshape}
                  </p>
                  <p className="text-[11px] text-slate-400 italic">
                    💡 <span className="text-slate-300">Posture Notes:</span> {selectedLetterInfo.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* B. Google ADK Multi-Agent Execution HUD */}
          {pipelineResult && (
            <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-5 shadow-xl flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>ADK Multi-Agent Pipeline Result</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {pipelineResult.executionTimeMs}ms • {pipelineResult.modelUsed}
                </span>
              </div>

              {/* Sub-Agent 1: ISL Linguistic Grammar Result */}
              <div className="flex flex-col gap-1.5 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase">Sub-Agent 1: ISL Linguistic Grammar</span>
                  {pipelineResult.omittedStopwords.length > 0 && (
                    <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Omitted Non-Sign Words: &quot;{pipelineResult.omittedStopwords.join(', ')}&quot;
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
                  <span className="text-slate-500">ISL Gloss Syntax:</span>
                  <span className="text-white font-bold tracking-wider">
                    [{pipelineResult.islGrammarTokens.join(' ')}]
                  </span>
                </div>
                {pipelineResult.linguisticExplanation && (
                  <p className="text-[11px] text-slate-400 italic">
                    💡 {pipelineResult.linguisticExplanation}
                  </p>
                )}
              </div>

              {/* Sub-Agent 2: Vector Embedding Semantic Matches */}
              {pipelineResult.semanticSubstitutions.length > 0 && (
                <div className="flex flex-col gap-1.5 bg-slate-950/70 p-3 rounded-2xl border border-cyan-500/20">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase">Sub-Agent 2: Vector Embedding Synonyms</span>
                  <div className="flex flex-wrap gap-2">
                    {pipelineResult.semanticSubstitutions.map((sub, i) => (
                      <span key={i} className="text-xs font-mono px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-200">
                        &quot;{sub.original}&quot; ➔ <strong className="text-white">{sub.matched.toUpperCase()}</strong> ({Math.round(sub.similarity * 100)}% cosine match)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Agent 3: Animation Choreography Timeline & Interactive Controls */}
              <div className="flex flex-col gap-2.5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Choreographed Sign Queue ({pipelineResult.animationQueue.length} Signs):</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={replayFullSequence}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold font-mono transition shadow-sm"
                      title="Replay entire sign sequence from beginning"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Replay Sequence</span>
                    </button>

                    <button
                      onClick={() => setIsLooping(!isLooping)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition ${
                        isLooping
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-sm'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title="Continuously loop sequence"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Loop: {isLooping ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </div>

                {/* Clickable Word Gestures Queue */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {pipelineResult.animationQueue.map((act, idx) => (
                    <button
                      key={idx}
                      onClick={() => playWordAction(idx)}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border transition flex items-center gap-2 shrink-0 cursor-pointer text-left ${
                        idx === currentActionIndex
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-300 shadow-lg shadow-cyan-500/40 scale-105 ring-2 ring-cyan-400'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-cyan-500/50'
                      }`}
                      title={`Click to play sign: ${act.displayLabel}`}
                    >
                      <Play className="w-3 h-3 text-cyan-400" />
                      <div className="flex flex-col">
                        <span className="text-white text-xs">{act.displayLabel}</span>
                        <span className="text-[9px] opacity-75 font-normal">
                          {act.source === 'dataset_parquet' ? '• 262 ISL Take' : act.source === 'vector_synonym' ? '• Vector Synonym' : '• Fingerspell'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <span className="text-[11px] text-slate-500 italic">
                  💡 Tip: Click any sign badge above to replay that specific gesture on the 3D model!
                </span>
              </div>

              {/* Educational Word-by-Word Mapping Guide */}
              <div className="flex flex-col gap-2 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  ISL Linguistic Breakdown for &quot;{pipelineResult.originalText}&quot;:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold font-mono">1. Auxiliary Verbs:</span>
                    <span className="text-slate-400 text-[11px]">
                      ISL has no verb &quot;to be&quot; (&quot;is&quot;, &quot;are&quot;). Omitted naturally.
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold font-mono">2. Questions (&quot;What&quot;):</span>
                    <span className="text-slate-400 text-[11px]">
                      Interrogatives in ISL are expressed with facial cues (eyebrows & head tilt).
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold font-mono">3. Pronoun (&quot;Your&quot;):</span>
                    <span className="text-slate-400 text-[11px]">
                      Signed using personal pronoun <strong>[YOU]</strong> pointing index finger.
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold font-mono">4. Identity (&quot;Name&quot;):</span>
                    <span className="text-slate-400 text-[11px]">
                      Signed using the Deaf community sign <strong>[SIGN]</strong> (asking for your sign-name).
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right Column: 3D Holographic Viewport */}
        <div className="w-full lg:w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Viewport Header */}
          <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                3D Holographic Skeleton Viewport
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback Speed Selector */}
              <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700 text-[11px] font-mono">
                {[0.5, 0.75, 1.0].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-0.5 rounded-md transition font-bold ${
                      playbackSpeed === spd
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={`Set playback speed to ${spd}x`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Recenter Camera */}
              <button
                onClick={resetCamera}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
                title="Recenter Camera Target"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Recenter</span>
              </button>

              {/* Smooth Motion Toggle */}
              <button
                onClick={() => {
                  setSmoothMotion(!smoothMotion);
                  smootherRef.current.reset();
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
                  smoothMotion
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50 shadow-xs'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Toggle Landmark Motion Smoothing & Cubic Transition Bridges"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Smooth 60fps: {smoothMotion ? 'ON' : 'OFF'}</span>
              </button>

              {/* Hold / Freeze 3D Pose Toggle */}
              <button
                onClick={() => setHoldSign(!holdSign)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                  holdSign
                    ? 'bg-amber-950 text-amber-300 border-amber-500 shadow-xs'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Hold the 3D sign in place indefinitely so you can rotate and inspect the posture from all angles"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Hold Sign: {holdSign ? 'ON' : 'OFF'}</span>
              </button>

              {activeToken && (
                <span className="px-3 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold animate-pulse">
                  {activeToken.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Three.js Canvas Container */}
          <div ref={mountRef} className="flex-1 w-full min-h-[380px] relative bg-radial-gradient from-slate-900 to-slate-950">
            {/* Loading Overlay */}
            {isLoadingFrames && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm z-10 rounded-b-3xl pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-[3px] border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  <span className="text-xs font-mono text-cyan-400 tracking-wider">
                    Loading sign data...
                  </span>
                </div>
              </div>
            )}

            {/* Live Playing Word Floating Badge */}
            {isPlaying && activeToken && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 bg-slate-950/90 border border-cyan-500/60 px-4 py-2 rounded-2xl shadow-xl shadow-cyan-950/60 backdrop-blur-md animate-pulse">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">Now Signing:</span>
                <span className="text-sm font-mono font-extrabold text-cyan-300 tracking-wider">[{activeToken.toUpperCase()}]</span>
                <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                  {playbackSpeed}x
                </span>
              </div>
            )}

            {/* Playback Controls & Frame Scrubber */}
            {frames.length > 0 ? (
              <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-2xl text-xs font-mono text-slate-300 shadow-xl">
                <button
                  onClick={handleTogglePlay}
                  className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
                  title={isPlaying ? 'Pause' : 'Play / Rewind'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => {
                    stopAllPlayback();
                    skeletonRef.current?.resetToDefaultPose();
                    setActiveToken('STANDBY');
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Reset to Standby Posture"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <span className="text-cyan-400 font-bold shrink-0">
                  Frame {currentFrameIdx + 1}/{frames.length}
                </span>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0, frames.length - 1)}
                  value={currentFrameIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    stopAllPlayback();
                    currentFrameIdxRef.current = idx;
                    setCurrentFrameIdx(idx);
                    if (skeletonRef.current && frames[idx]) {
                      skeletonRef.current.update(frames[idx]);
                    }
                  }}
                  className="flex-1 accent-cyan-400 h-1.5 cursor-pointer"
                />

                <span className="text-slate-500 text-[11px] hidden md:inline">Drag 3D to rotate</span>
              </div>
            ) : (
              <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-mono text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Standby Posture Active • Model Ready</span>
              </div>
            )}
          </div>

          {/* Viewport Footer Note */}
          <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Volumetric 3D Neon Limbs • Articulated Phalanx Joints • Palm Orientation Plates</span>
            <span className="text-cyan-400 font-mono">30 FPS Ground Truth</span>
          </div>

        </div>

      </div>
    </div>
  );
}
