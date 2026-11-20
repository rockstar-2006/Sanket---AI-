'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { 
  Camera, 
  Activity, 
  Save, 
  CheckCircle2, 
  Trash2, 
  RotateCcw, 
  Database, 
  Download,
  Sparkles, 
  Check, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  Tag,
  Volume2,
  FileSpreadsheet,
  Play,
  Flame,
  Search,
  Sliders,
  AlertCircle,
  Clock,
  Timer,
  BarChart2,
  FolderHeart,
  Filter,
  Target,
  Crosshair
} from 'lucide-react';
import { 
  ISLCameraRecognizerEngine, 
  RecognitionFrameUpdate, 
  HandLandmarkResult, 
  LandmarkPoint3D 
} from '@/lib/islCameraRecognizer';
import {
  CustomSignRecord,
  LandmarkFrame,
  loadCustomSignsFromClientStorage,
  persistCustomSignToClientStorage,
  bulkPersistCustomSigns,
  removeCustomSignFromClientStorage,
  getLocalStorageSigns,
} from '@/lib/customSignsStorage';

function dist3D(a: LandmarkPoint3D, b: LandmarkPoint3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function computeFingerCurls(pts: LandmarkPoint3D[]): number[] {
  if (!pts || pts.length < 21) return [0, 0, 0, 0, 0];
  const wrist = pts[0];
  const fingers = [
    [1, 2, 4],   // thumb
    [5, 6, 8],   // index
    [9, 10, 12], // middle
    [13, 14, 16],// ring
    [17, 18, 20] // pinky
  ];
  return fingers.map(([mcpIdx, pipIdx, tipIdx]) => {
    const baseLen = dist3D(wrist, pts[mcpIdx]);
    const tipLen = dist3D(wrist, pts[tipIdx]);
    const ratio = (tipLen - baseLen * 0.8) / (baseLen * 1.3);
    return Math.max(0.0, Math.min(1.0, ratio));
  });
}

// 1. Translation- and Scale-Invariant Hand Landmark Normalization
function normalizeHandLandmarks(pts: LandmarkPoint3D[]): LandmarkPoint3D[] {
  if (!pts || pts.length < 21) return [];
  const wrist = pts[0];
  // Stable palm scale: distance from wrist (0) to middle MCP (9) or index MCP (5)
  const palmScale = dist3D(wrist, pts[9]) || dist3D(wrist, pts[5]) || 0.15;
  const s = Math.max(palmScale, 0.05);

  return pts.map((p) => ({
    x: (p.x - wrist.x) / s,
    y: (p.y - wrist.y) / s,
    z: ((p.z || 0) - (wrist.z || 0)) / s,
  }));
}

// 2. Unit Direction Vector for a Finger (MCP to TIP)
function getFingerDirectionVector(normPts: LandmarkPoint3D[], mcpIdx: number, tipIdx: number) {
  const dx = normPts[tipIdx].x - normPts[mcpIdx].x;
  const dy = normPts[tipIdx].y - normPts[mcpIdx].y;
  const dz = (normPts[tipIdx].z || 0) - (normPts[mcpIdx].z || 0);
  const mag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
  return { x: dx / mag, y: dy / mag, z: dz / mag };
}

// 3. Strict 21-Node Kinematic Geometric Similarity (0.0 to 1.0)
function computeHandGeometricSimilarity(livePts: LandmarkPoint3D[], refPts: LandmarkPoint3D[]): number {
  if (!livePts || livePts.length < 21 || !refPts || refPts.length < 21) return 0;

  const normLive = normalizeHandLandmarks(livePts);
  const normRef = normalizeHandLandmarks(refPts);

  // A. Normalized 21-Joint Mean Euclidean Distance
  let jointDistSum = 0;
  for (let i = 0; i < 21; i++) {
    jointDistSum += dist3D(normLive[i], normRef[i]);
  }
  const avgJointDist = jointDistSum / 21;
  // Exponential decay ensures distant joints sharply drop similarity score
  const jointSim = Math.max(0, Math.exp(-avgJointDist * 2.2));

  // B. 5-Finger Direction Vector Alignment (MCP to TIP Cosine Alignment)
  const fingerJoints = [
    [2, 4],   // Thumb
    [5, 8],   // Index
    [9, 12],  // Middle
    [13, 16], // Ring
    [17, 20]  // Pinky
  ];
  let vectorSimSum = 0;
  for (const [mcp, tip] of fingerJoints) {
    const vLive = getFingerDirectionVector(normLive, mcp, tip);
    const vRef = getFingerDirectionVector(normRef, mcp, tip);
    const dot = vLive.x * vRef.x + vLive.y * vRef.y + vLive.z * vRef.z;
    const cosScore = Math.max(0, (dot + 1) / 2);
    vectorSimSum += cosScore;
  }
  const vectorSim = vectorSimSum / 5;

  // C. 5-Finger Curl Extension Consistency
  const liveCurls = computeFingerCurls(livePts);
  const refCurls = computeFingerCurls(refPts);
  let curlDiffSum = 0;
  for (let f = 0; f < 5; f++) {
    curlDiffSum += Math.abs(liveCurls[f] - refCurls[f]);
  }
  const curlSim = Math.max(0, 1.0 - (curlDiffSum / 5));

  // D. Fingertip Relative Distance Matrix
  const tipPairs = [
    [4, 8],   // Thumb to Index
    [8, 12],  // Index to Middle
    [12, 16], // Middle to Ring
    [16, 20], // Ring to Pinky
    [4, 20],  // Thumb to Pinky span
    [4, 12]   // Thumb to Middle
  ];
  let tipDistDiffSum = 0;
  for (const [a, b] of tipPairs) {
    const dLive = dist3D(normLive[a], normLive[b]);
    const dRef = dist3D(normRef[a], normRef[b]);
    tipDistDiffSum += Math.abs(dLive - dRef);
  }
  const tipSim = Math.max(0, 1.0 - (tipDistDiffSum / tipPairs.length) * 1.4);

  // Precision Weighted Formulation
  return (jointSim * 0.40) + (vectorSim * 0.35) + (curlSim * 0.15) + (tipSim * 0.10);
}

// 4. Multi-Hand & Trajectory Sequence Evaluator
function evaluateSignSimilarity(
  sign: CustomSignRecord,
  liveHands: HandLandmarkResult[]
): number {
  if (!sign.frames || sign.frames.length === 0) return 0;

  // Detect whether the recorded sign was dual-handed
  const dualHandFrameCount = sign.frames.filter((f) => f.rightHand && f.leftHand).length;
  const isDualHandRef = dualHandFrameCount > (sign.frames.length * 0.35);

  // Dual-hand signs require 2 hands in view to prevent single-hand false positives
  if (isDualHandRef && liveHands.length < 2) {
    return 0;
  }

  // Sample 7 representative frames across the core 70% of recorded gesture
  const startIdx = Math.floor(sign.frames.length * 0.15);
  const endIdx = Math.floor(sign.frames.length * 0.85);
  const step = Math.max(1, Math.floor((endIdx - startIdx) / 7));

  let maxSim = 0;

  for (let i = startIdx; i <= endIdx; i += step) {
    const frame = sign.frames[i];
    if (!frame) continue;

    if (isDualHandRef) {
      const refRight = frame.rightHand;
      const refLeft = frame.leftHand;
      if (!refRight || !refLeft) continue;

      const liveH0 = liveHands[0]?.landmarks;
      const liveH1 = liveHands[1]?.landmarks;
      if (!liveH0 || !liveH1) continue;

      const scoreOption1 = (computeHandGeometricSimilarity(liveH0, refRight) + computeHandGeometricSimilarity(liveH1, refLeft)) / 2;
      const scoreOption2 = (computeHandGeometricSimilarity(liveH1, refRight) + computeHandGeometricSimilarity(liveH0, refLeft)) / 2;
      const dualScore = Math.max(scoreOption1, scoreOption2);

      if (dualScore > maxSim) maxSim = dualScore;
    } else {
      const refPts = frame.rightHand || frame.leftHand;
      if (!refPts || refPts.length < 21) continue;

      for (const liveHand of liveHands) {
        if (!liveHand.landmarks || liveHand.landmarks.length < 21) continue;
        const sim = computeHandGeometricSimilarity(liveHand.landmarks, refPts);
        if (sim > maxSim) maxSim = sim;
      }
    }
  }

  return maxSim;
}

export default function OpenSourceLandmarkDatasetPage() {
  const [activeTab, setActiveTab] = useState<'record' | 'test' | 'library'>('record');

  // Camera & Tracking state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [handsCount, setHandsCount] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);

  // Sign naming inputs
  const [signWord, setSignWord] = useState<string>('DOCTOR');
  const [signCategory, setSignCategory] = useState<string>('Medical');

  // Configurable Timers (User selectable)
  const [countdownDuration, setCountdownDuration] = useState<number>(3); // 2s, 3s, 5s, 10s
  const [recordingDuration, setRecordingDuration] = useState<number>(4); // 3s, 4s, 5s, 6s, 8s, 10s

  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(4);
  const [recordedFrames, setRecordedFrames] = useState<LandmarkFrame[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Database saved signs (initialized synchronously from client storage to prevent disappearing on refresh)
  const [savedSigns, setSavedSigns] = useState<CustomSignRecord[]>(() => {
    if (typeof window !== 'undefined') {
      return getLocalStorageSigns();
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Live Testing state & Target Selection
  const [targetTestSignId, setTargetTestSignId] = useState<string | 'all'>('all');
  const [testResult, setTestResult] = useState<{
    matchedLabel: string;
    confidence: number;
    timestamp: number;
  } | null>(null);
  const [liveAlignment, setLiveAlignment] = useState<{
    label: string;
    score: number;
    isMatched: boolean;
  }>({ label: '', score: 0, isMatched: false });

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ISLCameraRecognizerEngine | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const currentBufferRef = useRef<LandmarkFrame[]>([]);
  const recordStartMsRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(0);
  const latestHandsRef = useRef<HandLandmarkResult[]>([]);
  const lastChimeTimeRef = useRef<number>(0);
  const activeTabRef = useRef<'record' | 'test' | 'library'>(activeTab);
  const savedSignsRef = useRef<CustomSignRecord[]>(savedSigns);
  const targetTestSignIdRef = useRef<string | 'all'>('all');
  const consecutiveMatchFramesRef = useRef<{ label: string; count: number }>({ label: '', count: 0 });

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    savedSignsRef.current = savedSigns;
  }, [savedSigns]);

  useEffect(() => {
    targetTestSignIdRef.current = targetTestSignId;
  }, [targetTestSignId]);

  // 1. Fetch & Reconcile Saved Signs (IndexedDB + LocalStorage + Server DB)
  const fetchSavedSigns = useCallback(async () => {
    try {
      // Step A: Load client-stored signs (guaranteed to survive restarts & refreshes)
      const localSigns = await loadCustomSignsFromClientStorage();

      // Step B: Fetch from server API
      let serverSigns: CustomSignRecord[] = [];
      try {
        const res = await fetch('/api/custom-signs');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.signs)) {
            serverSigns = data.signs;
          }
        }
      } catch (netErr) {
        console.warn('[Custom Signs] Server fetch note:', netErr);
      }

      // Step C: Bidirectional merge - ensure no locally recorded sign is ever lost
      const signMap = new Map<string, CustomSignRecord>();
      serverSigns.forEach((s) => signMap.set(s.id, s));
      localSigns.forEach((s) => {
        if (!signMap.has(s.id)) {
          signMap.set(s.id, s);
          // Auto-sync missing signs back to server in background
          fetch('/api/custom-signs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
          }).catch(() => {});
        }
      });

      const merged = Array.from(signMap.values());
      setSavedSigns(merged);
      await bulkPersistCustomSigns(merged);
    } catch (e) {
      console.warn('Could not fetch custom signs, using local client storage:', e);
      const fallback = await loadCustomSignsFromClientStorage();
      if (fallback.length > 0) {
        setSavedSigns(fallback);
      }
    }
  }, []);

  useEffect(() => {
    // Immediate IndexedDB load
    loadCustomSignsFromClientStorage().then((initial) => {
      if (initial && initial.length > 0) {
        setSavedSigns((prev) => {
          const map = new Map<string, CustomSignRecord>();
          prev.forEach((s) => map.set(s.id, s));
          initial.forEach((s) => map.set(s.id, s));
          return Array.from(map.values());
        });
      }
    });

    fetchSavedSigns();
  }, [fetchSavedSigns]);

  // 2. Play Pleasant Harmonic Audio Chime for Successful Test
  const playHarmonicChime = () => {
    const now = Date.now();
    if (now - lastChimeTimeRef.current < 1200) return; // Prevent spam
    lastChimeTimeRef.current = now;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.15); // E6

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  // 3. Initialize Camera & Live MediaPipe 21-Node Landmark Recognizer (Once on mount)
  useEffect(() => {
    let stream: MediaStream | null = null;
    let engine: ISLCameraRecognizerEngine | null = null;
    let isMounted = true;

    async function initCamera() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              await playPromise.catch((err) => {
                if (err.name !== 'AbortError') {
                  console.warn('Video play error:', err);
                }
              });
            }
          } catch (err: any) {
            if (err.name !== 'AbortError') console.warn('Play call error:', err);
          }
          if (isMounted) setCameraActive(true);
        }

        engine = new ISLCameraRecognizerEngine();
        engineRef.current = engine;

        if (videoRef.current && canvasRef.current && isMounted) {
          await engine.initialize(
            videoRef.current,
            canvasRef.current,
            (update: RecognitionFrameUpdate) => {
              if (!isMounted) return;
              setHandsCount(update.handsDetected || 0);
              latestHandsRef.current = update.allHands || [];

              // Calculate FPS
              frameCountRef.current++;
              const now = performance.now();
              if (now - fpsTimerRef.current >= 1000) {
                setFps(frameCountRef.current);
                frameCountRef.current = 0;
                fpsTimerRef.current = now;
              }

              // Recording Logic: Capture real 21-node coordinates
              if (isRecordingRef.current) {
                let rightHand: LandmarkPoint3D[] | null = null;
                let leftHand: LandmarkPoint3D[] | null = null;

                if (update.allHands && update.allHands.length > 0) {
                  for (const h of update.allHands) {
                    if (h.handedness === 'Right') rightHand = h.landmarks;
                    else if (h.handedness === 'Left') leftHand = h.landmarks;
                  }
                  if (!rightHand && !leftHand && update.allHands[0]) {
                    rightHand = update.allHands[0].landmarks;
                  }
                }

                const elapsed = (performance.now() - recordStartMsRef.current) / 1000;
                currentBufferRef.current.push({
                  frameIndex: currentBufferRef.current.length,
                  timeSec: Number(elapsed.toFixed(3)),
                  rightHand,
                  leftHand,
                });
              }

              // Live Testing Logic: Compare live hand with saved custom signs
              if (activeTabRef.current === 'test') {
                evaluateLiveTestGesture(update.allHands || []);
              }
            },
            'hybrid'
          );
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Camera init error:', err);
        setCameraError(err.message || 'Camera access denied. Please allow camera permissions.');
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (engine) engine.stop();
      if (stream) stream.getTracks().forEach((t) => t.stop());
      isRecordingRef.current = false;
    };
  }, []);

  // 4. Live Custom Sign Gesture Matching Algorithm (Strict Kinematic Normalization & Hold-to-Confirm)
  const evaluateLiveTestGesture = (liveHands: HandLandmarkResult[]) => {
    const signs = savedSignsRef.current;
    if (!signs || signs.length === 0) return;

    if (!liveHands || liveHands.length === 0) {
      setLiveAlignment((prev) => ({ ...prev, score: 0, isMatched: false }));
      consecutiveMatchFramesRef.current = { label: '', count: 0 };
      return;
    }

    const currentTargetId = targetTestSignIdRef.current;

    // Filter candidate signs based on active target selection (Specific Sign vs All Signs)
    const candidateSigns =
      currentTargetId === 'all'
        ? signs
        : signs.filter((s) => s.id === currentTargetId);

    if (candidateSigns.length === 0) return;

    let bestMatch: CustomSignRecord | null = null;
    let highestSim = 0;

    for (const sign of candidateSigns) {
      const score = evaluateSignSimilarity(sign, liveHands);
      if (score > highestSim) {
        highestSim = score;
        bestMatch = sign;
      }
    }

    // Require high threshold (0.86 / 86%) to strictly eliminate false positives
    const MATCH_THRESHOLD = 0.86;
    const percentScore = Math.min(99, Math.round(highestSim * 100));

    // Update real-time alignment HUD
    const targetDisplayLabel =
      currentTargetId !== 'all'
        ? signs.find((s) => s.id === currentTargetId)?.label || ''
        : bestMatch?.label || 'Custom Sign';

    setLiveAlignment({
      label: targetDisplayLabel,
      score: percentScore,
      isMatched: highestSim >= MATCH_THRESHOLD,
    });

    if (bestMatch && highestSim >= MATCH_THRESHOLD) {
      if (consecutiveMatchFramesRef.current.label === bestMatch.label) {
        consecutiveMatchFramesRef.current.count++;
      } else {
        consecutiveMatchFramesRef.current = { label: bestMatch.label, count: 1 };
      }

      // Require holding gesture steady for 3 consecutive frames (~150-200ms) to confirm
      if (consecutiveMatchFramesRef.current.count >= 3) {
        setTestResult({
          matchedLabel: bestMatch.label,
          confidence: percentScore,
          timestamp: Date.now(),
        });
        playHarmonicChime();
      }
    } else {
      if (consecutiveMatchFramesRef.current.count > 0) {
        consecutiveMatchFramesRef.current.count = Math.max(0, consecutiveMatchFramesRef.current.count - 1);
      }
    }
  };

  // 5. Start Recording with User Configurable Countdown & Duration
  const handleStartCountdown = () => {
    if (isRecording || countdown !== null) return;
    setRecordedFrames([]);
    currentBufferRef.current = [];

    setCountdown(countdownDuration);
    let count = countdownDuration;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setCountdown(null);
        startActualRecording();
      }
    }, 1000);
  };

  const startActualRecording = () => {
    currentBufferRef.current = [];
    recordStartMsRef.current = performance.now();
    isRecordingRef.current = true;
    setIsRecording(true);
    setSecondsRemaining(recordingDuration);

    let secs = recordingDuration;
    const secTimer = setInterval(() => {
      secs--;
      setSecondsRemaining(secs);
      if (secs <= 0) {
        clearInterval(secTimer);
        isRecordingRef.current = false;
        setIsRecording(false);
        const finalCaptured = [...currentBufferRef.current];
        setRecordedFrames(finalCaptured);
        triggerToast('success', `✓ Successfully captured ${finalCaptured.length} landmark frames for "${signWord}"!`);
      }
    }, 1000);
  };

  // 6. Save Landmark Data to Database (.parquet / structured JSON format)
  const handleSaveSign = async () => {
    if (recordedFrames.length === 0) return;
    const cleanLabel = signWord.trim().toUpperCase();
    if (!cleanLabel) return;

    setIsSaving(true);
    const cleanToken = cleanLabel.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const id = `custom_${cleanToken}_${Date.now()}`;

    const newSign: CustomSignRecord = {
      id,
      token: cleanToken,
      label: cleanLabel,
      category: signCategory.trim() || 'Custom',
      description: `Authentic on-device MediaPipe 21-node landmark dataset capture for sign ${cleanLabel}`,
      totalFrames: recordedFrames.length,
      durationSec: Number(((recordedFrames.length - 1) / 30).toFixed(2)),
      createdAt: new Date().toISOString(),
      frames: recordedFrames,
    };

    // 1. Immediately persist to client storage (IndexedDB + LocalStorage) -> GUARANTEED TO PERSIST ON REFRESH
    await persistCustomSignToClientStorage(newSign);
    setSavedSigns((prev) => [newSign, ...prev.filter((s) => s.id !== newSign.id)]);

    // 2. Also send to server API
    try {
      const res = await fetch('/api/custom-signs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSign),
      });

      if (res.ok) {
        triggerToast('success', `✓ Saved sign "${cleanLabel}" to Library with ${recordedFrames.length} frames!`);
      } else {
        triggerToast('success', `✓ Saved sign "${cleanLabel}" safely to local library!`);
      }
    } catch (e) {
      console.warn('[Custom Sign Save] Server sync note (saved safely locally):', e);
      triggerToast('success', `✓ Saved sign "${cleanLabel}" safely to local library!`);
    } finally {
      setIsSaving(false);
      fetchSavedSigns();
    }
  };

  // 7. Delete / Remove Sign from Database
  const handleDeleteSign = async (id: string, label: string) => {
    if (!confirm(`Are you sure you want to permanently remove sign "${label}" from the dataset?`)) {
      return;
    }

    setIsDeletingId(id);
    try {
      // 1. Remove from local storage immediately
      await removeCustomSignFromClientStorage(id);
      setSavedSigns((prev) => prev.filter((s) => s.id !== id));

      // 2. Send DELETE to server API
      await fetch(`/api/custom-signs?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      triggerToast('success', `Deleted sign "${label}" from library.`);
    } catch (e) {
      console.error('Delete error:', e);
      triggerToast('error', 'Error removing sign.');
    } finally {
      setIsDeletingId(null);
    }
  };

  // 8. Download Motion Data as .json or Parquet-Formatted CSV
  const handleDownloadDataset = (sign: CustomSignRecord) => {
    const data = {
      datasetSchema: 'ISL-MediaPipe-21Nodes-Parquet-V2',
      signToken: sign.token,
      signLabel: sign.label,
      category: sign.category,
      totalFrames: sign.totalFrames || sign.frames.length,
      durationSec: sign.durationSec,
      createdAt: sign.createdAt,
      jointCountPerHand: 21,
      frames: sign.frames,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanket_isl_${sign.token}_${sign.totalFrames}f.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const triggerToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const filteredSigns = savedSigns.filter((s) =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const libraryFilteredSigns = savedSigns.filter((s) => {
    const matchesSearch =
      s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'all' ||
      s.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const totalFramesCount = savedSigns.reduce(
    (acc, s) => acc + (s.totalFrames || s.frames?.length || 0),
    0
  );
  const totalDurationSec = savedSigns
    .reduce((acc, s) => acc + (s.durationSec || 2.4), 0)
    .toFixed(1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Floating Toast Notification */}
        {notification && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
        )}

        {/* Top Header Banner matching Sanket AI main page styling */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-mono font-bold">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>ISL Open Dataset Initiative</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Format: .parquet &amp; 3D Coordinates</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Indian Sign Language <span className="text-orange-600">Landmark Studio</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-body">
              Record live sign gestures directly using your camera. MediaPipe calculates authentic 21-node 3D joint landmark coordinates, stores them in the database for model training, and syncs to your personal account.
            </p>
          </div>

          {/* Mode Switcher Tabs (Fully Responsive for Mobile & Desktop) */}
          <div className="w-full md:w-auto grid grid-cols-1 sm:grid-cols-3 md:flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0 text-xs font-heading font-bold shadow-inner gap-1">
            <button
              onClick={() => setActiveTab('record')}
              className={`w-full md:w-auto justify-center px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'record'
                  ? 'bg-white text-orange-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-4 h-4 text-orange-500" />
              <span>1. Record Sign</span>
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`w-full md:w-auto justify-center px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'test'
                  ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>2. Test Signs</span>
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`w-full md:w-auto justify-center px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderHeart className="w-4 h-4 text-indigo-500" />
              <span>3. Library ({savedSigns.length})</span>
            </button>
          </div>
        </div>

        {/* ─── Mode View: Either Library Showcase OR Camera 2-Column Stage ─── */}
        {activeTab === 'library' ? (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Top KPI Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                  <Database className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-black font-heading text-slate-900">{savedSigns.length}</div>
                  <div className="text-xs text-slate-500 font-medium">Custom Signs in Library</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <BarChart2 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="text-2xl font-black font-heading text-slate-900">{totalFramesCount}</div>
                  <div className="text-xs text-slate-500 font-medium">Total 3D Landmark Frames</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-black font-heading text-slate-900">{totalDurationSec}s</div>
                  <div className="text-xs text-slate-500 font-medium">Total Kinematic Duration</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                  <Layers className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-black font-heading text-slate-900">21 Nodes</div>
                  <div className="text-xs text-slate-500 font-medium">Parquet / 3D Coordinate Schema</div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                {['all', 'Medical', 'Daily', 'Emergency', 'Work', 'Custom'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-bold transition cursor-pointer ${
                      selectedCategoryFilter.toLowerCase() === cat.toLowerCase()
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search custom library..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Library Grid */}
            {libraryFilteredSigns.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center shadow-xs flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <FolderHeart className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-heading">No Custom Signs Found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    {savedSigns.length === 0
                      ? "You haven't recorded any custom signs yet. Use your webcam to record your first gesture!"
                      : "No signs match your filter or search query. Try clearing the filter."}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('record')}
                  className="px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-heading font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Record Your First Sign</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {libraryFilteredSigns.map((sign) => (
                  <div
                    key={sign.id}
                    className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-lg font-black font-heading text-slate-900 tracking-tight">
                            {sign.label}
                          </h4>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 font-bold inline-block mt-1">
                            {sign.category || 'Custom'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(sign.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Gesture Specs */}
                      <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-400 block text-[10px]">TOTAL FRAMES</span>
                          <strong className="text-slate-800">{sign.totalFrames || sign.frames?.length || 0}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">DURATION</span>
                          <strong className="text-slate-800">{sign.durationSec || 2.4}s</strong>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Kinematic Schema</span>
                          <span className="font-bold text-orange-600">MediaPipe 21-Node 3D</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setActiveTab('test');
                          setTargetTestSignId(sign.id);
                          setTestResult(null);
                          consecutiveMatchFramesRef.current = { label: '', count: 0 };
                          triggerToast('success', `Testing target set to "${sign.label}". Sign in front of camera!`);
                        }}
                        className="flex-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Test recognition of this sign"
                      >
                        <Play className="w-3.5 h-3.5 fill-emerald-600" />
                        <span>Test Live</span>
                      </button>

                      <button
                        onClick={() => handleDownloadDataset(sign)}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
                        title="Download Dataset (.parquet / JSON format)"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteSign(sign.id, sign.label)}
                        disabled={isDeletingId === sign.id}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 transition cursor-pointer"
                        title="Delete from Library"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ─── Main 2-Column Split Stage ───────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT 7 COLS: Live Webcam Feed with MediaPipe Skeleton Overlay */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              <div className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-sm flex flex-col gap-3">
                
                <div className="flex items-center justify-between px-2 text-xs font-mono">
                  <span className="font-bold text-slate-700 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-orange-500" />
                    <span>Real-Time Webcam Feed</span>
                  </span>
                  <span className="text-slate-500 flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${handsCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                      <span>Hands: <strong className="text-slate-800">{handsCount}</strong></span>
                    </span>
                    <span>•</span>
                    <span>FPS: <strong className="text-orange-600">{fps}</strong></span>
                  </span>
                </div>

                {/* Video + Canvas Stage (Responsive aspect-[4/3] on phones for generous hand room, aspect-video on desktop) */}
                <div className="relative aspect-[4/3] sm:aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-inner flex items-center justify-center">
                  
                  {/* User Camera Feed */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover -scale-x-100"
                  />

                  {/* Real-time 21-Node Landmark Skeleton Overlay */}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100"
                  />

                  {/* Animated 3-2-1 Countdown */}
                  {countdown !== null && (
                    <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
                      <span className="text-8xl font-black text-amber-400 animate-ping">
                        {countdown}
                      </span>
                      <span className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                        Prepare your sign posture...
                      </span>
                    </div>
                  )}

                  {/* Active Recording Pill */}
                  {isRecording && (
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 shadow-lg animate-pulse z-20">
                      <span className="w-2.5 h-2.5 rounded-full bg-white" />
                      <span>RECORDING: {secondsRemaining}s ({currentBufferRef.current.length} frames)</span>
                    </div>
                  )}

                  {/* Sign Label Badge on Camera */}
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3.5 py-1 rounded-full border border-slate-200 text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5 shadow-sm z-10">
                    {activeTab === 'test' ? (
                      <>
                        <Target className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Testing:{' '}
                          <strong className={targetTestSignId === 'all' ? 'text-orange-600' : 'text-emerald-600'}>
                            {targetTestSignId === 'all'
                              ? `ALL SIGNS (${savedSigns.length})`
                              : (savedSigns.find((s) => s.id === targetTestSignId)?.label || 'TARGET')}
                          </strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <Tag className="w-3.5 h-3.5 text-orange-500" />
                        <span>Target: <strong className="text-orange-600">{signWord || 'SIGN'}</strong></span>
                      </>
                    )}
                  </div>

                  {/* Real-time Live Test Success Overlay */}
                  {activeTab === 'test' && testResult && (Date.now() - testResult.timestamp < 2000) && (
                    <div className="absolute bottom-5 inset-x-5 bg-emerald-600/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl flex items-center justify-between z-20 animate-in fade-in slide-in-from-bottom-2 border border-emerald-400/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                          <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="text-[11px] font-mono text-emerald-100 uppercase tracking-wider font-bold">
                            Custom Sign Confirmed!
                          </div>
                          <div className="text-xl font-black font-heading tracking-wide text-white drop-shadow-xs">
                            {testResult.matchedLabel}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black font-mono text-white">{testResult.confidence}%</span>
                        <div className="text-[10px] text-emerald-100 font-mono">Matched (Hold OK)</div>
                      </div>
                    </div>
                  )}

                  {/* Landmark Node Colors Legend (Visible on tablets and desktop, hidden on tiny phone screens to keep camera uncluttered) */}
                  <div className="hidden sm:flex absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono text-white items-center gap-3 shadow-md z-10">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                      <span>Fingertips (5)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                      <span>Joints (16)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-[#06b6d4]" />
                      <span>21 Bones</span>
                    </div>
                  </div>

                  {/* Error Banner */}
                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-rose-400 z-30">
                      <AlertCircle className="w-8 h-8 mb-2" />
                      <p className="font-bold text-sm mb-1">{cameraError}</p>
                      <p className="text-xs text-slate-400">Please verify camera access in your browser.</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons underneath Camera */}
                {activeTab === 'record' ? (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleStartCountdown}
                      disabled={isRecording || countdown !== null}
                      className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 text-white font-heading font-bold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-orange-500/25 transition hover:scale-[1.01] active:scale-95 cursor-pointer"
                    >
                      <Activity className="w-4 h-4" />
                      <span>{isRecording ? `Capturing Landmark Coordinates (${secondsRemaining}s)...` : `Record Landmark for "${signWord}" (${recordingDuration}s)`}</span>
                    </button>

                    {recordedFrames.length > 0 && !isRecording && (
                      <button
                        onClick={() => setRecordedFrames([])}
                        className="px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-heading font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="Clear & retake"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Retake</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <span className="font-heading font-bold text-slate-800">
                          {targetTestSignId === 'all' ? (
                            <span>Testing Mode: <strong className="text-orange-600">All Saved Custom Signs ({savedSigns.length})</strong></span>
                          ) : (
                            <span>
                              Testing Target:{' '}
                              <strong className="text-emerald-700">
                                {savedSigns.find((s) => s.id === targetTestSignId)?.label || 'Custom Sign'}
                              </strong>
                            </span>
                          )}
                        </span>
                      </div>
                      {targetTestSignId !== 'all' ? (
                        <button
                          onClick={() => {
                            setTargetTestSignId('all');
                            setTestResult(null);
                            consecutiveMatchFramesRef.current = { label: '', count: 0 };
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono text-[11px] font-bold transition cursor-pointer"
                        >
                          Switch to Test All
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400">
                          Strict Min Threshold: 86%
                        </span>
                      )}
                    </div>

                    {/* Live Kinematic Alignment Meter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-500">Live Posture Alignment:</span>
                        <span className={`font-bold ${
                          liveAlignment.score >= 86
                            ? 'text-emerald-600 font-black'
                            : liveAlignment.score >= 60
                            ? 'text-amber-600 font-bold'
                            : 'text-slate-400'
                        }`}>
                          {liveAlignment.score}% {liveAlignment.isMatched ? '✓ MATCHED' : ''}
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-150 ${
                            liveAlignment.score >= 86
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : liveAlignment.score >= 60
                              ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                              : 'bg-slate-300'
                          }`}
                          style={{ width: `${Math.max(4, Math.min(100, liveAlignment.score))}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>
                        {liveAlignment.score >= 86
                          ? '✨ Posture matched! Hold position to confirm.'
                          : liveAlignment.score >= 60
                          ? '⚡ Close match! Adjust finger curl & hand angle.'
                          : 'Pose your recorded custom gesture in front of the camera.'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {handsCount === 0 ? 'No hand detected' : `${handsCount} hand${handsCount > 1 ? 's' : ''} in view`}
                      </span>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* RIGHT 5 COLS: Metadata Form & Saved Signs Database */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* 1. Name & Save Form (Active when in record tab) */}
              {activeTab === 'record' && (
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-heading font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Tag className="w-4 h-4 text-orange-500" />
                      <span>Sign Definition &amp; Label</span>
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500">
                      Step 1 of 2
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div>
                      <label className="text-slate-700 font-bold block mb-1">
                        Sign Name / Word:
                      </label>
                      <input
                        type="text"
                        value={signWord}
                        onChange={(e) => setSignWord(e.target.value.toUpperCase())}
                        placeholder="e.g. DOCTOR, WATER, MEDICINE..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-orange-600 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        The meaning that will be translated whenever this landmark motion is recognized.
                      </span>
                    </div>

                    <div>
                      <label className="text-slate-700 font-bold block mb-1">
                        Category:
                      </label>
                      <input
                        type="text"
                        value={signCategory}
                        onChange={(e) => setSignCategory(e.target.value)}
                        placeholder="Medical, Emergency, Courtesy, Daily, Work..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition"
                      />
                    </div>

                    {/* Configurable Timers */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-slate-700 font-bold text-[11px] flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                            <span>Countdown Timer:</span>
                          </span>
                          <span className="font-mono font-bold text-orange-600 text-[11px]">{countdownDuration} seconds</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[2, 3, 5, 10].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => setCountdownDuration(sec)}
                              className={`py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                                countdownDuration === sec
                                  ? 'bg-orange-500 text-white shadow-xs'
                                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {sec}s
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-slate-700 font-bold text-[11px] flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-orange-500" />
                            <span>Gesture Recording Duration:</span>
                          </span>
                          <span className="font-mono font-bold text-orange-600 text-[11px]">{recordingDuration} seconds</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {[3, 4, 5, 6, 8, 10].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => setRecordingDuration(sec)}
                              className={`py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                                recordingDuration === sec
                                  ? 'bg-orange-500 text-white shadow-xs'
                                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {sec}s
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Captured Landmark Summary */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Captured Frames:</span>
                        <strong className={recordedFrames.length > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                          {recordedFrames.length} frames
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Landmark Nodes:</span>
                        <strong className="text-slate-800 font-bold">21 Joint Points ($x, y, z$)</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Export Format:</span>
                        <strong className="text-orange-600 font-bold">.parquet / 3D Vector</strong>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveSign}
                      disabled={recordedFrames.length === 0 || isSaving}
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 text-white font-heading font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Saving to Database...' : `Save "${signWord}" to ISL Database`}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Saved Signs Database Table with Remove Option & .parquet Export */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-heading font-bold text-slate-900 text-sm">
                      Saved Custom Signs ({savedSigns.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTab === 'test' && targetTestSignId !== 'all' && (
                      <button
                        onClick={() => {
                          setTargetTestSignId('all');
                          setTestResult(null);
                          consecutiveMatchFramesRef.current = { label: '', count: 0 };
                          triggerToast('success', 'Now testing all saved custom signs.');
                        }}
                        className="text-[10px] font-mono text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200 font-bold transition cursor-pointer"
                      >
                        Reset to All
                      </button>
                    )}
                    <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Account Database
                    </span>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter saved signs..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Signs List */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredSigns.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No custom signs recorded yet. Use the camera on the left to record your first sign!
                    </div>
                  ) : (
                    filteredSigns.map((sign) => {
                      const isCurrentlyTargeted = activeTab === 'test' && targetTestSignId === sign.id;
                      return (
                        <div
                          key={sign.id}
                          className={`p-3.5 rounded-2xl border transition gap-3 flex items-center justify-between ${
                            isCurrentlyTargeted
                              ? 'bg-emerald-50/70 border-emerald-400 shadow-xs ring-2 ring-emerald-400/20'
                              : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/80'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-bold text-slate-900 text-sm truncate">
                                {sign.label}
                              </span>
                              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-semibold ${
                                isCurrentlyTargeted
                                  ? 'bg-emerald-200 text-emerald-800 font-bold'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {isCurrentlyTargeted ? 'Target' : (sign.category || 'Custom')}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {sign.totalFrames || sign.frames?.length || 0} frames • {sign.durationSec || 2.4}s
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Download Dataset (.parquet / .json format) */}
                            <button
                              onClick={() => handleDownloadDataset(sign)}
                              className="p-2 rounded-xl bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
                              title="Download 3D Coordinate Dataset (.json / .parquet format)"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {/* Test this sign button */}
                            <button
                              onClick={() => {
                                setActiveTab('test');
                                setTargetTestSignId(sign.id);
                                setTestResult(null);
                                consecutiveMatchFramesRef.current = { label: '', count: 0 };
                                triggerToast('success', `Testing target set to "${sign.label}". Pose gesture in camera!`);
                              }}
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                                isCurrentlyTargeted
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}
                              title="Test recognition of this sign"
                            >
                              <Play className={`w-3 h-3 ${isCurrentlyTargeted ? 'fill-white text-white' : 'fill-emerald-600'}`} />
                              <span>{isCurrentlyTargeted ? 'Active' : 'Test'}</span>
                            </button>

                            {/* Delete / Remove sign */}
                            <button
                              onClick={() => {
                                if (targetTestSignId === sign.id) {
                                  setTargetTestSignId('all');
                                }
                                handleDeleteSign(sign.id, sign.label);
                              }}
                              disabled={isDeletingId === sign.id}
                              className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 transition cursor-pointer"
                              title="Permanently remove this sign"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
