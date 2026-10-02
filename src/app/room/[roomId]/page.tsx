'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useMeetingTimer } from '@/hooks/useMeetingTimer';
import { VideoGrid } from '@/components/meeting/VideoGrid';
import { ControlBar } from '@/components/meeting/ControlBar';
import { ChatDrawer } from '@/components/meeting/ChatDrawer';
import { ParticipantsSidebar } from '@/components/meeting/ParticipantsSidebar';
import { SettingsModal } from '@/components/meeting/SettingsModal';
import { matchSignWord } from '@/components/meeting/AvatarModel';
import { RoleBadge } from '@/components/meeting/RoleBadge';
import { ContextEngineBar } from '@/components/meeting/ContextEngineBar';
import { ContextDrawer } from '@/components/meeting/ContextDrawer';
import { ParticipantRole, AutocompletePrediction } from '@/lib/agents/types';
import { translatorAgent, SemanticSubstitution } from '@/lib/agents/translatorAgent';
import dynamic from 'next/dynamic';
import { ParticipantState } from '@/types';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ArrowLeft, 
  Video, 
  Copy, 
  Check, 
  Users, 
  CheckCircle2, 
  Circle, 
  Send,
  Bot,
  Sparkles,
  Mic,
  MicOff,
  Zap,
  RotateCcw,
  SlidersHorizontal,
  HandMetal,
  Volume2,
  Layers
} from 'lucide-react';

// Typewriter text animation component for realistic chat bubble acting
function TypewriterText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) {
        clearInterval(timer);
      }
    }, 20); // 20ms typing speed

    return () => clearInterval(timer);
  }, [text]);

  return <span>{displayedText}</span>;
}

// Dynamically import Three.js components (no SSR)
const AvatarModel = dynamic(
  () => import('@/components/meeting/AvatarModel').then((m) => m.AvatarModel),
  { ssr: false }
);

const HologramParquetPlayer = dynamic(
  () => import('@/components/meeting/HologramParquetPlayer').then((m) => m.HologramParquetPlayer),
  { ssr: false }
);

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const roomId = (params?.roomId as string) || '';
  const initialName = searchParams?.get('name') || profile?.displayName || user?.email?.split('@')[0] || 'Participant';
  const initialAudioMuted = searchParams?.get('muted') === '1';
  const initialVideoOff = searchParams?.get('videoOff') === '1';
  const initialRole = searchParams?.get('role') === 'speaking_interviewer' ? 'speaking_interviewer' : 'deaf_signer';

  const [guestId] = useState(() => `guest-${Math.random().toString(36).substring(2, 9)}`);

  // Participant Role State
  const [userRole, setUserRole] = useState<ParticipantRole>(initialRole as ParticipantRole);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [messageText, setMessageText] = useState('');

  // Visual Display Mode: 3D Character Avatar vs Parquet Hologram
  const [visualDisplayMode, setVisualDisplayMode] = useState<'hologram_parquet' | 'avatar_3d'>('hologram_parquet');

  // Parquet Dataset Playback & ISL Grammar State
  const [hologramQueue, setHologramQueue] = useState<string[]>([]);
  const [activeHologramWord, setActiveHologramWord] = useState<string | null>('hello');
  const [omittedStopwords, setOmittedStopwords] = useState<string[]>([]);
  const [islGlossTokens, setIslGlossTokens] = useState<string[]>([]);
  const [semanticSubstitutions, setSemanticSubstitutions] = useState<SemanticSubstitution[]>([]);

  // 3D Avatar & Sign Language State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState('');
  const [bubbleText, setBubbleText] = useState('Welcome! Spoken words are converted via ISL Grammar and streamed from the 262 Dataset to the Hologram.');
  const [modelReady, setModelReady] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);
  const [currentSignWord, setCurrentSignWord] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Context Engine (Fingerspell Auto-Completion) State
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>([]);
  const [candidateLiveCaption, setCandidateLiveCaption] = useState<string>('');

  // Interviewer Speech Recognition State
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const speechRecognitionRef = useRef<any>(null);

  // Initialize WebRTC LiveKit engine
  const {
    localStream,
    remoteStreams,
    participants,
    chatMessages,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    isRoomFull,
    roomFullMessage,
    connectionStatus,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    sendMessage,
  } = useWebRTC({
    roomId,
    user: {
      uid: user?.uid || guestId,
      displayName: initialName,
      photoURL: profile?.photoURL || null,
      role: profile?.role || 'patient',
    },
    initialAudioMuted,
    initialVideoOff,
  });

  const { formattedTime } = useMeetingTimer();

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setIsCopied(true);
      setShowToast(true);
      setTimeout(() => setIsCopied(false), 3000);
      setTimeout(() => setShowToast(false), 4000);
    }).catch(() => {
      console.error("Failed to copy link");
    });
  };

  const handleLeaveMeeting = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
    router.push('/dashboard');
  };

  // ─── ElevenLabs / Speech Synthesis TTS → Avatar Speak ─────────────────────────
  const speakMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const cleanText = text.trim();
    setSpeakingText(cleanText);
    setBubbleText(cleanText);
    setIsSpeaking(true);

    try {
      const res = await fetch('/api/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      });

      if (!res.ok) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
          return;
        }
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
    } catch (err) {
      console.error('[Avatar] TTS error:', err);
      setIsSpeaking(false);
    }
  }, []);

  // Process Spoken/Typed Sentence Through ISL Grammar & Stream Dataset Parquet Moves
  const processSentenceToSign = useCallback((text: string) => {
    const translation = translatorAgent.translateSpeechToSigns(text);

    setOmittedStopwords(translation.omittedStopwords);
    setIslGlossTokens(translation.islGloss);
    setSemanticSubstitutions(translation.semanticSubstitutions || []);

    if (translation.parquetWordsToPlay.length > 0) {
      const [first, ...rest] = translation.parquetWordsToPlay;
      setActiveHologramWord(first);
      setHologramQueue(rest);
      setCurrentSignWord(first);
      const semText = translation.semanticSubstitutions?.length
        ? ` [Vector Synonyms: ${translation.semanticSubstitutions.map(s => `"${s.original}"→${s.matchedVocab.toUpperCase()}`).join(', ')}]`
        : '';
      setBubbleText(`ISL Translation: [${translation.islGloss.join(' ')}]${semText}`);
    } else {
      setBubbleText(`Interviewer: "${text}"`);
    }
  }, []);

  // Advance Hologram Queue when current word finishes
  const handleHologramWordComplete = useCallback((finishedWord: string) => {
    setHologramQueue((prev) => {
      if (prev.length === 0) {
        return [];
      }
      const [nextWord, ...remaining] = prev;
      setTimeout(() => {
        setActiveHologramWord(nextWord);
        setCurrentSignWord(nextWord);
      }, 0);
      return remaining;
    });
  }, []);

  // ─── Context Engine Auto-Completion API Call ──────────────────────────────────
  const fetchPredictions = useCallback(async (prefix: string) => {
    if (!prefix || prefix.length < 1) {
      setPredictions([]);
      return;
    }

    try {
      const res = await fetch('/api/agents/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'predict', roomId, prefix }),
      });
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
      }
    } catch (err) {
      console.error('Failed to query Context Engine:', err);
    }
  }, [roomId]);

  // Commit Autocomplete Prediction
  const handleCommitPrediction = useCallback(async (word: string) => {
    setCurrentPrefix('');
    setPredictions([]);

    const fullMessage = `I have hands-on production experience with ${word}.`;
    sendMessage(fullMessage);
    setCandidateLiveCaption(word);

    // Call orchestrator candidate_signed action
    try {
      const res = await fetch('/api/agents/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'candidate_signed',
          roomId,
          text: fullMessage,
          senderName: initialName,
          isAutoCompleted: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.verifiedSkill && !verifiedSkills.includes(data.verifiedSkill)) {
          setVerifiedSkills((prev) => [...prev, data.verifiedSkill]);
        }
      }
    } catch (err) {
      console.error('Failed to record candidate sign:', err);
    }

    // Interviewer hears candidate's answer aloud
    speakMessage(fullMessage);
  }, [roomId, initialName, sendMessage, speakMessage, verifiedSkills]);

  // ─── Web Speech Recognition (for Speaking Interviewer) ──────────────────────────
  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Web Speech Recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    if (isListeningSpeech) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setIsListeningSpeech(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListeningSpeech(true);
      };

      recognition.onresult = async (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const spokenText = lastResult[0].transcript.trim();
          if (spokenText) {
            sendMessage(spokenText);
            processSentenceToSign(spokenText);

            // Send to Multi-Agent Orchestrator
            fetch('/api/agents/orchestrator', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'interviewer_speech',
                roomId,
                text: spokenText,
                senderName: initialName,
              }),
            });
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error);
        setIsListeningSpeech(false);
      };

      recognition.onend = () => {
        setIsListeningSpeech(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition initiation error:', err);
      setIsListeningSpeech(false);
    }
  };

  // Handle outgoing chat messages
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    const text = messageText.trim();
    sendMessage(text);
    setMessageText('');

    processSentenceToSign(text);

    if (userRole === 'speaking_interviewer') {
      fetch('/api/agents/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'interviewer_speech', roomId, text, senderName: initialName }),
      });
    } else {
      speakMessage(text);
    }
  };

  // Sync Context Documents (Resume & Job Description)
  const handleSaveContext = async (resume: string, jobDescription: string) => {
    await fetch('/api/agents/orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_context', roomId, resume, jobDescription }),
    });
  };

  // Local Participant State object for VideoGrid
  const localParticipantState: ParticipantState = {
    uid: user?.uid || 'local',
    socketId: 'local',
    displayName: `${initialName} (${userRole === 'deaf_signer' ? 'Deaf Signer' : 'Interviewer'})`,
    photoURL: profile?.photoURL || null,
    role: profile?.role || 'patient',
    isMuted: isAudioMuted,
    isVideoOff,
    isScreenSharing,
    joinedAt: Date.now(),
  };

  // Handle Room Capacity Exceeded Error
  if (isRoomFull) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2 font-heading">Room Capacity Reached</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6 font-body">
          {roomFullMessage || "This consultation room has reached the maximum capacity of 4 participants."}
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 rounded-2xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen h-screen bg-slate-950 flex flex-col justify-between overflow-hidden select-none">
      
      {/* 1. Top Header Bar with Role Switcher */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-30 shadow-lg shrink-0">
        
        {/* Left: App Brand & Active Role */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-cyan-500/20 shrink-0">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-white font-extrabold text-xs sm:text-sm tracking-tight flex items-center gap-2 truncate font-heading">
              Sanket AI • Multi-Agent Meeting
            </h1>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
              Room: <span className="font-mono font-bold text-cyan-400">{roomId}</span>
            </div>
          </div>

          <div className="hidden sm:block ml-2">
            <RoleBadge role={userRole} />
          </div>
        </div>

        {/* Center: Live Role Toggle */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setUserRole('deaf_signer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              userRole === 'deaf_signer'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <HandMetal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Deaf Signer View</span>
          </button>
          <button
            onClick={() => setUserRole('speaking_interviewer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              userRole === 'speaking_interviewer'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Speaking Interviewer</span>
          </button>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Recording Timer Pill */}
          <div className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[11px] sm:text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>{formattedTime}</span>
          </div>

          {/* Context Dictionary Drawer Button */}
          <button
            onClick={() => setIsContextDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold transition"
            title="Edit Candidate Resume & Job Description Context"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">LLM Context</span>
          </button>

          {/* Share Link Button */}
          <button
            onClick={handleCopyLink}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              isCopied
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{isCopied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* Toast Notification Alert */}
      {showToast && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-emerald-500 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>Meeting invite link copied to clipboard!</span>
        </div>
      )}

      {/* 2. Main Middle Content Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-2 sm:p-3 gap-2">
        
        {/* Top Context Engine Auto-Completion Bar */}
        <ContextEngineBar
          currentPrefix={currentPrefix}
          predictions={predictions}
          onSelectPrediction={handleCommitPrediction}
          onClearPrefix={() => {
            setCurrentPrefix('');
            setPredictions([]);
          }}
          onOpenContextDrawer={() => setIsContextDrawerOpen(true)}
          isDeafSigner={userRole === 'deaf_signer'}
        />

        {/* Video Canvas & Side Panels */}
        <div className="flex-1 min-h-0 flex overflow-hidden gap-3">
          
          {/* Left Side: Video Canvas Container */}
          <main className="flex-1 relative overflow-hidden flex flex-col rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl p-2">
            
            {/* Live Visual HUD Banner */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5 shadow-lg">
                  <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
                  {userRole === 'deaf_signer'
                    ? 'Visual Mode: Neon Hologram Active'
                    : 'Listening Mode: Voice-to-ISL Active'}
                </span>

                {candidateLiveCaption && (
                  <span className="px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/60 text-xs font-bold text-white shadow-xl animate-fade-in flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    Candidate: &quot;{candidateLiveCaption}&quot;
                  </span>
                )}
              </div>

              {/* ISL Grammar Badge Display */}
              {islGlossTokens.length > 0 && (
                <div className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-cyan-200">
                  <span className="text-slate-400">ISL Gloss:</span>
                  <span className="font-bold tracking-wider">[{islGlossTokens.join(' ')}]</span>
                  {omittedStopwords.length > 0 && (
                    <span className="text-amber-400/90 ml-1">(omitted: &quot;{omittedStopwords.join(', ')}&quot;)</span>
                  )}
                </div>
              )}
            </div>

            <VideoGrid
              localStream={localStream}
              localUser={localParticipantState}
              remoteStreams={remoteStreams}
              participants={participants}
            />

            {/* Speaking Interviewer Voice Input Trigger */}
            {userRole === 'speaking_interviewer' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-950/90 border border-amber-500/40 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md">
                <button
                  onClick={toggleSpeechRecognition}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isListeningSpeech
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                  }`}
                >
                  {isListeningSpeech ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isListeningSpeech ? 'Stop Speaking (Mic Active)' : 'Start Speaking (Mic Transcribe)'}</span>
                </button>
                <span className="text-[11px] text-slate-400">
                  ISL Grammar filters filler words & plays the 262 Dataset on the Hologram.
                </span>
              </div>
            )}

            {/* Deaf Signer Live Fingerspell Simulator Quick Bar */}
            {userRole === 'deaf_signer' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-950/90 border border-cyan-500/40 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md">
                <span className="text-[11px] font-mono text-slate-400">Quick Tech Sim:</span>
                {[
                  { label: 'K-U-B', word: 'Kubernetes' },
                  { label: 'R-E-D', word: 'Redis' },
                  { label: 'D-O-C', word: 'Docker' },
                  { label: 'P-Y-T', word: 'Python' },
                  { label: 'N-E-X', word: 'Next.js' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setCurrentPrefix(item.label.replace(/-/g, ''));
                      fetchPredictions(item.label.replace(/-/g, ''));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950 text-cyan-300 hover:text-white border border-slate-700 text-xs font-mono font-bold transition"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </main>

          {/* Right Sidebar: Dual Sign Player (Hologram Parquet vs 3D Avatar) */}
          <aside className="hidden lg:flex flex-col w-88 shrink-0 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
            
            {/* Header with Visual Mode Tabs */}
            <div className="p-2.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setVisualDisplayMode('hologram_parquet')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                    visualDisplayMode === 'hologram_parquet'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ISL Hologram</span>
                </button>
                <button
                  onClick={() => setVisualDisplayMode('avatar_3d')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                    visualDisplayMode === 'avatar_3d'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>3D Avatar</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-cyan-300 font-mono font-bold bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  262 Dataset
                </span>
                <button
                  onClick={() => {
                    setModelReady(false);
                    setCurrentSignWord(null);
                    setAvatarKey((k) => k + 1);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Reload"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Visual Canvas Area */}
            <div className="flex-1 min-h-0 relative bg-slate-950">
              {visualDisplayMode === 'hologram_parquet' ? (
                <HologramParquetPlayer
                  wordsQueue={hologramQueue}
                  activeWord={activeHologramWord}
                  onWordComplete={handleHologramWordComplete}
                  omittedWords={omittedStopwords}
                  semanticSubstitutions={semanticSubstitutions}
                  className="w-full h-full border-none rounded-none"
                />
              ) : (
                <AvatarModel
                  key={avatarKey}
                  isSpeaking={isSpeaking}
                  signWord={currentSignWord}
                  onSignComplete={() => setCurrentSignWord(null)}
                  onLoaded={() => setModelReady(true)}
                  className="w-full h-full"
                />
              )}
            </div>

            {/* Quick 262 ISL Signs Row with Vector Synonyms */}
            <div className="px-2.5 py-2 bg-slate-900 border-t border-slate-800 shrink-0">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Quick ISL Dataset Phrases & Vector Matches</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { label: '👋 What is your name?', text: 'what is your name' },
                  { label: '🌅 Good morning you happy', text: 'good morning you are happy' },
                  { label: '🩺 Physician (Vector→Doctor)', text: 'the physician is in the hospital' },
                  { label: '🚗 Automobile (Vector→Car)', text: 'he drives an automobile' },
                  { label: '😊 Cheerful (Vector→Happy)', text: 'a cheerful child is clean' },
                  { label: '💻 Laptop (Vector→Computer)', text: 'expensive laptop' },
                  { label: '🤝 How are you?', text: 'how are you' },
                ].map(({ label, text }) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => {
                      processSentenceToSign(text);
                      speakMessage(text);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition border bg-slate-800 hover:bg-cyan-950 text-cyan-300 hover:text-white border-slate-700"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Speech / Sign Translation Bubble */}
            <div className="shrink-0 px-3 py-2 bg-slate-950 border-t border-slate-800">
              <div className="relative bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-xl shadow-lg text-xs font-medium leading-relaxed">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-slate-800" />
                <TypewriterText text={bubbleText} />
              </div>
            </div>

            {/* Verified Skills Pill Bar */}
            {verifiedSkills.length > 0 && (
              <div className="px-3 py-1.5 bg-cyan-950/40 border-t border-cyan-500/20 flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[10px] font-bold text-cyan-400">Verified:</span>
                {verifiedSkills.map((sk) => (
                  <span key={sk} className="text-[10px] bg-cyan-900/60 text-cyan-200 border border-cyan-500/40 px-2 py-0.2 rounded-full font-mono">
                    ✓ {sk}
                  </span>
                ))}
              </div>
            )}

            {/* In-Meeting Chat Input */}
            <form onSubmit={handleSendMessage} className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder={userRole === 'deaf_signer' ? 'Type or fingerspell...' : 'Speak or type: "what is your name"...'}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 transition shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

          </aside>

        </div>

      </div>

      {/* 3. Dedicated Bottom Dock Bar Section */}
      <div className="h-20 shrink-0 pb-3 pt-1 px-4 flex items-center justify-center z-40">
        <ControlBar
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          isChatOpen={isChatOpen}
          isParticipantsOpen={isParticipantsOpen}
          participantCount={participants.size + 1}
          formattedTime={formattedTime}
          isCopied={isCopied}
          onCopyLink={handleCopyLink}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          onToggleParticipants={() => setIsParticipantsOpen(!isParticipantsOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLeaveMeeting={handleLeaveMeeting}
        />
      </div>

      {/* Context Drawer for Candidate Resume & Job Description */}
      <ContextDrawer
        isOpen={isContextDrawerOpen}
        onClose={() => setIsContextDrawerOpen(false)}
        onSaveContext={handleSaveContext}
      />

      {/* Mobile Drawer Slide-outs */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        chatMessages={chatMessages}
        onSendMessage={sendMessage}
      />

      <ParticipantsSidebar
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        localUser={localParticipantState}
        participants={participants}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
