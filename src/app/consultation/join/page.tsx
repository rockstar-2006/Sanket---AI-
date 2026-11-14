'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { normalizeRoomCode } from '@/types';
import {
  ArrowRight,
  Sparkles,
  User,
  HandMetal,
  Mic,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react';

export default function GeneralJoinPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [inputCodeOrUrl, setInputCodeOrUrl] = useState('');
  const [displayName, setDisplayName] = useState(
    profile?.displayName || user?.email?.split('@')[0] || ''
  );
  const [age, setAge] = useState('22');
  const [role, setRole] = useState<'deaf_signer' | 'speaking_interviewer'>('deaf_signer');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Extract clean 6-8 char room code whether user entered code or full URL
  const extractRoomCode = (raw: string): string => {
    return normalizeRoomCode(raw);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = extractRoomCode(inputCodeOrUrl);

    if (!cleanCode) {
      setErrorMsg('Please enter a valid meeting code or invite link.');
      return;
    }
    if (!displayName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setErrorMsg('');
    setIsJoining(true);

    const query = new URLSearchParams({
      name: displayName.trim(),
      age: age.trim() || '22',
      role,
    }).toString();

    const targetUrl = `/room/${cleanCode}?${query}`;
    router.push(targetUrl);

    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== `/room/${cleanCode}`) {
        window.location.assign(targetUrl);
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Title */}
        <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-bold text-xs uppercase tracking-wider shadow-xs">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            Direct Meeting Access
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Join Accessible Video Meeting
          </h1>
          <p className="text-slate-600 text-sm">
            Enter the meeting code or paste the shared invite link to join your peers instantly.
          </p>
        </div>

        {/* Join Card Form */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 max-w-xl mx-auto space-y-6">
          <form onSubmit={handleJoin} className="space-y-5" suppressHydrationWarning>
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Meeting Code or Link Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Meeting Code or Invite Link
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={inputCodeOrUrl}
                  onChange={(e) => {
                    setInputCodeOrUrl(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g. SAQ1VQ or paste link"
                  suppressHydrationWarning
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm text-slate-900 font-mono font-bold uppercase placeholder:normal-case placeholder:font-normal focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                You can paste the entire link (e.g. <code>https://.../SAQ1VQ</code>) or just the 6-character room code.
              </p>
            </div>

            {/* User Details: Name & Age */}
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
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
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
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
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
                {/* Deaf Signer */}
                <div
                  onClick={() => setRole('deaf_signer')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-2.5 ${
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
                      <div className="text-[10px] text-slate-500">3D Hologram interpreter</div>
                    </div>
                  </div>
                  {role === 'deaf_signer' && (
                    <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0" />
                  )}
                </div>

                {/* Speaker */}
                <div
                  onClick={() => setRole('speaking_interviewer')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-2.5 ${
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
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isJoining || !inputCodeOrUrl.trim() || !displayName.trim()}
              suppressHydrationWarning
              className="w-full py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white font-bold text-sm shadow-lg shadow-cyan-600/25 transition flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
            >
              {isJoining ? (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200 animate-spin" />
                  <span>Joining Meeting Room...</span>
                </>
              ) : (
                <>
                  <span>Join Meeting Now</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Switch to Create Meeting */}
            <div className="text-center pt-2">
              <Link
                href="/consultation/create"
                className="text-xs font-semibold text-slate-500 hover:text-cyan-600 transition inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5 text-cyan-500" />
                <span>Want to start a new meeting instead? Click here</span>
              </Link>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
