'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, ArrowLeft } from 'lucide-react';

type Mood = 'new' | 'returning' | 'lost' | null;

// ─────────────────────────────────────────────────────────────────────────────
// TYPEWRITER HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 34, active = false) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return;
    setDisplayed(''); setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed, active]);
  return { displayed, done };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHIBI CHARACTER — kawaii proportions: huge head, tiny body, big sparkle eyes
// ─────────────────────────────────────────────────────────────────────────────
function Character({ mood, isPasswordFocused, blink }: {
  mood: Mood; isPasswordFocused: boolean; blink: boolean;
}) {
  const skin    = '#FDDBB4';
  const skinSh  = '#F0BC8A';
  const skinLit = '#FFF0D6';

  const hC  = mood === 'new' ? '#9333ea' : mood === 'returning' ? '#1e293b' : mood === 'lost' ? '#f59e0b' : '#f97316';
  const hS  = mood === 'new' ? '#c084fc' : mood === 'returning' ? '#475569' : mood === 'lost' ? '#fcd34d' : '#fdba74';
  const sC  = mood === 'new' ? '#8b5cf6' : mood === 'returning' ? '#3b82f6' : mood === 'lost' ? '#f97316' : '#f97316';
  const sSh = mood === 'new' ? '#c4b5fd' : mood === 'returning' ? '#93c5fd' : mood === 'lost' ? '#fdba74' : '#fdba74';
  const iC  = mood === 'new' ? '#7c3aed' : mood === 'returning' ? '#1d4ed8' : mood === 'lost' ? '#ea580c' : '#f97316';
  const iS  = mood === 'new' ? '#a78bfa' : mood === 'returning' ? '#60a5fa' : mood === 'lost' ? '#fb923c' : '#fdba74';

  return (
    <svg width="190" height="235" viewBox="0 0 190 235" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 14px 36px rgba(0,0,0,0.13))', overflow: 'visible' }}>
      <defs>
        <radialGradient id="kFace" cx="38%" cy="30%" r="62%">
          <stop offset="0%"   stopColor={skinLit}/>
          <stop offset="55%"  stopColor={skin}/>
          <stop offset="100%" stopColor={skinSh}/>
        </radialGradient>
        <radialGradient id="kEyeW" cx="28%" cy="22%" r="68%">
          <stop offset="0%"   stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#eef0fb"/>
        </radialGradient>
        <radialGradient id="kIris" cx="28%" cy="22%" r="68%">
          <stop offset="0%"   stopColor={iS}/>
          <stop offset="100%" stopColor={iC}/>
        </radialGradient>
        <radialGradient id="kHair" cx="35%" cy="28%" r="65%">
          <stop offset="0%"   stopColor={hS}/>
          <stop offset="100%" stopColor={hC}/>
        </radialGradient>
        <linearGradient id="kShirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={sSh}/>
          <stop offset="100%" stopColor={sC}/>
        </linearGradient>
        <filter id="blurCh"><feGaussianBlur stdDeviation="3.5"/></filter>
        <filter id="blurSh"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="95" cy="231" rx="42" ry="7" fill="rgba(0,0,0,0.07)" filter="url(#blurSh)"/>

      {/* ──────────── BODY (tiny chibi) ──────────── */}
      <path d="M67 172 Q56 196 53 228 L137 228 Q134 196 123 172 Z" fill="url(#kShirt)"/>
      {/* Shirt sheen stripe */}
      <path d="M82 172 Q76 184 77 200" stroke="rgba(255,255,255,0.4)" strokeWidth="5" strokeLinecap="round" fill="none"/>
      {/* Collar V */}
      <path d="M82 172 Q95 180 108 172" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" strokeLinecap="round" fill="none"/>

      {/* ──────────── ARMS ──────────── */}
      <path d="M68 178 Q46 196 48 218" stroke={sC} strokeWidth="20" strokeLinecap="round" fill="none"/>
      {/* Left hand — round */}
      <circle cx="48" cy="219" r="14" fill={skin}/>
      <circle cx="48" cy="214" r="9"  fill={skinLit}/>
      <path d="M122 178 Q144 196 142 218" stroke={sC} strokeWidth="20" strokeLinecap="round" fill="none"/>
      {/* Right hand — round */}
      <circle cx="142" cy="219" r="14" fill={skin}/>
      <circle cx="142" cy="214" r="9"  fill={skinLit}/>
      {/* Arm sheen */}
      <path d="M62 182 Q52 198 52 210" stroke={sSh} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.45"/>

      {/* Neck */}
      <rect x="87" y="156" width="16" height="20" rx="8" fill={skin}/>

      {/* ──────────── BIG ROUND HEAD ──────────── */}
      {/* Ear left */}
      <ellipse cx="44" cy="116" rx="11" ry="14" fill={skin}/>
      <ellipse cx="44" cy="116" rx="6.5" ry="9" fill={skinSh} opacity="0.3"/>
      <ellipse cx="43" cy="112" rx="3.5" ry="5.5" fill="#e8a87c" opacity="0.4"/>
      {/* Ear right */}
      <ellipse cx="146" cy="116" rx="11" ry="14" fill={skin}/>
      <ellipse cx="146" cy="116" rx="6.5" ry="9" fill={skinSh} opacity="0.3"/>
      <ellipse cx="147" cy="112" rx="3.5" ry="5.5" fill="#e8a87c" opacity="0.4"/>
      {/* Head — large chibi */}
      <ellipse cx="95" cy="113" rx="53" ry="55" fill="url(#kFace)"/>
      {/* Chin roundness */}
      <ellipse cx="95" cy="155" rx="44" ry="20" fill={skin} opacity="0.22"/>

      {/* ──────────── HAIR ──────────── */}
      {(mood === 'new' || !mood) && (
        <g>
          {/* Fluffy puff base */}
          <circle cx="95"  cy="65"  r="30" fill="url(#kHair)"/>
          <circle cx="62"  cy="76"  r="24" fill="url(#kHair)"/>
          <circle cx="128" cy="76"  r="24" fill="url(#kHair)"/>
          <circle cx="72"  cy="60"  r="22" fill="url(#kHair)"/>
          <circle cx="118" cy="60"  r="22" fill="url(#kHair)"/>
          <circle cx="95"  cy="55"  r="24" fill="url(#kHair)"/>
          {/* Spiky tips */}
          <ellipse cx="74"  cy="44" rx="8" ry="15" fill={hC} transform="rotate(-20,74,44)"/>
          <ellipse cx="95"  cy="39" rx="8" ry="17" fill={hC}/>
          <ellipse cx="116" cy="44" rx="8" ry="15" fill={hC} transform="rotate(20,116,44)"/>
          <ellipse cx="58"  cy="58" rx="7" ry="13" fill={hC} transform="rotate(-35,58,58)"/>
          <ellipse cx="132" cy="58" rx="7" ry="13" fill={hC} transform="rotate(35,132,58)"/>
          {/* Sheen */}
          <ellipse cx="76" cy="64" rx="16" ry="8" fill="rgba(255,255,255,0.32)" transform="rotate(-22,76,64)"/>
        </g>
      )}
      {mood === 'returning' && (
        <g>
          <circle cx="95"  cy="66"  r="32" fill="url(#kHair)"/>
          <circle cx="62"  cy="78"  r="26" fill="url(#kHair)"/>
          <circle cx="128" cy="78"  r="26" fill="url(#kHair)"/>
          <path d="M50 92 Q66 62 95 70 Q124 62 140 92" fill="url(#kHair)"/>
          {/* Neat side part shine */}
          <path d="M82 63 Q89 54 98 63" stroke={hS} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.55"/>
          <ellipse cx="74" cy="68" rx="16" ry="7" fill="rgba(255,255,255,0.24)" transform="rotate(-18,74,68)"/>
        </g>
      )}
      {mood === 'lost' && (
        <g>
          <circle cx="95"  cy="68"  r="32" fill="url(#kHair)"/>
          <circle cx="60"  cy="78"  r="26" fill="url(#kHair)"/>
          <circle cx="130" cy="78"  r="26" fill="url(#kHair)"/>
          {/* Wild messy tufts */}
          <ellipse cx="60"  cy="55" rx="10" ry="20" fill={hC} transform="rotate(-32,60,55)"/>
          <ellipse cx="80"  cy="46" rx="9"  ry="18" fill={hC} transform="rotate(-12,80,46)"/>
          <ellipse cx="104" cy="45" rx="9"  ry="18" fill={hC} transform="rotate(14,104,45)"/>
          <ellipse cx="124" cy="55" rx="10" ry="20" fill={hC} transform="rotate(30,124,55)"/>
          <ellipse cx="72"  cy="66" rx="14" ry="6"  fill="rgba(255,255,255,0.22)" transform="rotate(-28,72,66)"/>
        </g>
      )}

      {/* ──────────── CHEEK BLUSH ──────────── */}
      <ellipse cx="55"  cy="127" rx="16" ry="10" fill="#ff8fab" opacity="0.3"  filter="url(#blurCh)"/>
      <ellipse cx="135" cy="127" rx="16" ry="10" fill="#ff8fab" opacity="0.3"  filter="url(#blurCh)"/>
      {/* Tiny sparkle dots on cheeks */}
      <circle cx="51"  cy="124" r="2.2" fill="#fda4af" opacity="0.55"/>
      <circle cx="57"  cy="129" r="1.5" fill="#fda4af" opacity="0.45"/>
      <circle cx="139" cy="124" r="2.2" fill="#fda4af" opacity="0.55"/>
      <circle cx="133" cy="129" r="1.5" fill="#fda4af" opacity="0.45"/>

      {/* ──────────── EYES ──────────── */}
      {isPasswordFocused ? (
        /* Round chubby hands cover both eyes */
        <g>
          {/* Left hand blobs */}
          <circle cx="72"  cy="114" r="21" fill={skin}/>
          <circle cx="54"  cy="106" r="13" fill={skin}/>
          <circle cx="57"  cy="95"  r="11" fill={skin}/>
          <circle cx="69"  cy="91"  r="11" fill={skin}/>
          <circle cx="81"  cy="93"  r="11" fill={skin}/>
          <circle cx="90"  cy="102" r="11" fill={skin}/>
          <ellipse cx="72" cy="118" rx="20" ry="9" fill={skinSh} opacity="0.28"/>
          {/* Right hand blobs */}
          <circle cx="118" cy="114" r="21" fill={skin}/>
          <circle cx="136" cy="106" r="13" fill={skin}/>
          <circle cx="133" cy="95"  r="11" fill={skin}/>
          <circle cx="121" cy="91"  r="11" fill={skin}/>
          <circle cx="109" cy="93"  r="11" fill={skin}/>
          <circle cx="100" cy="102" r="11" fill={skin}/>
          <ellipse cx="118" cy="118" rx="20" ry="9" fill={skinSh} opacity="0.28"/>
          {/* Knuckle shine dots */}
          <circle cx="60"  cy="96"  r="3" fill={skinLit} opacity="0.7"/>
          <circle cx="70"  cy="92"  r="3" fill={skinLit} opacity="0.7"/>
          <circle cx="81"  cy="94"  r="3" fill={skinLit} opacity="0.7"/>
          <circle cx="120" cy="92"  r="3" fill={skinLit} opacity="0.7"/>
          <circle cx="130" cy="96"  r="3" fill={skinLit} opacity="0.7"/>
          {/* Eyebrows peeking over hands */}
          <path d="M57 88 Q72 81 87 88" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          <path d="M103 88 Q118 81 133 88" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
        </g>
      ) : (
        /* Open kawaii eyes */
        <g>
          {/* Eye whites — large tall oval */}
          <ellipse cx="72"  cy="113" rx="18" ry="20" fill="url(#kEyeW)"/>
          <ellipse cx="118" cy="113" rx="18" ry="20" fill="url(#kEyeW)"/>
          {/* Iris — big & radial gradient */}
          <circle cx="73"  cy="115" r={blink ? 1 : 14} fill="url(#kIris)" style={{ transition: 'r 0.09s ease' }}/>
          <circle cx="119" cy="115" r={blink ? 1 : 14} fill="url(#kIris)" style={{ transition: 'r 0.09s ease' }}/>
          {/* Pupil */}
          <circle cx="74"  cy="116" r={blink ? 0.5 : 7.5} fill="#0f172a" style={{ transition: 'r 0.09s ease' }}/>
          <circle cx="120" cy="116" r={blink ? 0.5 : 7.5} fill="#0f172a" style={{ transition: 'r 0.09s ease' }}/>
          {/* Big main sparkle */}
          <circle cx="79"  cy="109" r="4.5" fill="white" opacity="0.96"/>
          <circle cx="125" cy="109" r="4.5" fill="white" opacity="0.96"/>
          {/* Small secondary sparkle */}
          <circle cx="66"  cy="119" r="2.2" fill="white" opacity="0.65"/>
          <circle cx="112" cy="119" r="2.2" fill="white" opacity="0.65"/>
          {/* Tiny tertiary */}
          <circle cx="80"  cy="120" r="1.4" fill="white" opacity="0.5"/>
          <circle cx="126" cy="120" r="1.4" fill="white" opacity="0.5"/>
          {/* Lash arch */}
          <path d="M54 103 Q72 94 90 103"  stroke={hC} strokeWidth="3.8" strokeLinecap="round" fill="none"/>
          <path d="M100 103 Q118 94 136 103" stroke={hC} strokeWidth="3.8" strokeLinecap="round" fill="none"/>
          {/* Individual lash spikes */}
          {[
            [55, 103, 52, 96], [63, 99, 62, 92], [72, 96, 72, 89],
            [81, 99, 83, 92], [89, 103, 92, 96],
            [101, 103, 98, 96], [109, 99, 108, 92], [118, 96, 118, 89],
            [127, 99, 129, 92], [135, 103, 138, 96],
          ].map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={hC} strokeWidth="2.2" strokeLinecap="round"/>
          ))}
          {/* Eyebrows */}
          {(mood === 'new' || !mood) && <>
            <path d="M57 92 Q72 85 87 92"  stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
            <path d="M103 92 Q118 85 133 92" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          </>}
          {mood === 'returning' && <>
            <path d="M57 94 Q72 87 87 94"  stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
            <path d="M103 94 Q118 87 133 94" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          </>}
          {mood === 'lost' && <>
            <path d="M57 92 Q64 86 72 92 Q80 98 87 92"   stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
            <path d="M103 92 Q110 98 118 92 Q126 86 133 92" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          </>}
        </g>
      )}

      {/* ──────────── NOSE — tiny button ──────────── */}
      <circle cx="95" cy="132" r="4" fill={skinSh} opacity="0.55"/>
      <circle cx="92" cy="131" r="2" fill={skinLit} opacity="0.5"/>

      {/* ──────────── MOUTH ──────────── */}
      {!isPasswordFocused && (mood === 'new' || !mood) && (
        /* Big happy cat smile with white teeth */
        <g>
          <path d="M72 143 Q95 164 118 143" fill="#1a1a2e"/>
          <path d="M72 143 Q95 161 118 143 L116 148 Q95 167 74 148 Z" fill="white"/>
          <path d="M72 143 Q95 164 118 143" fill="none" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round"/>
          <ellipse cx="95" cy="153" rx="18" ry="9" fill="#fda4af" opacity="0.5"/>
        </g>
      )}
      {!isPasswordFocused && mood === 'returning' && (
        <path d="M78 142 Q95 154 112 142" fill="none" stroke="#1a1a2e" strokeWidth="3.5" strokeLinecap="round"/>
      )}
      {!isPasswordFocused && mood === 'lost' && (
        <path d="M76 144 Q84 138 92 144 Q100 150 108 144" fill="none" stroke="#1a1a2e" strokeWidth="3.5" strokeLinecap="round"/>
      )}
      {isPasswordFocused && (
        <ellipse cx="95" cy="146" rx="10" ry="8" fill="#1a1a2e" opacity="0.7"/>
      )}

      {/* ──────────── FLOATING MOOD EMOJIS ──────────── */}
      {!mood && <>
        <text x="20"  y="74" fontSize="16" style={{ animation: 'floatyA 2.4s ease-in-out infinite' }}>👋</text>
        <text x="156" y="82" fontSize="13" style={{ animation: 'floatyB 3s ease-in-out 0.6s infinite' }}>✨</text>
      </>}
      {mood === 'new' && <>
        <text x="18"  y="70" fontSize="16" style={{ animation: 'floatyA 2.2s ease-in-out infinite' }}>✨</text>
        <text x="157" y="74" fontSize="14" style={{ animation: 'floatyB 2.8s ease-in-out 0.4s infinite' }}>⭐</text>
        <text x="158" y="102" fontSize="12" style={{ animation: 'floatyA 3.1s ease-in-out 0.8s infinite' }}>💜</text>
      </>}
      {mood === 'returning' && <>
        <text x="16"  y="76" fontSize="15" style={{ animation: 'floatyA 2.5s ease-in-out infinite' }}>💙</text>
        <text x="157" y="70" fontSize="16" style={{ animation: 'floatyB 3s ease-in-out 0.5s infinite' }}>👑</text>
      </>}
      {mood === 'lost' && <>
        <text x="14"  y="72" fontSize="16" style={{ animation: 'floatyA 2s ease-in-out infinite' }}>❓</text>
        <text x="157" y="76" fontSize="14" style={{ animation: 'floatyB 2.6s ease-in-out 0.3s infinite' }}>😵</text>
      </>}

      <style>{`
        @keyframes floatyA { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-10px) rotate(5deg)} }
        @keyframes floatyB { 0%,100%{transform:translateY(0) rotate(5deg)}  50%{transform:translateY(-12px) rotate(-5deg)} }
      `}</style>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG HELICOPTER
// ─────────────────────────────────────────────────────────────────────────────
function Helicopter() {
  return (
    <svg width="110" height="72" viewBox="0 0 110 72" xmlns="http://www.w3.org/2000/svg">
      <g style={{ transformOrigin: '55px 8px', animation: 'spinBlade 0.22s linear infinite' }}>
        <rect x="8" y="6" width="94" height="4" rx="2" fill="#475569"/>
        <circle cx="55" cy="8" r="5" fill="#94a3b8"/>
      </g>
      <rect x="53" y="9" width="4" height="10" fill="#64748b"/>
      <ellipse cx="55" cy="34" rx="28" ry="16" fill="#f97316"/>
      <ellipse cx="55" cy="34" rx="28" ry="16" fill="none" stroke="#ea580c" strokeWidth="1"/>
      <ellipse cx="46" cy="30" rx="14" ry="10" fill="#bae6fd" opacity="0.8"/>
      <ellipse cx="46" cy="30" rx="14" ry="10" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <path d="M80 34 Q98 30 104 22" stroke="#ea580c" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <ellipse cx="104" cy="22" rx="2" ry="9" fill="#475569"
        style={{ transformOrigin: '104px 22px', animation: 'spinBlade 0.17s linear infinite' }}/>
      <path d="M30 50 Q55 46 80 50" stroke="#64748b" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <line x1="37" y1="47" x2="37" y2="50" stroke="#94a3b8" strokeWidth="2.5"/>
      <line x1="73" y1="47" x2="73" y2="50" stroke="#94a3b8" strokeWidth="2.5"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTRO SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const QUESTION = "Hey! 👋 Are you visiting for the first time, or coming back?";

function IntroScreen({ onSelect }: { onSelect: (mood: Mood) => void }) {
  const [blink, setBlink]               = useState(false);
  const [dropped, setDropped]           = useState(false);
  const [helicVisible, setHelicVisible] = useState(true);
  const [postStage, setPostStage]       = useState(0);

  const { displayed, done: textDone } = useTypewriter(QUESTION, 34, postStage >= 1);

  useEffect(() => {
    if (!dropped) return;
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 110); }, 3200 + Math.random() * 1500);
    return () => clearInterval(t);
  }, [dropped]);

  useEffect(() => {
    let r1: number, r2: number;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setDropped(true);
        setTimeout(() => setHelicVisible(false), 950);
        setTimeout(() => setPostStage(1), 1450);
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  useEffect(() => {
    if (textDone && postStage === 1) {
      const t = setTimeout(() => setPostStage(2), 350);
      return () => clearTimeout(t);
    }
  }, [textDone, postStage]);

  return (
    <div className="min-h-screen bg-slate-50 bg-grid-lines flex flex-col items-center justify-center px-6 overflow-hidden relative">
      {/* Ambient blobs matching site */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-orange-400/20 via-purple-500/14 to-cyan-400/12 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute top-1/3 -left-24 w-72 h-72 bg-orange-300/18 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute top-1/3 -right-24 w-72 h-72 bg-purple-300/18 rounded-full blur-3xl pointer-events-none"/>

      {/* Top brand pill */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2"
        style={{ opacity: postStage >= 2 ? 1 : 0, transition: 'opacity 0.5s ease 0.3s' }}>
        <Link href="/" className="flex items-center gap-2.5 px-5 py-2.5 bg-white/90 border border-slate-200 rounded-full shadow-sm backdrop-blur-md">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center font-black text-white text-xs shadow-sm">S</div>
          <span className="font-extrabold text-slate-900 text-sm tracking-tight font-heading">Sanket AI</span>
        </Link>
      </div>

      {/* Helicopter + Character drop */}
      <div
        style={{
          position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
          transform: dropped ? 'translateY(0)' : 'translateY(-115vh)',
          transition: dropped ? 'transform 0.95s cubic-bezier(0.22, 1.5, 0.36, 1)' : 'none',
        }}
      >
        {/* Helicopter */}
        <div style={{
          position: 'absolute', top: -95, left: '50%', transform: 'translateX(-50%)',
          opacity: helicVisible ? 1 : 0, transition: 'opacity 0.4s ease',
        }}>
          <Helicopter/>
        </div>

        {/* Rope */}
        {helicVisible && (
          <div style={{
            position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
            width: '2px', height: '32px',
            background: 'repeating-linear-gradient(180deg,#94a3b8 0,#94a3b8 4px,transparent 4px,transparent 8px)',
          }}/>
        )}

        {/* Landing glow */}
        {dropped && (
          <div style={{
            position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
            width: '200px', height: '50px',
            background: 'radial-gradient(ellipse,rgba(249,115,22,0.16) 0%,transparent 75%)',
            animation: 'pulseGlow 2.5s ease-in-out infinite',
          }}/>
        )}

        {/* Character */}
        <div style={{ animation: dropped ? 'floatBob 3s ease-in-out 1.2s infinite' : undefined }}>
          <Character mood={null} isPasswordFocused={false} blink={blink}/>
        </div>

        {/* Speech bubble */}
        {postStage >= 1 && (
          <div style={{
            position: 'absolute', top: 16, left: '106%',
            minWidth: '225px', maxWidth: '255px',
            animation: 'bubblePop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
            zIndex: 20,
          }}>
            <div style={{
              background: 'white', borderRadius: '20px', padding: '15px 18px 13px',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <div style={{ height: '3px', background: 'linear-gradient(90deg,#f97316,#a855f7)', borderRadius: 99, marginBottom: 10 }}/>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.55, margin: 0 }}>
                {displayed}
                {!textDone && (
                  <span style={{
                    display: 'inline-block', width: '2px', height: '14px',
                    background: '#f97316', marginLeft: '2px', verticalAlign: 'middle',
                    animation: 'cursorBlink 0.6s step-end infinite',
                  }}/>
                )}
              </p>
            </div>
            {/* Tail */}
            <div style={{ position: 'absolute', top: '28px', left: '-11px', width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '13px solid white', filter: 'drop-shadow(-1px 0 1px rgba(0,0,0,0.06))' }}/>
            <div style={{ position: 'absolute', top: '27px', left: '-13.5px', width: 0, height: 0, borderTop: '11px solid transparent', borderBottom: '11px solid transparent', borderRight: '14px solid #e2e8f0', zIndex: -1 }}/>
          </div>
        )}
      </div>

      {/* 3 Buttons */}
      <div style={{
        marginTop: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '12px', width: '100%', maxWidth: '310px',
        opacity: postStage >= 2 ? 1 : 0,
        transform: postStage >= 2 ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        {([
          { mood: 'new' as Mood, icon: '🌟', label: 'New User', sub: 'First time here!', bg: '#f97316', hover: '#ea580c', shadow: 'rgba(249,115,22,0.3)' },
          { mood: 'returning' as Mood, icon: '👑', label: "I've Been Here", sub: 'Welcome back!', bg: '#0f172a', hover: '#1e293b', shadow: 'rgba(15,23,42,0.2)' },
          { mood: 'lost' as Mood, icon: '😅', label: 'I Forgot Everything', sub: 'Need some help', bg: '#7c3aed', hover: '#6d28d9', shadow: 'rgba(124,58,237,0.3)' },
        ] as const).map((opt, i) => (
          <button
            key={opt.mood}
            onClick={() => onSelect(opt.mood)}
            style={{
              width: '100%', background: opt.bg, border: 'none', borderRadius: '999px',
              padding: '13px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
              boxShadow: `0 6px 20px ${opt.shadow}`,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.15s ease',
              animation: postStage >= 2 ? `slideUpBtn 0.45s cubic-bezier(0.34,1.4,0.64,1) ${i * 75}ms both` : undefined,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px) scale(1.02)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 10px 28px ${opt.shadow}`;
              (e.currentTarget as HTMLButtonElement).style.background = opt.hover;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = '';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${opt.shadow}`;
              (e.currentTarget as HTMLButtonElement).style.background = opt.bg;
            }}
          >
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{opt.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 14.5 }}>{opt.label}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 1 }}>{opt.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: '1.8rem', opacity: postStage >= 2 ? 1 : 0, transition: 'opacity 0.5s ease 0.5s' }}>
        <Link href="/" className="text-xs text-slate-400 hover:text-orange-500 transition flex items-center gap-1 font-medium">
          <ArrowLeft className="w-3 h-3"/> Back to home
        </Link>
      </div>

      <style>{`
        @keyframes floatBob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes spinBlade   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes bubblePop   { 0%{opacity:0;transform:scale(0.5)} 100%{opacity:1;transform:scale(1)} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulseGlow   { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes slideUpBtn  { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN FORM
// ─────────────────────────────────────────────────────────────────────────────
const MOOD_META = {
  new: {
    badge: 'bg-orange-500 text-white', accentCls: 'from-orange-500 to-amber-400',
    btn: 'bg-orange-500 hover:bg-orange-600', btnShadow: 'shadow-orange-500/25',
    btnLabel: '🚀 Create My Account',
    greeting: "First time here? Welcome — let's get you set up!",
    emailPH: 'your-email@example.com', badgeLabel: '🌟 New User',
    hint: { text: 'Better yet,', link: 'Create an account →', href: '/auth/register' },
  },
  returning: {
    badge: 'bg-slate-900 text-white', accentCls: 'from-slate-700 to-slate-900',
    btn: 'bg-slate-900 hover:bg-slate-800', btnShadow: 'shadow-slate-900/20',
    btnLabel: '→ Sign Me In',
    greeting: 'Welcome back! Great to see you again.',
    emailPH: 'your@email.com', badgeLabel: '👑 Returning User',
    hint: { text: "Don't have an account?", link: 'Sign up free →', href: '/auth/register' },
  },
  lost: {
    badge: 'bg-violet-600 text-white', accentCls: 'from-violet-500 to-purple-600',
    btn: 'bg-violet-600 hover:bg-violet-700', btnShadow: 'shadow-violet-500/25',
    btnLabel: "🤞 Let's try signing in",
    greeting: "No stress! Try signing in or reset your password.",
    emailPH: 'hmm@letmethink.com', badgeLabel: '😅 Finding My Way',
    hint: { text: 'Not sure?', link: "Try signing up (it's free) →", href: '/auth/register' },
  },
};

function LoginForm({ mood, onBack }: { mood: Mood; onBack: () => void }) {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [pFocused, setPFocused] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [blink, setBlink]       = useState(false);
  const [visible, setVisible]   = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 40); }, []);
  useEffect(() => {
    if (pFocused) return;
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 110); }, 3200 + Math.random() * 1500);
    return () => clearInterval(t);
  }, [pFocused]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await signInWithEmail(email, password); router.push('/dashboard'); }
    catch (err: any) { setError(err.message || 'Failed to sign in.'); }
    finally { setLoading(false); }
  };
  const handleGoogle = async () => {
    setError('');
    try { await signInWithGoogle(); router.push('/dashboard'); }
    catch { setError('Google sign-in failed. Please try again.'); }
  };

  const cfg = mood ? MOOD_META[mood] : MOOD_META.returning;

  return (
    <div className="min-h-screen bg-slate-50 bg-grid-lines flex flex-col items-center justify-center px-4 overflow-hidden relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-orange-400/18 via-purple-400/12 to-cyan-400/10 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl pointer-events-none"/>

      <div className="flex flex-col items-center w-full max-w-sm"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-20px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}>

        <span className={`mb-3 inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-md ${cfg.badge}`}>
          {cfg.badgeLabel}
        </span>

        <div style={{ animation: 'floatBob2 3s ease-in-out infinite' }}>
          <Character mood={mood} isPasswordFocused={pFocused} blink={blink}/>
        </div>

        <div className="w-full mt-3 bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${cfg.accentCls}`}/>
          <div className="px-7 py-6">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-md shrink-0">
                  <span className="text-white font-black text-sm">S</span>
                </div>
                <span className="font-black text-slate-900 text-lg tracking-tight font-heading">Sanket AI</span>
              </Link>
            </div>
            <p className="text-center text-xs text-slate-500 mb-5 font-body leading-relaxed">{cfg.greeting}</p>

            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500"/>{error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={cfg.emailPH}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all placeholder:text-slate-400 font-body"/>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPFocused(true)} onBlur={() => setPFocused(false)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all placeholder:text-slate-400 font-body"/>
                {pFocused && (
                  <p className="mt-1.5 text-[11px] text-slate-400 animate-pulse">🙈 Not peeking! Your password is safe.</p>
                )}
              </div>
              <button type="submit" disabled={loading}
                className={`w-full py-3.5 rounded-2xl text-white font-black text-sm shadow-xl ${cfg.btn} ${cfg.btnShadow} transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60`}>
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>Signing in...
                    </span>
                  : cfg.btnLabel}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200"/>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">or</span>
              <div className="flex-1 border-t border-slate-200"/>
            </div>

            <button onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all hover:scale-[1.01] shadow-sm">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Continue with Google
            </button>

            <div className="mt-5 text-center space-y-2">
              <p className="text-xs text-slate-500">
                {cfg.hint.text}{' '}
                <Link href={cfg.hint.href} className="font-bold text-orange-500 hover:text-orange-600 transition">{cfg.hint.link}</Link>
              </p>
              <button onClick={onBack} className="text-xs text-slate-400 hover:text-purple-500 transition font-medium">← Go back</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatBob2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes spinBlade { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [phase, setPhase] = useState<'intro' | 'login'>('intro');
  const [mood,  setMood]  = useState<Mood>(null);
  const handleSelect = (m: Mood) => { setMood(m); setPhase('login'); };
  if (phase === 'intro') return <IntroScreen onSelect={handleSelect}/>;
  return <LoginForm mood={mood} onBack={() => { setPhase('intro'); setMood(null); }}/>;
}
