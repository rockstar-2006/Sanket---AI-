'use client';

import React from 'react';
import { AutocompletePrediction } from '@/lib/agents/types';
import { Sparkles, Zap, CheckCircle2, CornerDownLeft, FileText } from 'lucide-react';

interface ContextEngineBarProps {
  currentPrefix: string;
  predictions: AutocompletePrediction[];
  onSelectPrediction: (word: string) => void;
  onClearPrefix: () => void;
  onOpenContextDrawer: () => void;
  isDeafSigner: boolean;
}

export function ContextEngineBar({
  currentPrefix,
  predictions,
  onSelectPrediction,
  onClearPrefix,
  onOpenContextDrawer,
  isDeafSigner,
}: ContextEngineBarProps) {
  if (!isDeafSigner && !currentPrefix && predictions.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-4 py-2.5 shadow-2xl shadow-cyan-950/40 flex flex-wrap items-center justify-between gap-3 transition-all">
      {/* Left: Current Fingerspelled Buffer */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
          <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="font-semibold text-slate-400">Fingerspell:</span>
          <span className="font-black text-white tracking-widest text-sm">
            {currentPrefix || '—'}
          </span>
          {currentPrefix && (
            <button
              onClick={onClearPrefix}
              className="ml-1 text-slate-400 hover:text-white text-[11px] px-1 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          )}
        </div>

        <span className="text-[11px] text-slate-400 hidden sm:inline">
          {isDeafSigner
            ? 'Sign 2-3 letters → AI auto-completes technical word'
            : 'Candidate is fingerspelling live with AI copilot'}
        </span>
      </div>

      {/* Center: Top Predictions Chips */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5">
        {predictions.map((pred, i) => (
          <button
            key={i}
            onClick={() => onSelectPrediction(pred.word)}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-md active:scale-95 ${
              i === 0
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-300/50 shadow-cyan-500/30 ring-2 ring-cyan-400/20'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {i === 0 && <Sparkles className="w-3 h-3 text-cyan-200 animate-spin" />}
            <span className="font-bold">{pred.word}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              i === 0 ? 'bg-cyan-950/60 text-cyan-200' : 'bg-slate-900/60 text-slate-400'
            }`}>
              {Math.round(pred.confidence * 100)}%
            </span>
            <CornerDownLeft className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}

        {currentPrefix && predictions.length === 0 && (
          <span className="text-xs text-slate-500 italic">No matches in context trie yet...</span>
        )}
      </div>

      {/* Right: Context Drawer Trigger */}
      <button
        onClick={onOpenContextDrawer}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-800 border border-slate-800"
      >
        <FileText className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Resume Context</span>
      </button>
    </div>
  );
}
