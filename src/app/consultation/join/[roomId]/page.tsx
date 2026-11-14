'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { getMeetingSession } from '@/lib/firebase/services';
import { MeetingSession, normalizeRoomCode } from '@/types';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  ShieldCheck, 
  User, 
  ArrowRight,
  Sparkles,
  HandMetal,
  CheckCircle2,
  Lock,
  Volume2
} from 'lucide-react';

export default function JoinLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  
  const rawRoomId = (params?.roomId as string) || '';
  const roomId = normalizeRoomCode(rawRoomId);

  const initialName = searchParams?.get('name') || profile?.displayName || user?.email?.split('@')[0] || '';
  const initialAge = searchParams?.get('age') || '22';
  const rawRole = (searchParams?.get('role') || '').toLowerCase().trim();
  const isSpeaker =
    rawRole.includes('speak') ||
    rawRole.includes('voice') ||
    rawRole.includes('interviewer') ||
    rawRole === 'doctor' ||
    rawRole === 'host';
  const initialRole: 'deaf_signer' | 'speaking_interviewer' = isSpeaker
    ? 'speaking_interviewer'
    : 'deaf_signer';

  const [session, setSession] = useState<MeetingSession | null>(null);
  const [displayName, setDisplayName] = useState(initialName);
  const [age, setAge] = useState(initialAge);
  const [role, setRole] = useState<'deaf_signer' | 'speaking_interviewer'>(initialRole);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(true);

  const [isEntering, setIsEntering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pre-fetch room page in background so navigation is instant
  useEffect(() => {
    if (roomId) {
      router.prefetch(`/room/${roomId}`);
    }
  }, [roomId, router]);

  // Fetch meeting session details
  useEffect(() => {
    if (!roomId) return;

    getMeetingSession(roomId)
      .then((s) => {
        setSession(s);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Session query note:', err);
        setLoading(false);
      });
  }, [roomId]);

  // Local camera preview setup
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startPreview() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.warn('Could not get media preview:', err);
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
    if (isEntering) return;
    setIsEntering(true);

    const chosenName = displayName.trim() || `Guest-${Math.floor(1000 + Math.random() * 9000)}`;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    const query = new URLSearchParams({
      name: chosenName,
      age: age.trim() || '22',
      role,
      muted: isAudioMuted ? '1' : '0',
      videoOff: isVideoOff ? '1' : '0',
    }).toString();

    const targetUrl = `/room/${roomId}?${query}`;
    router.push(targetUrl);

    // Fast fallback safety: ensure transition happens within 1.2s
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== `/room/${roomId}`) {
        window.location.assign(targetUrl);
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Title Header */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-bold text-xs uppercase tracking-wider shadow-xs">
            <Sparkles className="w-4 h-4 text-cyan-600" /> Pre-Meeting Setup
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Ready to Join Meeting?
          </h1>
          <p className="text-slate-600 text-sm">
            Room Code: <strong className="font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">{roomId}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Camera Preview Box */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center">
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
                  <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-rose-400 text-xl font-bold">
                    <VideoOff className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-semibold">Camera is Turned Off</span>
                </div>
              )}

              {/* Floating Google Meet Style Circular Mic/Cam Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md p-2 rounded-full border border-slate-700 shadow-xl">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-3 rounded-full transition shadow-md ${
                    isAudioMuted 
                      ? 'bg-rose-500 text-white hover:bg-rose-600' 
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                  title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleCam}
                  className={`p-3 rounded-full transition shadow-md ${
                    isVideoOff 
                      ? 'bg-rose-500 text-white hover:bg-rose-600' 
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                  title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Quick Feature Badges */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                3D Hologram Interpreter & Subtitles Ready
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-mono text-[10px] font-bold">
                60 FPS Local WebGL
              </span>
            </div>
          </div>

          {/* Right Column: User Details & Strict Single-Role Selection */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 space-y-6">
            <div>
              <span className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider block mb-1">
                Meeting Details
              </span>
              <h2 className="text-xl font-black text-slate-900">
                {session?.title || 'Accessible Video Meeting'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Host: {session?.hostName || 'Organizer'}
              </p>
            </div>

            <div className="space-y-4">
              {/* Full Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Sarah / John Doe"
                    suppressHydrationWarning
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-medium"
                  />
                </div>
              </div>

              {/* Age Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your Age
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="22"
                  suppressHydrationWarning
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono font-bold"
                />
              </div>

              {/* Select Your Role: STRICTLY ONE - NOT BOTH */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Choose Your Role <span className="text-cyan-600 lowercase font-normal">(select one)</span>
                </label>
                
                <div className="space-y-2.5">
                  {/* Option 1: Deaf Signer View */}
                  <div
                    onClick={() => setRole('deaf_signer')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                      role === 'deaf_signer'
                        ? 'border-cyan-500 bg-cyan-50/80 text-cyan-950 ring-2 ring-cyan-400 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold shrink-0">
                        <HandMetal className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900">Deaf / Hard of Hearing</div>
                        <div className="text-[11px] text-slate-500 leading-tight">View 3D Sign Interpreter & subtitles</div>
                      </div>
                    </div>
                    {role === 'deaf_signer' ? (
                      <CheckCircle2 className="w-5 h-5 text-cyan-600 shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-300 shrink-0" />
                    )}
                  </div>

                  {/* Option 2: Speaking Participant */}
                  <div
                    onClick={() => setRole('speaking_interviewer')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                      role === 'speaking_interviewer'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-400 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                        <Mic className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900">Hearing & Speaking</div>
                        <div className="text-[11px] text-slate-500 leading-tight">Voice converts to 3D signs & subtitles</div>
                      </div>
                    </div>
                    {role === 'speaking_interviewer' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-300 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Enter Button */}
            <button
              onClick={handleEnterRoom}
              disabled={!displayName.trim() || isEntering}
              suppressHydrationWarning
              className="w-full py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white font-bold text-sm shadow-lg shadow-cyan-600/25 transition flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
            >
              {isEntering ? (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200 animate-spin" />
                  <span>Entering Meeting Room...</span>
                </>
              ) : (
                <>
                  <span>Enter Meeting Room</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
