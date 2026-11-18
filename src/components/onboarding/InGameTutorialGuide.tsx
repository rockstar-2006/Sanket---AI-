'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Video,
  PhoneCall
} from 'lucide-react';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';
import { generateMemberBadgeTextures } from '@/components/ui/MemberBadgeCanvas';

// Dynamic 3D WebGL Lanyard matching dashboard cloth physics
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. ANIMATED MINI-HELICOPTER (Matches Login Page Exactly)
// ─────────────────────────────────────────────────────────────────────────────
function MiniHelicopter({ isFlying = true }: { isFlying?: boolean }) {
  return (
    <svg width="105" height="68" viewBox="0 0 110 72" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl">
      {/* Top Spinning Rotor Blade */}
      <g style={{ transformOrigin: '55px 8px', animation: isFlying ? 'spinBlade 0.14s linear infinite' : 'none' }}>
        <rect x="6" y="6" width="98" height="4" rx="2" fill="#334155"/>
        <circle cx="55" cy="8" r="5" fill="#94a3b8"/>
      </g>
      {/* Rotor Mast */}
      <rect x="53" y="9" width="4" height="11" fill="#64748b"/>
      {/* Fuselage (Brand Orange) */}
      <ellipse cx="55" cy="34" rx="28" ry="16" fill="#f97316"/>
      <ellipse cx="55" cy="34" rx="28" ry="16" fill="none" stroke="#ea580c" strokeWidth="1.5"/>
      {/* Cockpit Glass (Cyan Tint) */}
      <ellipse cx="46" cy="30" rx="14" ry="10" fill="#bae6fd" opacity="0.9"/>
      <ellipse cx="46" cy="30" rx="14" ry="10" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
      {/* Tail Boom */}
      <path d="M80 34 Q98 30 104 22" stroke="#ea580c" strokeWidth="7" strokeLinecap="round" fill="none"/>
      {/* Tail Rotor */}
      <ellipse 
        cx="104" cy="22" rx="2.5" ry="10" fill="#334155"
        style={{ transformOrigin: '104px 22px', animation: isFlying ? 'spinBlade 0.10s linear infinite' : 'none' }}
      />
      {/* Landing Skids */}
      <path d="M30 52 Q55 48 80 52" stroke="#64748b" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <line x1="37" y1="48" x2="37" y2="52" stroke="#94a3b8" strokeWidth="2.5"/>
      <line x1="73" y1="48" x2="73" y2="52" stroke="#94a3b8" strokeWidth="2.5"/>
      <style>{`
        @keyframes spinBlade { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. USER'S AUTHENTIC CHIBI MASCOT (Geometric Clean Accents, No Emojis)
// ─────────────────────────────────────────────────────────────────────────────
function AuthenticMascot({ 
  withStick = true, 
  pointerAngle = -45,
  isLanding = false,
  className = "w-28 sm:w-32 h-auto" 
}: { 
  withStick?: boolean; 
  pointerAngle?: number;
  isLanding?: boolean;
  className?: string;
}) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 120);
    }, 3200 + Math.random() * 1200);
    return () => clearInterval(t);
  }, []);

  const skin    = '#FDDBB4';
  const skinSh  = '#F0BC8A';
  const skinLit = '#FFF0D6';
  const hC  = '#f97316';
  const hS  = '#fdba74';
  const sC  = '#f97316';
  const sSh = '#fdba74';
  const iC  = '#ea580c';
  const iS  = '#fdba74';

  return (
    <svg 
      viewBox="0 0 190 235" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ 
        filter: 'drop-shadow(0 12px 24px rgba(249, 115, 22, 0.32))', 
        overflow: 'visible',
        transform: isLanding ? 'scaleY(0.85) scaleX(1.15)' : 'none',
        transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      <defs>
        <radialGradient id="kFaceG" cx="38%" cy="30%" r="62%">
          <stop offset="0%"   stopColor={skinLit}/>
          <stop offset="55%"  stopColor={skin}/>
          <stop offset="100%" stopColor={skinSh}/>
        </radialGradient>
        <radialGradient id="kEyeWG" cx="28%" cy="22%" r="68%">
          <stop offset="0%"   stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#eef0fb"/>
        </radialGradient>
        <radialGradient id="kIrisG" cx="28%" cy="22%" r="68%">
          <stop offset="0%"   stopColor={iS}/>
          <stop offset="100%" stopColor={iC}/>
        </radialGradient>
        <radialGradient id="kHairG" cx="35%" cy="28%" r="65%">
          <stop offset="0%"   stopColor={hS}/>
          <stop offset="100%" stopColor={hC}/>
        </radialGradient>
        <linearGradient id="kShirtG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={sSh}/>
          <stop offset="100%" stopColor={sC}/>
        </linearGradient>
        <filter id="blurChG"><feGaussianBlur stdDeviation="3.5"/></filter>
        <filter id="blurShG"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>

      <ellipse cx="95" cy="231" rx="42" ry="7" fill="rgba(0,0,0,0.12)" filter="url(#blurShG)"/>

      {/* Body */}
      <path d="M67 172 Q56 196 53 228 L137 228 Q134 196 123 172 Z" fill="url(#kShirtG)"/>
      <path d="M82 172 Q76 184 77 200" stroke="rgba(255,255,255,0.4)" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M82 172 Q95 180 108 172" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" strokeLinecap="round" fill="none"/>

      {/* Left Arm */}
      <path d="M68 178 Q46 196 48 218" stroke={sC} strokeWidth="20" strokeLinecap="round" fill="none"/>
      <circle cx={48} cy={219} r="14" fill={skin}/>
      <circle cx={48} cy={214} r="9"  fill={skinLit}/>

      {/* Right Arm & Pointer Stick */}
      {withStick ? (
        <g>
          <path d="M122 178 Q146 180 152 160" stroke={sC} strokeWidth="18" strokeLinecap="round" fill="none"/>
          <circle cx="152" cy="160" r="13" fill={skin}/>
          <circle cx="152" cy="157" r="8"  fill={skinLit}/>

          {/* Pointer Stick pivoting dynamically */}
          <g style={{ transformOrigin: '152px 160px', transform: `rotate(${pointerAngle}deg)`, transition: 'transform 0.5s ease' }}>
            <line x1="152" y1="160" x2="152" y2="70" stroke="#334155" strokeWidth="5" strokeLinecap="round"/>
            <line x1="152" y1="90" x2="152" y2="70" stroke="#F59E0B" strokeWidth="6.5" strokeLinecap="round"/>
            <circle cx="152" cy="70" r="5" fill="#FBBF24" className="animate-pulse"/>
            {/* Clean Geometric Diamond */}
            <polygon points="152,58 155,66 163,69 155,72 152,80 149,72 141,69 149,66" fill="#FBBF24" />
          </g>
        </g>
      ) : (
        <g>
          <path d="M122 178 Q144 196 142 218" stroke={sC} strokeWidth="20" strokeLinecap="round" fill="none"/>
          <circle cx={142} cy={219} r="14" fill={skin}/>
          <circle cx={142} cy={214} r="9"  fill={skinLit}/>
        </g>
      )}

      {/* Head */}
      <rect x="83" y="148" width="24" height="28" rx="12" fill={skinSh}/>
      <ellipse cx="95" cy="116" rx="55" ry="49" fill="url(#kFaceG)"/>

      {/* Ears */}
      <ellipse cx="39"  cy="117" rx="12" ry="15" fill={skin}/>
      <ellipse cx="39"  cy="117" rx="7"  ry="9"  fill={skinSh}/>
      <ellipse cx="151" cy="117" rx="12" ry="15" fill={skin}/>
      <ellipse cx="151" cy="117" rx="7"  ry="9"  fill={skinSh}/>

      {/* Cheeks */}
      <ellipse cx="64"  cy="133" rx="14" ry="8" fill="#F87171" opacity="0.45" filter="url(#blurChG)"/>
      <ellipse cx="126" cy="133" rx="14" ry="8" fill="#F87171" opacity="0.45" filter="url(#blurChG)"/>

      {/* Eyes */}
      <ellipse cx="68" cy="113" rx="15" ry="19" fill="url(#kEyeWG)"/>
      <ellipse cx="68" cy="113" rx="15" ry="19" fill="none" stroke="#2D1500" strokeWidth="2.8"/>
      <ellipse cx="69" cy="114" rx="11" ry="14" fill="url(#kIrisG)"/>
      <ellipse cx="70" cy="114" rx="6.5" ry="8.5" fill="#1C0A00"/>
      <circle  cx="64" cy="107" r="5" fill="#ffffff"/>
      <circle  cx="73" cy="119" r="2.5" fill="#ffffff" opacity="0.8"/>

      <ellipse cx="122" cy="113" rx="15" ry="19" fill="url(#kEyeWG)"/>
      <ellipse cx="122" cy="113" rx="15" ry="19" fill="none" stroke="#2D1500" strokeWidth="2.8"/>
      <ellipse cx="121" cy="114" rx="11" ry="14" fill="url(#kIrisG)"/>
      <ellipse cx="120" cy="114" rx="6.5" ry="8.5" fill="#1C0A00"/>
      <circle  cx="115" cy="107" r="5" fill="#ffffff"/>
      <circle  cx="124" cy="119" r="2.5" fill="#ffffff" opacity="0.8"/>

      {/* Blink Eyelids */}
      {blink && (
        <>
          <ellipse cx="68"  cy="113" rx="16" ry="20" fill={skin}/>
          <ellipse cx="122" cy="113" rx="16" ry="20" fill={skin}/>
          <path d="M53 114 Q68 122 83 114" stroke="#2D1500" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M107 114 Q122 122 137 114" stroke="#2D1500" strokeWidth="3" strokeLinecap="round" fill="none"/>
        </>
      )}

      {/* Eyebrows */}
      <path d="M53 92 Q68 84 81 90" stroke="#7C2D12" strokeWidth="3.8" strokeLinecap="round" fill="none"/>
      <path d="M109 90 Q122 84 137 92" stroke="#7C2D12" strokeWidth="3.8" strokeLinecap="round" fill="none"/>

      {/* Nose */}
      <ellipse cx="95" cy="122" rx="3.5" ry="2.2" fill={skinSh}/>

      {/* Big Friendly Smile */}
      <path d="M78 131 Q95 149 112 131" stroke="#2D1500" strokeWidth="3.5" strokeLinecap="round" fill="#b91c1c"/>
      <path d="M83 131 Q95 137 107 131" fill="#ffffff"/>

      {/* Hair */}
      <path d="M42 98 Q38 65 62 48 Q78 36 95 38 Q118 36 132 50 Q152 66 148 98 Q140 76 128 72 Q108 66 95 72 Q82 66 62 72 Q50 77 42 98 Z" fill="url(#kHairG)"/>
      {/* Dynamic Tuft */}
      <path d="M88 40 Q94 14 103 26 Q112 16 116 34 Z" fill={hC}/>
      <path d="M72 48 Q77 30 84 41 Z" fill={hC}/>
      <path d="M118 42 Q126 28 130 44 Z" fill={hS}/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface InGameTutorialGuideProps {
  isOpen?: boolean;
  onClose: () => void;
  userName?: string;
  badgeTextures?: {
    frontDataUrl: string;
    backDataUrl: string;
    strapDataUrl: string;
  } | null;
}

type Act1Stage = 'dropping' | 'greeting' | 'card_reveal' | 'claiming' | 'claimed' | 'id_reveal';

export const InGameTutorialGuide: React.FC<InGameTutorialGuideProps> = ({
  onClose,
  userName = "BHUSHAN POOJARY",
  badgeTextures,
}) => {
  // Dynamic 3D Badge Textures for Lanyard
  const [localBadgeTextures, setLocalBadgeTextures] = useState(badgeTextures || null);

  useEffect(() => {
    if (badgeTextures) {
      setLocalBadgeTextures(badgeTextures);
    } else if (typeof window !== 'undefined') {
      generateMemberBadgeTextures({
        name: userName,
        email: 'member@sanket.ai',
        photoUrl: null,
        role: 'Verified Communicator • Signer & Speaker',
        memberId: 'SKT-7381-AI',
        credits: 100,
      }).then(setLocalBadgeTextures);
    }
  }, [badgeTextures, userName]);

  // ── HOOK DECLARATIONS (Unconditional top-level) ──
  // Step 0 = Cinematic cutscene (Credit Card + ID Card reveal)
  // Step 1 = Video Room lobby highlight
  // Step 2 = Telecom Relay highlight
  // Step 3 = Final complete
  const [step, setStep] = useState(0); 
  const [act1Stage, setAct1Stage] = useState<Act1Stage>('dropping');
  const [dropped, setDropped] = useState(false);
  const [helicVisible, setHelicVisible] = useState(true);
  const [isLanding, setIsLanding] = useState(false);
  const [cardCredits, setCardCredits] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  // Subsequent Steps (Dashboard Tour) - Clean geometric icons, no raw emojis
  const steps = [
    {
      title: 'Mascot Helicopter Arrival & Welcome Package',
      badge: 'SPECIAL DELIVERY',
      narrative: '',
      pointerAngle: -20,
      targetId: null,
      actionUrl: null,
      actionLabel: null,
    },
    {
      title: 'Accessible ISL Meeting Rooms',
      badge: 'PHASE 1 OF 3 • VIDEO TELECONFERENCING',
      narrative: 'Launch high-definition video conferences powered by our on-device Indian Sign Language neural interpreter. Dual-way speech subtitles and 3D avatar signing for all participants.',
      pointerAngle: -35,
      targetId: 'tour-action-buttons',
      actionUrl: '/consultation/create',
      actionLabel: 'Open Meeting Room Lobby',
      actionIcon: Video,
    },
    {
      title: 'Cellular Telecom Voice Relay',
      badge: 'PHASE 2 OF 3 • TELECOM VOICE RELAY',
      narrative: 'Signers can place live telephone calls to any regular landline or mobile across India. Our AI speaks your signs aloud and signs back the caller\'s voice in live subtitles.',
      pointerAngle: -15,
      targetId: 'tour-telecom-relay',
      actionUrl: '/call-center',
      actionLabel: 'Open Telecom Relay Call Center',
      actionIcon: PhoneCall,
    },
    {
      title: 'Full System Workspace Primed',
      badge: 'PHASE 3 OF 3 • SYSTEM PRIMED',
      narrative: 'You are completely ready to test everything. Your 100 Starter Credits are active in your wallet. Click "Enter Platform" below to begin exploring your accessible workspace.',
      pointerAngle: 0,
      targetId: null,
      actionUrl: '/consultation/create',
      actionLabel: 'Enter Video Workspace',
      actionIcon: Video,
    },
  ];

  const current = steps[step] || steps[0];

  // Dynamic narrative for Act 1 cutscene stages
  const act1Dialogue = 
    act1Stage === 'greeting'
      ? "Namaste! I am your Sanket AI guide. I just touched down in my helicopter to welcome you to our accessible teleconferencing platform. Since you are a new member, I have brought your welcome package."
      : act1Stage === 'card_reveal'
      ? "Here is your luxury Sanket Platinum Pass. It is currently at 0 credits. Click the button below to claim your free welcome balance."
      : act1Stage === 'claiming'
      ? "Depositing 100 Free Starter Credits directly into your digital pass..."
      : act1Stage === 'claimed'
      ? "100 Free Credits have been successfully deposited! Now let me present your official Verified 3D Member Pass."
      : act1Stage === 'id_reveal'
      ? "Here is your official Sanket AI Digital Member Pass! It links your verified identity, on-device neural sign tracker, and wallet balance. Tap or hover over the card to inspect the reverse side."
      : "";

  // Typewriter effect
  useEffect(() => {
    const textToType = step === 0 ? act1Dialogue : current.narrative;
    setDisplayed('');
    setIsFinished(false);
    if (!textToType) return;

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < textToType.length) {
        setDisplayed(textToType.slice(0, idx + 1));
        idx++;
      } else {
        setIsFinished(true);
        clearInterval(interval);
      }
    }, 14);
    return () => clearInterval(interval);
  }, [step, act1Stage, act1Dialogue]);

  // Initial Sequence: Matches Login Screen Helicopter Drop Physics
  useEffect(() => {
    let r1: number, r2: number;
    setDropped(false);
    setHelicVisible(true);
    setIsLanding(false);
    setAct1Stage('dropping');
    setCardCredits(0);

    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setDropped(true);
        // Landing bounce
        setTimeout(() => setIsLanding(true), 900);
        setTimeout(() => setIsLanding(false), 1150);
        // Helicopter lifts off and fades away
        setTimeout(() => setHelicVisible(false), 1100);
        // Character stands up and speaks
        setTimeout(() => setAct1Stage('greeting'), 1400);
      });
    });

    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  // ── DYNAMIC COMPONENT FOCUS (Acts 1–3 on Dashboard) ──────────────────────
  // Elevates target component with clean, professional shadow — NO thick orange borders!
  useEffect(() => {
    if (step === 0) return;

    const targetId = steps[step]?.targetId;
    if (!targetId) return;

    const el = document.getElementById(targetId);
    if (!el) return;

    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}

    const originalPosition = el.style.position;
    const originalZIndex = el.style.zIndex;
    const originalBoxShadow = el.style.boxShadow;
    const originalTransition = el.style.transition;

    el.style.position = 'relative';
    el.style.zIndex = '40';
    el.style.boxShadow = '0 12px 30px -4px rgba(0, 0, 0, 0.15)';
    el.style.transition = 'box-shadow 0.3s ease, z-index 0.3s ease, transform 0.3s ease';

    return () => {
      el.style.position = originalPosition;
      el.style.zIndex = originalZIndex;
      el.style.boxShadow = originalBoxShadow;
      el.style.transition = originalTransition;
    };
  }, [step]);

  // Handler: Reveal Card
  const handleRevealCard = () => {
    setAct1Stage('card_reveal');
  };

  // Handler: User clicks "Claim 100 Free Credits"
  const handleClaimCredits = () => {
    setAct1Stage('claiming');
    
    // Smooth ticker animation: 0 -> 100
    const ticker = [0, 8, 19, 35, 52, 68, 83, 94, 100];
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx < ticker.length) {
        setCardCredits(ticker[idx]);
      } else {
        setCardCredits(100);
        setAct1Stage('claimed');
        clearInterval(interval);
      }
    }, 45);
  };

  // Handler: Reveal the ID Card Pass right in the cutscene!
  const handleRevealIdPass = () => {
    setAct1Stage('id_reveal');
  };

  // Transition from cutscene to dashboard tour
  const handleStartDashboardTour = () => {
    setStep(1);
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('sanket_onboarding_completed', 'true');
    } catch {}
    onClose();
  };

  return (
    <>
      {/* ──────────────────────────────────────────────────────────── */}
      {/* CUTSCENE MODAL: MASCOT ARRIVAL + CREDIT CARD + ID CARD PASS   */}
      {/* ──────────────────────────────────────────────────────────── */}
      {step === 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#060a12]/96 animate-in fade-in duration-300 select-none font-body overflow-y-auto min-h-[100dvh]">
          
          {/* Radial Spotlight Beam */}
          <div 
            className="fixed inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 50% 40%, rgba(249, 115, 22, 0.18) 0%, rgba(15, 23, 42, 0.6) 60%, rgba(2, 6, 23, 0.95) 100%)',
            }}
          />

          {act1Stage === 'id_reveal' ? (
            /* ── ID REVEAL STAGE: RESPONSIVE SIDE-BY-SIDE ON ONE SCREEN ── */
            /* Mobile: Fluid stacked with compact height                   */
            /* Tablet/Desktop: Side-by-side with 3D Lanyard & Guide text   */
            <div className="relative z-10 max-w-5xl w-full flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-10 my-auto py-2 px-2 sm:px-4 animate-in fade-in zoom-in-95 duration-500">
              
              {/* LEFT: 3D Three.js WebGL Lanyard (Responsive Canvas Sizing) */}
              <div className="relative flex flex-col items-center shrink-0 w-full md:w-auto">
                <div className="w-full max-w-[280px] xs:max-w-[320px] sm:max-w-[350px] md:w-[380px] h-[310px] xs:h-[350px] sm:h-[400px] md:h-[460px] relative rounded-3xl overflow-hidden flex items-center justify-center">
                  {localBadgeTextures ? (
                    <Lanyard
                      frontImage={localBadgeTextures.frontDataUrl}
                      backImage={localBadgeTextures.backDataUrl}
                      strapImage={localBadgeTextures.strapDataUrl}
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
                      <span className="text-[11px] font-mono text-slate-400">Loading 3D Cloth Physics...</span>
                    </div>
                  )}

                  {/* Clean Hint Badge */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none px-3.5 py-1 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-[9px] sm:text-[10px] font-mono text-orange-300 font-bold flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Drag strap or tap card to flip in 3D</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: Mascot + Dialogue Guide Text + Explore Button */}
              <div className="flex flex-col items-center md:items-start text-left max-w-md w-full space-y-3.5 sm:space-y-4">
                
                {/* Mascot header */}
                <div className="flex items-center gap-3 w-full">
                  <AuthenticMascot 
                    withStick={true}
                    isLanding={false}
                    pointerAngle={-20}
                    className="w-16 sm:w-20 md:w-22 h-auto shrink-0"
                  />
                  <div className="space-y-0.5 sm:space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] sm:text-[11px] font-mono font-bold text-orange-400 uppercase tracking-wider">
                        OFFICIAL 3D MEMBER PASS
                      </span>
                    </div>
                    <h3 className="font-heading font-black text-base sm:text-xl text-white tracking-tight leading-snug">
                      Digital Identity Verified
                    </h3>
                  </div>
                </div>

                {/* Tutorial Dialogue Bubble */}
                <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-md space-y-3.5 sm:space-y-4 font-body">
                  
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[11px] sm:text-xs font-bold text-orange-400 uppercase tracking-wider font-mono">
                      Sanket AI Member Credentials
                    </span>
                    <button 
                      onClick={handleComplete}
                      className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Typewriter text */}
                  <p className="font-body text-xs sm:text-sm md:text-base text-slate-100 font-medium leading-relaxed min-h-[48px] sm:min-h-[56px]">
                    {displayed}
                    {!isFinished && (
                      <span className="inline-block w-1.5 sm:w-2 h-3.5 sm:h-4 ml-1 bg-orange-400 animate-pulse align-middle" />
                    )}
                  </p>

                  {/* Action button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                    <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 font-bold hidden sm:inline">
                      Starter Package Primed
                    </span>
                    <button
                      onClick={handleStartDashboardTour}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-heading font-extrabold text-xs sm:text-sm shadow-lg shadow-orange-500/30 transition flex items-center justify-center gap-2 cursor-pointer transform hover:scale-105"
                    >
                      <span>Explore Platform Features</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="relative z-10 max-w-xl w-full flex flex-col items-center text-center space-y-4 my-auto py-6">
              
              {/* ── STAGE 1: HELICOPTER DROP CANVAS ── */}
              <div className="relative w-full h-36 sm:h-40 flex flex-col items-center justify-end overflow-visible">
                
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transform: dropped ? 'translate3d(0, 0, 0)' : 'translate3d(0, -110vh, 0)',
                    transition: dropped ? 'transform 0.95s cubic-bezier(0.22, 1.45, 0.36, 1)' : 'none',
                    willChange: 'transform',
                  }}
                >
                  {/* Helicopter sitting above Character */}
                  <div 
                    style={{
                      position: 'absolute',
                      top: -75,
                      left: '50%',
                      transform: 'translate3d(-50%, 0, 0)',
                      opacity: helicVisible ? 1 : 0,
                      transition: 'opacity 0.4s ease, transform 0.6s ease',
                      willChange: 'transform, opacity',
                    }}
                  >
                    <MiniHelicopter isFlying={true} />
                  </div>

                  {/* Character */}
                  <div style={{ animation: dropped && act1Stage !== 'dropping' ? 'floatBob 3s ease-in-out infinite' : undefined }}>
                    <AuthenticMascot 
                      withStick={act1Stage !== 'dropping'}
                      isLanding={isLanding}
                      pointerAngle={act1Stage === 'card_reveal' || act1Stage === 'claiming' ? 25 : -25}
                      className="w-24 sm:w-28 h-auto"
                    />
                  </div>

                  {/* Landing Dust Ring */}
                  {isLanding && (
                    <div className="absolute bottom-1 w-32 h-4 rounded-full bg-orange-400/50 blur-xs animate-ping" />
                  )}
                </div>
              </div>

              {/* ── STAGE 2A: CREDIT CARD REVEAL (OBSIDIAN/GOLD LUXURY THEME) ── */}
              {(act1Stage === 'card_reveal' || act1Stage === 'claiming' || act1Stage === 'claimed') && (
                <div 
                  className="relative flex flex-col items-center justify-center w-full my-2 animate-in fade-in zoom-in-95 duration-500"
                >
                  {/* Glowing Aura behind Card */}
                  <div className="absolute -inset-6 bg-gradient-to-r from-orange-400/25 via-amber-300/20 to-orange-500/25 rounded-3xl blur-2xl animate-pulse pointer-events-none" />

                  <FlippableCreditCard 
                    cardholderName={userName}
                    cardNumber="•••• •••• •••• 7381"
                    expiryDate="LIFETIME PASS"
                    cvv="738"
                    credits={cardCredits}
                    className="shadow-2xl hover:scale-105 transition-transform duration-300"
                  />

                  {/* Flip Hint */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-mono text-orange-200/90 bg-slate-900/80 border border-orange-500/30 px-3.5 py-1 rounded-full backdrop-blur-sm shadow-md">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span>Hover or tap card to inspect back</span>
                  </div>
                </div>
              )}

              {/* ── STAGE 3: DIALOGUE BUBBLE & ACTION BUTTONS ── */}
              {act1Stage !== 'dropping' && (
                <div className="w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-md text-left space-y-4 animate-in slide-in-from-bottom-4 duration-500 font-body">
                  
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-orange-400 uppercase tracking-wider font-mono">
                        {act1Stage === 'greeting' && 'Sanket Guide • Mascot Arrival'}
                        {(act1Stage === 'card_reveal' || act1Stage === 'claiming' || act1Stage === 'claimed') && 'Sanket Platinum Membership Pass'}
                      </span>
                    </div>
                    <button 
                      onClick={handleComplete}
                      className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Typewriter Dialogue */}
                  <p className="font-body text-sm sm:text-base text-slate-100 font-medium leading-relaxed min-h-[48px]">
                    {displayed}
                    {!isFinished && (
                      <span className="inline-block w-2 h-4 ml-1 bg-orange-400 animate-pulse align-middle" />
                    )}
                  </p>

                  {/* Dynamic Contextual Action Buttons (Clean geometric Lucide icons, no emojis) */}
                  <div className="pt-1 flex items-center justify-between">
                    
                    {/* Progress Indicators */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-1.5 rounded-full bg-orange-500" />
                      <div className="w-2 h-1.5 rounded-full bg-slate-700" />
                      <div className="w-2 h-1.5 rounded-full bg-slate-700" />
                    </div>

                    {/* 1. Greeting Phase: Click to Reveal Card */}
                    {act1Stage === 'greeting' && (
                      <button
                        onClick={handleRevealCard}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-heading font-extrabold text-xs sm:text-sm shadow-lg shadow-orange-500/25 transition flex items-center gap-2 cursor-pointer transform hover:scale-105"
                      >
                        <CreditCard className="w-4 h-4 text-white" />
                        <span>Reveal Starter Pass</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {/* 2. Card Reveal Phase: Click to Claim 100 Credits */}
                    {act1Stage === 'card_reveal' && (
                      <button
                        onClick={handleClaimCredits}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-heading font-extrabold text-xs sm:text-sm shadow-xl shadow-orange-500/30 transition flex items-center gap-2 cursor-pointer transform hover:scale-105 animate-pulse"
                      >
                        <CheckCircle2 className="w-4 h-4 text-yellow-200" />
                        <span>Claim 100 Free Credits</span>
                      </button>
                    )}

                    {/* 3. Claiming Phase: Rolling Counter in progress */}
                    {act1Stage === 'claiming' && (
                      <div className="px-6 py-2.5 rounded-full bg-slate-800 text-orange-300 font-mono text-xs sm:text-sm font-bold flex items-center gap-2 border border-slate-700">
                        <span className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        <span>Depositing +100 Credits...</span>
                      </div>
                    )}

                    {/* 4. Claimed Phase: Reveal Official 3D ID Pass */}
                    {act1Stage === 'claimed' && (
                      <button
                        onClick={handleRevealIdPass}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-heading font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/30 transition flex items-center gap-2 cursor-pointer transform hover:scale-105"
                      >
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span>Reveal Official Member Pass</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                  </div>
                </div>
              )}

              <style>{`
                @keyframes floatBob {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-7px); }
                }
              `}</style>

            </div>
          )}
        </div>
      ) : (
        /* ──────────────────────────────────────────────────────────── */
        /* DASHBOARD TOUR: DOCKED AT BOTTOM-LEFT (NEVER BLOCKS RIGHT)   */
        /* ──────────────────────────────────────────────────────────── */
        <>
          {/* Subtle Dim Backdrop: Focuses dashboard without harsh borders */}
          <div className="fixed inset-0 bg-slate-950/40 z-30 pointer-events-none transition-opacity duration-300" />

          {/* Clean Bottom-Left Docked Companion Card (Responsive: Full-width sheet on mobile, docked left on desktop) */}
          <div className="fixed bottom-3 sm:bottom-6 inset-x-3 sm:inset-x-auto sm:left-8 z-50 sm:max-w-md pointer-events-auto font-body animate-in slide-in-from-bottom-5 duration-300 select-none">
            <div className="relative bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl shadow-slate-900/15 text-slate-900 space-y-3 sm:space-y-3.5">
              
              {/* Mascot Sitting Proudly on Left / Top-Left */}
              <div className="absolute -top-12 sm:-top-14 left-3 sm:left-4 shrink-0 pointer-events-none">
                <AuthenticMascot 
                  withStick={true}
                  pointerAngle={current.pointerAngle}
                  className="w-16 sm:w-20 md:w-24 h-auto"
                />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-2 pl-16 sm:pl-20 md:pl-24">
                <div className="space-y-0.5 truncate pr-2">
                  {current.badge && (
                    <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-orange-600">
                      {current.badge}
                    </span>
                  )}
                  <h3 className="font-heading font-black text-sm sm:text-base text-slate-900 truncate tracking-tight">
                    {current.title}
                  </h3>
                </div>
                <button 
                  onClick={handleComplete}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Narrative Typewriter (Clean modern Inter font) */}
              <p className="font-body text-xs sm:text-sm text-slate-700 font-medium leading-relaxed min-h-[50px] pl-1">
                {displayed}
                {!isFinished && (
                  <span className="inline-block w-1.5 h-3 ml-1 bg-orange-500 animate-pulse align-middle" />
                )}
              </p>

              {/* Contextual Action: Direct "Open Page" Link */}
              {current.actionUrl && (
                <div className="pt-0.5">
                  <Link
                    href={current.actionUrl}
                    target="_blank"
                    className="w-full inline-flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 font-heading font-bold text-xs transition group shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-heading font-bold">{current.actionLabel}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-orange-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Link>
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                <button
                  onClick={handlePrev}
                  className="px-3.5 py-1.5 rounded-full border border-slate-200 text-xs font-heading font-bold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                {/* Progress Dots */}
                <div className="flex items-center gap-1.5">
                  {steps.slice(1).map((_, idx) => (
                    <div 
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === step - 1 ? 'w-5 bg-orange-500' : 'w-1.5 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  className="px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-heading font-extrabold text-xs shadow-md shadow-orange-500/25 transition flex items-center gap-1 cursor-pointer transform hover:scale-105"
                >
                  <span>{step === steps.length - 1 ? 'Enter Platform' : 'Next'}</span>
                  {step < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
};
