'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase/config';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type Mood = 'new' | 'returning' | 'lost' | null;

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
function Character({ mood, isPasswordFocused, blink, className = '' }: {
  mood: Mood; isPasswordFocused: boolean; blink: boolean; className?: string;
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
    <svg 
      viewBox="0 0 190 235" 
      xmlns="http://www.w3.org/2000/svg"
      className={className || "w-[150px] sm:w-[180px] h-auto"}
      style={{ filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.12))', overflow: 'visible' }}
    >
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
      <path d="M82 172 Q76 184 77 200" stroke="rgba(255,255,255,0.4)" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M82 172 Q95 180 108 172" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" strokeLinecap="round" fill="none"/>

      {/* ──────────── ARMS ──────────── */}
      <path d="M68 178 Q46 196 48 218" stroke={sC} strokeWidth="20" strokeLinecap="round" fill="none"/>
      <circle cx="48" cy="219" r="14" fill={skin}/>
      <circle cx="48" cy="214" r="9"  fill={skinLit}/>
      <path d="M122 178 Q144 196 142 218" stroke={sC} strokeWidth="20" strokeLinecap="round" fill="none"/>
      <circle cx="142" cy="219" r="14" fill={skin}/>
      <circle cx="142" cy="214" r="9"  fill={skinLit}/>
      <path d="M62 182 Q52 198 52 210" stroke={sSh} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.45"/>

      {/* Neck */}
      <rect x="87" y="156" width="16" height="20" rx="8" fill={skin}/>
      <ellipse cx="95" cy="164" rx="8" ry="4" fill={skinSh} opacity="0.45"/>

      {/* ──────────── EARS ──────────── */}
      <circle cx="34" cy="116" r="14" fill={skin}/>
      <circle cx="35" cy="116" r="9"  fill={skinSh}/>
      <circle cx="36" cy="116" r="5"  fill="#fda4af" opacity="0.5"/>
      <circle cx="156" cy="116" r="14" fill={skin}/>
      <circle cx="155" cy="116" r="9"  fill={skinSh}/>
      <circle cx="154" cy="116" r="5"  fill="#fda4af" opacity="0.5"/>

      {/* ──────────── HEAD ──────────── */}
      <ellipse cx="95" cy="110" rx="63" ry="58" fill="url(#kFace)"/>

      {/* ──────────── BLUSH (cheeks) ──────────── */}
      <ellipse cx="52"  cy="126" rx="14" ry="8" fill="#fb7185" opacity="0.45" filter="url(#blurCh)"/>
      <ellipse cx="138" cy="126" rx="14" ry="8" fill="#fb7185" opacity="0.45" filter="url(#blurCh)"/>
      <g stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round" opacity="0.65">
        <line x1="47" y1="123" x2="43" y2="128"/>
        <line x1="52" y1="122" x2="48" y2="129"/>
        <line x1="57" y1="123" x2="53" y2="128"/>
        <line x1="133" y1="123" x2="137" y2="128"/>
        <line x1="138" y1="122" x2="142" y2="129"/>
        <line x1="143" y1="123" x2="147" y2="128"/>
      </g>

      {/* ──────────── HAIR ──────────── */}
      <path d="M34 100 C32 64 56 46 95 46 C134 46 158 64 156 100 C154 91 146 83 138 84 C128 85 125 93 118 90 C110 86 110 76 95 76 C80 76 80 86 72 90 C65 93 62 85 52 84 C44 83 36 91 34 100 Z"
        fill="url(#kHair)"/>
      <path d="M84 46 Q95 24 106 46" fill={hC}/>
      <path d="M68 50 Q75 30 84 50" fill={hC}/>
      <path d="M106 50 Q115 30 122 50" fill={hC}/>
      <path d="M52 60 Q55 42 68 54" fill={hC}/>
      <path d="M122 54 Q135 42 138 60" fill={hC}/>
      <path d="M52 58 Q95 44 138 58" stroke={hS} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.45"/>

      {/* Side hair locks */}
      <path d="M33 96 Q28 116 35 132 Q38 120 37 106 Z" fill={hC}/>
      <path d="M157 96 Q162 116 155 132 Q152 120 153 106 Z" fill={hC}/>

      {/* ──────────── EYES ──────────── */}
      {isPasswordFocused ? (
        <g>
          <path d="M54 116 Q67 107 80 116" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" fill="none"/>
          <path d="M110 116 Q123 107 136 116" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" fill="none"/>
          <ellipse cx="67" cy="116" rx="6" ry="3" fill="#fda4af" opacity="0.7"/>
          <ellipse cx="123" cy="116" rx="6" ry="3" fill="#fda4af" opacity="0.7"/>
        </g>
      ) : blink ? (
        <g>
          <path d="M54 116 Q67 125 80 116" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" fill="none"/>
          <path d="M110 116 Q123 125 136 116" stroke="#1a1a2e" strokeWidth="4" strokeLinecap="round" fill="none"/>
        </g>
      ) : (
        <g>
          <ellipse cx="67" cy="112" rx="17" ry="20" fill="url(#kEyeW)"/>
          <ellipse cx="123" cy="112" rx="17" ry="20" fill="url(#kEyeW)"/>
          
          <ellipse cx="67" cy="112" rx="13" ry="16" fill="url(#kIris)"/>
          <ellipse cx="123" cy="112" rx="13" ry="16" fill="url(#kIris)"/>

          <ellipse cx="67" cy="112" rx="7" ry="9" fill="#0f172a"/>
          <ellipse cx="123" cy="112" rx="7" ry="9" fill="#0f172a"/>

          <circle cx="63" cy="106" r="4.5" fill="#ffffff"/>
          <circle cx="72" cy="117" r="2.2" fill="#ffffff"/>
          <circle cx="119" cy="106" r="4.5" fill="#ffffff"/>
          <circle cx="128" cy="117" r="2.2" fill="#ffffff"/>
        </g>
      )}

      {/* ──────────── EYEBROWS ──────────── */}
      {!isPasswordFocused && (
        <g>
          {(mood === 'new' || !mood) && <>
            <path d="M56 88 Q67 80 78 88" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
            <path d="M112 88 Q123 80 134 88" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          </>}
          {mood === 'returning' && <>
            <path d="M57 94 Q72 87 87 94" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
            <path d="M103 94 Q118 87 133 94" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          </>}
          {mood === 'lost' && <>
            <path d="M57 92 Q64 86 72 92 Q80 98 87 92" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
            <path d="M103 92 Q110 98 118 92 Q126 86 133 92" stroke={hC} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          </>}
        </g>
      )}

      {/* ──────────── NOSE ──────────── */}
      <circle cx="95" cy="132" r="4" fill={skinSh} opacity="0.55"/>
      <circle cx="92" cy="131" r="2" fill={skinLit} opacity="0.5"/>

      {/* ──────────── MOUTH ──────────── */}
      {!isPasswordFocused && (mood === 'new' || !mood) && (
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

      {/* Floating Sparkles */}
      {!mood && <>
        <text x="20" y="74" fontSize="16" style={{ animation: 'floatyA 2.4s ease-in-out infinite' }}>👋</text>
        <text x="156" y="82" fontSize="13" style={{ animation: 'floatyB 3s ease-in-out 0.6s infinite' }}>✨</text>
      </>}
      {mood === 'new' && <>
        <text x="18" y="70" fontSize="16" style={{ animation: 'floatyA 2.2s ease-in-out infinite' }}>✨</text>
        <text x="157" y="74" fontSize="14" style={{ animation: 'floatyB 2.8s ease-in-out 0.4s infinite' }}>⭐</text>
      </>}
      {mood === 'returning' && <>
        <text x="16" y="76" fontSize="15" style={{ animation: 'floatyA 2.5s ease-in-out infinite' }}>💙</text>
        <text x="157" y="70" fontSize="16" style={{ animation: 'floatyB 3s ease-in-out 0.5s infinite' }}>👑</text>
      </>}
      {mood === 'lost' && <>
        <text x="14" y="72" fontSize="16" style={{ animation: 'floatyA 2s ease-in-out infinite' }}>❓</text>
        <text x="157" y="76" fontSize="14" style={{ animation: 'floatyB 2.6s ease-in-out 0.3s infinite' }}>💡</text>
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
    <svg width="100" height="65" viewBox="0 0 110 72" xmlns="http://www.w3.org/2000/svg">
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
// INTRO SCREEN (Fully Responsive for Phones & Tablets)
// ─────────────────────────────────────────────────────────────────────────────
const QUESTION = "Hey! 👋 Are you visiting for the first time, or coming back?";

function IntroScreen({ onSelect }: { onSelect: (mood: Mood) => void }) {
  const [blink, setBlink]               = useState(false);
  const [dropped, setDropped]           = useState(false);
  const [helicVisible, setHelicVisible] = useState(true);
  const [postStage, setPostStage]       = useState(0);

  const { displayed, done: textDone } = useTypewriter(QUESTION, 30, postStage >= 1);

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
        setTimeout(() => setPostStage(1), 1350);
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  useEffect(() => {
    if (textDone && postStage === 1) {
      const t = setTimeout(() => setPostStage(2), 250);
      return () => clearTimeout(t);
    }
  }, [textDone, postStage]);

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 bg-grid-lines flex flex-col items-center justify-between sm:justify-center px-4 py-6 sm:py-12 overflow-y-auto relative">
      {/* Ambient background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] sm:w-[650px] h-[300px] sm:h-[400px] bg-gradient-to-tr from-orange-400/20 via-purple-500/12 to-cyan-400/10 rounded-full blur-2xl pointer-events-none"/>

      {/* Top brand pill (Always clean, in-flow or top pinned) */}
      <div className="w-full flex justify-center mb-2 sm:mb-4 z-20"
        style={{ opacity: postStage >= 2 ? 1 : 0.8, transition: 'opacity 0.4s ease' }}>
        <Link href="/" className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/95 border border-slate-200/90 rounded-full shadow-sm hover:shadow transition">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center font-black text-white text-xs shadow-xs">
            S
          </div>
          <span className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight font-heading">
            Sanket<span className="text-orange-500">.ai</span>
          </span>
        </Link>
      </div>

      {/* Main Chibi Character Canvas */}
      <div className="my-auto flex flex-col items-center justify-center w-full max-w-sm z-10">
        <div
          style={{
            position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
            transform: dropped ? 'translateY(0)' : 'translateY(-110vh)',
            transition: dropped ? 'transform 0.9s cubic-bezier(0.22, 1.45, 0.36, 1)' : 'none',
          }}
        >
          {/* Helicopter */}
          <div style={{
            position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
            opacity: helicVisible ? 1 : 0, transition: 'opacity 0.35s ease',
          }}>
            <Helicopter/>
          </div>

          {/* Character */}
          <div style={{ animation: dropped ? 'floatBob 3s ease-in-out 1.2s infinite' : undefined }}>
            <Character mood={null} isPasswordFocused={false} blink={blink} className="w-[140px] sm:w-[175px] h-auto" />
          </div>

          {/* Speech bubble */}
          {postStage >= 1 && (
            <div
              className="relative mt-2 max-w-[280px] sm:max-w-xs bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-lg text-slate-800 text-center font-bold text-xs sm:text-sm tracking-tight font-heading"
              style={{ animation: 'bubblePop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
              {displayed}
              {!textDone && <span className="inline-block w-1.5 h-3.5 bg-orange-500 ml-1 animate-pulse" />}
            </div>
          )}
        </div>

        {/* 3 Action Buttons (New User, I've Been Here, I Forgot Everything) */}
        {postStage >= 2 && (
          <div className="w-full max-w-xs space-y-2.5 sm:space-y-3 mt-5 sm:mt-7 z-10" style={{ animation: 'slideUpBtn 0.35s ease forwards' }}>
            
            {/* New User Option */}
            <button
              onClick={() => onSelect('new')}
              className="w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/25 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-base sm:text-lg">⭐</span>
                <div className="text-left">
                  <div className="font-black leading-tight text-xs sm:text-sm">New User</div>
                  <div className="text-[10px] sm:text-[11px] font-normal text-orange-100 opacity-90">First time here!</div>
                </div>
              </div>
              <span className="text-white/80 font-bold text-xs">→</span>
            </button>

            {/* Returning User Option */}
            <button
              onClick={() => onSelect('returning')}
              className="w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-slate-900/20 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-base sm:text-lg">👑</span>
                <div className="text-left">
                  <div className="font-black leading-tight text-xs sm:text-sm">I&apos;ve Been Here</div>
                  <div className="text-[10px] sm:text-[11px] font-normal text-slate-400">Welcome back!</div>
                </div>
              </div>
              <span className="text-white/80 font-bold text-xs">→</span>
            </button>

            {/* Lost / Forgot Option */}
            <button
              onClick={() => onSelect('lost')}
              className="w-full py-3 sm:py-3.5 px-5 sm:px-6 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-violet-600/20 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-base sm:text-lg">😅</span>
                <div className="text-left">
                  <div className="font-black leading-tight text-xs sm:text-sm">I Forgot Everything</div>
                  <div className="text-[10px] sm:text-[11px] font-normal text-violet-200">Need some help</div>
                </div>
              </div>
              <span className="text-white/80 font-bold text-xs">→</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Back Link */}
      <div className="text-center pt-4 pb-2 z-20">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-700 font-semibold transition py-2 px-3">
          ← Back to home
        </Link>
      </div>

      <style>{`
        @keyframes floatBob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes spinBlade   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes bubblePop   { 0%{opacity:0;transform:scale(0.6)} 100%{opacity:1;transform:scale(1)} }
        @keyframes slideUpBtn  { 0%{opacity:0;transform:translateY(16px)} 100%{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN & REGISTRATION FORM (Pure Sanket AI - Mobile Responsive)
// ─────────────────────────────────────────────────────────────────────────────
const MOOD_META = {
  new: {
    badge: 'bg-orange-500 text-white', accentCls: 'from-orange-500 to-amber-400',
    btn: 'bg-orange-500 hover:bg-orange-600', btnShadow: 'shadow-orange-500/25',
    btnLabel: '🚀 Create My Account',
    greeting: "Welcome to Sanket AI! Let's get your account ready.",
    badgeLabel: '🌟 New User Registration',
  },
  returning: {
    badge: 'bg-slate-900 text-white', accentCls: 'from-slate-700 to-slate-900',
    btn: 'bg-slate-900 hover:bg-slate-800', btnShadow: 'shadow-slate-900/20',
    btnLabel: '→ Sign Me In',
    greeting: 'Welcome back! Great to see you again.',
    badgeLabel: '👑 Returning User',
  },
  lost: {
    badge: 'bg-violet-600 text-white', accentCls: 'from-violet-500 to-purple-600',
    btn: 'bg-violet-600 hover:bg-violet-700', btnShadow: 'shadow-violet-500/25',
    btnLabel: '📧 Send Password Reset Email',
    greeting: "No stress! Enter your email and we'll send a reset link.",
    badgeLabel: '😅 Password Help',
  },
};

function LoginForm({ 
  mood, 
  onBack, 
  onSwitchMood 
}: { 
  mood: Mood; 
  onBack: () => void; 
  onSwitchMood: (m: Mood) => void;
}) {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [pFocused, setPFocused] = useState(false);
  const [error, setError]       = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [blink, setBlink]       = useState(false);
  const [visible, setVisible]   = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 30); }, []);
  
  useEffect(() => {
    if (pFocused) return;
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 110); }, 3200 + Math.random() * 1500);
    return () => clearInterval(t);
  }, [pFocused]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSent(false);
    setLoading(true);

    try {
      if (mood === 'new') {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email.trim(), password, name.trim());
        router.push('/dashboard');
      } else if (mood === 'lost') {
        await sendPasswordResetEmail(auth, email.trim());
        setResetSent(true);
      } else {
        await signInWithEmail(email.trim(), password);
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Operation failed. Please verify details.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch {
      setError('Google sign-in failed. Please try again.');
    }
  };

  const cfg = mood ? MOOD_META[mood] : MOOD_META.returning;

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 bg-grid-lines flex flex-col items-center justify-center px-4 py-8 sm:py-12 overflow-y-auto relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] sm:w-[600px] h-[300px] bg-gradient-to-tr from-orange-400/18 via-purple-400/12 to-cyan-400/10 rounded-full blur-2xl pointer-events-none"/>

      <div className="flex flex-col items-center w-full max-w-sm mx-auto z-10"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-12px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>

        <span className={`mb-2 inline-flex items-center px-3.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-widest shadow-md ${cfg.badge}`}>
          {cfg.badgeLabel}
        </span>

        {/* Character with compact mobile scaling */}
        <div style={{ animation: 'floatBob2 3s ease-in-out infinite' }}>
          <Character mood={mood} isPasswordFocused={pFocused} blink={blink} className="w-[125px] sm:w-[155px] h-auto" />
        </div>

        {/* Form Card */}
        <div className="w-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl shadow-xl overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${cfg.accentCls}`}/>
          <div className="p-5 sm:p-7">
            
            {/* Brand Header */}
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center font-black text-white text-xs shadow-xs">
                  S
                </div>
                <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight font-heading">
                  Sanket<span className="text-orange-500">.ai</span>
                </span>
              </Link>
            </div>
            
            <p className="text-center text-xs text-slate-500 mb-4 font-body leading-relaxed">
              {cfg.greeting}
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500"/>
                <span>{error}</span>
              </div>
            )}

            {resetSent && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500"/>
                <span>Password reset link sent to your email!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Full Name for New User Registration */}
              {mood === 'new' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Bhushan Poojary"
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all placeholder:text-slate-400 font-body"
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all placeholder:text-slate-400 font-body"
                />
              </div>

              {/* Password */}
              {mood !== 'lost' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    {mood === 'new' ? 'Create Password' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setPFocused(true)}
                    onBlur={() => setPFocused(false)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all placeholder:text-slate-400 font-body"
                  />
                  {pFocused && (
                    <p className="mt-1 text-[10px] text-slate-400 animate-pulse">🙈 Not peeking! Your password is secure.</p>
                  )}
                </div>
              )}

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-2xl text-white font-black text-xs sm:text-sm shadow-lg ${cfg.btn} ${cfg.btnShadow} transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 cursor-pointer mt-2`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  cfg.btnLabel
                )}
              </button>
            </form>

            {/* Google Alternative */}
            {mood !== 'lost' && (
              <>
                <div className="my-3.5 flex items-center gap-3">
                  <div className="flex-1 border-t border-slate-200"/>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">or</span>
                  <div className="flex-1 border-t border-slate-200"/>
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 sm:py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-all hover:scale-[1.01] shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}

            {/* Seamless Mode Switchers */}
            <div className="mt-4 text-center space-y-1.5">
              {mood === 'new' && (
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchMood('returning')}
                    className="font-bold text-orange-500 hover:text-orange-600 transition cursor-pointer"
                  >
                    Sign in here →
                  </button>
                </p>
              )}

              {mood === 'returning' && (
                <p className="text-xs text-slate-500">
                  First time visiting?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchMood('new')}
                    className="font-bold text-orange-500 hover:text-orange-600 transition cursor-pointer"
                  >
                    Create free account →
                  </button>
                </p>
              )}

              {mood === 'lost' && (
                <p className="text-xs text-slate-500">
                  Remembered your details?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchMood('returning')}
                    className="font-bold text-violet-600 hover:text-violet-700 transition cursor-pointer"
                  >
                    Back to sign in →
                  </button>
                </p>
              )}

              <div>
                <button
                  type="button"
                  onClick={onBack}
                  className="text-xs text-slate-400 hover:text-slate-600 transition font-medium cursor-pointer"
                >
                  ← Go back to intro
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatBob2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER LOGIN PAGE CONTENT (Handles query params)
// ─────────────────────────────────────────────────────────────────────────────
function LoginPageContent({
  defaultPhase = 'intro',
  defaultMood = null,
}: {
  defaultPhase?: 'intro' | 'login';
  defaultMood?: Mood;
}) {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');

  const initialPhase: 'intro' | 'login' = modeParam ? 'login' : defaultPhase;
  const initialMood: Mood = 
    modeParam === 'new' || modeParam === 'register' ? 'new' :
    modeParam === 'lost' || modeParam === 'reset' ? 'lost' :
    modeParam === 'returning' || modeParam === 'login' ? 'returning' :
    defaultMood;

  const [phase, setPhase] = useState<'intro' | 'login'>(initialPhase);
  const [mood,  setMood]  = useState<Mood>(initialMood);

  const handleSelect = (m: Mood) => { 
    setMood(m); 
    setPhase('login'); 
  };

  if (phase === 'intro') {
    return <IntroScreen onSelect={handleSelect} />;
  }

  return (
    <LoginForm 
      mood={mood} 
      onBack={() => { 
        setPhase('intro'); 
        setMood(null); 
      }} 
      onSwitchMood={(m) => setMood(m)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage(props: {
  initialPhase?: 'intro' | 'login';
  initialMood?: Mood;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    }>
      <LoginPageContent 
        defaultPhase={props.initialPhase || 'intro'} 
        defaultMood={props.initialMood || null} 
      />
    </Suspense>
  );
}
