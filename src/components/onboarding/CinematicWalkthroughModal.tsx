'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { generateMemberBadgeTextures } from '@/components/ui/MemberBadgeCanvas';
import { RealisticLeatherWallet } from './RealisticLeatherWallet';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  PhoneCall,
  Activity,
  Award,
  CheckCircle2,
} from 'lucide-react';

// Dynamically import Three.js Lanyard component to prevent SSR hydration mismatches
const Lanyard = dynamic(() => import('@/components/ui/Lanyard'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono text-slate-400 font-bold">
        Simulating 3D Physics & Badge Shaders...
      </span>
    </div>
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// CHIBI MASCOT GUIDE (WITH GOLDEN-TIPPED POINTER STICK & EYE BLINK PHYSICS)
// ─────────────────────────────────────────────────────────────────────────────
const ChibiMascotGuide: React.FC<{
  pose?: 'greeting' | 'pointing' | 'celebrating' | 'holdingCard';
  speechBubbleText?: string;
}> = ({ pose = 'pointing', speechBubbleText }) => {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3200);
    return () => clearInterval(blinkInterval);
  }, []);

  return (
    <div className="relative flex flex-col items-center select-none pointer-events-none">
      {/* Speech Bubble Above Mascot */}
      {speechBubbleText && (
        <div className="mb-2 max-w-xs px-4 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 border-2 border-orange-500/40 text-slate-900 dark:text-white text-xs font-bold shadow-xl shadow-orange-500/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 text-[10px] uppercase font-mono tracking-wider mb-0.5">
            <Sparkles className="w-3 h-3" />
            <span>Sanket Guide</span>
          </div>
          <p className="leading-snug">{speechBubbleText}</p>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-900 border-r-2 border-b-2 border-orange-500/40 rotate-45" />
        </div>
      )}

      {/* SVG Mascot Character with Golden Pointer Stick */}
      <div className="relative w-44 h-44 sm:w-52 sm:h-52 drop-shadow-2xl">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full overflow-visible transition-transform duration-500 hover:scale-105"
        >
          <defs>
            {/* Skin Gradient */}
            <linearGradient id="guideSkin" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFE0B2" />
              <stop offset="100%" stopColor="#FFCC80" />
            </linearGradient>

            {/* Hair Gradient */}
            <linearGradient id="guideHair" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF8F00" />
              <stop offset="50%" stopColor="#FF6D00" />
              <stop offset="100%" stopColor="#E65100" />
            </linearGradient>

            {/* Pointer Stick Gold Gradient */}
            <linearGradient id="goldStick" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>

            {/* Jacket Body Gradient */}
            <linearGradient id="guideBody" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF8A65" />
              <stop offset="100%" stopColor="#FF5722" />
            </linearGradient>
          </defs>

          {/* Torso / Jacket */}
          <path
            d="M 60,150 C 60,135 75,130 100,130 C 125,130 140,135 140,150 L 148,190 C 148,195 140,200 100,200 C 60,200 52,195 52,190 Z"
            fill="url(#guideBody)"
          />

          {/* Jacket Collar Trim */}
          <path
            d="M 85,130 L 100,155 L 115,130"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Head */}
          <ellipse cx="100" cy="95" rx="42" ry="40" fill="url(#guideSkin)" />

          {/* Rosy Cheeks */}
          <ellipse cx="74" cy="108" rx="8" ry="4.5" fill="#FF8A80" opacity="0.65" />
          <ellipse cx="126" cy="108" rx="8" ry="4.5" fill="#FF8A80" opacity="0.65" />

          {/* Eyes (With Blinking Animation) */}
          {blink ? (
            // Closed / Happy Arc Eyes
            <g stroke="#3E2723" strokeWidth="4" strokeLinecap="round" fill="none">
              <path d="M 72,94 Q 80,99 88,94" />
              <path d="M 112,94 Q 120,99 128,94" />
            </g>
          ) : (
            // Open Big Expressive Anime Eyes
            <g>
              <ellipse cx="80" cy="94" rx="9" ry="12" fill="#3E2723" />
              <ellipse cx="120" cy="94" rx="9" ry="12" fill="#3E2723" />
              {/* Eye Catchlights */}
              <circle cx="77" cy="90" r="3.5" fill="#FFFFFF" />
              <circle cx="83" cy="98" r="1.5" fill="#FFFFFF" />
              <circle cx="117" cy="90" r="3.5" fill="#FFFFFF" />
              <circle cx="123" cy="98" r="1.5" fill="#FFFFFF" />
            </g>
          )}

          {/* Cheerful Mouth */}
          <path
            d="M 92,112 Q 100,122 108,112"
            fill="#D81B60"
            stroke="#3E2723"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Spiky Anime Orange Hair */}
          <path
            d="M 58,80 C 50,60 65,45 80,45 C 85,30 100,28 112,38 C 125,25 145,35 142,55 C 155,60 152,78 144,88 C 140,65 130,55 120,58 C 110,48 95,50 88,60 C 78,54 65,65 58,80 Z"
            fill="url(#guideHair)"
          />

          {/* Left Hand / Arm */}
          <path
            d="M 60,150 C 50,155 45,170 52,180"
            stroke="url(#guideSkin)"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />

          {/* RIGHT ARM & THE GOLDEN POINTER STICK */}
          <g className="transition-transform duration-700">
            {/* Arm */}
            <path
              d="M 138,150 C 155,142 168,135 168,125"
              stroke="url(#guideSkin)"
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
            />

            {/* Hand Clasp */}
            <circle cx="168" cy="125" r="7.5" fill="url(#guideSkin)" />

            {/* The Pointer Stick (Sleek Carbon with 24K Gold Tip) */}
            <line
              x1="168"
              y1="125"
              x2="198"
              y2="55"
              stroke="#1E293B"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Gold Tip */}
            <line
              x1="192"
              y1="68"
              x2="198"
              y2="55"
              stroke="url(#goldStick)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <circle cx="199" cy="53" r="5" fill="#FDE047" className="animate-pulse" />

            {/* Sparkle Particle from Pointer Tip */}
            <path
              d="M 199,44 L 201,51 L 208,53 L 201,55 L 199,62 L 197,55 L 190,53 L 197,51 Z"
              fill="#FBBF24"
              className="animate-spin"
              style={{ transformOrigin: '199px 53px', animationDuration: '4s' }}
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CINEMATIC WALKTHROUGH MODAL
// ─────────────────────────────────────────────────────────────────────────────
interface CinematicWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CinematicWalkthroughModal: React.FC<CinematicWalkthroughModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [badgeTextures, setBadgeTextures] = useState<{
    frontDataUrl: string;
    backDataUrl: string;
    strapDataUrl: string;
  } | null>(null);

  // Generate real dynamic badge textures on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const name = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Sanket Member';
    const email = user?.email || 'member@sanket.ai';
    const photoUrl = user?.photoURL || null;

    generateMemberBadgeTextures({
      name,
      email,
      photoUrl,
      role: 'Verified Communicator • Signer & Speaker',
      memberId: `SKT-${(user?.uid || '7381').slice(0, 6).toUpperCase()}`,
      credits: 100,
    }).then(setBadgeTextures);
  }, [user, profile]);

  if (!isOpen) return null;

  const totalSteps = 5;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('sanket_onboarding_completed', 'true');
    } catch {
      // Ignore storage errors
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Modal Card Shell */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0B0F19] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header & Progress */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 p-0.5 shadow-md shadow-orange-500/20 flex items-center justify-center">
              <span className="font-black text-white text-base">S</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                Sanket AI Interactive Tour
              </h2>
              <p className="text-[11px] font-mono text-orange-600 dark:text-orange-400 font-bold">
                ACT {currentStep + 1} OF {totalSteps} • CINEMATIC ONBOARDING
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Step Pills */}
            <div className="hidden sm:flex items-center gap-1.5 mr-2">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? 'w-7 bg-orange-500'
                      : idx < currentStep
                      ? 'w-2 bg-emerald-500'
                      : 'w-2 bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleComplete}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Skip Tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Center Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
          {/* STEP 1: REALISTIC LEATHER WALLET & 100 CREDITS */}
          {currentStep === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <ChibiMascotGuide
                  pose="pointing"
                  speechBubbleText="Namaste! 👋 I have a special welcome gift inside your luxury wallet!"
                />
                <div className="text-center mt-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 font-mono text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    100 Free Starter Credits
                  </span>
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col items-center">
                <RealisticLeatherWallet autoOpen={true} />

                <div className="mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed max-w-md text-center">
                  <p className="font-bold text-slate-900 dark:text-white">
                    🎁 Welcome Gift Automatically Unlocked!
                  </p>
                  <p>
                    Every new Sanket AI member receives <strong>100 free credits</strong> right
                    in their wallet to test accessible video meetings and telecom voice relay
                    calls across India with zero upfront payment.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 3D LANYARD ID BADGE */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <ChibiMascotGuide
                  pose="pointing"
                  speechBubbleText="Behold! Your official 3D ID Badge! You can drag, swing, and flip it!"
                />
                <div className="text-center mt-3 space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 font-mono text-xs font-bold">
                    <Award className="w-3.5 h-3.5" />
                    Physics Simulation (Three.js)
                  </span>
                  <p className="text-[11px] font-mono text-slate-400">
                    💡 Click card to flip • Drag to swing with cloth gravity
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="w-full h-80 sm:h-96 rounded-3xl bg-slate-900/60 border border-slate-800 overflow-hidden relative shadow-inner">
                  {badgeTextures ? (
                    <Lanyard
                      frontImage={badgeTextures.frontDataUrl}
                      backImage={badgeTextures.backDataUrl}
                      strapImage={badgeTextures.strapDataUrl}
                      imageFit="cover"
                      cardColor="#0B0F19"
                      finish="holographic"
                      metal="gold"
                      strapWidth={0.65}
                      gravity={0.9}
                      breeze={0.4}
                      interactive={true}
                      intro={true}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 text-center max-w-md">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Verified Digital Member Credentials
                  </span>
                  <p className="mt-1">
                    Your badge is permanently stored on your dashboard. It displays your
                    authenticated identity, encrypted access QR code, and verified role as both a
                    Signer and Speaker.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ON-DEVICE ISL RECOGNITION (21 NODES) */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <ChibiMascotGuide
                  pose="pointing"
                  speechBubbleText="Our neural model tracks 21 hand and pose landmarks on your device with 0ms latency!"
                />
              </div>

              <div className="lg:col-span-7 space-y-4">
                {/* Visual HUD Card */}
                <div className="relative rounded-2xl bg-[#070e1b] border-2 border-cyan-500/40 p-6 overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span className="text-xs font-mono font-bold text-cyan-300 uppercase">
                        On-Device 21-Node Coordinate Engine
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 text-[10px] font-mono font-bold border border-cyan-500/30">
                      60 FPS REAL-TIME
                    </span>
                  </div>

                  {/* Animated Hand Landmark Nodes */}
                  <div className="relative h-44 flex items-center justify-center">
                    <svg viewBox="0 0 200 160" className="w-48 h-full">
                      {/* Bone Lines */}
                      <path
                        d="M 100,140 L 70,100 L 50,70 L 40,50"
                        stroke="#38BDF8"
                        strokeWidth="3"
                        fill="none"
                        opacity="0.8"
                      />
                      <path
                        d="M 100,140 L 85,90 L 75,55 L 70,30"
                        stroke="#38BDF8"
                        strokeWidth="3"
                        fill="none"
                        opacity="0.8"
                      />
                      <path
                        d="M 100,140 L 100,85 L 100,50 L 100,20"
                        stroke="#F97316"
                        strokeWidth="3.5"
                        fill="none"
                        opacity="0.9"
                      />
                      <path
                        d="M 100,140 L 115,90 L 125,55 L 130,30"
                        stroke="#38BDF8"
                        strokeWidth="3"
                        fill="none"
                        opacity="0.8"
                      />
                      <path
                        d="M 100,140 L 130,100 L 150,70 L 160,50"
                        stroke="#38BDF8"
                        strokeWidth="3"
                        fill="none"
                        opacity="0.8"
                      />

                      {/* 21 Keypoint Nodes */}
                      {[
                        [100, 140],
                        [70, 100],
                        [50, 70],
                        [40, 50],
                        [85, 90],
                        [75, 55],
                        [70, 30],
                        [100, 85],
                        [100, 50],
                        [100, 20],
                        [115, 90],
                        [125, 55],
                        [130, 30],
                        [130, 100],
                        [150, 70],
                        [160, 50],
                      ].map(([x, y], idx) => (
                        <circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r={idx === 9 ? '6' : '4.5'}
                          fill={idx === 9 ? '#F59E0B' : '#38BDF8'}
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                          className="animate-pulse"
                        />
                      ))}
                    </svg>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-cyan-500/20 text-[11px] font-mono">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block">Sign To Voice:</span>
                      <strong className="text-emerald-400">Natural English & Hindi</strong>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block">Privacy Guarantee:</span>
                      <strong className="text-cyan-300">100% Client-Side Processing</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: 3D AVATAR & VOICE TELECOM RELAY */}
          {currentStep === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <ChibiMascotGuide
                  pose="pointing"
                  speechBubbleText="Our 3D avatar signs spoken voice in real time, and Voice Telecom Relay dials any regular phone!"
                />
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-[#0B0F19] border border-indigo-500/30 shadow-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Voice Telecom Relay</h4>
                      <p className="text-xs text-indigo-300">
                        Connect directly to landline and cellular phone numbers
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-400">PSTN / Mobile Trunk:</span>
                      <span className="text-emerald-400 font-bold">● Active Gateway</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-400">3D Holographic Avatar:</span>
                      <span className="text-cyan-400 font-bold">● 262 ISL Vocabulary</span>
                    </div>
                    <p className="text-slate-400 pt-1 leading-relaxed">
                      Deaf users can sign or type, and the other person hears real voice on their
                      phone. When they speak back, our 3D avatar signs to you in live motion!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: READY & CELEBRATION */}
          {currentStep === 4 && (
            <div className="text-center py-4 space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-orange-500 to-amber-400 p-1 shadow-2xl shadow-orange-500/30 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  You are all set for inclusive communication!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your <strong>100 Starter Credits</strong> are loaded, your{' '}
                  <strong>3D Membership Pass</strong> is active on your dashboard, and your camera
                  is ready. Let&apos;s build an accessible world together!
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleComplete}
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm shadow-xl shadow-orange-500/25 transition transform hover:scale-105 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Enter Sanket Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Navigation */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs font-mono font-bold text-slate-400">
            {currentStep + 1} / {totalSteps}
          </span>

          <button
            onClick={handleNext}
            className="px-6 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/25 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>{currentStep === totalSteps - 1 ? 'Finish & Launch 🚀' : 'Next Step'}</span>
            {currentStep < totalSteps - 1 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
