'use client';

import React from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  MessageSquare, 
  Users, 
  PhoneOff,
  Copy,
  Check,
  ChevronUp,
  Smile,
  Hand,
  Sparkles
} from 'lucide-react';

interface ControlBarProps {
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  unreadCount?: number;
  participantCount: number;
  formattedTime: string;
  isCopied?: boolean;
  onCopyLink?: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onOpenSettings: () => void;
  onLeaveMeeting: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isChatOpen,
  isParticipantsOpen,
  unreadCount = 0,
  participantCount,
  formattedTime,
  isCopied = false,
  onCopyLink,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onOpenSettings,
  onLeaveMeeting,
}) => {
  return (
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-full shadow-2xl px-4 py-2.5 flex items-center justify-between gap-3 max-w-3xl w-full mx-auto">
      
      {/* Center Action Buttons Group */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 mx-auto">
        
        {/* Mic Toggle Button */}
        <div className="flex items-center">
          <button
            onClick={onToggleAudio}
            title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
            className={`p-3 rounded-full transition-all shadow-sm flex items-center justify-center ${
              isAudioMuted 
                ? 'bg-rose-500 text-white' 
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={onOpenSettings} className="p-1 text-slate-400 hover:text-slate-700">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Video Toggle Button */}
        <div className="flex items-center">
          <button
            onClick={onToggleVideo}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            className={`p-3 rounded-full transition-all shadow-sm flex items-center justify-center ${
              isVideoOff 
                ? 'bg-rose-500 text-white' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
          <button onClick={onOpenSettings} className="p-1 text-slate-400 hover:text-slate-700">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Screen Share Button */}
        <button
          onClick={onToggleScreenShare}
          title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
          className={`p-3 rounded-full transition-all shadow-sm ${
            isScreenSharing 
              ? 'bg-orange-500 text-white font-bold' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
          }`}
        >
          <Monitor className="w-4 h-4" />
        </button>

        {/* Live AI Subtitles Indicator */}
        <button
          title="Live AI Subtitles Active"
          className="p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-orange-500" />
        </button>

        {/* Raise Hand Button */}
        <button
          title="Raise Hand"
          className="p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm hidden sm:flex"
        >
          <Hand className="w-4 h-4" />
        </button>

        {/* Reactions Emoji Button */}
        <button
          title="Send Reaction"
          className="p-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm hidden sm:flex"
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* Chat Drawer Toggle */}
        <button
          onClick={onToggleChat}
          title="Chat Drawer"
          className={`relative p-3 rounded-full transition-all shadow-sm ${
            isChatOpen 
              ? 'bg-slate-900 text-white' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Copy Meeting Link Button */}
        {onCopyLink && (
          <button
            onClick={onCopyLink}
            title="Copy Invite Link"
            className={`p-3 rounded-full transition-all shadow-sm ${
              isCopied
                ? 'bg-emerald-500 text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        )}

        {/* End Meeting Button (Coral Red) */}
        <button
          onClick={onLeaveMeeting}
          title="End Meeting"
          className="ml-2 px-5 py-2.5 rounded-full bg-[#f05638] hover:bg-[#e04527] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>End Meeting</span>
        </button>

      </div>

    </div>
  );
};
