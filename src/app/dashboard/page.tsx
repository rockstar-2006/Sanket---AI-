'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { getUserMeetingHistory } from '@/lib/firebase/services';
import { MeetingSession } from '@/types';
import { 
  Video, 
  PlusCircle, 
  ArrowRight, 
  Calendar, 
  Clock, 
  Users, 
  ShieldCheck, 
  Activity,
  Copy,
  Check,
  Sparkles,
  Hand,
  MessageSquareText,
  Mic,
  VideoOff,
  PhoneOff,
  Volume2
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [history, setHistory] = useState<MeetingSession[]>([]);
  const [roomInput, setRoomInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      getUserMeetingHistory(user.uid)
        .then(setHistory)
        .catch((err) => console.error("Failed loading history:", err));
    }
  }, [user, loading, router]);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    router.push(`/consultation/join/${roomInput.trim().toUpperCase()}`);
  };

  const copyRoomLink = (roomCode: string) => {
    const link = `${window.location.origin}/consultation/join/${roomCode}`;
    navigator.clipboard.writeText(link);
    setCopiedId(roomCode);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading Sanket Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 bg-grid-lines">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        
        {/* Welcome Hero Banner - Inspired directly by Image 2 "Get Insights with Video Interviews" */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-100/90 via-indigo-50/70 to-slate-50 border border-slate-200/90 p-8 md:p-12 shadow-sm">
          
          {/* Background Decorative Soft Blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-300/20 rounded-full blur-2xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-purple-200 text-purple-700 font-bold text-xs uppercase tracking-wider shadow-xs backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Sign Language AI Workspace
              </div>

              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
                Get insights with <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                  AI video interviews.
                </span>
              </h1>

              <p className="text-slate-600 text-base leading-relaxed max-w-xl">
                Welcome back, <strong className="text-slate-900 font-bold">{profile?.displayName || user.email?.split('@')[0]}</strong>. Start a new accessible session or enter a room code. On-device ISL landmark tracking is active.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href="/consultation/create"
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Start Free Call</span>
                </Link>

                <form onSubmit={handleJoinByCode} className="w-full sm:w-auto flex items-center bg-white border border-slate-300 rounded-full p-1.5 shadow-sm">
                  <input
                    type="text"
                    placeholder="ROOM CODE"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    className="px-4 py-2 text-xs font-mono font-bold uppercase text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none w-36"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-xs"
                  >
                    Join Room
                  </button>
                </form>
              </div>
            </div>

            {/* Right Side: REAL 3D Claymation Illustration Image (Matching Image 2) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md rounded-3xl overflow-hidden border border-slate-200 shadow-2xl group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sanket_dashboard.jpg"
                  alt="Sanket AI Video Call Dashboard 3D Illustration"
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{history.length}</div>
              <div className="text-xs font-bold text-slate-500">Total Video Calls</div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Hand className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">Sign to Speech</div>
              <div className="text-xs font-bold text-slate-500">ISL Recognition Active</div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <MessageSquareText className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">Live Captions</div>
              <div className="text-xs font-bold text-slate-500">Speech Subtitles</div>
            </div>
          </div>
        </div>

        {/* Meeting History List */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Recent Meeting Sessions
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Showing last {history.length} sessions
            </span>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-800 font-bold text-sm">No meeting sessions created yet.</p>
              <p className="text-slate-500 text-xs mt-1 mb-4">Click below to start your first accessible AI video call.</p>
              <Link
                href="/consultation/create"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition"
              >
                Start First Meeting
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-purple-500/40 transition gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">{session.title}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200">
                        {session.consultationType}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>Room Code: <strong className="font-mono text-slate-800">{session.roomCode}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {session.createdAt?.seconds ? new Date(session.createdAt.seconds * 1000).toLocaleDateString() : 'Active'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => copyRoomLink(session.roomCode)}
                      className="px-3.5 py-2 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 transition shadow-2xs"
                    >
                      {copiedId === session.roomCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied Link
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          Copy Link
                        </>
                      )}
                    </button>

                    <Link
                      href={`/consultation/join/${session.roomCode}`}
                      className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                    >
                      Enter Call <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
}
