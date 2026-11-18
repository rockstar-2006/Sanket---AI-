'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { createMeetingSession } from '@/lib/firebase/services';
import { 
  Video, 
  ArrowRight,
  Sparkles,
  Users,
  Mic,
  HandMetal,
  CheckCircle2,
  Lock,
  Calendar,
  Zap,
  LogIn,
  PlusCircle,
  User,
} from 'lucide-react';

export default function CreateOrJoinConsultationPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [title, setTitle] = useState('Accessible Video Meeting');
  const [hostName, setHostName] = useState('');
  const [hostAge, setHostAge] = useState('22');
  const [role, setRole] = useState<'deaf_signer' | 'speaking_interviewer'>('deaf_signer');
  const [loading, setLoading] = useState(false);
  const [joinCodeOrUrl, setJoinCodeOrUrl] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (profile?.displayName) {
      setHostName(profile.displayName);
    } else if (user?.email) {
      setHostName(user.email.split('@')[0]);
    } else {
      setHostName('');
    }
  }, [user, profile]);

  const extractCode = (val: string): string => {
    const trimmed = decodeURIComponent(String(val || '')).trim();
    if (!trimmed) return '';
    if (trimmed.includes('/')) {
      const parts = trimmed.split('?')[0].split('/');
      const lastPart = parts.filter(Boolean).pop() || '';
      return lastPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }
    return trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  };

  const handleCreate = async (e?: React.FormEvent, directJoin = false) => {
    if (e) e.preventDefault();
    if (!hostName.trim()) return;

    setLoading(true);
    try {
      const hostUid = user?.uid || `host-${Math.random().toString(36).substring(2, 9)}`;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore timeout')), 1500)
      );

      const session = await Promise.race([
        createMeetingSession({
          title: title.trim() || 'Accessible Video Meeting',
          description: 'General Accessible Real-Time Video Call with 3D Holographic Sign Interpreter and live captions.',
          hostUid,
          hostName: hostName.trim(),
          consultationType: 'general',
          maxParticipants: 4,
        }),
        timeoutPromise,
      ]);

      const query = new URLSearchParams({
        name: hostName.trim(),
        age: hostAge.trim() || '22',
        role,
      }).toString();

      // Enter directly into accessible meeting room
      const targetUrl = `/room/${session.roomCode}?${query}`;
      router.push(targetUrl);
    } catch (err) {
      console.warn('Fast fallback room navigation:', err);
      const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const query = new URLSearchParams({
        name: hostName.trim(),
        age: hostAge.trim() || '22',
        role,
      }).toString();

      const targetUrl = `/room/${fallbackCode}?${query}`;
      router.push(targetUrl);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = extractCode(joinCodeOrUrl);
    if (!cleanCode) {
      setJoinError('Please enter a valid meeting code or link.');
      return;
    }
    if (!hostName.trim()) {
      setJoinError('Please enter your full name.');
      return;
    }

    setJoinError('');
    setLoading(true);

    const query = new URLSearchParams({
      name: hostName.trim(),
      age: hostAge.trim() || '22',
      role,
    }).toString();

    router.push(`/room/${cleanCode}?${query}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900">
      <Navbar />

      <AuthGuard featureName="Accessible Video Meetings">
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Title Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-bold text-xs uppercase tracking-wider shadow-xs">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            Sanket AI Accessible Meetings
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {activeTab === 'create' ? 'Start Accessible Video Call' : 'Join Existing Video Call'}
          </h1>
          <p className="text-slate-600 text-sm">
            Real-time on-device 3D sign interpreter, continuous subtitles, and accessible communication for all.
          </p>

          {/* Mode Switcher Tabs */}
          <div className="inline-flex items-center p-1 bg-slate-200/80 rounded-2xl border border-slate-300 shadow-inner mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
                activeTab === 'create'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-cyan-600" />
              <span>Create New Meeting</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
                activeTab === 'join'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4 text-orange-500" />
              <span>Join with Code / Link</span>
            </button>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 max-w-2xl mx-auto space-y-6">
          {activeTab === 'create' ? (
            /* ─── TAB 1: CREATE MEETING FORM ─────────────────────────────── */
            <form onSubmit={(e) => handleCreate(e, false)} className="space-y-6" suppressHydrationWarning>
              {/* Meeting Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Meeting Session Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Project Discussion / General Call"
                  suppressHydrationWarning
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-medium"
                />
              </div>

              {/* User Details: Name & Age */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="e.g. John Doe / Sarah"
                    suppressHydrationWarning
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Your Age
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    required
                    value={hostAge}
                    onChange={(e) => setHostAge(e.target.value)}
                    placeholder="22"
                    suppressHydrationWarning
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono font-bold"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Your Role <span className="text-cyan-600 lowercase font-normal">(choose strictly one)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Deaf Signer View */}
                  <button
                    type="button"
                    onClick={() => setRole('deaf_signer')}
                    suppressHydrationWarning
                    className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 relative ${
                      role === 'deaf_signer'
                        ? 'border-cyan-500 bg-cyan-50/70 text-cyan-950 ring-2 ring-cyan-400 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold">
                          <HandMetal className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-sm text-slate-900">Deaf / Signer</span>
                      </div>
                      {role === 'deaf_signer' && (
                        <CheckCircle2 className="w-5 h-5 text-cyan-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-snug">
                      I will observe the 3D Holographic Sign Interpreter and real-time synchronized captions.
                    </p>
                  </button>

                  {/* Option 2: Speaking Interviewer / Voice */}
                  <button
                    type="button"
                    onClick={() => setRole('speaking_interviewer')}
                    suppressHydrationWarning
                    className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 relative ${
                      role === 'speaking_interviewer'
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-400 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                          <Mic className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-sm text-slate-900">Speaker / Voice</span>
                      </div>
                      {role === 'speaking_interviewer' && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-snug">
                      I will speak naturally; my voice will be translated into 3D ISL signs and subtitles for deaf peers.
                    </p>
                  </button>
                </div>
              </div>

              {/* Action Buttons: 1-Click Instant Start OR Preview in Lobby */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleCreate(undefined, true)}
                  disabled={loading || !hostName.trim()}
                  suppressHydrationWarning
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm shadow-xl shadow-cyan-600/25 transition flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>{loading ? 'Starting Meeting...' : '⚡ Start & Enter Meeting Instantly'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="submit"
                  disabled={loading || !hostName.trim()}
                  suppressHydrationWarning
                  className="w-full py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Video className="w-4 h-4 text-slate-500" />
                  <span>Preview Camera &amp; Mic in Lobby First</span>
                </button>
              </div>
            </form>
          ) : (
            /* ─── TAB 2: JOIN EXISTING MEETING FORM ──────────────────────── */
            <form onSubmit={handleDirectJoin} className="space-y-5" suppressHydrationWarning>
              {joinError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {joinError}
                </div>
              )}

              {/* Code or Link Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Enter Meeting Code or Paste Invite Link
                </label>
                <input
                  type="text"
                  required
                  value={joinCodeOrUrl}
                  onChange={(e) => {
                    setJoinCodeOrUrl(e.target.value);
                    if (joinError) setJoinError('');
                  }}
                  placeholder="e.g. SAQ1VQ or paste link"
                  suppressHydrationWarning
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm text-slate-900 font-mono font-bold uppercase placeholder:normal-case placeholder:font-normal focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  You can paste the entire link shared by the host or just enter the 6-character room code.
                </p>
              </div>

              {/* Name & Age */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      placeholder="e.g. John Doe / Sarah"
                      suppressHydrationWarning
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Your Age
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    required
                    value={hostAge}
                    onChange={(e) => setHostAge(e.target.value)}
                    placeholder="22"
                    suppressHydrationWarning
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono font-bold"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Your Role <span className="text-cyan-600 lowercase font-normal">(choose one)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('deaf_signer')}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between gap-2.5 ${
                      role === 'deaf_signer'
                        ? 'border-cyan-500 bg-cyan-50/80 text-cyan-950 ring-2 ring-cyan-400 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold shrink-0">
                        <HandMetal className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">Deaf / Signer</div>
                        <div className="text-[10px] text-slate-500">3D Hologram view</div>
                      </div>
                    </div>
                    {role === 'deaf_signer' && (
                      <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('speaking_interviewer')}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between gap-2.5 ${
                      role === 'speaking_interviewer'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-400 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                        <Mic className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">Speaker / Voice</div>
                        <div className="text-[10px] text-slate-500">Voice translates to signs</div>
                      </div>
                    </div>
                    {role === 'speaking_interviewer' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {/* Join Submit Button */}
              <button
                type="submit"
                disabled={loading || !joinCodeOrUrl.trim() || !hostName.trim()}
                suppressHydrationWarning
                className="w-full py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm shadow-xl shadow-cyan-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Joining Meeting...' : 'Join Meeting Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </main>
      </AuthGuard>

      <Footer />
    </div>
  );
}
