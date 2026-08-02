'use client';

import React, { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useMeetingTimer } from '@/hooks/useMeetingTimer';
import { VideoGrid } from '@/components/meeting/VideoGrid';
import { ControlBar } from '@/components/meeting/ControlBar';
import { ChatDrawer } from '@/components/meeting/ChatDrawer';
import { ParticipantsSidebar } from '@/components/meeting/ParticipantsSidebar';
import { SettingsModal } from '@/components/meeting/SettingsModal';
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
  Send
} from 'lucide-react';

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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    sendMessage(messageText);
    setMessageText('');
  };

  const toggleAgendaDone = (id: number) => {
    setAgendaItems(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
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

      {/* 2. Main Middle Content Area (flex-1 min-h-0: Fills exact middle space above bottom bar) */}
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
          
          {/* Top Section: Things to Discuss Agenda */}
          <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm font-heading">Things to Discuss</h3>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">Agenda</span>
            </div>

            <div className="space-y-2.5">
              {agendaItems.map(item => (
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

          {/* Bottom Section: Real-Time Chat Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider font-heading">In-Meeting Chat</h4>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">Livekit Data</span>
            </div>

            {/* Chat Messages Container */}
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

            {/* Form Chat Input */}
            <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder="Type a message to all..."
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

      {/* 3. Dedicated Bottom Dock Bar Section (h-20 shrink-0: Centered below Video Canvas with ZERO Overlap) */}
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
