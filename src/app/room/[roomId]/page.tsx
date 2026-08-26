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
  Sparkles
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

// Dynamically import AvatarModel (Three.js — no SSR)
const AvatarModel = dynamic(
  () => import('@/components/meeting/AvatarModel').then((m) => m.AvatarModel),
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
  const [guestId] = useState(() => `guest-${Math.random().toString(36).substring(2, 9)}`);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [messageText, setMessageText] = useState('');

  // 3D Avatar & Sign Language State
  const [avatarEnabled, setAvatarEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState('');
  const [bubbleText, setBubbleText] = useState('Hey there! 👋 I am your AI meeting interpreter. Type any greeting or use the quick buttons to trigger 3D sign language!');
  const [modelReady, setModelReady] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);
  const [currentSignWord, setCurrentSignWord] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Agenda checklist items
  const [agendaItems, setAgendaItems] = useState([
    { id: 1, text: 'Candidate introduction & background', done: true },
    { id: 2, text: 'Review ISL sign language responses', done: true },
    { id: 3, text: 'Discuss technical skills & experience', done: false },
    { id: 4, text: 'Live Q&A with real-time speech captions', done: false },
  ]);

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

  // Auto-trigger background generation of signs if needed on mount
  useEffect(() => {
    fetch('/api/generate-signs')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          console.log('[Sanket AI] Loaded sign clips:', data.clips?.length);
        }
      })
      .catch((e) => console.log('[Sanket AI] Sign generator check:', e));
  }, []);

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/consultation/join/${roomId}`;
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
    router.push('/dashboard');
  };

  // ─── ElevenLabs TTS → Avatar Speak ──────────────────────────────────────────
  const speakMessage = useCallback(async (text: string) => {
    if (!avatarEnabled || !text.trim()) return;

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
        console.error('[Avatar] ElevenLabs API error:', res.status);
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
  }, [avatarEnabled]);

  // Handle outgoing chat messages and trigger matching sign language animation
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    const text = messageText.trim();
    sendMessage(text);
    setMessageText('');

    // Trigger sign language if message matches
    const matchedSign = matchSignWord(text);
    if (matchedSign) {
      setCurrentSignWord(matchedSign);
      setBubbleText(`Signing: ${matchedSign.toUpperCase()}`);
    }

    // Trigger avatar speech if avatar is enabled
    speakMessage(text);
  };

  // Listen to incoming remote messages & auto-trigger 3D sign translation
  useEffect(() => {
    if (!avatarEnabled || chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (!lastMsg.isSelf) {
      const matched = matchSignWord(lastMsg.text);
      if (matched) {
        setCurrentSignWord(matched);
        setBubbleText(`[Remote Speaker]: "${lastMsg.text}"`);
      }
    }
  }, [chatMessages, avatarEnabled]);

  const toggleAgendaDone = (id: number) => {
    setAgendaItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  // Local Participant State object for VideoGrid
  const localParticipantState: ParticipantState = {
    uid: user?.uid || 'local',
    socketId: 'local',
    displayName: initialName,
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
    <div className="relative min-h-screen h-screen bg-slate-50 bg-grid-lines flex flex-col justify-between overflow-hidden select-none">
      
      {/* 1. Top Header Bar (Fixed Height 16) */}
      <header className="h-16 px-4 sm:px-6 bg-white/90 backdrop-blur-md border-b border-slate-200/90 flex items-center justify-between z-30 shadow-xs shrink-0">
        
        {/* Left Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-slate-900 font-extrabold text-xs sm:text-sm tracking-tight flex items-center gap-2 truncate font-heading">
              Sanket AI • Video Call
            </h1>
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
              Room: <span className="font-mono font-bold text-slate-800">{roomId}</span>
            </div>
          </div>
        </div>

        {/* Center & Right Status Pills */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Recording Timer Pill */}
          <div className="px-3 py-1.5 rounded-full bg-slate-900 text-white font-mono text-[11px] sm:text-xs font-bold flex items-center gap-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>{formattedTime}</span>
          </div>

          {/* Participant Count Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>{participants.size + 1} Participants</span>
          </div>

          {/* Share Link Button */}
          <button
            onClick={handleCopyLink}
            className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 border ${
              isCopied
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
            }`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span className="hidden sm:inline">{isCopied ? 'Copied!' : 'Share Link'}</span>
          </button>
        </div>
      </header>

      {/* Toast Notification Alert */}
      {showToast && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-emerald-500 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>Meeting invite link copied to clipboard! Share with participants to join.</span>
        </div>
      )}

      {/* 2. Main Middle Content Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden p-2 sm:p-4 gap-3">
        
        {/* Left Side: Video Canvas Container */}
        <main className="flex-1 relative overflow-hidden flex flex-col rounded-3xl border border-slate-200/80 bg-white/70 backdrop-blur-md shadow-xs p-2">
          <VideoGrid
            localStream={localStream}
            localUser={localParticipantState}
            remoteStreams={remoteStreams}
            participants={participants}
          />
        </main>

        {/* Right Sidebar: Agenda Checklist & Real-Time Chat (Desktop) */}
        <aside className="hidden lg:flex flex-col w-80 shrink-0 bg-white/90 border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden backdrop-blur-md">
          
          {/* Top Section: Things to Discuss Agenda (Hidden when Avatar is enabled) */}
          {!avatarEnabled && (
            <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm font-heading">Things to Discuss</h3>
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">Agenda</span>
              </div>

              <div className="space-y-2.5">
                {agendaItems.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => toggleAgendaDone(item.id)}
                    className="flex items-start gap-2.5 text-xs cursor-pointer group"
                  >
                    {item.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <span className={`leading-tight ${item.done ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Section: Real-Time Chat Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">

            {/* Chat header with Avatar toggle */}
            <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider font-heading flex items-center gap-1.5">
                <span>In-Meeting Chat</span>
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">Livekit Data</span>
                {/* 3D Avatar Toggle */}
                <button
                  onClick={() => {
                    setAvatarEnabled((v) => !v);
                    if (avatarEnabled) {
                      if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current = null;
                      }
                      setIsSpeaking(false);
                      setModelReady(false);
                      setCurrentSignWord(null);
                    }
                  }}
                  title={avatarEnabled ? 'Disable 3D Avatar' : 'Enable 3D Avatar'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                    avatarEnabled
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/30'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-orange-400 hover:text-orange-500'
                  }`}
                >
                  <Bot className="w-3 h-3" />
                  {avatarEnabled ? 'Avatar ON' : '3D Avatar'}
                </button>
              </div>
            </div>

            {/* 3D Avatar Mode — full remaining height split into canvas + quick signs + bubble */}
            {avatarEnabled ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                {/* 3D Canvas — takes all available space */}
                <div className="flex-1 min-h-0 relative bg-slate-950">
                  <AvatarModel
                    key={avatarKey}
                    isSpeaking={isSpeaking}
                    signWord={currentSignWord}
                    onSignComplete={() => setCurrentSignWord(null)}
                    onLoaded={() => setModelReady(true)}
                    className="w-full h-full"
                  />

                  {/* Reset / Reload Button */}
                  <button
                    onClick={() => {
                      setModelReady(false);
                      setCurrentSignWord(null);
                      setAvatarKey((k) => k + 1);
                    }}
                    title="Reload 3D Avatar"
                    className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold backdrop-blur-sm transition"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Reload
                  </button>

                  {/* Speaking glow ring */}
                  {isSpeaking && (
                    <div className="absolute inset-0 pointer-events-none border-2 border-orange-400/30 animate-pulse" />
                  )}
                </div>

                {/* Quick Interactive Sign Buttons for Live Presentation Demo */}
                <div className="px-2 py-2 bg-slate-900/90 border-t border-slate-800 shrink-0">
                  <div className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1 px-1">
                    <Sparkles className="w-3 h-3 text-orange-400" />
                    <span>Live ISL Signs (Presentation Demo)</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {[
                      { label: '👋 Hello', word: 'hello' },
                      { label: '🙏 Thank You', word: 'thankyou' },
                      { label: '🌅 Morning', word: 'goodmorning' },
                      { label: '🤝 How Are You?', word: 'howareyou' },
                      { label: '✅ Alright', word: 'alright' },
                      { label: '🌙 Good Night', word: 'goodnight' },
                    ].map(({ label, word }) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => {
                          setCurrentSignWord(word);
                          setBubbleText(`Performing ISL Gesture: "${word.toUpperCase()}"`);
                          speakMessage(label.replace(/[^\w\s]/gi, '').trim());
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition border ${
                          currentSignWord === word
                            ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/30 animate-pulse'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speech Bubble — sits BELOW the quick sign bar, above the input bar */}
                {modelReady && (
                  <div className="shrink-0 px-3 py-2 bg-slate-950 border-t border-slate-800">
                    <div className="relative bg-white text-slate-800 px-3 py-2.5 rounded-xl shadow-lg border border-slate-100 text-xs font-medium leading-relaxed">
                      {/* Tail pointing UP toward model */}
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[8px] border-b-white" />
                      <TypewriterText text={bubbleText} />
                    </div>
                  </div>
                )}

              </div>
            ) : (
              /* Chat Messages Container — shown only when Avatar is toggled OFF */
              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-2xl shadow-2xs max-w-[90%] ${
                      msg.isSelf
                        ? 'bg-slate-900 text-white ml-auto'
                        : 'bg-white border border-slate-200/80 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`font-bold ${msg.isSelf ? 'text-orange-400' : 'text-slate-900'}`}>
                        {msg.sender}
                      </span>
                      <span className={`text-[10px] ${msg.isSelf ? 'text-slate-400' : 'text-slate-400'}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="leading-relaxed font-body break-words">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Form Chat Input */}
            <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder={avatarEnabled ? '💬 Type "hello", "thank you", or any message...' : 'Type a message to all...'}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 font-body"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

          </div>

        </aside>

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
