'use client';

import React from 'react';
import { Volume2, Hand, Mic, Video, PhoneOff, Sparkles, ShieldCheck, MessageSquareText } from 'lucide-react';

export const HeroIllustration: React.FC = () => {
  return (
    <div className="relative w-full aspect-[16/10] rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl overflow-hidden p-4 sm:p-6 flex flex-col justify-between group">
      
      {/* Background Soft Gradients */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar inside Video Call UI */}
      <div className="relative z-10 flex items-center justify-between bg-slate-950/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500" />
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-xs font-mono font-bold text-slate-300 ml-2">Sanket AI • Candidate Interview</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Live ISL Landmark AI
          </span>
        </div>
      </div>

      {/* Center 3D Interactive Candidate Video Frame */}
      <div className="relative z-10 my-auto grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        
        {/* Left Main Video Card (Candidate Signing) */}
        <div className="sm:col-span-8 relative aspect-video rounded-2xl bg-gradient-to-tr from-slate-950 via-purple-950/80 to-slate-900 border border-purple-500/30 overflow-hidden p-4 flex flex-col justify-between shadow-xl">
          
          {/* Top Badge */}
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full bg-slate-900/90 text-white font-mono text-[9px] font-bold border border-slate-700">
              CANDIDATE • ISL SIGNER
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold">
              30 FPS • 21 Landmarks
            </span>
          </div>

          {/* 3D Visual Hand Landmark Wireframe Graphic */}
          <div className="relative my-auto flex items-center justify-center">
            {/* Pulsing Avatar Silhouette */}
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-orange-500 to-purple-600 p-1 shadow-lg shadow-orange-500/20 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-3xl">
                🖐️
              </div>
            </div>

            {/* Floating Landmark Nodes */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-36 h-36 border border-cyan-400/40 rounded-full animate-ping opacity-30" />
              <span className="absolute -top-2 left-10 w-3 h-3 rounded-full bg-cyan-400 shadow-md shadow-cyan-400/50" />
              <span className="absolute top-4 right-8 w-3 h-3 rounded-full bg-orange-400 shadow-md shadow-orange-400/50" />
              <span className="absolute bottom-2 left-12 w-3 h-3 rounded-full bg-purple-400 shadow-md shadow-purple-400/50" />
              <span className="absolute bottom-6 right-14 w-3 h-3 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50" />
            </div>
          </div>

          {/* Bottom Live Subtitle Bubble inside Video */}
          <div className="bg-slate-950/90 backdrop-blur-md border border-orange-500/40 p-3 rounded-xl shadow-lg flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-orange-500 text-white shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-400 block">
                Live Speech Output
              </span>
              <p className="text-xs font-bold text-white leading-relaxed">
                &quot;Hello! I am ready to begin the technical evaluation.&quot;
              </p>
            </div>
          </div>

        </div>

        {/* Right Secondary Video Card (Interviewer / Receiver) */}
        <div className="sm:col-span-4 space-y-3">
          
          <div className="aspect-video rounded-2xl bg-slate-950 border border-slate-800 p-3 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">INTERVIEWER</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="my-auto text-center">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white mx-auto flex items-center justify-center font-bold text-lg shadow-md mb-1">
                HR
              </div>
              <span className="text-[10px] font-bold text-slate-300">Listening to Voice Output</span>
            </div>
          </div>

          {/* Landmark Accuracy Widget */}
          <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-800/60 text-white space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-purple-300">Recognition AI</span>
              <span className="text-emerald-400">98.4% Acc</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="w-[98%] h-full bg-gradient-to-r from-orange-500 via-purple-500 to-emerald-400 rounded-full" />
            </div>
          </div>

        </div>

      </div>

      {/* Floating Control Bar at Bottom of Illustration */}
      <div className="relative z-10 flex items-center justify-center gap-3 bg-slate-950/90 backdrop-blur-md p-2 rounded-full border border-slate-800 max-w-sm mx-auto">
        <div className="p-2.5 rounded-full bg-slate-800 text-white">
          <Mic className="w-4 h-4" />
        </div>
        <div className="p-2.5 rounded-full bg-orange-500 text-white shadow-md shadow-orange-500/30">
          <Hand className="w-4 h-4" />
        </div>
        <div className="p-2.5 rounded-full bg-purple-600 text-white">
          <MessageSquareText className="w-4 h-4" />
        </div>
        <div className="p-2.5 rounded-full bg-rose-500 text-white px-4 font-bold text-xs flex items-center gap-1">
          <PhoneOff className="w-3.5 h-3.5" /> End
        </div>
      </div>

    </div>
  );
};
