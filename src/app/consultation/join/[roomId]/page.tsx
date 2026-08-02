'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { getMeetingSession } from '@/lib/firebase/services';
import { MeetingSession } from '@/types';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  ShieldCheck, 
  User, 
  ArrowRight,
  Sparkles,
  Hand,
  CheckCircle2
} from 'lucide-react';

export default function JoinLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const roomId = (params?.roomId as string) || '';

  const [session, setSession] = useState<MeetingSession | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Set default display name from auth user profile
  useEffect(() => {
    if (profile?.displayName) {
      setDisplayName(profile.displayName);
    } else if (user?.email) {
      setDisplayName(user.email.split('@')[0]);
    } else {
      setDisplayName('Guest Participant');
    }
  }, [user, profile]);

  // Fetch meeting session details
  useEffect(() => {
    if (!roomId) return;

    getMeetingSession(roomId)
      .then((s) => {
        setSession(s);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [roomId]);

  // Local camera preview setup
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startPreview() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.warn("Could not get media preview:", err);
        setIsVideoOff(true);
      }
    }

    startPreview();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isAudioMuted;
        setIsAudioMuted(!isAudioMuted);
      }
    }
  };

  const toggleCam = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoOff;
        setIsVideoOff(!isVideoOff);
      }
    }
  };

  const handleEnterRoom = () => {
    if (!displayName.trim()) return;

    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);

    const query = new URLSearchParams({
      name: displayName,
      muted: isAudioMuted ? '1' : '0',
      videoOff: isVideoOff ? '1' : '0',
    }).toString();

    router.push(`/room/${roomId}?${query}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        
        {/* Title Header */}
        <div className="text-center max-w-xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-bold text-xs uppercase tracking-wider shadow-xs">
            <Sparkles className="w-4 h-4 text-orange-500" /> Pre-Call Hardware Check
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Meeting Pre-Call Lobby
          </h1>
          <p className="text-slate-600 text-sm">
            Test your camera & mic before stepping into room <strong className="font-mono font-bold text-slate-900">{roomId}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Camera Preview Box */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative w-full aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center">
              {!isVideoOff && stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-rose-400 text-xl font-bold">
                    <VideoOff className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-semibold">Camera is Turned Off</span>
                </div>
              )}

              {/* Floating Mic/Cam Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-full border border-slate-700">
                <button
                  onClick={toggleMic}
                  className={`p-3 rounded-full transition ${
                    isAudioMuted ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  onClick={toggleCam}
                  className={`p-3 rounded-full transition ${
                    isVideoOff ? 'bg-rose-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <Hand className="w-4 h-4 text-orange-500" />
                Sanket AI Sign Language Recognition Active
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                30 FPS Ready
              </span>
            </div>
          </div>

          {/* Right Participant Info & UNIQUE 3D Illustration Card */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 3D Illustration Card */}
            <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-lg bg-white p-3">
              <div className="relative rounded-2xl overflow-hidden aspect-[16/9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/img_instant_invite.jpg"
                  alt="Instant Meeting Lobby 3D Illustration"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Join Action Form */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg p-6 sm:p-8 space-y-6">
              {session && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Session Details</div>
                  <div className="text-base font-bold text-slate-900">{session.title}</div>
                  <div className="text-xs text-slate-500">Hosted by: {session.hostName}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Your Display Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                  />
                </div>
              </div>

              <button
                onClick={handleEnterRoom}
                disabled={!displayName.trim()}
                className="w-full py-4 px-6 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-base shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Enter Meeting Room
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
