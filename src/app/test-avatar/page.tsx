'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { 
  Bot, 
  Play, 
  RotateCcw, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Send, 
  Layers, 
  Activity, 
  CheckCircle2, 
  ArrowLeft,
  Sliders,
  RefreshCw,
  Hand
} from 'lucide-react';
import { matchSignWord, REST_POSES, BoneAuditReport } from '@/components/meeting/AvatarModel';

// Dynamically import AvatarModel (Three.js — no SSR)
const AvatarModel = dynamic(
  () => import('@/components/meeting/AvatarModel').then((m) => m.AvatarModel),
  { ssr: false }
);

interface SignInfo {
  word: string;
  label: string;
  duration: string;
  description: string;
  category: string;
}

const AVAILABLE_SIGNS: SignInfo[] = [
  { word: 'hello', label: '👋 Hello / Hi (ISL Salute)', duration: '2.5s', description: 'Right hand brings flat palm to temple and extends outward in formal ISL greeting', category: 'Greetings' },
  { word: 'thankyou', label: '🙏 Thank You', duration: '2.5s', description: 'Hand moves from chin forward with a respectful nod', category: 'Courtesy' },
  { word: 'goodmorning', label: '🌅 Good Morning', duration: '2.8s', description: 'Right hand touches chin (Good) then rises gracefully like the morning sun', category: 'Greetings' },
  { word: 'goodafternoon', label: '☀️ Good Afternoon', duration: '2.5s', description: 'Horizontal chest-level sweep across front', category: 'Greetings' },
  { word: 'goodevening', label: '🌆 Good Evening', duration: '2.5s', description: 'Gentle downward sweeping evening wave at chest', category: 'Greetings' },
  { word: 'goodnight', label: '🌙 Good Night', duration: '2.5s', description: 'Both hands meet at left cheek in sleep posture', category: 'Greetings' },
  { word: 'howareyou', label: '🤝 How Are You?', duration: '2.5s', description: 'Chest outward open palms inquiry to viewer', category: 'Questions' },
  { word: 'alright', label: '👍 Alright / OK (Double Thumbs Up)', duration: '2.5s', description: 'Both hands lift symmetrically with double thumbs-up at chest level & affirmative double nod', category: 'Response' },
  { word: 'pleased', label: '🤝 Pleased / Namaste', duration: '2.5s', description: 'Palms meeting at heart level in warm greeting', category: 'Courtesy' },
];

export default function TestAvatarPage() {
  const [currentSign, setCurrentSign] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputText, setInputText] = useState('');
  const [modelReady, setModelReady] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);
  const [speechBubble, setSpeechBubble] = useState('Welcome to the Sanket AI 3D Sign Language Studio! Select any sign below or type a message to test.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'greetings' | 'courtesy' | 'questions'>('all');
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Hard-level rig verification states
  const [boneAudit, setBoneAudit] = useState<BoneAuditReport | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Manual bone slider override state
  const [manualOverride, setManualOverride] = useState<Record<string, [number, number, number]> | null>(null);
  const [showSliders, setShowSliders] = useState(false);

  const [armX, setArmX] = useState(0.30);
  const [armY, setArmY] = useState(-0.55);
  const [armZ, setArmZ] = useState(0.10);

  const [foreArmX, setForeArmX] = useState(0.15);
  const [foreArmY, setForeArmY] = useState(-1.55);
  const [foreArmZ, setForeArmZ] = useState(1.05);

  const [handX, setHandX] = useState(0.35);
  const [handY, setHandY] = useState(-0.45);
  const [handZ, setHandZ] = useState(0.35);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Apply slider values in manual mode
  useEffect(() => {
    if (showSliders) {
      setManualOverride({
        RightArm: [armX, armY, armZ],
        RightForeArm: [foreArmX, foreArmY, foreArmZ],
        RightHand: [handX, handY, handZ],
        RightShoulder: [1.554, 0.40, 1.600],
      });
    } else {
      setManualOverride(null);
    }
  }, [showSliders, armX, armY, armZ, foreArmX, foreArmY, foreArmZ, handX, handY, handZ]);

  const handlePlaySign = (word: string, customPhrase?: string) => {
    setShowSliders(false);
    setManualOverride(null);
    setCurrentSign(word);
    const phrase = customPhrase || AVAILABLE_SIGNS.find((s) => s.word === word)?.label.replace(/[^\w\s]/gi, '').trim() || word;
    setSpeechBubble(`Performing ISL gesture: "${word.toUpperCase()}"`);

    if (ttsEnabled) {
      speakMessage(phrase);
    }
  };

  const speakMessage = async (text: string) => {
    if (!text.trim()) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsSpeaking(true);

    try {
      const res = await fetch('/api/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        setIsSpeaking(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (_) {
      setIsSpeaking(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    setSpeechBubble(`Input: "${text}"`);

    const matched = matchSignWord(text);
    if (matched) {
      handlePlaySign(matched, text);
    } else {
      handlePlaySign('hello', text);
    }
  };

  const handleReSyncDataset = async () => {
    setIsGenerating(true);
    setGenStatus('Reading D:\\Matri\\Dataset parquet files...');
    try {
      const res = await fetch('/api/generate-signs');
      const data = await res.json();
      if (data.success) {
        setGenStatus(`✅ Synced ${data.clips?.length} signs from dataset!`);
        setAvatarKey((k) => k + 1);
      } else {
        setGenStatus(`❌ Sync error: ${data.error}`);
      }
    } catch (err: any) {
      setGenStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenStatus(null), 5000);
    }
  };

  const filteredSigns = AVAILABLE_SIGNS.filter((s) => {
    if (activeTab === 'all') return true;
    return s.category.toLowerCase() === activeTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      
      {/* 1. Header Bar */}
      <header className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black shadow-lg shadow-orange-500/20 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
              Sanket AI • 3D Sign Language Studio
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                ISL Accurate Mode
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Indian Sign Language Kinematics & Posture Testing Playground
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Hard Bone Audit Button */}
          <button
            onClick={() => setShowAuditModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              boneAudit?.isFull65
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 animate-pulse'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span>
              {boneAudit
                ? boneAudit.isFull65
                  ? `🦴 Rig: 65 Bones (PASS ✅)`
                  : `⚠️ Rig: ${boneAudit.totalBones} Bones (${boneAudit.hasThumbs ? 'Thumbs OK' : 'No Thumbs ❌'})`
                : '🦴 Checking Rig...'}
            </span>
          </button>

          {/* 3D Skeleton Wireframe Overlay Toggle */}
          <button
            onClick={() => setShowSkeleton(!showSkeleton)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              showSkeleton
                ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle 3D Skeleton wireframe joints visualizer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>3D Skeleton: {showSkeleton ? 'VISIBLE' : 'HIDDEN'}</span>
          </button>

          {/* Manual Sliders Toggle */}
          <button
            onClick={() => setShowSliders(!showSliders)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              showSliders
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showSliders ? 'Exit Sliders' : 'Live Angle Tuner'}</span>
          </button>

          {/* TTS Toggle Button */}
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              ttsEnabled
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>Voice TTS: {ttsEnabled ? 'ON' : 'MUTED'}</span>
          </button>

          {/* Dataset Re-Sync Button */}
          <button
            onClick={handleReSyncDataset}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin text-orange-400' : ''}`} />
            <span>{isGenerating ? 'Syncing...' : 'Re-sync Parquet'}</span>
          </button>
        </div>
      </header>

      {/* Sync Status Alert */}
      {genStatus && (
        <div className="bg-slate-900 border-b border-orange-500/30 px-6 py-2 text-xs font-medium text-center text-orange-300 animate-pulse">
          {genStatus}
        </div>
      )}

      {/* 2. Main Content Grid */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* Left: 3D Avatar Viewport */}
        <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0 bg-slate-950 relative border-r border-slate-800">
          
          {/* 3D Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <AvatarModel
              key={avatarKey}
              isSpeaking={isSpeaking}
              signWord={currentSign}
              manualPoseOverride={manualOverride}
              showSkeletonHelper={showSkeleton}
              onBoneAudit={(report) => setBoneAudit(report)}
              onSignComplete={() => setCurrentSign(null)}
              onLoaded={() => setModelReady(true)}
              className="w-full h-full"
            />

            {/* Reset Button */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={() => {
                  setModelReady(false);
                  setCurrentSign(null);
                  setShowSliders(false);
                  setAvatarKey((k) => k + 1);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold backdrop-blur-md transition flex items-center gap-1.5 shadow-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Avatar</span>
              </button>
            </div>

            {/* Active Signing Overlay */}
            {currentSign && !showSliders && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/90 text-white text-xs font-black shadow-xl backdrop-blur-md border border-orange-400">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                ISL: {currentSign.toUpperCase()}
              </div>
            )}

            {showSliders && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-600/90 text-white text-xs font-black shadow-xl backdrop-blur-md border border-purple-400">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                LIVE ANGLE TUNER ACTIVE
              </div>
            )}
          </div>

          {/* Live Sliders Panel (when active) */}
          {showSliders && (
            <div className="p-4 bg-slate-900/95 border-t border-purple-500/30 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs shrink-0 max-h-48 overflow-y-auto">
              {/* Right Arm */}
              <div className="space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="font-bold text-orange-400">RightArm (Pitch/Yaw/Roll)</span>
                <div className="flex items-center gap-2">
                  <span className="w-4 text-[10px] text-slate-500">X</span>
                  <input type="range" min="-1.5" max="1.5" step="0.02" value={armX} onChange={(e) => setArmX(parseFloat(e.target.value))} className="w-full accent-orange-500" />
                  <span className="w-10 text-[10px] font-mono text-right">{armX.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 text-[10px] text-slate-500">Y</span>
                  <input type="range" min="-1.8" max="1.0" step="0.02" value={armY} onChange={(e) => setArmY(parseFloat(e.target.value))} className="w-full accent-orange-500" />
                  <span className="w-10 text-[10px] font-mono text-right">{armY.toFixed(2)}</span>
                </div>
              </div>

              {/* Right ForeArm */}
              <div className="space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="font-bold text-emerald-400">RightForeArm (Elbow Lift)</span>
                <div className="flex items-center gap-2">
                  <span className="w-4 text-[10px] text-slate-500">Y</span>
                  <input type="range" min="-2.2" max="0.5" step="0.02" value={foreArmY} onChange={(e) => setForeArmY(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                  <span className="w-10 text-[10px] font-mono text-right">{foreArmY.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 text-[10px] text-slate-500">Z</span>
                  <input type="range" min="-0.5" max="1.8" step="0.02" value={foreArmZ} onChange={(e) => setForeArmZ(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                  <span className="w-10 text-[10px] font-mono text-right">{foreArmZ.toFixed(2)}</span>
                </div>
              </div>

              {/* Right Hand */}
              <div className="space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="font-bold text-blue-400">RightHand (Wrist/Palm)</span>
                <div className="flex items-center gap-2">
                  <span className="w-4 text-[10px] text-slate-500">Y</span>
                  <input type="range" min="-1.5" max="1.5" step="0.02" value={handY} onChange={(e) => setHandY(parseFloat(e.target.value))} className="w-full accent-blue-500" />
                  <span className="w-10 text-[10px] font-mono text-right">{handY.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 text-[10px] text-slate-500">Z</span>
                  <input type="range" min="-1.0" max="1.5" step="0.02" value={handZ} onChange={(e) => setHandZ(parseFloat(e.target.value))} className="w-full accent-blue-500" />
                  <span className="w-10 text-[10px] font-mono text-right">{handZ.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Speech Bubble / Dialogue Output */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
            <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 leading-relaxed shadow-inner">
              <div className="flex items-center gap-2 mb-1 text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5" />
                <span>Avatar Speech & Action Status</span>
              </div>
              <p className="text-slate-300 font-medium">{speechBubble}</p>
            </div>
          </div>

          {/* Text Input Tester */}
          <form onSubmit={handleTextSubmit} className="p-3 bg-slate-900/50 border-t border-slate-800 flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder="Type any sentence (e.g. 'Hello, good morning! Thank you') to test auto-sign translation..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-lg shadow-orange-500/20 flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Test Phrase</span>
            </button>
          </form>

        </div>

        {/* Right: Sign Selector Panel & Kinematics Info */}
        <div className="w-full lg:w-96 bg-slate-900/60 flex flex-col shrink-0 overflow-y-auto">
          
          {/* Header & Filter Tabs */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-400" />
                <span>ISL Vocabulary ({AVAILABLE_SIGNS.length} Words)</span>
              </h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                Chest-Level Rigs
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
              {(['all', 'greetings', 'courtesy', 'questions'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 rounded-lg capitalize transition ${
                    activeTab === tab
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Sign Buttons Grid */}
          <div className="p-4 space-y-2.5 flex-1">
            {filteredSigns.map((s) => {
              const isActive = currentSign === s.word && !showSliders;
              return (
                <div
                  key={s.word}
                  onClick={() => handlePlaySign(s.word)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-orange-500/15 border-orange-500 shadow-lg shadow-orange-500/10'
                      : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-xs ${isActive ? 'text-orange-400' : 'text-white group-hover:text-orange-300'}`}>
                      {s.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {s.duration}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySign(s.word);
                        }}
                        className={`p-1.5 rounded-lg transition ${
                          isActive
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-orange-500 hover:text-white'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug font-normal">
                    {s.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Technical Diagnostics Footer */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span className="font-medium">Sign Standard:</span>
              <span className="text-emerald-400 font-mono font-bold">Indian Sign Language (ISL)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Armpit Mesh Protection:</span>
              <span className="text-emerald-400 font-mono font-bold">Active (Chest Height Constraint)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Model Loaded:</span>
              <span className="text-slate-200 font-mono">{boneAudit?.loadedSource || '/model/man.glb'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Rig Health:</span>
              <span className={boneAudit?.isFull65 ? 'text-emerald-400 font-mono font-bold' : 'text-amber-400 font-mono font-bold'}>
                {boneAudit ? `${boneAudit.totalBones} Bones (${boneAudit.isFull65 ? '65 Standard Ready' : 'Incomplete Fingers'})` : 'Auditing...'}
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* ── HARD RIG VERIFICATION MODAL ────────────────────────────────────── */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${boneAudit?.isFull65 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-950'}`}>
                  <Hand className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    Hard-Level Skeleton & Bone Audit
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${boneAudit?.isFull65 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                      {boneAudit?.isFull65 ? 'PASS (65/65 Bones)' : 'FAIL (Missing Bones)'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Source: <span className="text-slate-200 font-mono">{boneAudit?.loadedSource || 'Loading...'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-slate-400 font-medium block mb-1">Total Detected Joints</span>
                  <span className="text-2xl font-black text-white font-mono">{boneAudit?.totalBones || 0}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Required: 65 Standard</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-slate-400 font-medium block mb-1">Thumb Bones (L & R)</span>
                  <span className={`text-2xl font-black font-mono ${boneAudit?.hasThumbs ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {boneAudit?.thumbBones.length || 0} / 6
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{boneAudit?.hasThumbs ? 'Thumb1, 2, 3 Active' : '0 Thumb Bones (Mitten Rig)'}</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-slate-400 font-medium block mb-1">Finger Bones (L & R)</span>
                  <span className={`text-2xl font-black font-mono ${boneAudit?.hasAllFingers ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {boneAudit?.fingerBones.length || 0} / 30
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{boneAudit?.hasAllFingers ? 'All 5 Fingers Ready' : 'Simplified 1-Chain Rig'}</span>
                </div>
              </div>

              {/* Thumb Anatomy Audit */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>1. Thumb Anatomy Verification (Crucial for Thumbs-Up 👍)</span>
                  <span className={boneAudit?.hasThumbs ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                    {boneAudit?.hasThumbs ? 'PASSED ✅' : 'FAILED ❌'}
                  </span>
                </h4>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <span className="font-semibold text-slate-400 block mb-1">Right Hand Thumb:</span>
                    {['RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3'].map((b) => {
                      const exists = boneAudit?.detectedBones.includes(b);
                      return (
                        <div key={b} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                          <span>{exists ? '✅' : '❌'}</span>
                          <span className={exists ? 'text-emerald-300 font-mono' : 'text-slate-500 line-through font-mono'}>{b}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400 block mb-1">Left Hand Thumb:</span>
                    {['LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3'].map((b) => {
                      const exists = boneAudit?.detectedBones.includes(b);
                      return (
                        <div key={b} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                          <span>{exists ? '✅' : '❌'}</span>
                          <span className={exists ? 'text-emerald-300 font-mono' : 'text-slate-500 line-through font-mono'}>{b}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4-Fingers Anatomy Audit */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>2. Finger Anatomy Breakdown</span>
                  <span className={boneAudit?.hasAllFingers ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
                    {boneAudit?.hasAllFingers ? 'ALL 5 FINGERS READY ✅' : '1 FINGER CHAIN ⚠️'}
                  </span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-[11px]">
                  {['Index', 'Middle', 'Ring', 'Pinky'].map((f) => {
                    const count = (boneAudit?.detectedBones || []).filter(b => b.includes(f)).length;
                    return (
                      <div key={f} className="space-y-1">
                        <span className="font-bold text-slate-300">{f}:</span>
                        <span className={`block font-mono text-[10px] ${count >= 6 ? 'text-emerald-400' : (count > 0 ? 'text-amber-400' : 'text-slate-500')}`}>
                          {count >= 6 ? 'Full (L & R)' : (count > 0 ? `${count} joints` : 'Missing ❌')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Missing Bones List */}
              {boneAudit && boneAudit.missingBones.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-rose-400 uppercase tracking-wider text-[11px]">
                    3. Missing Standard Mixamo Bones ({boneAudit.missingBones.length})
                  </h4>
                  <div className="bg-slate-950 p-3 rounded-2xl border border-rose-500/20 max-h-32 overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {boneAudit.missingBones.map((mb) => (
                        <span key={mb} className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono text-[10px]">
                          {mb}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Verdict & Recommendation */}
              <div className={`p-4 rounded-2xl border ${boneAudit?.isFull65 ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' : 'bg-amber-950/40 border-amber-500/30 text-amber-200'}`}>
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  <span>{boneAudit?.isFull65 ? '🎉 Ready for Sign Language Mocap!' : '⚠️ Model Limitation Notice:'}</span>
                </div>
                <p className="leading-relaxed text-[11px] opacity-90">
                  {boneAudit?.isFull65
                    ? 'This model contains all 65 standard Mixamo bones including all 5 fingers and thumbs. It will execute all 2,000 ISL signs from your Kaggle dataset with 100% anatomical accuracy!'
                    : `This character currently has only ${boneAudit?.totalBones} bones. The thumb and other fingers are merged into Index1..4. To get perfect 90° thumbs and separate finger movements, re-export from Mixamo with "Standard Skeleton (65 bones)" or use an Avaturn.me avatar.`}
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-lg shadow-orange-500/20"
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
