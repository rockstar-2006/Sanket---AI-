'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import { getUserMeetingHistory } from '@/lib/firebase/services';
import { generateMemberBadgeTextures } from '@/components/ui/MemberBadgeCanvas';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';
import { MinutesOfMeetingModal } from '@/components/dashboard/MinutesOfMeetingModal';
import { MeetingSession } from '@/types';
import { 
  Video, 
  PlusCircle, 
  ArrowRight, 
  Calendar, 
  Clock, 
  Hand, 
  MessageSquareText, 
  Copy, 
  Check, 
  Award, 
  CreditCard,
  FileText,
  Zap,
  TrendingUp,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

// SSR-safe dynamic imports
const Lanyard = dynamic(() => import('@/components/ui/Lanyard'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono text-slate-400 font-bold">
        Loading 3D Cloth Physics & ID Shaders...
      </span>
    </div>
  ),
});

const InGameTutorialGuide = dynamic(
  () => import('@/components/onboarding/InGameTutorialGuide').then((mod) => mod.InGameTutorialGuide),
  { ssr: false }
);

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const { credits, openRechargeModal } = useWallet();
  const [history, setHistory] = useState<MeetingSession[]>([]);
  const [roomInput, setRoomInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [selectedMoMSession, setSelectedMoMSession] = useState<MeetingSession | null>(null);
  const [activeCardTab, setActiveCardTab] = useState<'lanyard' | 'wallet_card'>('lanyard');

  // Dynamic 3D Badge Textures for the Lanyard
  const [badgeTextures, setBadgeTextures] = useState<{
    frontDataUrl: string;
    backDataUrl: string;
    strapDataUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      getUserMeetingHistory(user.uid)
        .then(setHistory)
        .catch((err) => console.error("Failed loading history:", err));

      // Generate customized 3D badge textures matching the authenticated user
      const name = profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Verified Member';
      const email = user.email || 'member@sanket.ai';
      const photoUrl = user.photoURL || null;

      generateMemberBadgeTextures({
        name,
        email,
        photoUrl,
        role: 'Verified Communicator • Signer & Speaker',
        memberId: `SKT-${user.uid.slice(0, 6).toUpperCase()}`,
        credits: credits || 100,
      }).then(setBadgeTextures);

      // Check if user is a brand-new account (created in the last 15 mins and never completed onboarding)
      try {
        const completed = localStorage.getItem('sanket_onboarding_completed');
        if (!completed) {
          // If the account was created more than 15 minutes ago, treat as existing user (no tour needed)
          const isExistingUser = (
            user.metadata?.creationTime && 
            Math.abs(Date.now() - new Date(user.metadata.creationTime).getTime()) > 15 * 60 * 1000
          );

          if (!isExistingUser) {
            // Only brand new accounts get the walkthrough
            const timer = setTimeout(() => setShowWalkthrough(true), 800);
            return () => clearTimeout(timer);
          } else {
            localStorage.setItem('sanket_onboarding_completed', 'true');
          }
        }
      } catch {
        // Storage unavailable
      }
    }
  }, [user, loading, router, profile, credits]);

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

  const userName = profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Member';

  // Accurate Dynamic Tier & Credit Calculation (Fixes the wrong 500-credit assumption)
  const baseTierCredits = credits <= 100 ? 100 : credits <= 500 ? 500 : 1500;
  const tierName = credits <= 100 ? "Starter Welcome Balance" : credits <= 500 ? "Pro Tier" : "Enterprise Pass";
  const usedCredits = Math.max(0, baseTierCredits - credits);
  const capacityPercent = Math.min(100, Math.round((credits / baseTierCredits) * 100));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 bg-grid-lines">
      <Navbar />

      {/* In-Game Companion Guide ONLY for Brand New Users */}
      {showWalkthrough && (
        <InGameTutorialGuide
          onClose={() => {
            try {
              localStorage.setItem('sanket_onboarding_completed', 'true');
            } catch {}
            setShowWalkthrough(false);
          }}
          userName={userName}
          badgeTextures={badgeTextures}
        />
      )}

      {/* Minutes of Meeting (MoM) Document Modal */}
      {selectedMoMSession && (
        <MinutesOfMeetingModal
          session={selectedMoMSession}
          onClose={() => setSelectedMoMSession(null)}
          userName={userName}
        />
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        {/* Welcome Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-100/80 via-amber-50/60 to-slate-50 border border-slate-200/90 p-8 md:p-12 shadow-sm">
          
          {/* Background Decorative Soft Blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-300/15 rounded-full blur-2xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-orange-200 text-orange-700 font-bold text-xs uppercase tracking-wider shadow-xs backdrop-blur-md">
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  Sign Language AI Workspace
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
                Accessible meetings &amp; <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
                  real-time AI voice relay.
                </span>
              </h1>

              <p className="text-slate-600 text-base leading-relaxed max-w-xl">
                Welcome back, <strong className="text-slate-900 font-bold">{userName}</strong>. Your on-device ISL neural tracker is primed, and your verified digital member pass is active on your workspace.
              </p>

              {/* Action Buttons (Clean, Zero Trial Buttons) */}
              <div id="tour-action-buttons" className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href="/consultation/create"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-lg shadow-orange-600/25 transition flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Start Video Call</span>
                </Link>

                <Link
                  href="/consultation/join/ROOM-MAIN"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4 text-amber-400" />
                  <span>Accessible ISL Room</span>
                </Link>

                <form 
                  onSubmit={handleJoinByCode} 
                  className="w-full sm:w-auto min-w-[280px] sm:min-w-[320px] flex items-center justify-between bg-white border border-slate-300/90 rounded-full p-1.5 pl-4 shadow-sm hover:border-orange-400 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all"
                >
                  <input
                    type="text"
                    placeholder="ROOM CODE..."
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    className="flex-1 text-xs font-mono font-bold uppercase text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 min-w-0"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-heading font-extrabold text-xs transition-all shadow-xs cursor-pointer shrink-0 active:scale-95 flex items-center gap-1.5"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Side: DIGITAL MEMBER CREDENTIALS (Verified Member ID shown first + Smart Wallet Pass) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              
              {/* Card Switcher: Professional enterprise labels */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-slate-200/90 shadow-xs mb-3">
                <button
                  type="button"
                  onClick={() => setActiveCardTab('lanyard')}
                  className={`px-4 py-2 rounded-xl font-heading text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeCardTab === 'lanyard'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-orange-500" />
                  <span>Verified Member ID</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCardTab('wallet_card')}
                  className={`px-4 py-2 rounded-xl font-heading text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeCardTab === 'wallet_card'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>Smart Wallet Pass</span>
                </button>
              </div>

              {/* Zero-Lag Stacked Container: Keeps 3D WebGL context alive in memory (Zero freeze on tab switch) */}
              <div className="relative w-full max-w-md h-[400px] sm:h-[450px]">
                
                {/* 1. Verified 3D Member ID */}
                <div 
                  id="tour-3d-pass" 
                  className={`absolute inset-0 w-full h-full rounded-3xl overflow-hidden group transition-opacity duration-300 ${
                    activeCardTab === 'lanyard'
                      ? 'opacity-100 pointer-events-auto z-10'
                      : 'opacity-0 pointer-events-none z-0'
                  }`}
                >
                  {/* Top Badge Overlay */}
                  <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
                    <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-mono text-orange-600 font-bold flex items-center gap-1.5 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      VERIFIED DIGITAL ID
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full shadow-xs">
                      Drag / Click to Flip
                    </span>
                  </div>

                  {/* 3D WebGL Lanyard */}
                  {badgeTextures ? (
                    <Lanyard
                      frontImage={badgeTextures.frontDataUrl}
                      backImage={badgeTextures.backDataUrl}
                      strapImage={badgeTextures.strapDataUrl}
                      imageFit="cover"
                      cardColor="#ffffff"
                      finish="glossy"
                      metal="gold"
                      size={0.78}
                      strapWidth={0.65}
                      gravity={0.9}
                      damping={0.5}
                      elasticity={0.5}
                      breeze={0.4}
                      interactive={true}
                      intro={true}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[11px] font-mono text-slate-400">Loading Pass...</span>
                    </div>
                  )}

                  {/* Bottom Quick Status (Clean & Professional, No duplicate progress bar) */}
                  <div className="absolute bottom-2.5 left-3 right-3 z-20 pointer-events-none flex items-center justify-between text-[11px] font-mono text-slate-700 bg-white/95 backdrop-blur-md px-4 py-2 rounded-xl shadow-xs border border-slate-200/60">
                    <span className="text-slate-900 font-bold truncate max-w-[160px] font-heading">
                      {userName}
                    </span>
                    <span className="text-orange-600 font-bold font-mono">
                      {credits} CREDITS
                    </span>
                  </div>
                </div>

                {/* 2. Smart Wallet Pass */}
                <div 
                  className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 transition-opacity duration-300 ${
                    activeCardTab === 'wallet_card'
                      ? 'opacity-100 pointer-events-auto z-10'
                      : 'opacity-0 pointer-events-none z-0'
                  }`}
                >
                  <FlippableCreditCard 
                    cardholderName={userName.toUpperCase()}
                    credits={credits}
                    cardNumber={`•••• •••• •••• ${user.uid.slice(0, 4).toUpperCase()}`}
                    expiryDate="LIFETIME PASS"
                  />
                  <span className="text-[11px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                    <span>Official Sanket Smart Wallet Pass (Click card to flip)</span>
                  </span>
                </div>

              </div>

            </div>

          </div>
        </div>

        {/* Professional Credit Allocation & Smart Wallet Section */}
        <div className="rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Left: Credit Metrics & Progress Line Bar */}
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs uppercase tracking-widest text-slate-500 font-bold">
                  Telecom &amp; Video Relay Balance
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-100 text-orange-700 border border-orange-200">
                  LIFETIME PASS
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 font-heading">
                  {credits}
                </span>
                <span className="text-slate-500 font-heading font-semibold text-sm">
                  Credits Remaining ({tierName}: {baseTierCredits})
                </span>
              </div>

              {/* Progress Line Bar (100% accurate based on active allocation) */}
              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-200 flex">
                  <div 
                    className="bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Usage: {usedCredits} credits used</span>
                  <span className="font-bold text-slate-700">
                    {capacityPercent}% Available &amp; Ready
                  </span>
                </div>
              </div>

              {/* Quick Conversion Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                <span className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  ~{Math.round(credits / 10)} mins Video Meetings &amp; Voice Relay
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5 font-mono">
                  <Hand className="w-3.5 h-3.5 text-cyan-600" />
                  ~{credits} ISL Gestures Translated
                </span>
              </div>
            </div>

            {/* Right: Recharge Action Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => openRechargeModal()}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-heading font-extrabold text-sm shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 transform hover:scale-102 active:scale-98"
              >
                <Zap className="w-4 h-4 fill-yellow-200 text-yellow-200" />
                <span>+ Recharge Credits (UPI)</span>
              </button>

              <Link
                href="/pricing"
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-heading font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <span>View Plans</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{history.length}</div>
              <div className="text-xs font-bold text-slate-500">Accessible Video Calls</div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center font-bold">
              <Hand className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">Sign to Voice</div>
              <div className="text-xs font-bold text-slate-500">21-Node ISL Recognition</div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <MessageSquareText className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">Live Captions</div>
              <div className="text-xs font-bold text-slate-500">Live Subtitles &amp; Speech</div>
            </div>
          </div>
        </div>

        {/* Meeting History & Minutes of Meeting (MoM) Archive */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                <span>Recent Meeting Sessions &amp; MoM Archive</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Access your session history and AI-generated Minutes of Meeting (MoM) documents
              </p>
            </div>

            {/* Instant Demo MoM preview button */}
            <button
              onClick={() => setSelectedMoMSession({
                id: 'demo-sample-session',
                title: 'Accessible Clinical Consultation & ISL Relay Sync',
                description: 'Clinical review of patient symptoms, antipyretic prescription, and ISL sign relay.',
                hostUid: user.uid,
                hostName: 'Dr. Sharma',
                roomCode: 'SANKET-AI',
                createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600 },
                status: 'ended',
                consultationType: 'specialist',
                maxParticipants: 4
              })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 text-xs font-heading font-bold transition cursor-pointer self-start sm:self-auto"
            >
              <FileText className="w-3.5 h-3.5 text-orange-600" />
              <span>Preview Sample MoM</span>
            </button>
          </div>

          {history.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <p className="text-slate-800 font-bold text-sm">No live meeting sessions recorded yet.</p>
                <p className="text-slate-500 text-xs mt-1">Start a video meeting or preview the sample Minutes of Meeting document above.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/consultation/create"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-600/20 hover:bg-orange-700 transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Start First Meeting</span>
                </Link>

                <button
                  onClick={() => setSelectedMoMSession({
                    id: 'demo-sample-session',
                    title: 'Accessible Clinical Consultation & ISL Relay Sync',
                    description: 'Clinical review of patient symptoms, antipyretic prescription, and ISL sign relay.',
                    hostUid: user.uid,
                    hostName: 'Dr. Sharma',
                    roomCode: 'SANKET-AI',
                    createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600 },
                    status: 'ended',
                    consultationType: 'specialist',
                    maxParticipants: 4
                  })}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>View Sample MoM Report</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-orange-500/40 transition gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">{session.title}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200">
                        {session.consultationType}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span>Room Code: <strong className="font-mono text-slate-800">{session.roomCode}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {session.createdAt?.seconds ? new Date(session.createdAt.seconds * 1000).toLocaleDateString() : 'Active'}
                      </span>
                      <span>•</span>
                      <span className="text-emerald-600 font-bold flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        MoM Ready
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    
                    {/* View MoM Document Button */}
                    <button
                      onClick={() => setSelectedMoMSession(session)}
                      className="px-3.5 py-2 rounded-full bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 text-xs font-heading font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-orange-600" />
                      <span>MoM Document</span>
                    </button>

                    <button
                      onClick={() => copyRoomLink(session.roomCode)}
                      className="px-3.5 py-2 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      {copiedId === session.roomCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <Link
                      href={`/consultation/join/${session.roomCode}`}
                      className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                    >
                      <span>Enter Call</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
