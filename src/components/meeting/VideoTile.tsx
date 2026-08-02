'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, VideoOff, Pin, Monitor, VolumeX, Maximize2 } from 'lucide-react';
import { ParticipantState } from '@/types';

interface VideoTileProps {
  stream: MediaStream | null;
  participant: ParticipantState;
  isLocal?: boolean;
  isPinned?: boolean;
  isSpotlight?: boolean;
  onPinToggle?: () => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  participant,
  isLocal = false,
  isPinned = false,
  isSpotlight = false,
  onPinToggle,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Handle Video Track playback (Always Muted, Bypass Autoplay Policy)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      video.srcObject = new MediaStream(videoTracks);
      video.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[VideoTile] Muted video play interrupted:', err);
        }
      });
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  // Handle Audio Track playback (Unmuted, captures browser autoplay policy blocks)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream || isLocal) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      audio.srcObject = new MediaStream(audioTracks);
      
      const playAudio = () => {
        audio.play()
          .then(() => setAudioBlocked(false))
          .catch((err) => {
            if (err.name !== 'AbortError') {
              console.warn('[VideoTile] Remote audio autoplay blocked:', err);
              setAudioBlocked(true);
            }
          });
      };

      audio.addEventListener('loadedmetadata', playAudio);
      audio.addEventListener('canplay', playAudio);
      playAudio();

      return () => {
        audio.removeEventListener('loadedmetadata', playAudio);
        audio.removeEventListener('canplay', playAudio);
      };
    } else {
      audio.srcObject = null;
      setAudioBlocked(false);
    }
  }, [stream, isLocal]);

  const handleResumeAudio = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => setAudioBlocked(false))
        .catch((err) => console.error("Audio resume error:", err));
    }
  };

  const hasVideoTrack = Boolean(stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled);
  const isVideoOff = (participant.isVideoOff && !participant.isScreenSharing) || !hasVideoTrack;

  return (
    <div className={`relative w-full h-full bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-md transition-all duration-300 group border-2 ${
      isSpotlight || isPinned ? 'ring-4 ring-blue-500/50 border-blue-500' : 'border-slate-800 hover:border-slate-700'
    }`}>
      {/* Video Media Element: Always muted so browser never blocks it */}
      {stream && (
        <div className={`absolute inset-0 bg-slate-950 flex items-center justify-center ${isVideoOff ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={true}
            className={`w-full h-full ${
              participant.isScreenSharing ? 'object-contain bg-slate-950' : 'object-cover'
            } ${isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : ''}`}
          />
        </div>
      )}

      {/* Invisible HTML5 Audio Element for Remote Sound */}
      {!isLocal && stream && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          muted={participant.isMuted}
        />
      )}

      {/* Autoplay Blocked Notification Banner */}
      {audioBlocked && !isLocal && (
        <button
          onClick={handleResumeAudio}
          className="absolute inset-x-4 top-14 z-30 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition animate-pulse"
        >
          <VolumeX className="w-4 h-4" />
          Click to Enable Remote Audio
        </button>
      )}

      {isVideoOff && (
        /* Camera Off Avatar Fallback */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-white text-3xl font-bold shadow-inner">
            {participant.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={participant.photoURL}
                alt={participant.displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              participant.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <span className="mt-3 text-slate-300 font-semibold text-xs flex items-center gap-1.5">
            <VideoOff className="w-3.5 h-3.5 text-rose-400" />
            Camera Off
          </span>
        </div>
      )}

      {/* Bottom Left Name Badge (Matching Image 2 style) */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-full bg-slate-950/70 backdrop-blur-md text-white font-medium text-xs flex items-center gap-2 border border-white/10 shadow-sm">
          <div className={`p-1 rounded-full ${participant.isMuted ? 'bg-rose-500' : 'bg-blue-600'}`}>
            {participant.isMuted ? <MicOff className="w-3 h-3 text-white" /> : <Mic className="w-3 h-3 text-white" />}
          </div>
          <span className="truncate max-w-[140px] sm:max-w-[200px]">
            {participant.displayName} {isLocal ? '(You)' : ''}
          </span>
        </div>

        {participant.isScreenSharing && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500 text-slate-950 flex items-center gap-1 shadow">
            <Monitor className="w-3.5 h-3.5" />
            Sharing
          </span>
        )}
      </div>

      {/* Top Right Controls (Pin / Expand) */}
      {onPinToggle && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={onPinToggle}
            title={isPinned ? "Unpin video" : "Pin video"}
            className={`p-2 rounded-full backdrop-blur-md transition ${
              isPinned ? 'bg-blue-600 text-white' : 'bg-slate-950/60 text-slate-200 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
