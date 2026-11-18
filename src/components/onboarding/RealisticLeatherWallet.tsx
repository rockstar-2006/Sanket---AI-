'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

interface RealisticLeatherWalletProps {
  onCreditsDeposited?: () => void;
  autoOpen?: boolean;
}

/**
 * RealisticLeatherWallet
 * A movie-like, physics-animated luxury leather wallet crafted with real textures,
 * perimeter orange thread stitching, metallic embossed emblem, and a 3D fold-out
 * mechanism that slides out a 24K golden holographic 100 Credits VIP Pass into the user's balance.
 */
export const RealisticLeatherWallet: React.FC<RealisticLeatherWalletProps> = ({
  onCreditsDeposited,
  autoOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cardEjected, setCardEjected] = useState(false);
  const [balanceCounter, setBalanceCounter] = useState(0);
  const [hasSparkled, setHasSparkled] = useState(false);

  // Play a soft pleasant audio chime using Web Audio API
  const playChime = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio may be blocked by autoplay policies; fail silently
    }
  };

  useEffect(() => {
    if (autoOpen) {
      const openTimer = setTimeout(() => {
        setIsOpen(true);
      }, 700);

      const ejectTimer = setTimeout(() => {
        setCardEjected(true);
        playChime();
        setHasSparkled(true);
      }, 1600);

      const countTimer = setTimeout(() => {
        let current = 0;
        const interval = setInterval(() => {
          current += 5;
          if (current >= 100) {
            current = 100;
            clearInterval(interval);
            if (onCreditsDeposited) onCreditsDeposited();
          }
          setBalanceCounter(current);
        }, 30);
      }, 2000);

      return () => {
        clearTimeout(openTimer);
        clearTimeout(ejectTimer);
        clearTimeout(countTimer);
      };
    }
  }, [autoOpen, onCreditsDeposited]);

  return (
    <div className="relative w-full max-w-md mx-auto select-none py-6 flex flex-col items-center">
      {/* 3D Perspective Stage */}
      <div
        className="relative w-80 sm:w-96 h-56 transition-transform duration-700 cursor-pointer"
        style={{ perspective: '1400px' }}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && !cardEjected) {
            setTimeout(() => setCardEjected(true), 600);
          }
        }}
      >
        {/* WALLET BASE / BACK BODY */}
        <div
          className="absolute inset-0 rounded-3xl transition-all duration-700 shadow-2xl overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, #1E293B 0%, #0F172A 70%, #020617 100%)',
            boxShadow: isOpen
              ? '0 30px 60px -12px rgba(0, 0, 0, 0.75), 0 0 40px rgba(249, 115, 22, 0.25)'
              : '0 20px 40px -10px rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Real Leather Grain Texture Overlay */}
          <div
            className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
              backgroundSize: '4px 4px',
            }}
          />

          {/* Precision Orange Thread Perimeter Stitching */}
          <div
            className="absolute inset-2.5 rounded-2xl pointer-events-none"
            style={{
              border: '2px dashed #F97316',
              opacity: 0.85,
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))',
            }}
          />

          {/* Interior Suede Pockets (Visible When Open) */}
          <div className="relative w-full h-full p-4 flex flex-col justify-between z-10">
            {/* Top Pocket Layer */}
            <div className="flex items-center justify-between px-2 pt-1 border-b border-orange-500/20 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <span className="text-[11px] font-mono font-bold tracking-wider text-orange-200">
                  SANKET VAULT
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-semibold">
                SECURE HARDWARE ENCLAVE
              </span>
            </div>

            {/* Middle Card Slots (Layered Depth) */}
            <div className="space-y-1.5 px-2">
              <div className="h-6 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-inner flex items-center px-3 justify-between">
                <span className="text-[9px] font-mono text-slate-400">ISL NEURAL TRUNK #01</span>
                <span className="text-[9px] font-mono text-emerald-400 font-bold">READY</span>
              </div>
              <div className="h-6 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-inner flex items-center px-3 justify-between">
                <span className="text-[9px] font-mono text-slate-400">VOICE RELAY CALLER ID</span>
                <span className="text-[9px] font-mono text-cyan-400 font-bold">LINKED</span>
              </div>
            </div>

            {/* Bottom Pocket Lip with Embossed Stitching */}
            <div className="relative h-14 rounded-2xl bg-gradient-to-t from-[#0B0F19] to-slate-800 border-t-2 border-orange-500/30 flex items-center px-4 justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-white font-mono">STARTER BALANCE</span>
              </div>
              <span className="text-sm font-black text-amber-400 font-mono tracking-wider">
                +{balanceCounter} CREDITS
              </span>
            </div>
          </div>
        </div>

        {/* 24K GOLD 100-CREDITS VOUCHER CARD (EJECTS OUT ON OPEN) */}
        <div
          className={`absolute left-6 right-6 h-36 rounded-2xl transition-all duration-1000 ease-out z-20 overflow-hidden shadow-2xl ${
            cardEjected ? '-top-16 scale-100' : 'top-10 scale-95 opacity-0 pointer-events-none'
          }`}
          style={{
            background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 40%, #B45309 85%, #78350F 100%)',
            boxShadow: cardEjected
              ? '0 20px 40px -8px rgba(245, 158, 11, 0.5), 0 0 25px rgba(254, 240, 138, 0.4)'
              : 'none',
            border: '1.5px solid rgba(255, 255, 255, 0.6)',
          }}
        >
          {/* Holographic Foil Shimmer */}
          <div
            className="absolute inset-0 opacity-40 mix-blend-color-dodge animate-pulse pointer-events-none"
            style={{
              background:
                'linear-gradient(45deg, transparent 20%, rgba(255,255,255,0.8) 50%, transparent 80%)',
              backgroundSize: '200% 200%',
            }}
          />

          {/* Card Content */}
          <div className="relative h-full p-4 flex flex-col justify-between text-slate-950">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-black tracking-widest uppercase text-amber-950/70 block">
                  OFFICIAL WELCOME GIFT
                </span>
                <h4 className="text-xl font-black tracking-tight text-amber-950 leading-none">
                  100 STARTER CREDITS
                </h4>
              </div>

              {/* Gold Chip */}
              <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-800/40 shadow-xs flex items-center justify-center">
                <div className="w-6 h-4 border border-amber-900/30 rounded-xs grid grid-cols-2 gap-0.5" />
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <span className="text-[9px] font-mono font-bold text-amber-950/70 block">
                  CLAIMED BY
                </span>
                <span className="text-xs font-black tracking-wider uppercase text-amber-950 font-mono">
                  NEW MEMBER ACCOUNT
                </span>
              </div>

              <div className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-200 text-[10px] font-mono font-black shadow-xs flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                VERIFIED & UNLOCKED
              </div>
            </div>
          </div>
        </div>

        {/* WALLET FRONT FLAP (OPENS WITH 3D ROTATION) */}
        <div
          className="absolute inset-0 rounded-3xl origin-bottom transition-all duration-700 z-30 overflow-hidden shadow-2xl"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #1E293B 0%, #0F172A 60%, #020617 100%)',
            transform: isOpen ? 'rotateX(-140deg)' : 'rotateX(0deg)',
            transformOrigin: 'bottom center',
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          {/* Leather Grain Texture */}
          <div
            className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
              backgroundSize: '4px 4px',
            }}
          />

          {/* Perimeter Orange Stitching */}
          <div
            className="absolute inset-2.5 rounded-2xl pointer-events-none"
            style={{
              border: '2px dashed #F97316',
              opacity: 0.85,
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))',
            }}
          />

          {/* Embossed Metallic Gold Sanket Logo Stamp */}
          <div className="relative h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 p-0.5 shadow-xl shadow-orange-500/20 mb-3 flex items-center justify-center">
              <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center">
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200">
                  S
                </span>
              </div>
            </div>

            <h3 className="text-lg font-black text-white tracking-wider font-mono">
              SANKET.AI
            </h3>
            <p className="text-[11px] font-mono text-orange-300 font-semibold tracking-widest mt-0.5">
              AUTONOMOUS TELECOM PASS
            </p>

            {/* Click to open badge */}
            <div className="mt-4 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-[10px] font-mono font-bold text-orange-200 flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Tap to Open Luxury Wallet</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Particle Sparkles when balance is unlocked */}
      {hasSparkled && (
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold animate-bounce shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>+100 Free Credits Automatically Deposited to Your Account!</span>
        </div>
      )}
    </div>
  );
};
